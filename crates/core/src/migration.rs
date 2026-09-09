use serde_json::Value;
use thiserror::Error;

use crate::model::{BehaviorLock, BEHAVIOR_SCHEMA_V1};

pub const SUPPORTED_SCHEMA: &str = BEHAVIOR_SCHEMA_V1;

#[derive(Debug, Error)]
pub enum MigrationError {
    #[error("behavior lock is not valid JSON: {0}")]
    Json(#[from] serde_json::Error),
    #[error("behavior lock is missing the string `schema` discriminator")]
    MissingSchema,
    #[error("unsupported behavior lock schema `{found}`; this binary supports `{supported}`. Upgrade ReleaseTruth or migrate the lockfile explicitly")]
    UnsupportedSchema { found: String, supported: &'static str },
}

/// Load a behavior lock through the schema migration boundary.
///
/// v0.1 ships only v1. Keeping this dispatcher from the start prevents future callers from
/// scattering schema-version checks throughout the application.
pub fn load_behavior_lock(bytes: &[u8]) -> Result<BehaviorLock, MigrationError> {
    let value: Value = serde_json::from_slice(bytes)?;
    let schema = value
        .get("schema")
        .and_then(Value::as_str)
        .ok_or(MigrationError::MissingSchema)?;
    match schema {
        BEHAVIOR_SCHEMA_V1 => Ok(serde_json::from_value(value)?),
        other => Err(MigrationError::UnsupportedSchema {
            found: other.to_owned(),
            supported: SUPPORTED_SCHEMA,
        }),
    }
}
