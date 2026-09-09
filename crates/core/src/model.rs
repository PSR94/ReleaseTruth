use std::collections::BTreeMap;

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const BEHAVIOR_SCHEMA_V1: &str = "releasetruth.behavior/v1";

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BehaviorLock {
    pub schema: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub release: Option<String>,
    pub captured_at: String,
    #[serde(default)]
    pub metadata: BTreeMap<String, Value>,
    #[serde(default)]
    pub surfaces: Surfaces,
    #[serde(default)]
    pub evidence: Vec<EvidenceRef>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub normalization: Option<NormalizationManifest>,
    #[serde(default)]
    pub fingerprint: String,
}

impl BehaviorLock {
    pub fn empty(captured_at: impl Into<String>) -> Self {
        Self {
            schema: BEHAVIOR_SCHEMA_V1.to_owned(),
            release: None,
            captured_at: captured_at.into(),
            metadata: BTreeMap::new(),
            surfaces: Surfaces::default(),
            evidence: Vec::new(),
            normalization: None,
            fingerprint: String::new(),
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Surfaces {
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub browser: Vec<Observation>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub api: Vec<Observation>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub cli: Vec<Observation>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub accessibility: Vec<Observation>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub events: Vec<Observation>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub performance: Vec<Observation>,
}

impl Surfaces {
    pub fn get(&self, surface: Surface) -> &[Observation] {
        match surface {
            Surface::Browser => &self.browser,
            Surface::Api => &self.api,
            Surface::Cli => &self.cli,
            Surface::Accessibility => &self.accessibility,
            Surface::Events => &self.events,
            Surface::Performance => &self.performance,
        }
    }

    pub fn get_mut(&mut self, surface: Surface) -> &mut Vec<Observation> {
        match surface {
            Surface::Browser => &mut self.browser,
            Surface::Api => &mut self.api,
            Surface::Cli => &mut self.cli,
            Surface::Accessibility => &mut self.accessibility,
            Surface::Events => &mut self.events,
            Surface::Performance => &mut self.performance,
        }
    }

    pub fn sort_by_id(&mut self) {
        for surface in Surface::ALL {
            self.get_mut(surface).sort_by(|left, right| left.id.cmp(&right.id));
        }
    }
}

#[derive(
    Debug, Clone, Copy, Serialize, Deserialize, JsonSchema, PartialEq, Eq, PartialOrd, Ord, Hash,
)]
#[serde(rename_all = "snake_case")]
pub enum Surface {
    Browser,
    Api,
    Cli,
    Accessibility,
    Events,
    Performance,
}

impl Surface {
    pub const ALL: [Surface; 6] = [
        Surface::Browser,
        Surface::Api,
        Surface::Cli,
        Surface::Accessibility,
        Surface::Events,
        Surface::Performance,
    ];

    pub const fn as_str(self) -> &'static str {
        match self {
            Surface::Browser => "browser",
            Surface::Api => "api",
            Surface::Cli => "cli",
            Surface::Accessibility => "accessibility",
            Surface::Events => "events",
            Surface::Performance => "performance",
        }
    }
}

impl std::fmt::Display for Surface {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Observation {
    /// Stable identity inside one surface, for example `POST /api/orders` or `journey:checkout/button:pay`.
    pub id: String,
    /// Adapter-owned semantic kind such as `http_exchange`, `element`, `command`, or `event_sequence`.
    pub kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    /// Structured, already-redacted evidence-derived values. Nested order remains meaningful for arrays.
    #[serde(default)]
    pub attributes: Value,
    /// Evidence catalog IDs that support this observation.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub evidence: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct EvidenceRef {
    pub id: String,
    pub kind: String,
    pub path: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub media_type: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sha256: Option<String>,
    #[serde(default)]
    pub redacted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct NormalizationManifest {
    pub rules_hash: String,
    #[serde(default)]
    pub defaults_enabled: bool,
    #[serde(default)]
    pub redactions_applied: usize,
}

#[derive(
    Debug, Clone, Copy, Serialize, Deserialize, JsonSchema, PartialEq, Eq, PartialOrd, Ord, Hash,
)]
#[serde(rename_all = "snake_case")]
pub enum Severity {
    Expected,
    Minor,
    Significant,
    Breaking,
}

impl Severity {
    pub const fn rank(self) -> u8 {
        match self {
            Severity::Expected => 0,
            Severity::Minor => 1,
            Severity::Significant => 2,
            Severity::Breaking => 3,
        }
    }
}

impl std::fmt::Display for Severity {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let text = match self {
            Severity::Expected => "expected",
            Severity::Minor => "minor",
            Severity::Significant => "significant",
            Severity::Breaking => "breaking",
        };
        f.write_str(text)
    }
}
