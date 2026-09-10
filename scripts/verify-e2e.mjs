#!/usr/bin/env node

import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const demo = path.resolve(root, '.releasetruth/demo');
const api = process.env.RELEASETRUTH_API_URL ?? 'http://127.0.0.1:8000';
const dashboard = process.env.RELEASETRUTH_DASHBOARD_URL ?? 'http://127.0.0.1:3002';

const readJson = async (file) => JSON.parse(await readFile(path.join(demo, file), 'utf8'));
const [base, replay, candidate, report, sarif] = await Promise.all([
  readJson('base/behavior.lock.json'),
  readJson('base-replay/behavior.lock.json'),
  readJson('candidate/behavior.lock.json'),
  readJson('report.json'),
  readJson('report.sarif'),
]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

for (const [name, lock, release] of [
  ['base', base, 'v1-good'],
  ['candidate', candidate, 'v2-regression'],
]) {
  invariant(lock.schema === 'releasetruth.behavior/v1', `${name} behavior.lock schema is invalid`);
  invariant(lock.release === release, `${name} behavior.lock release metadata is invalid`);
  invariant(typeof lock.capturedAt === 'string' && lock.capturedAt.length > 0, `${name} capture timestamp missing`);
  invariant(typeof lock.fingerprint === 'string' && lock.fingerprint.startsWith('sha256:'), `${name} fingerprint missing`);
  invariant(lock.normalization?.rulesHash?.startsWith('sha256:'), `${name} normalization manifest missing`);
  for (const surface of ['api', 'browser', 'accessibility', 'cli', 'events', 'performance']) {
    invariant(Array.isArray(lock.surfaces?.[surface]) && lock.surfaces[surface].length > 0, `${name} missing real ${surface} observations`);
  }
  invariant(Array.isArray(lock.evidence) && lock.evidence.length >= 1, `${name} evidence catalog is empty`);
}
invariant(base.fingerprint === replay.fingerprint, 're-finalizing the identical base draft changed its fingerprint');
invariant(base.fingerprint !== candidate.fingerprint, 'base and regression fingerprints unexpectedly match');

const changes = report.comparison?.changes ?? [];
invariant(Array.isArray(changes) && changes.length > 0, 'comparison contains no changes');
const findChange = (surface, observationId, pathName) => changes.find(
  (change) => change.surface === surface && change.observationId === observationId && change.path === pathName,
);

const apiStatus = findChange('api', 'POST /api/orders', '/status');
invariant(apiStatus?.before === 400 && apiStatus?.after === 422 && apiStatus?.severity === 'breaking', 'expected API 400 -> 422 breaking status change not detected');

const browserDialog = findChange('browser', 'journey:checkout-safety', '/dialogs');
invariant(Array.isArray(browserDialog?.before) && browserDialog.before.some((dialog) => dialog?.type === 'confirm'), 'base confirmation dialog evidence missing');
invariant(Array.isArray(browserDialog?.after) && browserDialog.after.length === 0 && browserDialog.severity === 'breaking', 'removed checkout confirmation was not classified breaking');

const a11yRole = findChange('accessibility', 'journey:checkout-safety', '/controls/pay/role');
invariant(a11yRole?.before === 'button' && a11yRole?.after === 'generic' && a11yRole?.severity === 'breaking', 'button -> generic accessibility regression not detected');
const a11yKeyboard = findChange('accessibility', 'journey:checkout-safety', '/controls/pay/keyboardFocusable');
invariant(a11yKeyboard?.before === true && a11yKeyboard?.after === false && a11yKeyboard?.severity === 'breaking', 'keyboard focusability regression not detected');

const cliExit = findChange('cli', 'truthshop receipt', '/exitCode');
invariant(cliExit?.before === 0 && cliExit?.after === 1 && cliExit?.severity === 'breaking', 'CLI exit 0 -> 1 regression not detected');

const eventOrder = findChange('events', 'checkout webhook sequence', '/order');
invariant(JSON.stringify(eventOrder?.before) === JSON.stringify(['payment.completed', 'invoice.generated']), 'base webhook order is incorrect');
invariant(JSON.stringify(eventOrder?.after) === JSON.stringify(['invoice.generated', 'payment.completed']) && eventOrder?.severity === 'significant', 'webhook ordering regression not detected');

const perfP95 = findChange('performance', 'GET /api/search', '/p95Ms');
invariant(typeof perfP95?.before === 'number' && typeof perfP95?.after === 'number', 'performance p95 change missing numeric evidence');
invariant(perfP95.after > perfP95.before * 1.5 && perfP95.severity === 'significant', `expected >50% p95 regression; got ${perfP95?.before} -> ${perfP95?.after}`);

for (const surface of ['api', 'browser', 'accessibility', 'cli', 'events', 'performance']) {
  invariant(changes.some((change) => change.surface === surface), `comparison has no ${surface} changes`);
}
invariant((report.score?.score ?? 100) < 100, 'compatibility score did not decrease');
invariant((report.score?.countsBySeverity?.breaking ?? 0) >= 4, 'expected multiple breaking regressions in score breakdown');

const markdown = await readFile(path.join(demo, 'report.md'), 'utf8');
const junit = await readFile(path.join(demo, 'report.junit.xml'), 'utf8');
const htmlReport = await readFile(path.join(demo, 'report.html'), 'utf8');
invariant(markdown.includes('# ReleaseTruth Behavioral Compatibility') && markdown.includes('POST /api/orders'), 'Markdown report is malformed or incomplete');
invariant(junit.startsWith('<?xml version="1.0"') && junit.includes('<testsuite') && junit.includes('<failure'), 'JUnit report is malformed or contains no compatibility failures');
invariant(sarif.version === '2.1.0' && Array.isArray(sarif.runs?.[0]?.results) && sarif.runs[0].results.length > 0, 'SARIF report is malformed or empty');
invariant(htmlReport.includes('ReleaseTruth Behavioral Diff') && htmlReport.includes('Compatibility') && htmlReport.includes('Before') && htmlReport.includes('After'), 'standalone HTML report is incomplete');
for (const file of ['report.json', 'report.md', 'report.junit.xml', 'report.sarif', 'report.html']) {
  invariant((await stat(path.join(demo, file))).size > 20, `${file} is unexpectedly empty`);
}

const summaryResponse = await fetch(`${api}/v1/summary`);
invariant(summaryResponse.ok, `summary API failed with HTTP ${summaryResponse.status}`);
const summary = await summaryResponse.json();
invariant(summary.runs >= 1 && summary.snapshots >= 2 && summary.breaking_changes >= 4, `unexpected persisted summary: ${JSON.stringify(summary)}`);
invariant(summary.average_score === report.score.score, `summary average score drifted from the only persisted run: ${summary.average_score} != ${report.score.score}`);
const runsResponse = await fetch(`${api}/v1/runs`);
invariant(runsResponse.ok, `runs API failed with HTTP ${runsResponse.status}`);
const runs = await runsResponse.json();
invariant(runs[0]?.id, 'no persisted run id');
const runResponse = await fetch(`${api}/v1/runs/${runs[0].id}`);
invariant(runResponse.ok, `run detail API failed with HTTP ${runResponse.status}`);
const persisted = await runResponse.json();
for (const expected of [
  ['api', 'POST /api/orders', '/status', 'breaking'],
  ['browser', 'journey:checkout-safety', '/dialogs', 'breaking'],
  ['accessibility', 'journey:checkout-safety', '/controls/pay/role', 'breaking'],
  ['cli', 'truthshop receipt', '/exitCode', 'breaking'],
  ['events', 'checkout webhook sequence', '/order', 'significant'],
  ['performance', 'GET /api/search', '/p95Ms', 'significant'],
]) {
  const [surface, observationId, pathName, severity] = expected;
  invariant(persisted.changes.some((change) => change.surface === surface && change.observation_id === observationId && change.path === pathName && change.severity === severity), `persisted run missing ${surface} ${observationId}${pathName}`);
}

const overviewResponse = await fetch(dashboard);
invariant(overviewResponse.ok, `dashboard overview failed with HTTP ${overviewResponse.status}`);
const overviewHtml = await overviewResponse.text();
const expectedScoreLabel = `Compatibility score ${Math.round(summary.average_score)} out of 100`;
invariant(overviewHtml.includes(expectedScoreLabel), `dashboard overview did not render persisted average score: ${expectedScoreLabel}`);

const dashboardResponse = await fetch(`${dashboard}/runs/${runs[0].id}`);
invariant(dashboardResponse.ok, `dashboard run page failed with HTTP ${dashboardResponse.status}`);
const dashboardHtml = await dashboardResponse.text();
for (const needle of ['ReleaseTruth', 'Behavior changes', 'POST /api/orders', 'checkout webhook sequence', 'truthshop receipt', 'GET /api/search']) {
  invariant(dashboardHtml.includes(needle), `dashboard run page did not render ${needle}`);
}

console.log(`E2E verified run ${runs[0].id}; score=${persisted.compatibility_score}; status=${persisted.status}`);
console.log('Verified flagship regressions: API status, browser confirmation, accessibility semantics/focus, CLI exit, event order, performance p95.');
