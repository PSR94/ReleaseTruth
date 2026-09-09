'use client';

import { useState } from 'react';

export function CheckoutPanel({ keyboardAccessible, confirmDestructive, layoutOrder }: { keyboardAccessible: boolean; confirmDestructive: boolean; layoutOrder: string }) {
  const [message, setMessage] = useState('');
  async function placeOrder() {
    const response = await fetch('/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ quantity: 1 }) });
    setMessage(response.ok ? 'Order placed successfully.' : 'Checkout failed.');
  }
  function cancelOrder() {
    if (confirmDestructive && !window.confirm('Cancel checkout and clear your cart?')) return;
    setMessage('Checkout cancelled.');
  }

  const form = (
    <section className="checkout-card" aria-labelledby="payment-heading">
      <span className="eyebrow">Payment</span><h2 id="payment-heading">Complete your order</h2>
      <label>Email<input name="email" type="email" defaultValue="demo@example.com" /></label>
      <label>Card number<input name="card" inputMode="numeric" defaultValue="4242 4242 4242 4242" /></label>
      <div className="field-row"><label>Expiry<input name="expiry" defaultValue="12/30" /></label><label>CVC<input name="cvc" defaultValue="123" /></label></div>
      {keyboardAccessible ? (
        <button data-testid="pay" className="button primary full" type="button" onClick={placeOrder}>Pay $89</button>
      ) : (
        <div data-testid="pay" className="button primary full faux-button" onClick={placeOrder}>Pay $89</div>
      )}
      <button className="text-button" type="button" onClick={cancelOrder}>Cancel checkout</button>
      <p className="status" role="status">{message}</p>
    </section>
  );
  const summary = <aside className="checkout-summary"><span className="eyebrow">Order summary</span><h2>Signal Lamp</h2><p>Warm / task light · one size</p><div className="summary"><span>Item <b>$89</b></span><span>Shipping <b>Free</b></span><span className="total">Total <b>$89</b></span></div></aside>;
  return <div className={`checkout-grid ${layoutOrder === 'summary-first' ? 'reverse' : ''}`}>{layoutOrder === 'summary-first' ? <>{summary}{form}</> : <>{form}{summary}</>}</div>;
}
