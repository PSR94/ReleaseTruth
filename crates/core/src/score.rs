use std::collections::BTreeMap;

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use crate::{diff::Comparison, model::{Severity, Surface}};

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ScoringConfig {
    #[serde(default = "default_penalties")]
    pub penalties: BTreeMap<Severity, f64>,
    #[serde(default = "default_surface_weights")]
    pub surface_weights: BTreeMap<Surface, f64>,
}

impl Default for ScoringConfig {
    fn default() -> Self {
        Self {
            penalties: default_penalties(),
            surface_weights: default_surface_weights(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ScoreBreakdown {
    pub score: f64,
    pub total_penalty: f64,
    pub penalties_by_severity: BTreeMap<Severity, f64>,
    pub penalties_by_surface: BTreeMap<Surface, f64>,
    pub counts_by_severity: BTreeMap<Severity, usize>,
}

pub fn score_comparison(comparison: &Comparison, config: &ScoringConfig) -> ScoreBreakdown {
    let mut total_penalty = 0.0;
    let mut penalties_by_severity = BTreeMap::new();
    let mut penalties_by_surface = BTreeMap::new();
    let mut counts_by_severity = BTreeMap::new();

    for change in &comparison.changes {
        let base_penalty = config.penalties.get(&change.severity).copied().unwrap_or(0.0);
        let surface_weight = config
            .surface_weights
            .get(&change.surface)
            .copied()
            .unwrap_or(1.0);
        let penalty = base_penalty * surface_weight;
        total_penalty += penalty;
        *penalties_by_severity.entry(change.severity).or_insert(0.0) += penalty;
        *penalties_by_surface.entry(change.surface).or_insert(0.0) += penalty;
        *counts_by_severity.entry(change.severity).or_insert(0) += 1;
    }

    ScoreBreakdown {
        score: (100.0 - total_penalty).clamp(0.0, 100.0),
        total_penalty,
        penalties_by_severity,
        penalties_by_surface,
        counts_by_severity,
    }
}

fn default_penalties() -> BTreeMap<Severity, f64> {
    BTreeMap::from([
        (Severity::Expected, 0.0),
        (Severity::Minor, 1.0),
        (Severity::Significant, 7.0),
        (Severity::Breaking, 20.0),
    ])
}

fn default_surface_weights() -> BTreeMap<Surface, f64> {
    BTreeMap::from([
        (Surface::Api, 1.0),
        (Surface::Accessibility, 1.25),
        (Surface::Browser, 1.0),
        (Surface::Cli, 1.0),
        (Surface::Events, 0.75),
        (Surface::Performance, 0.5),
    ])
}
