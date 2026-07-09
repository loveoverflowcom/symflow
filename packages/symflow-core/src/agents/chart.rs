//! Chart Agent: render_chart (SVG thuần Rust, ghi vào sandbox).

use crate::error::ToolError;
use crate::protocol::{Agent, Tool, ToolContext, ToolOutput};
use async_trait::async_trait;
use serde_json::{json, Value};

pub struct ChartAgent;
impl Agent for ChartAgent {
    fn id(&self) -> &str {
        "chart"
    }
    fn name(&self) -> &str {
        "Chart Agent"
    }
    fn description(&self) -> &str {
        "Tạo biểu đồ SVG (bar, line, pie) từ dữ liệu."
    }
    fn tools(&self) -> Vec<Box<dyn Tool>> {
        vec![Box::new(RenderChart)]
    }
}

pub struct RenderChart;
#[async_trait]
impl Tool for RenderChart {
    fn name(&self) -> &str {
        "render_chart"
    }
    fn description(&self) -> &str {
        "Tạo biểu đồ SVG và lưu vào sandbox."
    }
    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "filename": { "type": "string" },
                "type":     { "type": "string", "enum": ["bar","line","pie"] },
                "labels":   { "type": "array", "items": { "type": "string" } },
                "values":   { "type": "array", "items": { "type": "number" } },
                "title":    { "type": "string" }
            },
            "required": ["filename","type","labels","values"]
        })
    }
    async fn call(&self, args: Value, ctx: &ToolContext) -> Result<ToolOutput, ToolError> {
        let filename = args["filename"]
            .as_str()
            .ok_or_else(|| ToolError::InvalidArgs("thiếu 'filename'".into()))?;
        let chart_type = args["type"].as_str().unwrap_or("bar");
        let title = args["title"].as_str().unwrap_or("Chart");
        let labels: Vec<&str> = args["labels"]
            .as_array()
            .ok_or_else(|| ToolError::InvalidArgs("thiếu 'labels'".into()))?
            .iter()
            .filter_map(|v| v.as_str())
            .collect();
        let values: Vec<f64> = args["values"]
            .as_array()
            .ok_or_else(|| ToolError::InvalidArgs("thiếu 'values'".into()))?
            .iter()
            .filter_map(|v| v.as_f64())
            .collect();
        if labels.len() != values.len() {
            return Err(ToolError::InvalidArgs(
                "labels và values phải cùng độ dài".into(),
            ));
        }
        let svg = match chart_type {
            "line" => render_line(&labels, &values, title),
            "pie" => render_pie(&labels, &values, title),
            _ => render_bar(&labels, &values, title),
        };
        let path = crate::sandbox::safe_path(&ctx.sandbox_dir, filename)?;
        tokio::fs::write(&path, &svg)
            .await
            .map_err(|e| ToolError::Io(e.to_string()))?;
        Ok(ToolOutput::text(format!(
            "Đã tạo biểu đồ '{filename}' ({chart_type}, {} điểm).",
            values.len()
        )))
    }
}

fn render_bar(labels: &[&str], values: &[f64], title: &str) -> String {
    let (w, h) = (600f64, 400f64);
    let max = values.iter().cloned().fold(0.0_f64, f64::max).max(1.0);
    let bar_w = (w - 80.0) / labels.len() as f64;
    let chart_h = h - 80.0;
    let color_bar = "#6366f1";
    let color_text = "#374151";
    let color_title = "#111827";
    let bars: String = labels.iter().zip(values.iter()).enumerate().map(|(i, (lbl, &val))| {
        let x = 40.0 + i as f64 * bar_w;
        let bh = (val / max) * chart_h;
        let y  = chart_h + 20.0 - bh;
        let tx = x + bar_w / 2.0;
        let ty = chart_h + 36.0;
        format!(
            "<rect x=\"{x:.0}\" y=\"{y:.0}\" width=\"{:.0}\" height=\"{bh:.0}\" fill=\"{color_bar}\" opacity=\"0.85\"/>\n\
             <text x=\"{tx:.0}\" y=\"{ty:.0}\" text-anchor=\"middle\" font-size=\"10\" fill=\"{color_text}\">{lbl}</text>",
            bar_w - 4.0)
    }).collect::<Vec<_>>().join("\n");
    let cx = w / 2.0;
    format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{w:.0}\" height=\"{h:.0}\">\n\
         <text x=\"{cx:.0}\" y=\"18\" text-anchor=\"middle\" font-size=\"14\" font-weight=\"bold\" fill=\"{color_title}\">{title}</text>\n\
         {bars}</svg>")
}

