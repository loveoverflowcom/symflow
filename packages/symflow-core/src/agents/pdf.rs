//! PDF Agent: pdf_extract_text, pdf_metadata, pdf_search.

use crate::error::ToolError;
use crate::protocol::{Agent, Tool, ToolContext, ToolOutput};
use async_trait::async_trait;
use lopdf::Document;
use serde_json::{json, Value};

pub struct PdfAgent;
impl Agent for PdfAgent {
    fn id(&self) -> &str {
        "pdf"
    }
    fn name(&self) -> &str {
        "PDF Agent"
    }
    fn description(&self) -> &str {
        "Trích xuất và tìm kiếm nội dung trong file PDF."
    }
    fn tools(&self) -> Vec<Box<dyn Tool>> {
        vec![
            Box::new(PdfExtractText),
            Box::new(PdfMetadata),
            Box::new(PdfSearch),
        ]
    }
}

fn load_pdf(ctx: &ToolContext, filename: &str) -> Result<Document, ToolError> {
    let path = crate::sandbox::safe_path(&ctx.sandbox_dir, filename)?;
    Document::load(&path).map_err(|e| ToolError::Io(e.to_string()))
}

fn all_text(doc: &Document) -> String {
    doc.get_pages()
        .keys()
        .copied()
        .filter_map(|page_number| doc.extract_text(&[page_number]).ok())
        .collect::<Vec<_>>()
        .join("\n")
}

pub struct PdfExtractText;
#[async_trait]
impl Tool for PdfExtractText {
    fn name(&self) -> &str {
        "pdf_extract_text"
    }
    fn description(&self) -> &str {
        "Trích xuất toàn bộ text từ file PDF trong sandbox."
    }
    fn input_schema(&self) -> Value {
        json!({ "type": "object", "properties": { "filename": { "type": "string" } }, "required": ["filename"] })
    }
    async fn call(&self, args: Value, ctx: &ToolContext) -> Result<ToolOutput, ToolError> {
        let filename = args["filename"]
            .as_str()
            .ok_or_else(|| ToolError::InvalidArgs("thiếu 'filename'".into()))?
            .to_string();
        let ctx2 = ctx.clone();
        let doc = tokio::task::spawn_blocking(move || load_pdf(&ctx2, &filename))
            .await
            .map_err(|e| ToolError::Io(e.to_string()))??;
        Ok(ToolOutput::text(all_text(&doc)))
    }
}

pub struct PdfMetadata;
#[async_trait]
impl Tool for PdfMetadata {
    fn name(&self) -> &str {
        "pdf_metadata"
    }
    fn description(&self) -> &str {
        "Lấy metadata (số trang) từ PDF."
    }
    fn input_schema(&self) -> Value {
        json!({ "type": "object", "properties": { "filename": { "type": "string" } }, "required": ["filename"] })
    }
    async fn call(&self, args: Value, ctx: &ToolContext) -> Result<ToolOutput, ToolError> {
        let filename = args["filename"]
            .as_str()
            .ok_or_else(|| ToolError::InvalidArgs("thiếu 'filename'".into()))?
            .to_string();
        let ctx2 = ctx.clone();
        let doc = tokio::task::spawn_blocking(move || load_pdf(&ctx2, &filename))
            .await
            .map_err(|e| ToolError::Io(e.to_string()))??;
        Ok(ToolOutput::text(format!("pages={}", doc.get_pages().len())))
    }
}

