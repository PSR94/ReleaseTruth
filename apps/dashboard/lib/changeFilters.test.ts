import { describe, expect, it } from 'vitest';
import type { Change } from './api';
import { countBySurface, filterChanges } from './changeFilters';

const changes: Change[] = [
  {
    change_id: 'api-status',
    surface: 'api',
    observation_id: 'POST /api/orders',
    path: '/status',
    severity: 'breaking',
    reason: 'HTTP status contract changed',
    before: 400,
    after: 422,
    evidence: ['http-post-api-orders'],
  },
  {
    change_id: 'perf-p95',
    surface: 'performance',
    observation_id: 'GET /api/search',
    path: '/p95Ms',
    severity: 'significant',
    reason: 'performance regression exceeded configured threshold',
    before: 30,
    after: 230,
    evidence: [],
  },
];

describe('change filtering', () => {
  it('filters by surface and severity without hiding unfiltered data', () => {
    expect(filterChanges(changes, {})).toHaveLength(2);
    expect(filterChanges(changes, { surface: 'api' })).toEqual([changes[0]]);
    expect(filterChanges(changes, { severity: 'significant' })).toEqual([changes[1]]);
  });

  it('searches observation IDs, paths, reasons and values', () => {
    expect(filterChanges(changes, { query: 'orders' })).toEqual([changes[0]]);
    expect(filterChanges(changes, { query: 'p95' })).toEqual([changes[1]]);
    expect(filterChanges(changes, { query: '422' })).toEqual([changes[0]]);
  });

  it('counts changes by captured surface', () => {
    expect(countBySurface(changes)).toEqual({ api: 1, performance: 1 });
  });
});
