import { describe, expect, it } from 'vitest';
import { summarizeTimings } from './index.js';

describe('timing summary', () => {
  it('computes deterministic p50 and p95 from sorted samples', () => {
    const summary = summarizeTimings([472, 300, 281, 320, 400, 350, 310, 305, 500, 290]);
    expect(summary.p50Ms).toBe(310);
    expect(summary.p95Ms).toBe(500);
    expect(summary.samples[0]).toBe(281);
  });

  it('omits p95 when the sample is too small to be useful', () => {
    expect(summarizeTimings([1, 2, 3]).p95Ms).toBeNull();
  });
});
