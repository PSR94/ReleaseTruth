use serde::Serialize;
use serde_json::Value;
use sha2::{Digest, Sha256};

use crate::{canonical::canonical_json, model::BehaviorLock};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FingerprintPayload<'a> {
    schema: &'a str,
    surfaces: &'a crate::model::Surfaces,
    normalization: &'a Option<crate::model::NormalizationManifest>,
}

/// Compute a fingerprint from behavioral content only.
///
/// Release labels, capture time, source metadata, evidence storage paths, and the fingerprint
/// field itself are intentionally excluded so identical behavior captured in two releases hashes
/// identically.
pub fn fingerprint_snapshot(snapshot: &BehaviorLock) -> Result<String, serde_json::Error> {
    let mut stable = snapshot.clone();
    stable.surfaces.sort_by_id();
    let payload = FingerprintPayload {
        schema: &stable.schema,
        surfaces: &stable.surfaces,
        normalization: &stable.normalization,
    };
    let value: Value = serde_json::to_value(payload)?;
    let canonical = canonical_json(&value)?;
    let digest = Sha256::digest(canonical.as_bytes());
    Ok(format!("sha256:{digest:x}"))
}

pub fn verify_fingerprint(snapshot: &BehaviorLock) -> Result<bool, serde_json::Error> {
    Ok(!snapshot.fingerprint.is_empty() && snapshot.fingerprint == fingerprint_snapshot(snapshot)?)
}
