import { createHash } from 'node:crypto';
import { chromium, type Browser, type Page } from 'playwright';
import { captureAccessibilityState } from '@releasetruth/accessibility-adapter';
import type { AdapterCapture, CapturedArtifact, Observation } from '@releasetruth/shared-types';

export type JourneyStep =
  | { goto: string }
  | { click: { selector: string } }
  | { fill: { selector: string; value: string } }
  | { press: { selector: string; key: string } }
  | { expect: { url?: string; text?: string; selector?: string } }
  | { waitFor: { selector: string; state?: 'attached' | 'visible' | 'hidden' | 'detached' } };

export interface BrowserJourney { name: string; steps: JourneyStep[]; }
export interface BrowserCaptureOptions { headless?: boolean; screenshot?: boolean; timeoutMs?: number; }

export async function captureBrowser(
  target: string,
  journeys: readonly BrowserJourney[],
  options: BrowserCaptureOptions = {},
): Promise<{ browser: AdapterCapture; accessibility: AdapterCapture }> {
  const browser = await chromium.launch({ headless: options.headless ?? true });
  try {
    const browserCapture: AdapterCapture = { observations: [], artifacts: [] };
    const accessibilityCapture: AdapterCapture = { observations: [], artifacts: [] };
    for (const journey of journeys) {
      const captured = await captureJourney(browser, target, journey, options);
      browserCapture.observations.push(captured.browserObservation);
      browserCapture.artifacts.push(...captured.artifacts);
      accessibilityCapture.observations.push(captured.accessibilityObservation);
    }
    return { browser: browserCapture, accessibility: accessibilityCapture };
  } finally {
    await browser.close();
  }
}

async function captureJourney(browser: Browser, target: string, journey: BrowserJourney, options: BrowserCaptureOptions) {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(options.timeoutMs ?? 10_000);
  const consoleErrors: string[] = [];
  const network: Array<{ method: string; url: string; status: number }> = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('response', (response) => {
    network.push({ method: response.request().method(), url: response.url(), status: response.status() });
  });

  try {
    for (const [index, step] of journey.steps.entries()) {
      try {
        await executeStep(page, target, step);
      } catch (error) {
        throw new Error(`browser journey "${journey.name}" failed at step ${index + 1}: ${describeStep(step)}\n${String(error)}`);
      }
    }

    const significantDom = await page.locator('body').evaluate(() => {
      const elements = [...document.querySelectorAll('button,a,input,select,textarea,dialog,form,[role]')].slice(0, 400);
      return elements.map((element) => ({
        tag: element.tagName.toLowerCase(),
        role: element.getAttribute('role'),
        name: element.getAttribute('aria-label') ?? element.getAttribute('name') ?? element.textContent?.replace(/\s+/g, ' ').trim().slice(0, 200) ?? '',
        href: element instanceof HTMLAnchorElement ? element.getAttribute('href') : null,
        type: element instanceof HTMLInputElement || element instanceof HTMLButtonElement ? element.type : null,
        disabled: 'disabled' in element ? Boolean((element as HTMLButtonElement).disabled) : false,
      }));
    });
    const visibleText = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim().slice(0, 20_000);
    const cookies = (await context.cookies()).map((cookie) => ({
      name: cookie.name,
      value: '<REDACTED>',
      domain: cookie.domain,
      path: cookie.path,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
    }));
    const localStorageKeys = await page.evaluate(() => Object.keys(localStorage).sort());
    const focused = await page.evaluate(() => {
      const element = document.activeElement;
      if (!(element instanceof HTMLElement)) return null;
      return { tag: element.tagName.toLowerCase(), id: element.id || null, role: element.getAttribute('role'), name: element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 100) ?? null };
    });

    const evidenceId = `browser-${slug(journey.name)}`;
    const artifacts: CapturedArtifact[] = [];
    if (options.screenshot ?? true) {
      const bytes = await page.screenshot({ fullPage: true });
      artifacts.push({
        ref: {
          id: `${evidenceId}-screenshot`, kind: 'screenshot', path: `artifacts/browser/${slug(journey.name)}.png`,
          mediaType: 'image/png', sha256: `sha256:${createHash('sha256').update(bytes).digest('hex')}`, redacted: false,
        },
        content: bytes.toString('base64'), encoding: 'base64',
      });
    }
    const state = { url: page.url(), visibleText, significantDom, cookies, localStorageKeys, consoleErrors, network, focused };
    const content = JSON.stringify(state, null, 2);
    artifacts.push({
      ref: {
        id: evidenceId, kind: 'browser_state', path: `artifacts/browser/${slug(journey.name)}.json`, mediaType: 'application/json',
        sha256: `sha256:${createHash('sha256').update(content).digest('hex')}`, redacted: true,
      }, content,
    });
    const browserObservation: Observation = {
      id: `journey:${journey.name}`,
      kind: 'browser_journey',
      name: journey.name,
      attributes: state,
      evidence: artifacts.map((artifact) => artifact.ref.id),
    };
    const accessibilityObservation = await captureAccessibilityState(page, `journey:${journey.name}`);
    accessibilityObservation.evidence = [evidenceId];
    return { browserObservation, accessibilityObservation, artifacts };
  } finally {
    await context.close();
  }
}

async function executeStep(page: Page, target: string, step: JourneyStep): Promise<void> {
  if ('goto' in step) { await page.goto(new URL(step.goto, ensureTrailingSlash(target)).toString(), { waitUntil: 'networkidle' }); return; }
  if ('click' in step) { await page.locator(step.click.selector).click(); return; }
  if ('fill' in step) { await page.locator(step.fill.selector).fill(step.fill.value); return; }
  if ('press' in step) { await page.locator(step.press.selector).press(step.press.key); return; }
  if ('waitFor' in step) { await page.locator(step.waitFor.selector).waitFor({ state: step.waitFor.state ?? 'visible' }); return; }
  if ('expect' in step) {
    if (step.expect.url !== undefined && !page.url().includes(step.expect.url)) throw new Error(`expected URL to include ${step.expect.url}; got ${page.url()}`);
    if (step.expect.text !== undefined && !(await page.locator('body').innerText()).includes(step.expect.text)) throw new Error(`expected page text to include ${step.expect.text}`);
    if (step.expect.selector !== undefined && !(await page.locator(step.expect.selector).isVisible())) throw new Error(`expected ${step.expect.selector} to be visible`);
  }
}

function describeStep(step: JourneyStep): string { return JSON.stringify(step); }
function ensureTrailingSlash(value: string): string { return value.endsWith('/') ? value : `${value}/`; }
function slug(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 96); }
