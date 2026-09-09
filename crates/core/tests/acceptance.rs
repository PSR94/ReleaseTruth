use std::collections::BTreeSet;

use releasetruth_core::{
    classify_changes, Change, ChangeType, ClassificationConfig, Severity, Surface,
};
use serde_json::json;

#[test]
fn accepted_change_is_expected_and_non_penalizing_input() {
    let mut changes = vec![Change {
        id: "chg-known".into(),
        surface: Surface::Browser,
        observation_id: "profile/save".into(),
        path: "/visibleText".into(),
        change_type: ChangeType::ValueChanged,
        before: Some(json!("Save Profile")),
        after: Some(json!("Save")),
        severity: Severity::Minor,
        confidence: 1.0,
        evidence: vec!["screen-profile".into()],
        classification_reason: String::new(),
    }];
    let config = ClassificationConfig {
        expected_change_ids: BTreeSet::from(["chg-known".into()]),
        ..ClassificationConfig::default()
    };
    classify_changes(&mut changes, &config);
    assert_eq!(changes[0].severity, Severity::Expected);
    assert!(changes[0].classification_reason.contains("accepted"));
}
