use std::collections::BTreeMap;

use anyhow::Result;
use clap::ValueEnum;
use releasetruth_core::{Comparison, ScoreBreakdown, Severity};
use serde::Serialize;
use serde_json::json;

#[derive(Debug, Clone, Copy, ValueEnum)]
pub enum ReportFormat {
    Text,
    Json,
    Markdown,
    Junit,
    Sarif,
    Html,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ComparisonReport<'a> {
    pub score: &'a ScoreBreakdown,
    pub comparison: &'a Comparison,
}

pub fn render(
    format: ReportFormat,
    comparison: &Comparison,
    score: &ScoreBreakdown,
) -> Result<String> {
    Ok(match format {
        ReportFormat::Text => render_text(comparison, score),
        ReportFormat::Json => {
            serde_json::to_string_pretty(&ComparisonReport { score, comparison })?
        }
        ReportFormat::Markdown => render_markdown(comparison, score),
        ReportFormat::Junit => render_junit(comparison),
        ReportFormat::Sarif => serde_json::to_string_pretty(&render_sarif(comparison, score))?,
        ReportFormat::Html => render_html(comparison, score),
    })
}

fn counts(score: &ScoreBreakdown) -> BTreeMap<Severity, usize> {
    let mut result = BTreeMap::new();
    for severity in [
        Severity::Breaking,
        Severity::Significant,
        Severity::Minor,
        Severity::Expected,
    ] {
        result.insert(
            severity,
            *score.counts_by_severity.get(&severity).unwrap_or(&0),
        );
    }
    result
}

fn render_text(comparison: &Comparison, score: &ScoreBreakdown) -> String {
    let counts = counts(score);
    let mut out = format!(
        "ReleaseTruth Behavioral Diff\n\nCompatibility Score: {:.0} / 100\nObservable changes: {}\nBreaking: {}\nSignificant: {}\nMinor: {}\nExpected: {}\n",
        score.score,
        comparison.changes.len(),
        counts[&Severity::Breaking],
        counts[&Severity::Significant],
        counts[&Severity::Minor],
        counts[&Severity::Expected]
    );
    for change in &comparison.changes {
        out.push_str(&format!(
            "\n[{}] {} {}{}\n  {}\n  before: {}\n  after:  {}\n",
            change.severity,
            change.surface,
            change.observation_id,
            change.path,
            change.classification_reason,
            compact(&change.before),
            compact(&change.after),
        ));
    }
    out
}

fn render_markdown(comparison: &Comparison, score: &ScoreBreakdown) -> String {
    let counts = counts(score);
    let mut out = format!(
        "# ReleaseTruth Behavioral Compatibility\n\n**Score: {:.0}/100** · {} breaking · {} significant · {} minor · {} expected\n\n",
        score.score,
        counts[&Severity::Breaking],
        counts[&Severity::Significant],
        counts[&Severity::Minor],
        counts[&Severity::Expected]
    );
    out.push_str(
        "| Severity | Surface | Behavior | Path | Reason |\n| --- | --- | --- | --- | --- |\n",
    );
    for change in &comparison.changes {
        out.push_str(&format!(
            "| {} | {} | `{}` | `{}` | {} |\n",
            change.severity,
            change.surface,
            md(&change.observation_id),
            md(&change.path),
            md(&change.classification_reason)
        ));
    }
    out
}

fn render_junit(comparison: &Comparison) -> String {
    let failures = comparison
        .changes
        .iter()
        .filter(|change| change.severity == Severity::Breaking)
        .count();
    let mut out = format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<testsuite name=\"ReleaseTruth behavioral compatibility\" tests=\"{}\" failures=\"{}\">\n",
        comparison.changes.len(), failures
    );
    for change in &comparison.changes {
        out.push_str(&format!(
            "  <testcase classname=\"{}\" name=\"{} {}\">",
            xml(change.surface.as_str()),
            xml(&change.observation_id),
            xml(&change.path)
        ));
        if change.severity == Severity::Breaking {
            out.push_str(&format!(
                "<failure message=\"{}\">before={} after={}</failure>",
                xml(&change.classification_reason),
                xml(&compact(&change.before)),
                xml(&compact(&change.after))
            ));
        } else if change.severity == Severity::Expected {
            out.push_str("<skipped message=\"accepted expected change\" />");
        }
        out.push_str("</testcase>\n");
    }
    out.push_str("</testsuite>\n");
    out
}

