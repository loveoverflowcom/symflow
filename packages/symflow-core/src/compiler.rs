//! DAG Compiler: build đồ thị từ Flow, toposort, phát hiện chu trình.

use crate::dsl::Flow;
use crate::error::CompileError;
use petgraph::algo::toposort;
use petgraph::graph::{DiGraph, NodeIndex};
use std::collections::HashMap;

pub struct Compiled {
    pub order: Vec<String>,
    pub levels: Vec<Vec<String>>,
}

pub fn compile(flow: &Flow) -> Result<Compiled, CompileError> {
    let mut g: DiGraph<String, ()> = DiGraph::new();
    let mut idx: HashMap<String, NodeIndex> = HashMap::new();

    for s in &flow.steps {
        if idx.contains_key(&s.id) {
            return Err(CompileError::DuplicateId(s.id.clone()));
        }
        let ni = g.add_node(s.id.clone());
        idx.insert(s.id.clone(), ni);
    }
    for s in &flow.steps {
        for dep in &s.needs {
            let from = *idx
                .get(dep)
                .ok_or_else(|| CompileError::UnknownDependency(dep.clone()))?;
            g.add_edge(from, idx[&s.id], ());
        }
    }

    let topo = toposort(&g, None).map_err(|e| CompileError::Cycle(g[e.node_id()].clone()))?;
    let order: Vec<String> = topo.iter().map(|n| g[*n].clone()).collect();

    // Tính tầng (levels) cho song song hoá.
    let mut depth: HashMap<String, usize> = HashMap::new();
    for id in &order {
        let step = flow.steps.iter().find(|s| &s.id == id).unwrap();
        let d = step
            .needs
            .iter()
            .map(|dep| depth.get(dep).copied().unwrap_or(0) + 1)
            .max()
            .unwrap_or(0);
        depth.insert(id.clone(), d);
    }
    let max_d = depth.values().copied().max().unwrap_or(0);
    let mut levels: Vec<Vec<String>> = vec![Vec::new(); max_d + 1];
    for id in &order {
        levels[depth[id]].push(id.clone());
    }

    Ok(Compiled { order, levels })
}
