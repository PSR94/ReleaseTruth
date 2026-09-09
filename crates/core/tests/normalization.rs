use releasetruth_core::{
    normalize_snapshot, BehaviorLock, NormalizationConfig, NormalizationRule, Observation,
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