fn render_sarif(comparison: &Comparison, score: &ScoreBreakdown) -> serde_json::Value {
    let results: Vec<_> = comparison
        .changes
        .iter()
        .filter(|change| change.severity != Severity::Expected)
        .map(|change| {
            let level = match change.severity {
                Severity::Breaking => "error",
                Severity::Significant => "warning",
                Severity::Minor => "note",
                Severity::Expected => "none",
            };
            json!({
                "ruleId": format!("releasetruth/{}/{}", change.surface, change.change_type_name()),
                "level": level,
                "message": {"text": format!("{}: {} {}{}", change.classification_reason, change.surface, change.observation_id, change.path)},
                "properties": {"changeId": change.id, "severity": change.severity.to_string()}
            })
        })
        .collect();
    json!({
        "$schema": "https://json.schemastore.org/sarif-2.1.0.json",
        "version": "2.1.0",
        "runs": [{
            "tool": {"driver": {"name": "ReleaseTruth", "version": env!("CARGO_PKG_VERSION"), "informationUri": "https://github.com/PSR94/ReleaseTruth", "rules": []}},
            "results": results,
            "properties": {"compatibilityScore": score.score}
        }]
    })
}

trait ChangeName {
    fn change_type_name(&self) -> &'static str;
}

impl ChangeName for releasetruth_core::Change {
    fn change_type_name(&self) -> &'static str {
        use releasetruth_core::ChangeType;
        match self.change_type {
            ChangeType::ObservationAdded => "observation-added",
            ChangeType::ObservationRemoved => "observation-removed",
            ChangeType::ValueAdded => "value-added",
            ChangeType::ValueRemoved => "value-removed",
            ChangeType::ValueChanged => "value-changed",
            ChangeType::ArrayChanged => "array-changed",
        }
    }
}

