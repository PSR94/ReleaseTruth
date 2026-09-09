import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { cp, mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import type { AdapterCapture, CapturedArtifact, Observation } from '@releasetruth/shared-types';

export interface CliScenario {
  id: string;
  executable: string;
  args?: string[];
  env?: Record<string, string>;
  seedDirectory?: string;
  timeoutMs?: number;
  shell?: boolean;
}

export async function captureCli(scenarios: readonly CliScenario[]): Promise<AdapterCapture> {
  const observations: Observation[] = [];
  const artifacts: CapturedArtifact[] = [];
  for (const scenario of scenarios) {
    const captured = await runScenario(scenario);
    observations.push(captured.observation);
    artifacts.push(captured.artifact);
  }
  return { observations, artifacts };
}

async function runScenario(scenario: CliScenario) {
  const cwd = await mkdtemp(join(tmpdir(), 'releasetruth-cli-'));
  try {
    if (scenario.seedDirectory !== undefined) await cp(scenario.seedDirectory, cwd, { recursive: true });
    const started = performance.now();
    const result = await spawnCaptured(scenario, cwd);
    const durationMs = performance.now() - started;
    const filesystem = await snapshotTree(cwd);
    const payload = { executable: scenario.executable, args: scenario.args ?? [], stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode, timedOut: result.timedOut, durationMs, filesystem };
    const content = JSON.stringify(payload, null, 2);
    const evidenceId = `cli-${slug(scenario.id)}`;
    const artifact: CapturedArtifact = {
      ref: { id: evidenceId, kind: 'cli_execution', path: `artifacts/cli/${slug(scenario.id)}.json`, mediaType: 'application/json', sha256: `sha256:${createHash('sha256').update(content).digest('hex')}`, redacted: true },
      content,
    };
    const observation: Observation = { id: scenario.id, kind: 'command', attributes: payload, evidence: [evidenceId] };
    return { observation, artifact };
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

function spawnCaptured(scenario: CliScenario, cwd: string): Promise<{ stdout: string; stderr: string; exitCode: number | null; timedOut: boolean }> {
  return new Promise((resolve, reject) => {
    const child = spawn(scenario.executable, scenario.args ?? [], {
      cwd,
      env: { ...process.env, ...scenario.env },
      shell: scenario.shell ?? false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => { stdout += chunk; });
    child.stderr.on('data', (chunk: string) => { stderr += chunk; });
    child.on('error', reject);
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, scenario.timeoutMs ?? 10_000);
    child.on('close', (code) => { clearTimeout(timer); resolve({ stdout, stderr, exitCode: code, timedOut }); });
  });
}

async function snapshotTree(root: string): Promise<Array<{ path: string; size: number; sha256?: string }>> {
  const result: Array<{ path: string; size: number; sha256?: string }> = [];
  async function walk(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const full = join(directory, entry.name);
      if (entry.isDirectory()) { await walk(full); continue; }
      if (!entry.isFile()) continue;
      const info = await stat(full);
      const path = relative(root, full).split('\\').join('/');
      if (info.size <= 1_000_000) {
        const bytes = await readFile(full);
        result.push({ path, size: info.size, sha256: `sha256:${createHash('sha256').update(bytes).digest('hex')}` });
      } else {
        result.push({ path, size: info.size });
      }
    }
  }
  await walk(root);
  return result;
}

function slug(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 96); }
