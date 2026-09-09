import { AxeBuilder } from '@axe-core/playwright';
import type { Page } from 'playwright';
import type { Observation } from '@releasetruth/shared-types';

export async function captureAccessibilityState(page: Page, id: string): Promise<Observation> {
  const axe = await new AxeBuilder({ page }).analyze();
  const semantics = await page.locator('body').evaluate(() => {
    const visible = (element: Element) => {
      const style = getComputedStyle(element as HTMLElement);
      const rect = (element as HTMLElement).getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
    };
    const controls = [...document.querySelectorAll('button,a,input,select,textarea,[role],[data-testid]')]
      .filter(visible)
      .slice(0, 300)
      .map((element, index) => {
        const html = element as HTMLElement;
        const implicit = implicitRole(element);
        const role = element.getAttribute('role') ?? implicit ?? 'generic';
        const accessibleName = element.getAttribute('aria-label')
          ?? element.getAttribute('title')
          ?? (element instanceof HTMLInputElement ? element.labels?.[0]?.textContent : null)
          ?? element.textContent
          ?? '';
        const normalizedName = accessibleName.replace(/\s+/g, ' ').trim().slice(0, 300);
        const stableId = element.getAttribute('data-testid')
          ?? element.getAttribute('id')
          ?? `${role}:${normalizedName || element.getAttribute('name') || index}`;
        return {
          id: stableId,
          tag: element.tagName.toLowerCase(),
          role,
          accessibleName: normalizedName,
          keyboardFocusable: html.tabIndex >= 0,
          tabIndex: html.tabIndex,
          ariaDisabled: element.getAttribute('aria-disabled'),
          ariaExpanded: element.getAttribute('aria-expanded'),
          ariaChecked: element.getAttribute('aria-checked'),
        };
      });
    const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
      .filter(visible)
      .map((heading, index) => ({ id: heading.id || `heading-${index}`, level: Number(heading.tagName[1]), text: heading.textContent?.replace(/\s+/g, ' ').trim() ?? '' }));
    return { controls, headings };

    function implicitRole(element: Element): string | null {
      const tag = element.tagName.toLowerCase();
      if (tag === 'button') return 'button';
      if (tag === 'a' && element.hasAttribute('href')) return 'link';
      if (tag === 'select') return 'combobox';
      if (tag === 'textarea') return 'textbox';
      if (tag === 'input') {
        const type = (element as HTMLInputElement).type;
        if (type === 'checkbox') return 'checkbox';
        if (type === 'radio') return 'radio';
        if (type === 'button' || type === 'submit') return 'button';
        return 'textbox';
      }
      return null;
    }
  });

  return {
    id,
    kind: 'accessibility_snapshot',
    attributes: {
      controls: semantics.controls,
      headings: semantics.headings,
      violations: axe.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        nodes: violation.nodes.map((node, index) => ({ id: `${violation.id}-${index}`, target: node.target, failureSummary: node.failureSummary })),
      })),
      incomplete: axe.incomplete.map((item) => ({ id: item.id, impact: item.impact, nodeCount: item.nodes.length })),
    },
  };
}
