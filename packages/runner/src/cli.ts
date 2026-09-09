import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { parse } from 'yaml';
import { captureApi, type ApiScenario } from '@releasetruth/api-adapter';
import { captureBrowser, type BrowserJourney } from '@releasetruth/browser-adapter';
import { captureCli, type CliScenario } from '@releasetruth/cli-adapter';
import { EventCollector } from '@releasetruth/events-adapter';
import { performanceObservation } from '@releasetruth/performance-adapter';
import { createDraft, mergeCapture, type CapturedArtifact } from '@releasetruth/shared-types';

interface RunnerConfig {
  journeys?: BrowserJourney[];
  apiScenarios?: ApiScenario[];
  cliScenarios?: CliScenario[];
  eventScenarios?: Array<{ id: string; path: string }>;
  performanceScenarios?: Array<{ id: string; path: string; samples?: number }>;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const configText = await readFile(args.config, 'utf8');
  const config = parse(configText) as RunnerConfig;
  const draft = createDraft(args.release);
  draft.metadata = { target: args.target, captureRunner: 'releasetruth-js/v0.1', variant: args.variant };
  const allArtifacts: CapturedArtifact[] = [];

  if (config.apiScenarios?.length) {
    const api = await captureApi(args.target, config.apiScenarios);
    mergeCapture(draft, 'api', api);
    allArtifacts.push(...api.artifacts);
  }
  if (config.journeys?.length) {
    const captured = await captureBrowser(args.target, config.journeys, { screenshot: true });
    mergeCapture(draft, 'browser', captured.browser);
    mergeCapture(draft, 'accessibility', captured.accessibility);
    allArtifacts.push(...captured.browser.artifacts);
  }
  if (config.cliScenarios?.length) {
    const scenarios = config.cliScenarios.map((scenario) => expandCliScenario(scenario, args));
    const cli = await captureCli(scenarios);
    mergeCapture(draft, 'cli', cli);
    allArtifacts.push(...cli.artifacts);
  }
  if (config.eventScenarios?.length) {
    for (const scenario of config.eventScenarios) {
      const collector = new EventCollector();
      const webhookUrl = await collector.start();
      try {
        const response = await fetch(new URL(scenario.path, withSlash(args.target)), {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ quantity: 1, webhookUrl }),
        });
        if (!response.ok) throw new Error(`event trigger ${scenario.path} failed with HTTP ${response.status}`);
        const observation = collector.observation(scenario.id);
        const content = JSON.stringify({ events: collector.events, normalizedObservation: observation.attributes }, null, 2);
        const artifact: CapturedArtifact = {
          ref: { id: `events-${slug(scenario.id)}`, kind: 'event_sequence', path: `artifacts/events/${slug(scenario.id)}.json`, mediaType: 'application/json', sha256: `sha256:${createHash('sha256').update(content).digest('hex')}`, redacted: true },
          content,
        };
        observation.evidence = [artifact.ref.id];
        mergeCapture(draft, 'events', { observations: [observation], artifacts: [artifact] });
        allArtifacts.push(artifact);
      } finally { await collector.close(); }
    }
  }
  if (config.performanceScenarios?.length) {
    const observations = [];
    for (const scenario of config.performanceScenarios) {
      const samples: number[] = [];
      for (let i = 0; i < (scenario.samples ?? 10); i += 1) {
        const started = performance.now();
        const response = await fetch(new URL(scenario.path, withSlash(args.target)));
        await response.arrayBuffer();
        if (!response.ok) throw new Error(`performance scenario ${scenario.id} failed with HTTP ${response.status}`);
        samples.push(performance.now() - started);
      }
      observations.push(performanceObservation(scenario.id, samples));
    }
    mergeCapture(draft, 'performance', { observations, artifacts: [] });
  }

  await mkdir(args.output, { recursive: true });
  for (const artifact of allArtifacts) await writeArtifact(args.output, artifact);
  const draftPath = resolve(args.output, 'draft.behavior.lock.json');
  await writeFile(draftPath, `${JSON.stringify(draft, null, 2)}\n`, 'utf8');
  process.stdout.write(`${draftPath}\n`);
}

function expandCliScenario(scenario: CliScenario, args: ReturnType<typeof parseArgs>): CliScenario {
  const replace = (value: string) => value.replaceAll('${NODE}', process.execPath).replaceAll('${ROOT}', process.cwd());
  return { ...scenario, executable: replace(scenario.executable), args: scenario.args?.map(replace), env: { ...scenario.env, TRUTHSHOP_VARIANT: args.variant } };
}

async function writeArtifact(root: string, artifact: CapturedArtifact) {
  const destination = resolve(root, artifact.ref.path);
  const safeRoot = `${resolve(root)}/`;
  if (!destination.startsWith(safeRoot)) throw new Error(`artifact path escapes capture root: ${artifact.ref.path}`);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, artifact.content, artifact.encoding === 'base64' ? 'base64' : 'utf8');
}

function parseArgs(argv: string[]) {
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]; const value = argv[i + 1];
    if (!key?.startsWith('--') || value === undefined) throw new Error(`expected --key value arguments; got ${argv.join(' ')}`);
    values.set(key.slice(2), value);
  }
  const required = (key: string) => { const value = values.get(key); if (!value) throw new Error(`missing --${key}`); return value; };
  const variant = required('variant');
  if (variant !== 'good' && variant !== 'regression') throw new Error('--variant must be good or regression');
  return { target: required('target'), output: required('output'), config: values.get('config') ?? '.releasetruth.demo.yml', release: required('release'), variant };
}

function withSlash(value: string) { return value.endsWith('/') ? value : `${value}/`; }
function slug(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 96); }
main().catch((error) => { console.error(error instanceof Error ? error.stack ?? error.message : error); process.exitCode = 1; });
