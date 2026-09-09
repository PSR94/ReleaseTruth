use std::{
    fs,
    path::{Path, PathBuf},
};

use anyhow::{bail, Context, Result};
use chrono::Utc;
use releasetruth_core::{
    classify_changes, compare, load_behavior_lock, verify_fingerprint, BehaviorLock,
    ClassificationConfig,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryRecord {
    pub release: Option<String>,
    pub fingerprint: String,
    pub lock_path: PathBuf,
    pub git_sha: Option<String>,
    pub recorded_at: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryLog {
    #[serde(default)]
    pub records: Vec<HistoryRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BaselineRecord {
    pub release: Option<String>,
    pub fingerprint: String,
    pub lock_path: PathBuf,
    pub set_at: String,
}

pub fn record_capture(
    lock_path: &Path,
    history_path: &Path,
    git_sha: Option<String>,
) -> Result<HistoryRecord> {
    let lock = read_lock(lock_path)?;
    ensure_verified(&lock, lock_path)?;
    let mut history = load_history(history_path)?;
    if let Some(existing) = history
        .records
        .iter()
        .find(|record| record.fingerprint == lock.fingerprint)
    {
        return Ok(existing.clone());
    }
    let record = HistoryRecord {
        release: lock.release.clone(),
        fingerprint: lock.fingerprint.clone(),
        lock_path: lock_path.to_path_buf(),
        git_sha,
        recorded_at: Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
    };
    history.records.push(record.clone());
    write_json(history_path, &history)?;
    Ok(record)
}

pub fn set_baseline(lock_path: &Path, baseline_path: &Path) -> Result<BaselineRecord> {
    let lock = read_lock(lock_path)?;
    ensure_verified(&lock, lock_path)?;
    let record = BaselineRecord {
        release: lock.release.clone(),
        fingerprint: lock.fingerprint.clone(),
        lock_path: lock_path.to_path_buf(),
        set_at: Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
    };
    write_json(baseline_path, &record)?;
    Ok(record)
}

pub fn load_baseline(path: &Path) -> Result<BaselineRecord> {
    let bytes =
        fs::read(path).with_context(|| format!("failed to read baseline `{}`", path.display()))?;
    serde_json::from_slice(&bytes)
        .with_context(|| format!("baseline `{}` is invalid JSON", path.display()))
}

pub fn load_history(path: &Path) -> Result<HistoryLog> {
    if !path.exists() {
        return Ok(HistoryLog::default());
    }
    let bytes =
        fs::read(path).with_context(|| format!("failed to read history `{}`", path.display()))?;
    serde_json::from_slice(&bytes)
        .with_context(|| format!("history `{}` is invalid JSON", path.display()))
}

pub fn find_change_origin(
    base_path: &Path,
    history_path: &Path,
    change_id: &str,
    config: &ClassificationConfig,
) -> Result<Option<HistoryRecord>> {
    let base = read_lock(base_path)?;
    let history = load_history(history_path)?;
    for record in history.records {
        let candidate = read_lock(&record.lock_path).with_context(|| {
            format!(
                "history entry `{}` points to unreadable lock `{}`",
                record.fingerprint,
                record.lock_path.display()
            )
        })?;
        let mut comparison = compare(&base, &candidate);
        classify_changes(&mut comparison.changes, config);
        if comparison
            .changes
            .iter()
            .any(|change| change.id == change_id)
        {
            return Ok(Some(record));
        }
    }
    Ok(None)
}

pub fn first_regression(
    base_path: &Path,
    history_path: &Path,
    threshold_rank: u8,
    config: &ClassificationConfig,
) -> Result<Option<(HistoryRecord, usize)>> {
    let base = read_lock(base_path)?;
    let history = load_history(history_path)?;
    for record in history.records {
        if record.fingerprint == base.fingerprint {
            continue;
        }
        let candidate = read_lock(&record.lock_path)?;
        let mut comparison = compare(&base, &candidate);
        classify_changes(&mut comparison.changes, config);
        let count = comparison
            .changes
            .iter()
            .filter(|change| change.severity.rank() >= threshold_rank)
            .count();
        if count > 0 {
            return Ok(Some((record, count)));
        }
    }
    Ok(None)
}

fn ensure_verified(lock: &BehaviorLock, path: &Path) -> Result<()> {
    if lock.fingerprint.is_empty() {
        bail!("behavior lock `{}` has no fingerprint", path.display());
    }
    if !verify_fingerprint(lock)? {
        bail!("behavior lock `{}` fingerprint is invalid", path.display());
    }
    Ok(())
}

fn read_lock(path: &Path) -> Result<BehaviorLock> {
    let bytes = fs::read(path).with_context(|| format!("failed to read `{}`", path.display()))?;
    load_behavior_lock(&bytes).map_err(Into::into)
}

fn write_json(path: &Path, value: &impl Serialize) -> Result<()> {
    if let Some(parent) = path.parent().filter(|value| !value.as_os_str().is_empty()) {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, serde_json::to_vec_pretty(value)?)
        .with_context(|| format!("failed to write `{}`", path.display()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use releasetruth_core::{fingerprint_snapshot, BehaviorLock};

    #[test]
    fn history_defaults_empty() {
        let path = PathBuf::from("/tmp/releasetruth-history-does-not-exist.json");
        let history = load_history(&path).unwrap();
        assert!(history.records.is_empty());
    }

    #[test]
    fn baseline_serializes_expected_fields() {
        let mut lock = BehaviorLock::empty("2026-09-09T00:00:00Z");
        lock.release = Some("v1".into());
        lock.fingerprint = fingerprint_snapshot(&lock).unwrap();
        let record = BaselineRecord {
            release: lock.release.clone(),
            fingerprint: lock.fingerprint,
            lock_path: PathBuf::from("behavior.lock.json"),
            set_at: "2026-09-09T00:00:00Z".into(),
        };
        let json = serde_json::to_value(record).unwrap();
        assert_eq!(json["release"], "v1");
    }
}
