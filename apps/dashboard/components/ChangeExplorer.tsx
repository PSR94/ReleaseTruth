'use client';

import { useMemo, useState } from 'react';
import type { Change } from '../lib/api';
import { countBySurface, filterChanges } from '../lib/changeFilters';
import styles from './ChangeExplorer.module.css';

const SURFACES = ['api', 'browser', 'accessibility', 'cli', 'events', 'performance'] as const;
const SEVERITIES = ['breaking', 'significant', 'minor', 'expected'] as const;

function print(value: unknown) {
  if (value === undefined || value === null) return '∅';
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

export function ChangeExplorer({ changes }: { changes: Change[] }) {
  const [surface, setSurface] = useState('all');
  const [severity, setSeverity] = useState('all');
  const [query, setQuery] = useState('');
  const counts = useMemo(() => countBySurface(changes), [changes]);
  const visible = useMemo(
    () => filterChanges(changes, { surface, severity, query }),
    [changes, query, severity, surface],
  );

  return (
    <>
      <div className={styles.surfaceGrid} aria-label="Changes by surface">
        {SURFACES.map((item) => (
          <button
            className={`${styles.surfaceCard} ${surface === item ? styles.active : ''}`}
            key={item}
            onClick={() => setSurface(surface === item ? 'all' : item)}
            type="button"
          >
            <span>{item}</span>
            <strong>{counts[item] ?? 0}</strong>
          </button>
        ))}
      </div>

      <div className={styles.filters}>
        <label>
          <span>Surface</span>
          <select value={surface} onChange={(event) => setSurface(event.target.value)}>
            <option value="all">All surfaces</option>
            {SURFACES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <span>Severity</span>
          <select value={severity} onChange={(event) => setSeverity(event.target.value)}>
            <option value="all">All severities</option>
            {SEVERITIES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className={styles.search}>
          <span>Search behavior or path</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="orders, /p95Ms, focusable…"
          />
        </label>
      </div>

      <div className={styles.resultMeta}>
        <span>{visible.length} of {changes.length} observable changes</span>
        {(surface !== 'all' || severity !== 'all' || query) && (
          <button type="button" onClick={() => { setSurface('all'); setSeverity('all'); setQuery(''); }}>
            Clear filters
          </button>
        )}
      </div>

      {visible.length === 0 ? <p className="empty">No changes match these filters.</p> : visible.map((change) => (
        <article className={`change severity-${change.severity}`} key={change.change_id} data-surface={change.surface}>
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
          <div className={styles.metadata}>
            <span><b>Observation</b> {change.observation_id}</span>
            <span><b>Path</b> {change.path}</span>
            <span><b>Evidence</b> {change.evidence.length > 0 ? change.evidence.join(', ') : 'No artifact reference'}</span>
          </div>
        </article>
      ))}
    </>
  );
}
