import { describe, expect, it } from 'vitest';
import { captureCli } from './index.js';

describe('CLI adapter', () => {
  it('captures stdout and exit code without shell interpolation', async () => {
    const capture = await captureCli([{ id: 'node-ok', executable: process.execPath, args: ['-e', 'process.stdout.write("ok")'] }]);
    expect(capture.observations[0]?.attributes).toMatchObject({ stdout: 'ok', exitCode: 0, timedOut: false });
  });
});
