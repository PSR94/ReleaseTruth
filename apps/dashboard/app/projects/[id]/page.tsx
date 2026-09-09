import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Score } from '../../../components/Score';
import { getBaseline, getProject, getRuns, getSnapshots } from '../../../lib/api';

export const dynamic = 'force-dynamic';

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, runs, snapshots, baseline] = await Promise.all([
    getProject(id),
    getRuns(id),
    getSnapshots(id),
    getBaseline(id),
  ]);
  if (!project) notFound();
  const baselineSnapshot = baseline ? snapshots.find((snapshot) => snapshot.id === baseline.snapshot_id) : null;

  return (
    <>
      <Link className="back" href="/">← Overview</Link>
      <section className="pageHeading">
        <p className="eyebrow">Project history</p>
        <h1>{project.name}</h1>
        <p className="lede">{project.repository_url ?? project.slug}</p>
      </section>

      <section className="panel" style={{ marginBottom: 28 }}>
        <div className="sectionHeading">
          <div><p className="eyebrow">Current baseline</p><h2>{baselineSnapshot?.release ?? (baseline ? 'Captured snapshot' : 'Not set')}</h2></div>
          {baseline ? <span className="badge badge-compatible">active baseline</span> : <span className="badge badge-changed">CLI/API managed</span>}
        </div>
        {baselineSnapshot ? (
          <div className="stack">
            <code>{baselineSnapshot.fingerprint}</code>
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>
              Captured {new Date(baselineSnapshot.captured_at ?? baselineSnapshot.created_at).toLocaleString()}
              {baseline?.set_by ? ` · set by ${baseline.set_by}` : ''}
            </span>
          </div>
        ) : (
          <p className="empty" style={{ padding: 0, marginBottom: 0 }}>Set a baseline with the ReleaseTruth CLI or <code>PUT /v1/projects/{project.id}/baseline</code>.</p>
        )}
      </section>

      <section className="panel">
        <div className="sectionHeading"><div><p className="eyebrow">Timeline</p><h2>Compatibility history</h2></div><span>{snapshots.length} snapshots</span></div>
        {runs.length === 0 ? <p className="empty">No runs yet.</p> : (
          <div className="timeline">
            {runs.map((run) => (
              <Link className="timelineRow" href={`/runs/${run.id}`} key={run.id}>
                <Score value={run.compatibility_score} compact />
                <div><strong>{run.status}</strong><span>{new Date(run.created_at).toLocaleString()}</span></div>
                <code>{run.git_sha?.slice(0, 12) ?? 'local'}</code>
                <span aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
