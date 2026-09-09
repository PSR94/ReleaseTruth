import type { Observation } from '@releasetruth/shared-types';

export interface TimingSummary {
  samples: number[];
  sampleCount: number;
  minMs: number;
  maxMs: number;
  meanMs: number;
  p50Ms: number;
  p95Ms: number | null;
}

export function summarizeTimings(samples: readonly number[]): TimingSummary {
  if (samples.length === 0) throw new Error('at least one performance sample is required');
  const sorted = [...samples].sort((a, b) => a - b);
  const meanMs = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  return {
    samples: sorted,
    sampleCount: sorted.length,
    minMs: sorted[0]!,
    maxMs: sorted[sorted.length - 1]!,
    meanMs,
    p50Ms: percentile(sorted, 0.5),
    p95Ms: sorted.length >= 5 ? percentile(sorted, 0.95) : null,
  };
}

export function performanceObservation(id: string, samples: readonly number[]): Observation {
  return { id, kind: 'timing_summary', attributes: summarizeTimings(samples) };
}

function percentile(sorted: readonly number[], quantile: number): number {
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * quantile) - 1));
  return sorted[index]!;
}
