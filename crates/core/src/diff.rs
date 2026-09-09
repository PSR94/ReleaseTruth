use std::collections::{BTreeMap, BTreeSet};

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};

use crate::model::{BehaviorLock, Observation, Severity, Surface};

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Comparison {
    pub base_fingerprint: String,
    pub candidate_fingerprint: String,
    pub changes: Vec<Change>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Change {
    pub id: String,
    pub surface: Surface,
    pub observation_id: String,
    pub path: String,
    pub change_type: ChangeType,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub before: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub after: Option<Value>,
    pub severity: Severity,
    pub confidence: f32,
    #[serde(default)]
    pub evidence: Vec<String>,
    pub classification_reason: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ChangeType {
    ObservationAdded,
    ObservationRemoved,
    ValueAdded,
    ValueRemoved,
    ValueChanged,
    ArrayChanged,
}

pub fn compare(base: &BehaviorLock, candidate: &BehaviorLock) -> Comparison {
    let mut changes = Vec::new();
    for surface in Surface::ALL {
        let base_map = by_id(base.surfaces.get(surface));
        let candidate_map = by_id(candidate.surfaces.get(surface));
        let ids: BTreeSet<&str> = base_map
            .keys()
            .chain(candidate_map.keys())
            .copied()
            .collect();

        for observation_id in ids {
            match (base_map.get(observation_id), candidate_map.get(observation_id)) {
                (None, Some(after)) => changes.push(make_change(
                    surface,
                    observation_id,
                    "/",
                    ChangeType::ObservationAdded,
                    None,
                    Some(serde_json::to_value(after).expect("observation is serializable")),
                    &[],
                    &after.evidence,
                )),
                (Some(before), None) => changes.push(make_change(
                    surface,
                    observation_id,
                    "/",
                    ChangeType::ObservationRemoved,
                    Some(serde_json::to_value(before).expect("observation is serializable")),
                    None,
                    &before.evidence,
                    &[],
                )),
                (Some(before), Some(after)) => diff_value(
                    surface,
                    observation_id,
                    "",
                    &before.attributes,
                    &after.attributes,
                    &before.evidence,
                    &after.evidence,
                    &mut changes,
                ),
                (None, None) => unreachable!(),
            }
        }
    }

    changes.sort_by(|left, right| left.id.cmp(&right.id));
    Comparison {
        base_fingerprint: base.fingerprint.clone(),
        candidate_fingerprint: candidate.fingerprint.clone(),
        changes,
    }
}

fn by_id(observations: &[Observation]) -> BTreeMap<&str, &Observation> {
    observations.iter().map(|item| (item.id.as_str(), item)).collect()
}

#[allow(clippy::too_many_arguments)]
fn diff_value(
    surface: Surface,
    observation_id: &str,
    path: &str,
    before: &Value,
    after: &Value,
    before_evidence: &[String],
    after_evidence: &[String],
    changes: &mut Vec<Change>,
) {
    if before == after {
        return;
    }

    match (before, after) {
        (Value::Object(left), Value::Object(right)) => {
            let keys: BTreeSet<&str> = left
                .keys()
                .chain(right.keys())
                .map(String::as_str)
                .collect();
            for key in keys {
                let child_path = format!("{}/{}", path, escape_pointer(key));
                match (left.get(key), right.get(key)) {
                    (None, Some(value)) => changes.push(make_change(
                        surface,
                        observation_id,
                        &child_path,
                        ChangeType::ValueAdded,
                        None,
                        Some(value.clone()),
                        before_evidence,
                        after_evidence,
                    )),
                    (Some(value), None) => changes.push(make_change(
                        surface,
                        observation_id,
                        &child_path,
                        ChangeType::ValueRemoved,
                        Some(value.clone()),
                        None,
                        before_evidence,
                        after_evidence,
                    )),
                    (Some(left), Some(right)) => diff_value(
                        surface,
                        observation_id,
                        &child_path,
                        left,
                        right,
                        before_evidence,
                        after_evidence,
                        changes,
                    ),
                    _ => unreachable!(),
                }
            }
        }
        (Value::Array(_), Value::Array(_)) => changes.push(make_change(
            surface,
            observation_id,
            if path.is_empty() { "/" } else { path },
            ChangeType::ArrayChanged,
            Some(before.clone()),
            Some(after.clone()),
            before_evidence,
            after_evidence,
        )),
        _ => changes.push(make_change(
            surface,
            observation_id,
            if path.is_empty() { "/" } else { path },
            ChangeType::ValueChanged,
            Some(before.clone()),
            Some(after.clone()),
            before_evidence,
            after_evidence,
        )),
    }
}

fn make_change(
    surface: Surface,
    observation_id: &str,
    path: &str,
    change_type: ChangeType,
    before: Option<Value>,
    after: Option<Value>,
    before_evidence: &[String],
    after_evidence: &[String],
) -> Change {
    let seed = format!(
        "{}|{}|{}|{:?}",
        surface.as_str(),
        observation_id,
        path,
        change_type
    );
    let digest = Sha256::digest(seed.as_bytes());
    let mut evidence: BTreeSet<String> = before_evidence.iter().cloned().collect();
    evidence.extend(after_evidence.iter().cloned());

    Change {
        id: format!("chg-{:x}", digest)[..20].to_owned(),
        surface,
        observation_id: observation_id.to_owned(),
        path: path.to_owned(),
        change_type,
        before,
        after,
        severity: Severity::Minor,
        confidence: 1.0,
        evidence: evidence.into_iter().collect(),
        classification_reason: "unclassified deterministic diff".to_owned(),
    }
}

fn escape_pointer(value: &str) -> String {
    value.replace('~', "~0").replace('/', "~1")
}
