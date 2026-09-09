import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChangeExplorer } from '../../../components/ChangeExplorer';
import { Score } from '../../../components/Score';
import { getBaseline, getProject, getRun } from '../../../lib/api';

export const dynamic = 'force-dynamic';

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await getRun(id);
  if (!run) notFound();
  const [project, baseline] = await Promise.all([getProject(run.project_id), getBaseline(run.project_id)]);
  const changes = run.changes ?? [];
  const baseIsBaseline = baseline?.snapshot_id === run.base_snapshot_id;

  return (
    <>
      <Link className="back" href={project ? `/projects/${project.id}` : '/'}>← Back to history</Link>
      <section className="runHero">
        <div>
          <p className="eyebrow">Comparison run</p>
          <h1>{project?.name ?? 'Release'} behavioral diff</h1>
          <p className="lede">{changes.length} deterministic changes · status <strong>{run.status}</strong>{run.git_sha ? ` · ${run.git_sha.slice(0, 12)}` : ''}</p>
        </div>
        <Score value={run.compatibility_score} />
      </section>

      <section className="panel" style={{ marginBottom: 28 }}>
        <div className="sectionHeading">
          <div>
            <p className="eyebrow">Compatibility contract</p>
            <h2>{baseIsBaseline ? 'Compared from the current baseline' : baseline ? 'Compared from a historical snapshot' : 'No server baseline is set'}</h2>
          </div>
          {baseline && <span className="badge badge-compatible">baseline {baseline.snapshot_id.slice(0, 8)}</span>}
        </div>
        <p className="lede" style={{ fontSize: 14, marginBottom: 0 }}>
          Base snapshot <code>{run.base_snapshot_id}</code> · Candidate <code>{run.candidate_snapshot_id}</code>
          {baseline?.set_by ? ` · baseline set by ${baseline.set_by}` : ''}
        </p>
      </section>

      <section className="panel">
        <div className="sectionHeading"><div><p className="eyebrow">Evidence</p><h2>Behavior changes</h2></div></div>
        {changes.length === 0 ? <p className="empty">No behavior changes detected.</p> : <ChangeExplorer changes={changes} />}
      </section>
    </>
  );
}
