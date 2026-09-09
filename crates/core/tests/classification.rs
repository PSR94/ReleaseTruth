use releasetruth_core::{
    classify_changes, Change, ChangeType, ClassificationConfig, Severity, Surface,
};
use serde_json::json;

fn change(surface: Surface, path: &str, before: serde_json::Value, after: serde_json::Value) -> Change {
    Change {
        id: format!("change-{surface}-{path}"),
        surface,
        observation_id: "fixture".into(),
        path: path.into(),
        change_type: ChangeType::ValueChanged,
        before: Some(before),
        after: Some(after),
        severity: Severity::Minor,
        confidence: 1.0,
        evidence: vec![],
        classification_reason: String::new(),
    }
}

#[test]
fn deterministic_classification_covers_release_critical_regressions() {
    let mut changes = vec![
        change(Surface::Api, "/status", json!(200), json!(500)),
        change(Surface::Api, "/status", json!(400), json!(422)),
        change(Surface::Accessibility, "/controls/pay/role", json!("button"), json!("generic")),
        change(
            Surface::Accessibility,
            "/controls/pay/keyboardFocusable",
            json!(true),
            json!(false),
        ),
        change(Surface::Cli, "/exitCode", json!(0), json!(1)),
        change(Surface::Performance, "/p95Ms", json!(100.0), json!(160.0)),
    ];
    let config = ClassificationConfig {
        performance_regression_percent: 50.0,
        ..ClassificationConfig::default()
    };
    classify_changes(&mut changes, &config);

    assert_eq!(changes[0].severity, Severity::Breaking);
    assert_eq!(
        changes[0].classification_reason,
        "successful HTTP response became non-successful"
    );
    assert_eq!(changes[1].severity, Severity::Breaking);
    assert_eq!(changes[1].classification_reason, "HTTP status contract changed");
    assert_eq!(changes[2].severity, Severity::Breaking);
    assert_eq!(changes[3].severity, Severity::Breaking);
    assert_eq!(changes[4].severity, Severity::Breaking);
    assert_eq!(changes[5].severity, Severity::Significant);
}

#[test]
fn explicitly_accepted_change_becomes_expected() {
    let mut changes = vec![change(Surface::Api, "/status", json!(400), json!(422))];
    let mut config = ClassificationConfig::default();
    config.expected_change_ids.insert(changes[0].id.clone());

    classify_changes(&mut changes, &config);

    assert_eq!(changes[0].severity, Severity::Expected);
    assert_eq!(
        changes[0].classification_reason,
        "change explicitly accepted as expected"
    );
}
