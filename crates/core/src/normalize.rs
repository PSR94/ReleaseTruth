use regex::Regex;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use thiserror::Error;

use crate::{canonical::canonical_json, model::BehaviorLock};

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct NormalizationConfig {
    #[serde(default = "default_true")]
    pub defaults: bool,
    #[serde(default)]
    pub rules: Vec<NormalizationRule>,
}

fn default_true() -> bool {
    true
}

impl Default for NormalizationConfig {
    fn default() -> Self {
        Self {
            defaults: true,
            rules: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum NormalizationRule {
    /// Replace regex matches in every string under an optional JSON Pointer scope.
    ReplaceRegex {
        pattern: String,
        replacement: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        scope: Option<String>,
    },
    /// Remove an object property or array item addressed by JSON Pointer.
    Remove { path: String },
    /// Replace a value addressed by JSON Pointer with a stable JSON value.
    Replace { path: String, value: Value },
    /// Sort a JSON array by canonical serialized value. Use only when order is not behavior.
    SortArray { path: String },
}

#[derive(Debug, Error)]
pub enum NormalizationError {
    #[error("invalid normalization regex `{pattern}`: {source}")]
    InvalidRegex {
        pattern: String,
        #[source]
        source: regex::Error,
    },
    #[error("normalization path `{0}` is not a valid JSON Pointer")]
    InvalidPointer(String),
    #[error("normalization path `{0}` does not exist")]
    MissingPath(String),
    #[error("normalization path `{0}` must address an array")]
    ExpectedArray(String),
    #[error("failed to serialize normalized value: {0}")]
    Serialization(#[from] serde_json::Error),
}

pub fn normalize_snapshot(
    snapshot: &BehaviorLock,
    config: &NormalizationConfig,
) -> Result<BehaviorLock, NormalizationError> {
    let mut value = serde_json::to_value(snapshot)?;
    let mut effective_rules = Vec::new();
    if config.defaults {
        effective_rules.extend(default_rules());
    }
    effective_rules.extend(config.rules.clone());

    for rule in &effective_rules {
        apply_rule(&mut value, rule)?;
    }

    let mut normalized: BehaviorLock = serde_json::from_value(value)?;
    normalized.surfaces.sort_by_id();

    let rules_value = serde_json::to_value(&effective_rules)?;
    let mut hasher = Sha256::new();
    hasher.update(canonical_json(&rules_value)?.as_bytes());
    normalized.normalization = Some(crate::model::NormalizationManifest {
        rules_hash: format!("sha256:{:x}", hasher.finalize()),
        defaults_enabled: config.defaults,
        redactions_applied: 0,
    });
    normalized.fingerprint.clear();
    Ok(normalized)
}

pub fn default_rules() -> Vec<NormalizationRule> {
    vec![
        NormalizationRule::ReplaceRegex {
            pattern: r"(?i)\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b".to_owned(),
            replacement: "<UUID>".to_owned(),
            scope: Some("/surfaces".to_owned()),
        },
        NormalizationRule::ReplaceRegex {
            pattern: r"\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})\b".to_owned(),
            replacement: "<TIMESTAMP>".to_owned(),
            scope: Some("/surfaces".to_owned()),
        },
        NormalizationRule::ReplaceRegex {
            pattern: r"(https?://(?:localhost|127\.0\.0\.1|\[::1\])):\d+".to_owned(),
            replacement: "$1:<PORT>".to_owned(),
            scope: Some("/surfaces".to_owned()),
        },
        NormalizationRule::ReplaceRegex {
            pattern: r"(?:/private)?/tmp/[A-Za-z0-9._/\-]+".to_owned(),
            replacement: "<TMP_PATH>".to_owned(),
            scope: Some("/surfaces".to_owned()),
        },
    ]
}

fn apply_rule(root: &mut Value, rule: &NormalizationRule) -> Result<(), NormalizationError> {
    match rule {
        NormalizationRule::ReplaceRegex {
            pattern,
            replacement,
            scope,
        } => {
            let regex = Regex::new(pattern).map_err(|source| NormalizationError::InvalidRegex {
                pattern: pattern.clone(),
                source,
            })?;
            let target = if let Some(pointer) = scope {
                root.pointer_mut(pointer)
                    .ok_or_else(|| NormalizationError::MissingPath(pointer.clone()))?
            } else {
                root
            };
            replace_strings(target, &regex, replacement);
            Ok(())
        }
        NormalizationRule::Remove { path } => remove_pointer(root, path),
        NormalizationRule::Replace { path, value } => {
            let target = root
                .pointer_mut(path)
                .ok_or_else(|| NormalizationError::MissingPath(path.clone()))?;
            *target = value.clone();
            Ok(())
        }
        NormalizationRule::SortArray { path } => {
            let target = root
                .pointer_mut(path)
                .ok_or_else(|| NormalizationError::MissingPath(path.clone()))?;
            let array = target
                .as_array_mut()
                .ok_or_else(|| NormalizationError::ExpectedArray(path.clone()))?;
            let mut keyed: Vec<(String, Value)> = array
                .drain(..)
                .map(|item| Ok((canonical_json(&item)?, item)))
                .collect::<Result<_, NormalizationError>>()?;
            keyed.sort_by(|left, right| left.0.cmp(&right.0));
            array.extend(keyed.into_iter().map(|(_, item)| item));
            Ok(())
        }
    }
}

fn replace_strings(value: &mut Value, regex: &Regex, replacement: &str) {
    match value {
        Value::String(text) => {
            *text = regex.replace_all(text, replacement).into_owned();
        }
        Value::Array(items) => {
            for item in items {
                replace_strings(item, regex, replacement);
            }
        }
        Value::Object(map) => {
            for child in map.values_mut() {
                replace_strings(child, regex, replacement);
            }
        }
        _ => {}
    }
}

fn remove_pointer(root: &mut Value, path: &str) -> Result<(), NormalizationError> {
    if !path.starts_with('/') {
        return Err(NormalizationError::InvalidPointer(path.to_owned()));
    }
    let (parent_path, token) = path
        .rsplit_once('/')
        .ok_or_else(|| NormalizationError::InvalidPointer(path.to_owned()))?;
    let parent_path = if parent_path.is_empty() { "" } else { parent_path };
    let parent = root
        .pointer_mut(parent_path)
        .ok_or_else(|| NormalizationError::MissingPath(path.to_owned()))?;
    let token = token.replace("~1", "/").replace("~0", "~");
    match parent {
        Value::Object(map) => {
            if map.remove(&token).is_none() {
                return Err(NormalizationError::MissingPath(path.to_owned()));
            }
        }
        Value::Array(items) => {
            let index: usize = token
                .parse()
                .map_err(|_| NormalizationError::InvalidPointer(path.to_owned()))?;
            if index >= items.len() {
                return Err(NormalizationError::MissingPath(path.to_owned()));
            }
            items.remove(index);
        }
        _ => return Err(NormalizationError::InvalidPointer(path.to_owned())),
    }
    Ok(())
}
