import { describe, expect, it } from 'vitest';
import { createDraft, mergeCapture } from './index.js';

describe('behavior draft helpers', () => {
  it('merges one adapter without inventing a fingerprint', () => {
    const draft = createDraft('v1');
    mergeCapture(draft, 'api', {
      observations: [{ id: 'GET /health', kind: 'http_exchange', attributes: { status: 200 } }],
      artifacts: [],
    });
    expect(draft.surfaces.api).toHaveLength(1);
    expect(draft.fingerprint).toBe('');
  });
});
