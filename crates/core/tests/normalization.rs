use releasetruth_core::{
    fingerprint_snapshot, normalize_snapshot, BehaviorLock, NormalizationConfig, NormalizationRule,
    Observation,
};
use serde_json::json;

#[test]
fn default_volatile_values_normalize_without_reordering_meaningful_arrays() {
    let mut lock = BehaviorLock::empty("2026-09-09T20:00:00Z");
    lock.surfaces.events.push(Observation {
        id: "checkout-events".into(),
        kind: "event_sequence".into(),
        name: None,
        attributes: json!({
            "requestId": "550e8400-e29b-41d4-a716-446655440000",
            "receivedAt": "2026-09-09T20:15:12.125Z",
            "callback": "http://localhost:43127/hooks",
            "events": ["payment.completed", "invoice.generated"]
        }),
        evidence: vec![],
    });

    let normalized = normalize_snapshot(&lock, &NormalizationConfig::default()).unwrap();
    let attrs = &normalized.surfaces.events[0].attributes;
    assert_eq!(attrs["requestId"], "<UUID>");
    assert_eq!(attrs["receivedAt"], "<TIMESTAMP>");
    assert_eq!(attrs["callback"], "http://localhost:<PORT>/hooks");
    assert_eq!(
        attrs["events"],
        json!(["payment.completed", "invoice.generated"])
    );
}

#[test]
fn arrays_can_be_explicitly_sorted_when_semantically_unordered() {
    let mut lock = BehaviorLock::empty("2026-09-09T20:00:00Z");
    lock.surfaces.api.push(Observation {
        id: "GET /tags".into(),
        kind: "http_exchange".into(),
        name: None,
        attributes: json!({"tags": ["z", "a"]}),
        evidence: vec![],
    });
    let config = NormalizationConfig {
        defaults: false,
        rules: vec![NormalizationRule::SortArray {
            path: "/surfaces/api/0/attributes/tags".into(),
        }],
    };
    let normalized = normalize_snapshot(&lock, &config).unwrap();
    assert_eq!(
        normalized.surfaces.api[0].attributes["tags"],
        json!(["a", "z"])
    );
}

fn volatile_fixture(captured_at: &str, request_id: &str, callback: &str, csrf: &str, quantity: i64) -> BehaviorLock {
    let mut lock = BehaviorLock::empty(captured_at);
    lock.surfaces.api.push(Observation {
        id: "POST /checkout".into(),
        kind: "http_exchange".into(),
        name: None,
        attributes: json!({
            "requestId": request_id,
            "receivedAt": captured_at,
            "callback": callback,
            "csrf": csrf,
            "quantity": quantity
        }),
        evidence: vec![],
    });
    lock
}

#[test]
fn volatile_request_values_do_not_change_fingerprint_but_meaningful_values_do() {
    let config = NormalizationConfig {
        defaults: true,
        rules: vec![NormalizationRule::ReplaceRegex {
            pattern: r"session_[A-Za-z0-9]+".into(),
            replacement: "<SESSION_TOKEN>".into(),
            scope: Some("/surfaces".into()),
        }],
    };
    let left = volatile_fixture(
        "2026-09-09T20:15:12.125Z",
        "550e8400-e29b-41d4-a716-446655440000",
        "http://localhost:43127/hooks",
        "session_alpha123",
        2,
    );
    let right = volatile_fixture(
        "2026-09-10T03:01:02Z",
        "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
        "http://127.0.0.1:51993/hooks",
        "session_beta987",
        2,
    );
    let normalized_left = normalize_snapshot(&left, &config).unwrap();
    let normalized_right = normalize_snapshot(&right, &config).unwrap();
    assert_eq!(
        fingerprint_snapshot(&normalized_left).unwrap(),
        fingerprint_snapshot(&normalized_right).unwrap()
    );

    let meaningful_change = volatile_fixture(
        "2026-09-10T03:01:02Z",
        "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
        "http://127.0.0.1:51993/hooks",
        "session_beta987",
        3,
    );
    let normalized_meaningful = normalize_snapshot(&meaningful_change, &config).unwrap();
    assert_ne!(
        fingerprint_snapshot(&normalized_left).unwrap(),
        fingerprint_snapshot(&normalized_meaningful).unwrap()
    );
}
