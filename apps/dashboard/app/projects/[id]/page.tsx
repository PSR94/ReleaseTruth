import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Score } from '../../../components/Score';
import { getProject, getRuns } from '../../../lib/api';

export const dynamic = 'force-dynamic';

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, runs] = await Promise.all([getProject(id), getRuns(id)]);
  if (!project) notFound();

  return (
    <>
      <Link className="back" href="/">← Overview</Link>
      <section className="pageHeading">
        <p className="eyebrow">Project history</p>
        <h1>{project.name}</h1>
        <p className="lede">{project.repository_url ?? project.slug}</p>
      </section>
      <section className="panel">
        <div className="sectionHeading"><div><p className="eyebrow">Timeline</p><h2>Compatibility history</h2></div></div>
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