fn render_line(labels: &[&str], values: &[f64], title: &str) -> String {
    let (w, h) = (600f64, 400f64);
    let max = values.iter().cloned().fold(0.0_f64, f64::max).max(1.0);
    let chart_h = h - 80.0;
    let step = (w - 80.0) / (labels.len().saturating_sub(1).max(1)) as f64;
    let color_title = "#111827";
    let color_stroke = "#6366f1";
    let pts: String = values
        .iter()
        .enumerate()
        .map(|(i, &v)| {
            format!(
                "{:.0},{:.0}",
                40.0 + i as f64 * step,
                chart_h + 20.0 - (v / max) * chart_h
            )
        })
        .collect::<Vec<_>>()
        .join(" ");
    let cx = w / 2.0;
    let _ = labels; // labels not displayed in this simple version
    format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{w:.0}\" height=\"{h:.0}\">\n\
         <text x=\"{cx:.0}\" y=\"18\" text-anchor=\"middle\" font-size=\"14\" font-weight=\"bold\" fill=\"{color_title}\">{title}</text>\n\
         <polyline points=\"{pts}\" fill=\"none\" stroke=\"{color_stroke}\" stroke-width=\"2.5\"/></svg>")
}

fn render_pie(labels: &[&str], values: &[f64], title: &str) -> String {
    let (w, h, cx, cy, r) = (500f64, 420f64, 200f64, 210f64, 150f64);
    let total = values.iter().sum::<f64>().max(1.0);
    let colors = [
        "#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4",
    ];
    let color_title = "#111827";
    let color_lbl = "#374151";
    let mut slices = String::new();
    let mut angle = -std::f64::consts::FRAC_PI_2;
    for (i, (&lbl, &val)) in labels.iter().zip(values.iter()).enumerate() {
        let slice = (val / total) * 2.0 * std::f64::consts::PI;
        let (x1, y1) = (cx + r * angle.cos(), cy + r * angle.sin());
        let mid = angle + slice / 2.0;
        angle += slice;
        let (x2, y2) = (cx + r * angle.cos(), cy + r * angle.sin());
        let large = if slice > std::f64::consts::PI { 1 } else { 0 };
        let color = colors[i % colors.len()];
        let (lx, ly) = (cx + (r + 22.0) * mid.cos(), cy + (r + 22.0) * mid.sin());
        slices.push_str(&format!(
            "<path d=\"M {cx:.0} {cy:.0} L {x1:.0} {y1:.0} A {r:.0} {r:.0} 0 {large} 1 {x2:.0} {y2:.0} Z\" fill=\"{color}\" opacity=\"0.9\"/>\n\
             <text x=\"{lx:.0}\" y=\"{ly:.0}\" text-anchor=\"middle\" font-size=\"10\" fill=\"{color_lbl}\">{lbl}</text>\n"));
    }
    let title_x = w / 2.0;
    format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{w:.0}\" height=\"{h:.0}\">\n\
         <text x=\"{title_x:.0}\" y=\"18\" text-anchor=\"middle\" font-size=\"14\" font-weight=\"bold\" fill=\"{color_title}\">{title}</text>\n\
         {slices}</svg>")
}
