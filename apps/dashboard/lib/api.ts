export type Summary = {
  projects: number;
  snapshots: number;
  runs: number;
  breaking_changes: number;
  significant_changes: number;
  average_score: number;
};

export type Project = {
  id: string;
  name: string;
  slug: string;
  repository_url: string | null;
  created_at: string;
};

export type Snapshot = {
  id: string;
  project_id: string;
  release: string | null;
  fingerprint: string;
  captured_at: string | null;
  created_at: string;
};

export type Baseline = {
  project_id: string;
  snapshot_id: string;
  set_by: string | null;
  updated_at: string;
};

export type Run = {
  id: string;
  project_id: string;
  base_snapshot_id: string;
  candidate_snapshot_id: string;
  status: string;
  compatibility_score: number;
  git_sha: string | null;
  pull_request: number | null;
  summary: Record<string, unknown>;
  report?: Record<string, unknown>;
  changes?: Change[];
  created_at: string;
};

export type Change = {
  change_id: string;
  surface: string;
  observation_id: string;
  path: string;
  severity: string;
  reason: string;
  before: unknown;
  after: unknown;
  evidence: string[];
};

const baseUrl =
  process.env.RELEASETRUTH_API_URL ??
  process.env.NEXT_PUBLIC_RELEASETRUTH_API_URL ??
  'http://127.0.0.1:8000';

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`ReleaseTruth API ${response.status}: ${path}`);
  }
  return response.json() as Promise<T>;
}

export async function getSummary(): Promise<Summary> {
  try {
    return await get<Summary>('/v1/summary');
  } catch {
    return {
      projects: 0,
      snapshots: 0,
      runs: 0,
      breaking_changes: 0,
      significant_changes: 0,
      average_score: 100,
    };
  }
}

export async function getProjects(): Promise<Project[]> {
  try {
    return await get<Project[]>('/v1/projects');
  } catch {
    return [];
  }
}

export async function getRuns(projectId?: string): Promise<Run[]> {
  try {
    const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : '';
    return await get<Run[]>(`/v1/runs${query}`);
  } catch {
    return [];
  }
}

export async function getRun(id: string): Promise<Run | null> {
  try {
    return await get<Run>(`/v1/runs/${encodeURIComponent(id)}`);
  } catch {
    return null;
  }
}

export async function getProject(id: string): Promise<Project | null> {
  try {
    return await get<Project>(`/v1/projects/${encodeURIComponent(id)}`);
  } catch {
    return null;
  }
}

export async function getSnapshots(projectId: string): Promise<Snapshot[]> {
  try {
    return await get<Snapshot[]>(`/v1/projects/${encodeURIComponent(projectId)}/snapshots`);
  } catch {
    return [];
  }
}

export async function getBaseline(projectId: string): Promise<Baseline | null> {
  try {
    return await get<Baseline>(`/v1/projects/${encodeURIComponent(projectId)}/baseline`);
  } catch {
    return null;
  }
}
