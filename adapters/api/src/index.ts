import { createHash } from 'node:crypto';
import type { AdapterCapture, CapturedArtifact, Observation } from '@releasetruth/shared-types';
import { summarizeTimings } from '@releasetruth/performance-adapter';

export interface ApiScenario {
  id?: string;
  name?: string;
  method?: string;
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  samples?: number;
}

export interface ApiCaptureOptions {
  redactHeaders?: string[];
  maxBodyBytes?: number;
}

const DEFAULT_REDACTED_HEADERS = ['authorization', 'cookie', 'set-cookie', 'proxy-authorization', 'x-api-key'];

export async function captureApi(
  target: string,
  scenarios: readonly ApiScenario[],
  options: ApiCaptureOptions = {},
): Promise<AdapterCapture> {
  const observations: Observation[] = [];
  const artifacts: CapturedArtifact[] = [];
  for (const scenario of scenarios) {
    const captured = await captureScenario(target, scenario, options);
    observations.push(captured.observation);
    artifacts.push(captured.artifact);
  }
  return { observations, artifacts };
}

async function captureScenario(target: string, scenario: ApiScenario, options: ApiCaptureOptions) {
  const method = (scenario.method ?? 'GET').toUpperCase();
  const url = new URL(scenario.path, ensureTrailingSlash(target)).toString();
  const durations: number[] = [];
  let latest: Response | undefined;
  let latestBody = '';
  const sampleCount = Math.max(1, scenario.samples ?? 1);

  for (let sample = 0; sample < sampleCount; sample += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), scenario.timeoutMs ?? 10_000);
    const started = performance.now();
    try {
      latest = await fetch(url, {
        method,
        headers: scenario.headers,
        body: scenario.body === undefined ? undefined : JSON.stringify(scenario.body),
        signal: controller.signal,
        redirect: 'manual',
      });
      latestBody = await latest.text();
      durations.push(performance.now() - started);
    } finally {
      clearTimeout(timeout);
    }
  }

  if (latest === undefined) throw new Error(`API scenario ${method} ${url} produced no response`);
  const maxBodyBytes = options.maxBodyBytes ?? 256_000;
  const truncatedBody = Buffer.byteLength(latestBody) > maxBodyBytes
    ? `${latestBody.slice(0, maxBodyBytes)}\n<TRUNCATED>`
    : latestBody;
  const contentType = latest.headers.get('content-type') ?? '';
  const parsedBody = parseBody(truncatedBody, contentType);
  const headers = redactHeaders(latest.headers, options.redactHeaders);
  const id = scenario.id ?? `${method} ${new URL(url).pathname}`;
  const evidenceId = `http-${slug(id)}`;
  const payload = {
    request: { method, url, headers: redactRecord(scenario.headers ?? {}, options.redactHeaders), body: scenario.body ?? null },
    response: { status: latest.status, headers, body: parsedBody },
    timing: summarizeTimings(durations),
  };
  const content = JSON.stringify(payload, null, 2);
  const artifact: CapturedArtifact = {
    ref: {
      id: evidenceId,
      kind: 'http_exchange',
      path: `artifacts/api/${slug(id)}.json`,
      mediaType: 'application/json',
      sha256: `sha256:${createHash('sha256').update(content).digest('hex')}`,
      redacted: true,
    },
    content,
  };
  const observation: Observation = {
    id,
    kind: 'http_exchange',
    ...(scenario.name === undefined ? {} : { name: scenario.name }),
    attributes: {
      method,
      path: new URL(url).pathname,
      status: latest.status,
      headers,
      contentType,
      body: parsedBody,
      timing: summarizeTimings(durations),
    },
    evidence: [evidenceId],
  };
  return { observation, artifact };
}

export function redactHeaders(headers: Headers, extra: readonly string[] = []): Record<string, string> {
  return redactRecord(Object.fromEntries(headers.entries()), extra);
}

export function redactRecord(
  headers: Record<string, string>,
  extra: readonly string[] = [],
): Record<string, string> {
  const hidden = new Set([...DEFAULT_REDACTED_HEADERS, ...extra].map((value) => value.toLowerCase()));
  return Object.fromEntries(
    Object.entries(headers)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => [key.toLowerCase(), hidden.has(key.toLowerCase()) ? '<REDACTED>' : value]),
  );
}

function parseBody(text: string, contentType: string): unknown {
  if (contentType.includes('json')) {
    try { return JSON.parse(text) as unknown; } catch { return text; }
  }
  return text;
}

function ensureTrailingSlash(value: string): string { return value.endsWith('/') ? value : `${value}/`; }
function slug(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 96); }
