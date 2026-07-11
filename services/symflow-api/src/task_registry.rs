use crate::error::ApiError;
use base64::Engine;
use once_cell::sync::Lazy;
use regex::Regex;
use serde::Serialize;
use serde_json::{json, Value};
use std::fs;
use std::path::Path;

static HTML_NOISE_BLOCK_RE: Lazy<Vec<Regex>> = Lazy::new(|| {
    vec![
        Regex::new(r"(?is)<script\b[^>]*>.*?</script>").expect("valid script noise regex"),
        Regex::new(r"(?is)<style\b[^>]*>.*?</style>").expect("valid style noise regex"),
        Regex::new(r"(?is)<noscript\b[^>]*>.*?</noscript>").expect("valid noscript noise regex"),
    ]
});

#[derive(Debug, Clone, Serialize)]
pub struct TaskMeta {
    pub name: &'static str,
    pub label: &'static str,
    pub description: &'static str,
    pub category: &'static str,
    pub runtime: &'static str,
    pub input_schema: Value,
    pub output_schema: Value,
}

#[derive(Default)]
pub struct BackendTaskRegistry;

impl BackendTaskRegistry {
    pub fn list(&self) -> Vec<TaskMeta> {
        vec![
            TaskMeta {
                name: "web_scraper",
                label: "Web Scraper",
                description: "Fetch a web page and extract its readable text.",
                category: "data",
                runtime: "remote",
                input_schema: json!({
                    "type": "object",
                    "properties": { "url": { "type": "string", "format": "uri" } },
                    "required": ["url"]
                }),
                output_schema: json!({
                    "type": "object",
                    "properties": {
                        "html": { "type": "string" },
                        "raw_text": { "type": "string" },
                        "url": { "type": "string" },
                        "char_count": { "type": "integer" }
                    },
                    "required": ["html", "raw_text", "url", "char_count"]
                }),
            },
            TaskMeta {
                name: "local_file_reader",
                label: "Local File Reader",
                description: "Read a UTF-8 file from the configured server sandbox.",
                category: "storage",
                runtime: "remote",
                input_schema: json!({
                    "type": "object",
                    "properties": { "path": { "type": "string" } },
                    "required": ["path"]
                }),
                output_schema: json!({
                    "type": "object",
                    "properties": {
                        "content": { "type": "string" },
                        "path": { "type": "string" },
                        "size": { "type": "integer" }
                    },
                    "required": ["content", "path", "size"]
                }),
            },
            TaskMeta {
                name: "ai_agent",
                label: "AI Agent",
                description: "Ask the configured OpenAI-compatible model to complete a goal.",
                category: "ai",
                runtime: "remote",
                input_schema: json!({
                    "type": "object",
                    "properties": {
                        "model": { "type": "string" },
                        "goal": { "type": "string" },
                        "context": {}
                    },
                    "required": ["goal"]
                }),
                output_schema: json!({
                    "type": "object",
                    "properties": { "result": { "type": "string" } },
                    "required": ["result"]
                }),
            },
            TaskMeta {
                name: "pdf_report",
                label: "PDF Report",
                description:
                    "Generate a simple PDF report from text, crawled content, or CSV rows.",
                category: "documents",
                runtime: "remote",
                input_schema: json!({
                    "type": "object",
                    "properties": {
                        "title": { "type": "string" },
                        "content": { "type": "string" },
                        "rows": { "type": "array", "items": { "type": "object" } },
                        "csv": { "type": "string" },
                        "filename": { "type": "string" }
                    },
                    "required": ["title"]
                }),
                output_schema: json!({
                    "type": "object",
                    "properties": {
                        "filename": { "type": "string" },
                        "path": { "type": "string" },
                        "size_bytes": { "type": "integer" },
                        "content_base64": { "type": "string" }
                    },
                    "required": ["filename", "path", "size_bytes", "content_base64"]
                }),
            },
        ]
    }

    pub async fn execute(
        &self,
        name: &str,
        input: Value,
        sandbox_dir: &Path,
    ) -> Result<Value, ApiError> {
        match name {
            "web_scraper" => web_scraper(input).await,
            "local_file_reader" => local_file_reader(input, sandbox_dir).await,
            "ai_agent" => ai_agent(input).await,
            "pdf_report" => pdf_report(input, sandbox_dir).await,
            _ => Err(ApiError::not_found(format!("Task '{name}' not found"))),
        }
    }
}

