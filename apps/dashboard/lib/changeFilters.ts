import type { Change } from './api';

export type ChangeFilters = {
  surface?: string;
  severity?: string;
  query?: string;
};

function searchable(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function filterChanges(changes: Change[], filters: ChangeFilters): Change[] {
  const query = filters.query?.trim().toLowerCase() ?? '';
  return changes.filter((change) => {
    if (filters.surface && filters.surface !== 'all' && change.surface !== filters.surface) return false;
    if (filters.severity && filters.severity !== 'all' && change.severity !== filters.severity) return false;
    if (!query) return true;
    const haystack = [
      change.surface,
      change.severity,
      change.observation_id,
      change.path,
      change.reason,
      searchable(change.before),
      searchable(change.after),
      change.evidence.join(' '),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });
}

export function countBySurface(changes: Change[]): Record<string, number> {
  return changes.reduce<Record<string, number>>((counts, change) => {
    counts[change.surface] = (counts[change.surface] ?? 0) + 1;
    return counts;
  }, {});
}
