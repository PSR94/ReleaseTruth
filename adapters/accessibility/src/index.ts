import AxeBuilder from '@axe-core/playwright';
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
    const controls = [...document.querySelectorAll('button,a,input,select,textarea,[role]')]
      .filter(visible)
      .slice(0, 300)
      .map((element, index) => {
        const html = element as HTMLElement;
        const role = element.getAttribute('role') ?? implicitRole(element);
        const accessibleName = element.getAttribute('aria-label')
          ?? element.getAttribute('title')
          ?? (element instanceof HTMLInputElement ? element.labels?.[0]?.textContent : null)
          ?? element.textContent
          ?? '';
        return {
          index,
          tag: element.tagName.toLowerCase(),
          role,
          accessibleName: accessibleName.replace(/\s+/g, ' ').trim().slice(0, 300),
          keyboardFocusable: html.tabIndex >= 0,
          tabIndex: html.tabIndex,
          ariaDisabled: element.getAttribute('aria-disabled'),
          ariaExpanded: element.getAttribute('aria-expanded'),
          ariaChecked: element.getAttribute('aria-checked'),
        };
      });
    const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
      .filter(visible)
      .map((heading) => ({ level: Number(heading.tagName[1]), text: heading.textContent?.replace(/\s+/g, ' ').trim() ?? '' }));
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
        nodes: violation.nodes.map((node) => ({ target: node.target, failureSummary: node.failureSummary })),
      })),
      incomplete: axe.incomplete.map((item) => ({ id: item.id, impact: item.impact, nodeCount: item.nodes.length })),
    },
  };
}
