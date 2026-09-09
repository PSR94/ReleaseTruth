import Link from 'next/link';
import { products } from '../../lib/products';

export default async function CartPage({ searchParams }: { searchParams: Promise<{ add?: string }> }) {
  const { add } = await searchParams;
  const item = products.find((product) => product.id === add) ?? products[0]!;
  return (
    <section className="page-stack narrow">
      <div className="page-header"><span className="eyebrow">Cart</span><h1>Your cart</h1><p>One item, ready for the behavioral checkout journey.</p></div>
      <div className="cart-row"><div className={`mini-art accent-${item.accent}`}>{item.name[0]}</div><div><strong>{item.name}</strong><span>Qty 1</span></div><b>${item.price}</b></div>
      <div className="summary"><span>Subtotal <b>${item.price}</b></span><span>Shipping <b>Free</b></span><span className="total">Total <b>${item.price}</b></span></div>
      <Link className="button primary full" href="/checkout">Continue to checkout</Link>
    </section>
  );
}