async fn web_scraper(input: Value) -> Result<Value, ApiError> {
    let url = required_string(&input, "url")?;
    let response = reqwest::get(&url)
        .await
        .map_err(|error| ApiError::bad_gateway(format!("Could not fetch '{url}': {error}")))?;
    if !response.status().is_success() {
        return Err(ApiError::bad_gateway(format!(
            "Could not fetch '{url}': HTTP {}",
            response.status()
        )));
    }
    let html = response
        .text()
        .await
        .map_err(|error| ApiError::bad_gateway(format!("Could not read '{url}': {error}")))?;
    let cleaned_html = strip_html_noise(&html);
    let document = scraper::Html::parse_document(&cleaned_html);
    let selector = scraper::Selector::parse("body").expect("valid body selector");
    let raw_text = document
        .select(&selector)
        .next()
        .map(|body| body.text().collect::<Vec<_>>().join(" "))
        .unwrap_or_default()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    Ok(json!({ "url": url, "html": html, "raw_text": raw_text, "char_count": raw_text.len() }))
}

async fn local_file_reader(input: Value, sandbox_dir: &Path) -> Result<Value, ApiError> {
    let path = required_string(&input, "path")?;
    let safe_path = symflow_core::sandbox::safe_path(sandbox_dir, &path)
        .map_err(|error| ApiError::bad_request(error.to_string()))?;
    let content = tokio::fs::read_to_string(&safe_path)
        .await
        .map_err(|error| ApiError::bad_request(format!("Could not read '{path}': {error}")))?;
    Ok(json!({ "path": path, "size": content.len(), "content": content }))
}

async fn ai_agent(input: Value) -> Result<Value, ApiError> {
    let goal = required_string(&input, "goal")?;
    let model = input
        .get("model")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let context = input.get("context").cloned().unwrap_or(Value::Null);
    let context = context
        .as_str()
        .map(str::to_owned)
        .unwrap_or_else(|| context.to_string());
    let messages = vec![
        symflow_core::agent::llm::msg(
            "system",
            "You are a JSON extraction engine. Return only one valid JSON object. Do not wrap it in markdown, code fences, reasoning text, or <think> tags.",
        ),
        symflow_core::agent::llm::msg(
            "user",
            format!(
                "Goal:\n{goal}\n\nContext:\n{context}\n\nReturn exactly one JSON object and nothing else."
            ),
        ),
    ];
    let result = symflow_core::agent::llm::chat_json(model, &messages)
        .await
        .map_err(|error| ApiError::bad_gateway(error.to_string()))?;
    let json_result = extract_json_payload(&result).map_err(|error| {
        ApiError::bad_gateway(format!("Could not parse AI JSON output: {error}"))
    })?;
    Ok(json!({ "result": json_result }))
}

async fn pdf_report(input: Value, sandbox_dir: &Path) -> Result<Value, ApiError> {
    let title = required_string(&input, "title")?;
    let content = input
        .get("content")
        .and_then(Value::as_str)
        .map(str::to_owned)
        .unwrap_or_default();
    let rows = input.get("rows").cloned().unwrap_or(Value::Null);
    let csv = input
        .get("csv")
        .and_then(Value::as_str)
        .map(str::to_owned)
        .unwrap_or_default();
    let filename = input
        .get("filename")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("report.pdf");

    let output_path = symflow_core::sandbox::safe_path(sandbox_dir, filename)
        .map_err(|error| ApiError::bad_request(error.to_string()))?;

    let mut report_lines = Vec::new();
    report_lines.push(format!("Generated by SymFlow"));
    report_lines.push(String::new());

    if !content.is_empty() {
        report_lines.push("Content:".to_string());
        report_lines.extend(content.lines().map(str::to_string));
        report_lines.push(String::new());
    }

    if !csv.is_empty() {
        report_lines.push("CSV Input:".to_string());
        report_lines.extend(csv.lines().map(str::to_string));
        report_lines.push(String::new());
    }

    if rows.is_array() {
        report_lines.push("Structured Rows:".to_string());
        for row in rows.as_array().unwrap_or(&vec![]) {
            report_lines.push(row.to_string());
        }
    }

    let pdf_bytes = build_simple_pdf(&title, &report_lines).map_err(|error| {
        ApiError::bad_request(format!("Could not build PDF '{filename}': {error}"))
    })?;

    fs::write(&output_path, &pdf_bytes).map_err(|error| {
        ApiError::bad_request(format!("Could not write PDF '{filename}': {error}"))
    })?;

    let metadata = fs::metadata(&output_path).map_err(|error| {
        ApiError::bad_request(format!("Could not stat PDF '{filename}': {error}"))
    })?;

    Ok(json!({
        "filename": filename,
        "path": output_path.to_string_lossy(),
        "size_bytes": metadata.len(),
        "content_base64": base64::engine::general_purpose::STANDARD.encode(pdf_bytes)
    }))
}

