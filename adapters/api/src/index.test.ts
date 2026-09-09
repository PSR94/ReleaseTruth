import { describe, expect, it } from 'vitest';
import { redactRecord } from './index.js';

describe('API redaction', () => {
  it('redacts credentials and preserves ordinary headers deterministically', () => {
    expect(redactRecord({ Authorization: 'Bearer secret', 'X-Trace': 'abc', Cookie: 'sid=123' })).toEqual({
      authorization: '<REDACTED>',
      cookie: '<REDACTED>',
      'x-trace': 'abc',
    });
  });
});