fn render_html(comparison: &Comparison, score: &ScoreBreakdown) -> String {
    let counts = counts(score);
    let rows: String = comparison
        .changes
        .iter()
        .map(|change| format!(
            "<article class=\"change sev-{}\"><header><span class=\"badge\">{}</span><strong>{} · {}</strong><code>{}</code></header><p>{}</p><div class=\"values\"><pre><b>Before</b>\n{}</pre><pre><b>After</b>\n{}</pre></div><small>Evidence: {}</small></article>",
            change.severity,
            change.severity,
            html(change.surface.as_str()),
            html(&change.observation_id),
            html(&change.path),
            html(&change.classification_reason),
            html(&pretty(&change.before)),
            html(&pretty(&change.after)),
            html(&change.evidence.join(", "))
        ))
        .collect();
    format!(
        r#"<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ReleaseTruth Behavioral Diff</title><style>
:root{{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color-scheme:light dark;--bg:#0b1020;--panel:#121a2f;--text:#eef3ff;--muted:#97a3bd;--line:#29334b;--danger:#ff6b79;--warn:#ffc866;--minor:#79b8ff;--ok:#61d6a0}}*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--text)}}main{{max-width:1120px;margin:auto;padding:48px 24px 80px}}h1{{font-size:38px;margin:0 0 8px}}.lede{{color:var(--muted)}}.score{{display:grid;grid-template-columns:180px 1fr;gap:24px;align-items:center;background:linear-gradient(135deg,#17213b,#10172a);border:1px solid var(--line);border-radius:18px;padding:24px;margin:28px 0}}.score strong{{font-size:54px}}.stats{{display:grid;grid-template-columns:repeat(4,minmax(90px,1fr));gap:10px}}.stat{{border-left:2px solid var(--line);padding-left:12px}}.stat b{{display:block;font-size:22px}}.change{{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px;margin:12px 0}}.change header{{display:flex;gap:10px;align-items:center;flex-wrap:wrap}}.change code{{color:var(--muted)}}.badge{{font-size:12px;text-transform:uppercase;letter-spacing:.08em;border:1px solid currentColor;border-radius:999px;padding:4px 8px}}.sev-breaking .badge{{color:var(--danger)}}.sev-significant .badge{{color:var(--warn)}}.sev-minor .badge{{color:var(--minor)}}.sev-expected .badge{{color:var(--ok)}}.values{{display:grid;grid-template-columns:1fr 1fr;gap:12px}}pre{{white-space:pre-wrap;overflow-wrap:anywhere;background:#090e1c;border-radius:10px;padding:14px;color:#dce6ff}}small{{color:var(--muted)}}@media(max-width:700px){{.score,.values{{grid-template-columns:1fr}}.stats{{grid-template-columns:1fr 1fr}}}}
</style></head><body><main><h1>ReleaseTruth Behavioral Diff</h1><p class="lede">Evidence-backed comparison of externally observable release behavior.</p><section class="score"><strong>{:.0}<small>/100</small></strong><div class="stats"><div class="stat"><b>{}</b>breaking</div><div class="stat"><b>{}</b>significant</div><div class="stat"><b>{}</b>minor</div><div class="stat"><b>{}</b>expected</div></div></section>{}</main></body></html>"#,
        score.score,
        counts[&Severity::Breaking],
        counts[&Severity::Significant],
        counts[&Severity::Minor],
        counts[&Severity::Expected],
        rows
    )
}

fn compact(value: &Option<serde_json::Value>) -> String {
    value
        .as_ref()
        .map_or_else(|| "∅".to_owned(), |value| value.to_string())
}

fn pretty(value: &Option<serde_json::Value>) -> String {
    value.as_ref().map_or_else(
        || "∅".to_owned(),
        |value| serde_json::to_string_pretty(value).unwrap_or_else(|_| value.to_string()),
    )
}

fn md(value: &str) -> String {
    value.replace('|', "\\|").replace('`', "\\`")
}
fn xml(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}
fn html(value: &str) -> String {
    xml(value)
}

#[cfg(test)]
mod tests {
    use super::*;
    use releasetruth_core::{Change, ChangeType, Comparison, ScoreBreakdown, Severity, Surface};
    use serde_json::json;

    fn fixture() -> (Comparison, ScoreBreakdown) {
        let comparison = Comparison {
            base_fingerprint: "sha256:base".into(),
            candidate_fingerprint: "sha256:candidate".into(),
            changes: vec![Change {
                id: "chg-1".into(),
                surface: Surface::Api,
                observation_id: "POST /orders".into(),
                path: "/status".into(),
                change_type: ChangeType::ValueChanged,
                before: Some(json!(400)),
                after: Some(json!(422)),
                severity: Severity::Breaking,
                confidence: 1.0,
                evidence: vec!["http-1".into()],
                classification_reason: "HTTP status contract changed".into(),
            }],
        };
        let score = ScoreBreakdown {
            score: 80.0,
            total_penalty: 20.0,
            penalties_by_severity: BTreeMap::new(),
            penalties_by_surface: BTreeMap::new(),
            counts_by_severity: BTreeMap::from([(Severity::Breaking, 1)]),
        };
        (comparison, score)
    }

    #[test]
    fn all_report_formats_render() {
        let (comparison, score) = fixture();
        for format in [
            ReportFormat::Text,
            ReportFormat::Json,
            ReportFormat::Markdown,
            ReportFormat::Junit,
            ReportFormat::Sarif,
            ReportFormat::Html,
        ] {
            let rendered = render(format, &comparison, &score).unwrap();
            assert!(!rendered.is_empty());
        }
    }
}
