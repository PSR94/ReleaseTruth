import { CheckoutPanel } from './CheckoutPanel';
import { behaviorFor, currentVariant } from '../../lib/variant';

export default function CheckoutPage() {
  const behavior = behaviorFor(currentVariant());
  return (
    <section className="page-stack">
      <div className="page-header"><span className="eyebrow">Checkout</span><h1>Review and pay.</h1><p>Your cart is reserved while you complete payment.</p></div>
      <CheckoutPanel keyboardAccessible={behavior.checkoutKeyboardAccessible} confirmDestructive={behavior.destructiveConfirmation} layoutOrder={behavior.layoutOrder} />
    </section>
  );
}
