export type TruthShopVariant = 'good' | 'regression';

export function currentVariant(): TruthShopVariant {
  return process.env.TRUTHSHOP_VARIANT === 'regression' ? 'regression' : 'good';
}

export function behaviorFor(variant: TruthShopVariant) {
  return {
    invalidOrderStatus: variant === 'good' ? 400 : 422,
    invalidOrderBody: variant === 'good'
      ? { error: 'Invalid quantity' }
      : { message: 'Validation failed', field: 'quantity' },
    searchDelayMs: variant === 'good' ? 20 : 220,
    profileSaveLabel: variant === 'good' ? 'Save Profile' : 'Save',
    checkoutKeyboardAccessible: variant === 'good',
    destructiveConfirmation: variant === 'good',
    eventOrder: variant === 'good'
      ? ['payment.completed', 'invoice.generated']
      : ['invoice.generated', 'payment.completed'],
    cliSuccessExitCode: variant === 'good' ? 0 : 1,
    sessionSameSite: variant === 'good' ? 'lax' : 'none',
    layoutOrder: variant === 'good' ? 'details-first' : 'summary-first',
  } as const;
}
