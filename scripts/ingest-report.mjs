#!/usr/bin/env node

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const [basePath, candidatePath, reportPath] = process.argv.slice(2);
if (!basePath || !candidatePath || !reportPath) {
  console.error('usage: ingest-report.mjs <base-lock> <candidate-lock> <report-json>');
  process.exit(64);
}

const api = process.env.RELEASETRUTH_API_URL ?? 'http://127.0.0.1:8000';
const slug = process.env.RELEASETRUTH_PROJECT_SLUG ?? 'truthshop';
const name = process.env.RELEASETRUTH_PROJECT_NAME ?? 'TruthShop';
const repositoryUrl = process.env.RELEASETRUTH_REPOSITORY_URL ?? 'https://github.com/PSR94/ReleaseTruth';

async function request(url, init = {}) {
  const response = await fetch(`${api}${url}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  if (!response.ok) {
    throw new Error(`${init.method ?? 'GET'} ${url} failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

const [baseLock, candidateLock, report] = await Promise.all(
  [basePath, candidatePath, reportPath].map(async (file) => JSON.parse(await readFile(file, 'utf8'))),
);

const projects = await request('/v1/projects');
let project = projects.find((item) => item.slug === slug);
if (!project) {
  project = await request('/v1/projects', {
    method: 'POST',
    body: JSON.stringify({ name, slug, repository_url: repositoryUrl }),
  });
}

const run = await request('/v1/runs/ingest', {
  method: 'POST',
  body: JSON.stringify({
    project_id: project.id,
    base_lock: baseLock,
    candidate_lock: candidateLock,
    report,
    git_sha: process.env.GITHUB_SHA ?? process.env.RELEASETRUTH_GIT_SHA ?? null,
    pull_request: process.env.RELEASETRUTH_PULL_REQUEST
      ? Number(process.env.RELEASETRUTH_PULL_REQUEST)
      : null,
  }),
});

const output = path.resolve('.releasetruth/demo/api-run.json');
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(run, null, 2));
console.log(`Persisted ReleaseTruth run ${run.id} (${run.status}, score ${run.compatibility_score})`);
console.log(`Dashboard: ${process.env.RELEASETRUTH_DASHBOARD_URL ?? 'http://127.0.0.1:3002'}/runs/${run.id}`);
