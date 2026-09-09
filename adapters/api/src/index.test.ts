import { describe, expect, it } from 'vitest';
import { redactRecord, sanitizeSetCookie } from './index.js';

describe('API redaction', () => {
  it('redacts credentials and preserves ordinary headers deterministically', () => {
    expect(redactRecord({ Authorization: 'Bearer secret', 'X-Trace': 'abc', Cookie: 'sid=123' })).toEqual({
      authorization: '<REDACTED>', cookie: '<REDACTED>', 'x-trace': 'abc',
    });
  });

  it('preserves cookie attributes while redacting the secret value', () => {
    expect(sanitizeSetCookie('truthshop_session=secret; Path=/; HttpOnly; SameSite=Lax'))
      .toBe('truthshop_session=<REDACTED>; Path=/; HttpOnly; SameSite=Lax');
  });
});
