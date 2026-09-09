import Link from 'next/link';
import { Score } from '../components/Score';
import { getProjects, getRuns, getSummary } from '../lib/api';

export const dynamic = 'force-dynamic';

function statusLabel(status: string) {
  return status.replaceAll('_', ' ');
}

export default async function Home() {
  const [summary, projects, runs] = await Promise.all([getSummary(), getProjects(), getRuns()]);
  const projectById = new Map(projects.map((project) => [project.id, project]));

  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">Behavioral release intelligence</p>
          <h1>Know what the product changed, not just what the code changed.</h1>
          <p className="lede">ReleaseTruth unifies API, browser, accessibility, CLI, event, and performance evidence into one deterministic compatibility history.</p>
        </div>
        <Score value={summary.average_score} />
      </section>

      <section className="metrics" aria-label="ReleaseTruth summary">
        <article><span>Projects</span><strong>{summary.projects}</strong></article>
        <article><span>Captures</span><strong>{summary.snapshots}</strong></article>
        <article><span>Comparisons</span><strong>{summary.runs}</strong></article>
        <article><span>Breaking changes</span><strong>{summary.breaking_changes}</strong></article>
        <article><span>Significant changes</span><strong>{summary.significant_changes}</strong></article>
      </section>

      <section className="grid twoCol">
        <div className="panel">
          <div className="sectionHeading"><div><p className="eyebrow">Projects</p><h2>Tracked products</h2></div></div>
          {projects.length === 0 ? (
            <p className="empty">No projects have been ingested yet. Run the demo or POST a project to the API.</p>
          ) : (
            <div className="stack">
              {projects.map((project) => (
                <Link className="projectCard" href={`/projects/${project.id}`} key={project.id}>
                  <div><strong>{project.name}</strong><span>{project.repository_url ?? project.slug}</span></div>
                  <span aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="sectionHeading"><div><p className="eyebrow">Recent evidence</p><h2>Latest comparisons</h2></div></div>
          {runs.length === 0 ? (
            <p className="empty">No comparison runs persisted yet.</p>
          ) : (
            <div className="stack">
              {runs.slice(0, 8).map((run) => (
                <Link className="runCard" href={`/runs/${run.id}`} key={run.id}>
                  <Score value={run.compatibility_score} compact />
                  <div className="runMeta">
                    <strong>{projectById.get(run.project_id)?.name ?? 'Project'}</strong>
                    <span className={`badge badge-${run.status}`}>{statusLabel(run.status)}</span>
                    <small>{new Date(run.created_at).toLocaleString()}</small>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
