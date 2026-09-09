use std::{fs, path::Path};

use anyhow::{Context, Result};
use releasetruth_core::{ClassificationConfig, NormalizationConfig, ScoringConfig};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    #[serde(default)]
    pub normalization: NormalizationConfig,
    #[serde(default)]
    pub classification: ClassificationConfig,
    #[serde(default)]
    pub scoring: ScoringConfig,
}

impl AppConfig {
    pub fn load(path: &Path) -> Result<Self> {
        if !path.exists() {
            return Ok(Self::default());
        }
        let bytes = fs::read(path)
            .with_context(|| format!("failed to read configuration `{}`", path.display()))?;
        serde_yaml::from_slice(&bytes)
            .with_context(|| format!("configuration `{}` is invalid YAML", path.display()))
    }
}

pub const DEFAULT_CONFIG: &str = r#"# ReleaseTruth configuration
normalization:
  defaults: true
  rules: []

classification:
  performanceRegressionPercent: 25
  expectedChangeIds: []
  severityOverrides: {}

scoring:
  penalties:
    expected: 0
    minor: 1
    significant: 7
    breaking: 20
  surfaceWeights:
    api: 1
    accessibility: 1.25
    browser: 1
    cli: 1
    events: 0.75
    performance: 0.5
"#;