fn build_simple_pdf(title: &str, lines: &[String]) -> Result<Vec<u8>, anyhow::Error> {
    let content_stream = build_pdf_content(title, lines)?;
    let content_object = format!(
        "<< /Length {} >>\nstream\n{}\nendstream",
        content_stream.len(),
        content_stream
    );

    let objects = vec![
        "<< /Type /Catalog /Pages 2 0 R >>".to_string(),
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>".to_string(),
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>".to_string(),
        content_object,
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>".to_string(),
    ];

    let mut pdf = Vec::new();
    pdf.extend_from_slice(b"%PDF-1.4\n");

    let mut offsets = Vec::new();
    for (index, object) in objects.iter().enumerate() {
        offsets.push(pdf.len());
        pdf.extend_from_slice(format!("{} 0 obj\n{}\nendobj\n", index + 1, object).as_bytes());
    }

    let xref_offset = pdf.len();
    pdf.extend_from_slice(format!("xref\n0 {}\n", objects.len() + 1).as_bytes());
    pdf.extend_from_slice(b"0000000000 65535 f \n");
    for offset in offsets {
        pdf.extend_from_slice(format!("{:010} 00000 n \n", offset).as_bytes());
    }

    pdf.extend_from_slice(
        format!(
            "trailer\n<< /Size {} /Root 1 0 R >>\nstartxref\n{}\n%%EOF\n",
            objects.len() + 1,
            xref_offset
        )
        .as_bytes(),
    );

    Ok(pdf)
}

fn build_pdf_content(title: &str, lines: &[String]) -> Result<String, anyhow::Error> {
    let mut content = String::new();
    content.push_str("BT\n/F1 18 Tf\n72 760 Td\n");
    content.push_str(&format!("({}) Tj\n", escape_pdf_text(title)));
    content.push_str("ET\n");
    content.push_str("BT\n/F1 11 Tf\n72 742 Td\n");
    content.push_str(&format!("({}) Tj\n", escape_pdf_text(&"-".repeat(60))));
    content.push_str("ET\n");

    for (index, line) in lines.iter().enumerate() {
        let y = 724 - (index as i32 * 14);
        if line.is_empty() {
            continue;
        }
        content.push_str("BT\n/F1 11 Tf\n72 ");
        content.push_str(&y.to_string());
        content.push_str(" Td\n");
        content.push_str(&format!("({}) Tj\n", escape_pdf_text(line)));
        content.push_str("ET\n");
    }

    Ok(content)
}

fn escape_pdf_text(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('(', "\\(")
        .replace(')', "\\)")
}

fn required_string(input: &Value, key: &str) -> Result<String, ApiError> {
    input
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
        .ok_or_else(|| ApiError::bad_request(format!("Missing string field '{key}'")))
}

fn extract_json_payload(text: &str) -> Result<String, String> {
    let cleaned = text.replace("<think>", "").replace("</think>", "");
    let cleaned = strip_code_fences(&cleaned);
    let candidate = find_json_fragment(&cleaned).ok_or_else(|| {
        format!(
            "no JSON object found in model output; preview: {}",
            preview_text(&cleaned, 400)
        )
    })?;
    let value: Value = serde_json::from_str(candidate).map_err(|error| {
        format!(
            "{error}; candidate preview: {}",
            preview_text(candidate, 400)
        )
    })?;
    if !value.is_object() {
        return Err(format!(
            "model output must be a JSON object; preview: {}",
            preview_text(candidate, 400)
        ));
    }
    serde_json::to_string(&value).map_err(|error| error.to_string())
}

