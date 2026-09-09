use releasetruth_core::{
    score_comparison, Change, ChangeType, Comparison, ScoringConfig, Severity, Surface,
};

fn change(surface: Surface, severity: Severity, id: &str) -> Change {
    Change {
        id: id.into(),
        surface,
        observation_id: "fixture".into(),
        path: "/value".into(),
        change_type: ChangeType::ValueChanged,
        before: None,
        after: None,
        severity,
        confidence: 1.0,
        evidence: vec![],
        classification_reason: "fixture".into(),
    }
}

fn score(changes: Vec<Change>) -> releasetruth_core::ScoreBreakdown {
    score_comparison(
        &Comparison {
            base_fingerprint: "sha256:base".into(),
            candidate_fingerprint: "sha256:candidate".into(),
            changes,
        },
        &ScoringConfig::default(),
    )
}

#[test]
fn no_changes_scores_one_hundred() {
    assert_eq!(score(vec![]).score, 100.0);
}

#[test]
fn default_penalties_are_deterministic() {
    assert_eq!(score(vec![change(Surface::Api, Severity::Minor, "minor")]).score, 99.0);
    assert_eq!(
        score(vec![change(Surface::Browser, Severity::Significant, "significant")]).score,
        93.0
    );
    assert_eq!(
        score(vec![change(Surface::Accessibility, Severity::Breaking, "breaking")]).score,
        75.0
    );
    assert_eq!(
        score(vec![change(Surface::Cli, Severity::Expected, "expected")]).score,
        100.0
    );
}

#[test]
fn multiple_surface_weights_are_applied_without_ai_or_rounding_noise() {
    let breakdown = score(vec![
        change(Surface::Events, Severity::Significant, "events"),
        change(Surface::Performance, Severity::Significant, "performance"),
    ]);
    assert_eq!(breakdown.total_penalty, 8.75);
    assert_eq!(breakdown.score, 91.25);
    assert_eq!(breakdown.penalties_by_surface[&Surface::Events], 5.25);
    assert_eq!(breakdown.penalties_by_surface[&Surface::Performance], 3.5);
}
