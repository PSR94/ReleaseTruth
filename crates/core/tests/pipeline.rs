use releasetruth_core::{
    classify_changes, compare, fingerprint_snapshot, normalize_snapshot, score_comparison,
    BehaviorLock, ClassificationConfig, NormalizationConfig, Observation, ScoringConfig, Severity,
};
use serde_json::json;

fn snapshot(release: &str, api_status: i64, cli_exit: i64, role: &str, p95: f64) -> BehaviorLock {
    let mut lock = BehaviorLock::empty("2026-09-09T20:00:00Z");
    lock.release = Some(release.to_owned());
    lock.surfaces.api.push(Observation {
        id: "POST /api/orders".into(),
        kind: "http_exchange".into(),
        name: None,
        attributes: json!({"status": api_status, "body": {"error": "bad quantity"}}),
        evidence: vec!["http-orders".into()],
    });
    lock.surfaces.cli.push(Observation {
        id: "truthshop receipt".into(),
        kind: "command".into(),
        name: None,
        attributes: json!({"exitCode": cli_exit, "stdout": "created receipt"}),
        evidence: vec!["cli-receipt".into()],
    });
    lock.surfaces.accessibility.push(Observation {
        id: "checkout/pay".into(),
        kind: "element".into(),
        name: Some("Pay now".into()),
        attributes: json!({"role": role, "keyboardFocusable": role == "button"}),
        evidence: vec!["a11y-checkout".into()],
    });
    lock.surfaces.performance.push(Observation {
        id: "GET /api/search".into(),
        kind: "http_timing".into(),
        name: None,
        attributes: json!({"p95Ms": p95}),
        evidence: vec!["perf-search".into()],
    });
    lock
}

#[test]
fn end_to_end_pipeline_classifies_known_regressions() {
    let mut base = normalize_snapshot(&snapshot("v1-good", 400, 0, "button", 281.0), &NormalizationConfig::default()).unwrap();
    base.fingerprint = fingerprint_snapshot(&base).unwrap();
    let mut candidate = normalize_snapshot(&snapshot("v2-regression", 422, 1, "generic", 472.0), &NormalizationConfig::default()).unwrap();
    candidate.fingerprint = fingerprint_snapshot(&candidate).unwrap();

    let mut comparison = compare(&base, &candidate);
    classify_changes(&mut comparison.changes, &ClassificationConfig::default());
    let score = score_comparison(&comparison, &ScoringConfig::default());

    assert!(comparison.changes.iter().any(|change| {
        change.surface.to_string() == "api"
            && change.path == "/status"
            && change.severity == Severity::Breaking
    }));
    assert!(comparison.changes.iter().any(|change| {
        change.surface.to_string() == "cli"
            && change.path == "/exitCode"
            && change.severity == Severity::Breaking
    }));
    assert!(comparison.changes.iter().any(|change| {
        change.surface.to_string() == "accessibility"
            && change.path == "/role"
            && change.severity == Severity::Breaking
    }));
    assert!(comparison.changes.iter().any(|change| {
        change.surface.to_string() == "performance"
            && change.path == "/p95Ms"
            && change.severity == Severity::Significant
    }));
    assert!(score.score < 100.0);
}

#[test]
fn fingerprints_ignore_release_and_capture_time() {
    let mut left = normalize_snapshot(&snapshot("1.0.0", 200, 0, "button", 100.0), &NormalizationConfig::default()).unwrap();
    let mut right = left.clone();
    right.release = Some("1.0.1".into());
    right.captured_at = "2030-01-01T00:00:00Z".into();
    left.fingerprint.clear();
    right.fingerprint.clear();
    assert_eq!(fingerprint_snapshot(&left).unwrap(), fingerprint_snapshot(&right).unwrap());
}
