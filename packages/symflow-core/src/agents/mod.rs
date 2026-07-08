pub mod core;
pub mod pdf;
pub mod scraper;
pub mod chart;

use crate::protocol::{Agent, Registry};

pub fn default_registry() -> Registry {
    let mut r = Registry::new();
    r.register(Box::new(core::CoreAgent));
    r.register(Box::new(pdf::PdfAgent));
    r.register(Box::new(scraper::ScraperAgent));
    r.register(Box::new(chart::ChartAgent));
    r
}
