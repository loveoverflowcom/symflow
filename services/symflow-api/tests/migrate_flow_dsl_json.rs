use anyhow::{Context, Result};
use serde_json::Value;
use sqlx::{postgres::PgPoolOptions, Row};
use symflow_core::dsl::Flow;

#[tokio::test]
#[ignore = "one-off PostgreSQL data migration; requires DATABASE_URL and mutates flows"]
async fn migrate_flow_dsl_json() -> Result<()> {
    dotenvy::dotenv().ok();
    let database_url =
        std::env::var("DATABASE_URL").context("DATABASE_URL is required for the migration")?;
    let pool = PgPoolOptions::new()
        .max_connections(1)
        .connect(&database_url)
        .await
        .context("connect to PostgreSQL")?;
    let mut transaction = pool.begin().await.context("begin migration transaction")?;

    let backup_table = format!(
        "flows_dsl_script_backup_{}",
        chrono::Utc::now().format("%Y%m%d%H%M%S")
    );
    sqlx::query(&format!(
        "CREATE TABLE {backup_table} AS SELECT id, dsl_script FROM flows"
    ))
    .execute(&mut *transaction)
    .await
    .context("create DSL backup table")?;

    let rows = sqlx::query("SELECT id, dsl_script FROM flows ORDER BY id")
        .fetch_all(&mut *transaction)
        .await
        .context("read stored flows")?;
    let mut converted = 0usize;

    for row in rows {
        let id: String = row.try_get("id")?;
        let source: String = row.try_get("dsl_script")?;
        let flow = parse_stored_flow(&id, &source)
            .with_context(|| format!("parse DSL for flow '{id}'"))?;
        let normalized = serde_json::to_string_pretty(&flow)
            .with_context(|| format!("serialize flow '{id}'"))?;

        sqlx::query("UPDATE flows SET dsl_script = $1 WHERE id = $2")
            .bind(normalized)
            .bind(&id)
            .execute(&mut *transaction)
            .await
            .with_context(|| format!("update flow '{id}'"))?;
        converted += 1;
    }

    transaction.commit().await.context("commit migration")?;
    println!("Converted {converted} flow(s) to JSON.");
    println!("Backup table: {backup_table}");
    Ok(())
}

fn parse_stored_flow(id: &str, source: &str) -> Result<Flow> {
    if let Ok(flow) = symflow_core::dsl::parse_json(source) {
        return Ok(flow);
    }

    let mut value = match serde_json::from_str::<Value>(source) {
        Ok(value) => value,
        Err(_) => symflow_core::dsl::parse_yaml_value(source)?,
    };
    let object = value
        .as_object_mut()
        .context("flow DSL must be an object")?;
    object
        .entry("flow_id")
        .or_insert_with(|| Value::String(id.to_string()));
    Ok(serde_json::from_value(value)?)
}

#[test]
fn stored_json_is_preserved_as_a_flow() {
    let flow = parse_stored_flow(
        "database-id",
        r#"{
          "flow_id": "json-flow",
          "steps": [{"id": "start", "type": "manual_trigger"}]
        }"#,
    )
    .expect("stored JSON flow");

    assert_eq!(flow.flow_id, "json-flow");
}

#[test]
fn legacy_yaml_without_flow_id_uses_database_id() {
    let flow = parse_stored_flow(
        "legacy-flow",
        "name: Legacy\nsteps:\n  - id: start\n    type: manual_trigger\n",
    )
    .expect("legacy YAML flow");

    assert_eq!(flow.flow_id, "legacy-flow");
    assert_eq!(flow.steps[0].kind, "manual_trigger");
}
