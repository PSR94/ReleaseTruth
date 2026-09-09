import { describe, expect, it } from 'vitest';
import { behaviorFor } from './variant';

describe('TruthShop demo variants', () => {
  it('contains intentional cross-surface regressions', () => {
    const base = behaviorFor('good');
    const candidate = behaviorFor('regression');
    expect([base.invalidOrderStatus, candidate.invalidOrderStatus]).toEqual([400, 422]);
    expect([base.checkoutKeyboardAccessible, candidate.checkoutKeyboardAccessible]).toEqual([true, false]);
    expect(candidate.searchDelayMs).toBeGreaterThan(base.searchDelayMs * 5);
    expect(candidate.eventOrder).toEqual([...base.eventOrder].reverse());
    expect([base.cliSuccessExitCode, candidate.cliSuccessExitCode]).toEqual([0, 1]);
    expect([base.profileSaveLabel, candidate.profileSaveLabel]).toEqual(['Save Profile', 'Save']);
  });
});