fn strip_html_noise(html: &str) -> String {
    let mut cleaned = html.to_string();
    for pattern in HTML_NOISE_BLOCK_RE.iter() {
        cleaned = pattern.replace_all(&cleaned, " ").to_string();
    }
    cleaned
}

fn preview_text(text: &str, limit: usize) -> String {
    let compact = text.split_whitespace().collect::<Vec<_>>().join(" ");
    let mut preview = String::new();
    for ch in compact.chars().take(limit) {
        preview.push(ch);
    }
    if compact.chars().count() > limit {
        preview.push_str("...");
    }
    preview
}

fn strip_code_fences(text: &str) -> String {
    let trimmed = text.trim();
    if let Some(start) = trimmed.find("```") {
        let rest = &trimmed[start + 3..];
        let rest = rest.strip_prefix("json").unwrap_or(rest).trim_start();
        if let Some(end) = rest.rfind("```") {
            return rest[..end].trim().to_string();
        }
    }
    trimmed.to_string()
}

fn find_json_fragment(text: &str) -> Option<&str> {
    let mut start = None;
    let mut stack: Vec<char> = Vec::new();
    let mut in_string = false;
    let mut escaped = false;

    for (index, ch) in text.char_indices() {
        if start.is_none() {
            if matches!(ch, '{' | '[') {
                start = Some(index);
                stack.push(ch);
            }
            continue;
        }

        if in_string {
            match ch {
                '\\' if !escaped => escaped = true,
                '"' if !escaped => in_string = false,
                _ => escaped = false,
            }
            continue;
        }

        match ch {
            '"' => in_string = true,
            '{' | '[' => stack.push(ch),
            '}' => {
                if stack.last() == Some(&'{') {
                    stack.pop();
                }
            }
            ']' => {
                if stack.last() == Some(&'[') {
                    stack.pop();
                }
            }
            _ => {}
        }

        if stack.is_empty() {
            if let Some(start_index) = start {
                return Some(&text[start_index..=index]);
            }
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::{extract_json_payload, pdf_report, strip_html_noise};
    use serde_json::Value;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dir() -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("symflow-task-registry-{nanos}"));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn extracts_json_from_think_wrapped_response() {
        let raw =
            "<think>planning</think>\n```json\n{\"title\":\"Hello\",\"summary\":\"World\"}\n```";
        let parsed = extract_json_payload(raw).expect("json payload");
        let value: Value = serde_json::from_str(&parsed).expect("parsed json");
        assert_eq!(value["title"], "Hello");
        assert_eq!(value["summary"], "World");
    }

    #[test]
    fn rejects_non_json_response() {
        let raw = "<think>oops no json here</think>";
        let error = extract_json_payload(raw).expect_err("should fail");
        assert!(error.contains("no JSON object"));
    }

    #[test]
    fn strips_script_style_and_noscript_blocks() {
        let html = r#"
            <html>
              <body>
                <article>
                  <h1>Title</h1>
                  <script>console.log("noise")</script>
                  <style>.noise { display: none; }</style>
                  <noscript>fallback noise</noscript>
                  <p>Body text</p>
                </article>
              </body>
            </html>
        "#;

        let cleaned = strip_html_noise(html);
        assert!(!cleaned.contains("console.log"));
        assert!(!cleaned.contains("fallback noise"));
        assert!(!cleaned.contains(".noise { display: none; }"));
        assert!(cleaned.contains("<h1>Title</h1>"));
        assert!(cleaned.contains("<p>Body text</p>"));
    }

    #[tokio::test]
    async fn pdf_report_writes_file_into_sandbox() {
        let sandbox_dir = temp_dir();
        let input = serde_json::json!({
            "title": "Test PDF",
            "content": "Hello world",
            "filename": "vnexpress-report.pdf"
        });

        let output = pdf_report(input, &sandbox_dir).await.expect("pdf report");

        let path = output["path"].as_str().expect("path");
        assert!(path.ends_with("vnexpress-report.pdf"));
        assert!(std::path::Path::new(path).exists());
    }
}
