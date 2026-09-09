export type SurfaceName =
  | 'browser'
  | 'api'
  | 'cli'
  | 'accessibility'
  | 'events'
  | 'performance';

export interface Observation {
  id: string;
  kind: string;
  name?: string;
  attributes: unknown;
  evidence?: string[];
}

export interface EvidenceRef {
  id: string;
  kind: string;
  path: string;
  mediaType?: string;
  sha256?: string;
  redacted: boolean;
}

export interface CapturedArtifact {
  ref: EvidenceRef;
  content: string;
  encoding?: 'utf8' | 'base64';
}

export interface AdapterCapture {
  observations: Observation[];
  artifacts: CapturedArtifact[];
}

export interface Surfaces {
  browser?: Observation[];
  api?: Observation[];
  cli?: Observation[];
  accessibility?: Observation[];
  events?: Observation[];
  performance?: Observation[];
}

export interface BehaviorLockDraft {
  schema: 'releasetruth.behavior/v1';
  release?: string;
  capturedAt: string;
  metadata: Record<string, unknown>;
  surfaces: Surfaces;
  evidence: EvidenceRef[];
  fingerprint: '';
}

export function createDraft(release?: string): BehaviorLockDraft {
  const draft: BehaviorLockDraft = {
    schema: 'releasetruth.behavior/v1',
    capturedAt: new Date().toISOString(),
    metadata: {},
    surfaces: {},
    evidence: [],
    fingerprint: '',
  };
  if (release !== undefined) draft.release = release;
  return draft;
}

export function mergeCapture(
  draft: BehaviorLockDraft,
  surface: SurfaceName,
  capture: AdapterCapture,
): void {
  const existing = draft.surfaces[surface] ?? [];
  draft.surfaces[surface] = [...existing, ...capture.observations];
  draft.evidence.push(...capture.artifacts.map((artifact) => artifact.ref));
}
