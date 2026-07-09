mod compat;

use std::{path::PathBuf, sync::Arc};

use anyhow::Context;
use clap::{Parser, Subcommand};
use compat::parse_flow_script;
use dotenvy::dotenv;
use serde_json::{Map, Value};
use symflow_core::{
    compiler,
    events::RunEvent,
    executor::{run_flow, RunContext},
    mem::MemoryStore,
    store::Store,
    tools,
};
use tokio::sync::broadcast;
use tracing_subscriber::EnvFilter;

#[derive(Parser)]
#[command(name = "symflow-cli", about = "Symflow headless runner")]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    Run {
        file: PathBuf,
        #[arg(long)]
        inputs: Option<String>,
        #[arg(long)]
        sandbox_dir: Option<PathBuf>,
    },
    Agents,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenv().ok();

    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));
    tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_target(true)
        .compact()
        .init();

    let cli = Cli::parse();

    match cli.command {
        Command::Agents => print_agents(),
        Command::Run {
            file,
            inputs,
            sandbox_dir,
        } => run_file(file, inputs, sandbox_dir).await,
    }
}

fn print_agents() -> anyhow::Result<()> {
    let catalog = tools::catalog();
    println!("{}", serde_json::to_string_pretty(&catalog)?);
    Ok(())
}

async fn run_file(
    file: PathBuf,
    inputs: Option<String>,
    sandbox_dir: Option<PathBuf>,
) -> anyhow::Result<()> {
    let source = tokio::fs::read_to_string(&file)
        .await
        .with_context(|| format!("failed to read {}", file.display()))?;

    let fallback_id = file.file_stem().and_then(|s| s.to_str());
    let flow =
        parse_flow_script(&source, fallback_id).map_err(|err| anyhow::anyhow!(err.to_string()))?;
    flow.validate()
        .map_err(|err| anyhow::anyhow!(err.to_string()))?;
    compiler::compile(&flow).map_err(|err| anyhow::anyhow!(err.to_string()))?;

    let initial_inputs = parse_inputs(inputs)?;
    let sandbox_dir = sandbox_dir.unwrap_or_else(default_sandbox_dir);
    tokio::fs::create_dir_all(&sandbox_dir)
        .await
        .with_context(|| format!("failed to create sandbox dir at {}", sandbox_dir.display()))?;

    let store = Arc::new(MemoryStore::new());
    let run_id = store
        .create_run(&flow.flow_id, Some(initial_inputs.clone()))
        .await
        .map_err(|err| anyhow::anyhow!(err.to_string()))?;

    let (bus, _) = broadcast::channel::<RunEvent>(512);
    let printer = tokio::spawn(print_events(bus.subscribe()));

    println!("Starting run {run_id} for flow {}", flow.display_name());
    let ctx = RunContext {
        run_id,
        sandbox_dir,
        initial_inputs,
        bus: Some(bus),
    };

    let final_status = run_flow(&flow, &ctx, store.as_ref())
        .await
        .map_err(|err| anyhow::anyhow!(err.to_string()))?;

    drop(ctx);
    let _ = printer.await;

    println!("Run {run_id} finished with status {final_status}");
    Ok(())
}

async fn print_events(mut rx: broadcast::Receiver<RunEvent>) {
    loop {
        match rx.recv().await {
            Ok(event) => print_event(&event),
            Err(broadcast::error::RecvError::Lagged(_)) => continue,
            Err(broadcast::error::RecvError::Closed) => break,
        }
    }
}

fn print_event(event: &RunEvent) {
    match event.kind {
        symflow_core::events::EventKind::Thought => {
            println!(
                "[thought] step={} iter={} {}",
                event.step_id.as_deref().unwrap_or("-"),
                event.iter.unwrap_or_default(),
                event.text.as_deref().unwrap_or_default()
            );
        }
        symflow_core::events::EventKind::Action => {
            println!(
                "[action] step={} iter={} tool={} {}",
                event.step_id.as_deref().unwrap_or("-"),
                event.iter.unwrap_or_default(),
                event.tool.as_deref().unwrap_or_default(),
                serde_json::to_string_pretty(event.arguments.as_ref().unwrap_or(&Value::Null))
                    .unwrap_or_default()
            );
        }
        symflow_core::events::EventKind::Observation => {
            println!(
                "[observation] step={} iter={} {}",
                event.step_id.as_deref().unwrap_or("-"),
                event.iter.unwrap_or_default(),
                event.text.as_deref().unwrap_or_default()
            );
        }
        symflow_core::events::EventKind::Final => {
            println!(
                "[final] step={} iter={} {}",
                event.step_id.as_deref().unwrap_or("-"),
                event.iter.unwrap_or_default(),
                event.text.as_deref().unwrap_or_default()
            );
        }
        symflow_core::events::EventKind::StepStatus
        | symflow_core::events::EventKind::RunStatus => {
            println!(
                "[status] {} {}",
                event.step_id.as_deref().unwrap_or("run"),
                event.status.as_deref().unwrap_or_default()
            );
        }
    }
}

fn parse_inputs(raw: Option<String>) -> anyhow::Result<Value> {
    match raw {
        Some(text) if !text.trim().is_empty() => {
            let parsed =
                serde_json::from_str(&text).with_context(|| "inputs must be valid JSON")?;
            Ok(parsed)
        }
        _ => Ok(Value::Object(Map::new())),
    }
}

fn default_sandbox_dir() -> PathBuf {
    std::env::current_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("data/storage_sandbox")
}
