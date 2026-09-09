use std::collections::{BTreeMap, BTreeSet};

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{diff::{Change, ChangeType}, model::{Severity, Surface}};

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ClassificationConfig {
    #[serde(default = "default_perf_threshold")]
    pub performance_regression_percent: f64,
    #[serde(default)]
    pub expected_change_ids: BTreeSet<String>,
    /// Path-prefix severity overrides, evaluated longest-prefix first.
    #[serde(default)]
    pub severity_overrides: BTreeMap<String, Severity>,
}

fn default_perf_threshold() -> f64 {
    25.0
}

impl Default for ClassificationConfig {
    fn default() -> Self {
        Self {
            performance_regression_percent: default_perf_threshold(),
            expected_change_ids: BTreeSet::new(),
            severity_overrides: BTreeMap::new(),
        }
    }
}

pub fn classify_changes(changes: &mut [Change], config: &ClassificationConfig) {
    for change in changes {
        if config.expected_change_ids.contains(&change.id) {
            change.severity = Severity::Expected;
            change.classification_reason = "change explicitly accepted as expected".to_owned();
            continue;
        }

        if let Some((_, severity)) = config
            .severity_overrides
            .iter()
            .filter(|(prefix, _)| change.path.starts_with(prefix.as_str()))
            .max_by_key(|(prefix, _)| prefix.len())
        {
            change.severity = *severity;
            change.classification_reason = "matched configured severity override".to_owned();
            continue;
        }

        let (severity, reason) = classify(change, config);
        change.severity = severity;
        change.classification_reason = reason.to_owned();
    }
}

fn classify(change: &Change, config: &ClassificationConfig) -> (Severity, &'static str) {
    match change.surface {
        Surface::Api => classify_api(change),
        Surface::Accessibility => classify_accessibility(change),
        Surface::Cli => classify_cli(change),
        Surface::Browser => classify_browser(change),
        Surface::Events => classify_events(change),
        Surface::Performance => classify_performance(change, config),
    }
}

fn classify_api(change: &Change) -> (Severity, &'static str) {
    let path = change.path.to_ascii_lowercase();
    if path.ends_with("/status") || path.ends_with("/statuscode") || path.ends_with("/status_code") {
        if let (Some(before), Some(after)) = (as_status(&change.before), as_status(&change.after)) {
            if (200..300).contains(&before) && !(200..300).contains(&after) {
                return (Severity::Breaking, "successful HTTP response became non-successful");
            }
            if before != after {
                return (Severity::Breaking, "HTTP status contract changed");
            }
        }
    }

    if path.contains("/type") && matches!(change.change_type, ChangeType::ValueChanged) {
        return (Severity::Breaking, "API response value type changed");
    }
    if matches!(change.change_type, ChangeType::ValueRemoved | ChangeType::ObservationRemoved) {
        return (Severity::Breaking, "previously observed API behavior was removed");
    }
    if matches!(change.change_type, ChangeType::ValueAdded | ChangeType::ObservationAdded) {
        return (Severity::Minor, "API behavior was added; additions are compatible by default");
    }
    (Severity::Significant, "API runtime behavior changed")
}

fn classify_accessibility(change: &Change) -> (Severity, &'static str) {
    let path = change.path.to_ascii_lowercase();
    if path.ends_with("/role") && value_text(&change.before) == Some("button") && value_text(&change.after) == Some("generic") {
        return (Severity::Breaking, "interactive semantic role regressed from button to generic");
    }
    if (path.contains("focusable") || path.contains("keyboard"))
        && change.before.as_ref().and_then(Value::as_bool) == Some(true)
        && change.after.as_ref().and_then(Value::as_bool) == Some(false)
    {
        return (Severity::Breaking, "keyboard/focus accessibility regressed");
    }
    if matches!(change.change_type, ChangeType::ObservationRemoved) {
        return (Severity::Significant, "accessibility observation disappeared");
    }
    (Severity::Significant, "accessibility semantics changed")
}

fn classify_cli(change: &Change) -> (Severity, &'static str) {
    let path = change.path.to_ascii_lowercase();
    if path.ends_with("/exitcode") || path.ends_with("/exit_code") {
        if as_i64(&change.before) == Some(0) && as_i64(&change.after).is_some_and(|code| code != 0) {
            return (Severity::Breaking, "CLI success exit code became non-zero");
        }
    }
    if matches!(change.change_type, ChangeType::ObservationRemoved) {
        return (Severity::Breaking, "previous CLI scenario disappeared");
    }
    (Severity::Significant, "CLI observable output or filesystem behavior changed")
}

fn classify_browser(change: &Change) -> (Severity, &'static str) {
    let path = change.path.to_ascii_lowercase();
    if matches!(change.change_type, ChangeType::ObservationRemoved) {
        return (Severity::Significant, "previously observed browser behavior disappeared");
    }
    if path.contains("visibletext") || path.ends_with("/text") || path.contains("copy") {
        return (Severity::Minor, "visible copy changed without a stronger deterministic signal");
    }
    if path.contains("confirmation") && change.after.as_ref().and_then(Value::as_bool) == Some(false) {
        return (Severity::Breaking, "destructive confirmation behavior was removed");
    }
    (Severity::Significant, "browser interaction or state changed")
}

fn classify_events(change: &Change) -> (Severity, &'static str) {
    if change.path.contains("order") || matches!(change.change_type, ChangeType::ArrayChanged) {
        return (Severity::Significant, "event ordering changed");
    }
    if matches!(change.change_type, ChangeType::ObservationRemoved) {
        return (Severity::Breaking, "previously emitted event behavior disappeared");
    }
    (Severity::Significant, "event/webhook behavior changed")
}

fn classify_performance(change: &Change, config: &ClassificationConfig) -> (Severity, &'static str) {
    if let (Some(before), Some(after)) = (as_f64(&change.before), as_f64(&change.after)) {
        if before > 0.0 && after > before {
            let increase = ((after - before) / before) * 100.0;
            if increase >= config.performance_regression_percent {
                return (Severity::Significant, "performance regression exceeded configured threshold");
            }
        }
    }
    (Severity::Minor, "performance changed below significant regression threshold")
}

fn as_status(value: &Option<Value>) -> Option<i64> {
    as_i64(value)
}

fn as_i64(value: &Option<Value>) -> Option<i64> {
    value.as_ref()?.as_i64()
}

fn as_f64(value: &Option<Value>) -> Option<f64> {
    value.as_ref()?.as_f64().or_else(|| value.as_ref()?.as_i64().map(|v| v as f64))
}

fn value_text(value: &Option<Value>) -> Option<&str> {
    value.as_ref()?.as_str()
}