pub struct PdfSearch;
#[async_trait]
impl Tool for PdfSearch {
    fn name(&self) -> &str {
        "pdf_search"
    }
    fn description(&self) -> &str {
        "Tìm kiếm từ khoá trong PDF."
    }
    fn input_schema(&self) -> Value {
        json!({ "type": "object", "properties": { "filename": { "type": "string" }, "keyword": { "type": "string" } }, "required": ["filename","keyword"] })
    }
    async fn call(&self, args: Value, ctx: &ToolContext) -> Result<ToolOutput, ToolError> {
        let filename = args["filename"]
            .as_str()
            .ok_or_else(|| ToolError::InvalidArgs("thiếu 'filename'".into()))?
            .to_string();
        let keyword = args["keyword"]
            .as_str()
            .ok_or_else(|| ToolError::InvalidArgs("thiếu 'keyword'".into()))?
            .to_lowercase();
        let ctx2 = ctx.clone();
        let doc = tokio::task::spawn_blocking(move || load_pdf(&ctx2, &filename))
            .await
            .map_err(|e| ToolError::Io(e.to_string()))??;
        let text = all_text(&doc);
        let matches: Vec<&str> = text
            .lines()
            .filter(|l| l.to_lowercase().contains(&keyword))
            .take(20)
            .collect();
        if matches.is_empty() {
            Ok(ToolOutput::text(format!(
                "Không tìm thấy '{keyword}' trong PDF."
            )))
        } else {
            Ok(ToolOutput::text(matches.join("\n")))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use lopdf::content::{Content, Operation};
    use lopdf::{dictionary, Document, Object, Stream};
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dir() -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("symflow-pdf-test-{nanos}"));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn write_sample_pdf(path: &Path) {
        let mut doc = Document::with_version("1.5");
        let info_id = doc.add_object(dictionary! {
            "Title" => Object::string_literal("Sample PDF"),
            "Creator" => Object::string_literal("symflow-test"),
        });
        let pages_id = doc.new_object_id();
        let font_id = doc.add_object(dictionary! {
            "Type" => "Font",
            "Subtype" => "Type1",
            "BaseFont" => "Courier",
        });
        let resources_id = doc.add_object(dictionary! {
            "Font" => dictionary! {
                "F1" => font_id,
            },
        });
        let content = Content {
            operations: vec![
                Operation::new("BT", vec![]),
                Operation::new("Tf", vec!["F1".into(), 48.into()]),
                Operation::new("Td", vec![100.into(), 600.into()]),
                Operation::new("Tj", vec![Object::string_literal("Hello world from PDF")]),
                Operation::new("ET", vec![]),
            ],
        };
        let content_id = doc.add_object(Stream::new(dictionary! {}, content.encode().unwrap()));
        let page_id = doc.add_object(dictionary! {
            "Type" => "Page",
            "Parent" => Object::Reference(pages_id),
            "Contents" => Object::Reference(content_id),
        });
        let pages = dictionary! {
            "Type" => "Pages",
            "Kids" => vec![Object::Reference(page_id)],
            "Count" => 1,
            "Resources" => Object::Reference(resources_id),
            "MediaBox" => vec![0.into(), 0.into(), 595.into(), 842.into()],
        };
        doc.objects.insert(pages_id, Object::Dictionary(pages));
        let catalog_id = doc.add_object(dictionary! {
            "Type" => "Catalog",
            "Pages" => Object::Reference(pages_id),
        });
        doc.trailer.set("Root", catalog_id);
        doc.trailer.set("Info", info_id);
        doc.compress();
        doc.save(path).unwrap();
    }

    #[tokio::test]
    async fn pdf_tools_can_read_sample_pdf() {
        let sandbox_dir = temp_dir();
        let pdf_path = sandbox_dir.join("sample.pdf");
        write_sample_pdf(&pdf_path);

        let ctx = ToolContext {
            sandbox_dir: sandbox_dir.clone(),
        };

        let text = PdfExtractText
            .call(json!({ "filename": "sample.pdf" }), &ctx)
            .await
            .unwrap();
        assert!(text.to_text().contains("Hello world from PDF"));

        let metadata = PdfMetadata
            .call(json!({ "filename": "sample.pdf" }), &ctx)
            .await
            .unwrap();
        assert!(metadata.to_text().contains("pages=1"));

        let search = PdfSearch
            .call(
                json!({ "filename": "sample.pdf", "keyword": "world" }),
                &ctx,
            )
            .await
            .unwrap();
        assert!(search.to_text().contains("Hello world from PDF"));

        let _ = fs::remove_dir_all(sandbox_dir);
    }
}
