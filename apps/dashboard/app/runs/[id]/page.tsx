import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Score } from '../../../components/Score';
import { getProject, getRun } from '../../../lib/api';

export const dynamic = 'force-dynamic';

function print(value: unknown) {
  if (value === undefined || value === null) return '∅';
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await getRun(id);
  if (!run) notFound();
  const project = await getProject(run.project_id);
  const changes = run.changes ?? [];

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

      <section className="panel">
        <div className="sectionHeading"><div><p className="eyebrow">Evidence</p><h2>Behavior changes</h2></div></div>
        {changes.length === 0 ? <p className="empty">No behavior changes detected.</p> : changes.map((change) => (
          <article className={`change severity-${change.severity}`} key={change.change_id}>
            <header>
              <span className={`badge badge-${change.severity}`}>{change.severity}</span>
              <span className="surface">{change.surface}</span>
              <code>{change.observation_id}{change.path}</code>
            </header>
            <p>{change.reason}</p>
            <div className="values">
              <div><small>Before</small><pre>{print(change.before)}</pre></div>
              <div><small>After</small><pre>{print(change.after)}</pre></div>
            </div>
            {change.evidence.length > 0 && <small>Evidence: {change.evidence.join(', ')}</small>}
          </article>
        ))}
      </section>
    </>
  );
}
