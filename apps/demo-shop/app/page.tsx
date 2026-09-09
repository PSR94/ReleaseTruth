import Link from 'next/link';
import { ProductGrid } from '../components/ProductGrid';
import { products } from '../lib/products';
import { currentVariant } from '../lib/variant';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const variant = currentVariant();
  return (
    <>
      <section className="hero">
        <div>
          <span className="eyebrow">TruthShop collection · {variant === 'good' ? 'stable release' : 'candidate release'}</span>
          <h1>Useful objects for people who notice the details.</h1>
          <p>TruthShop is a real, intentionally small storefront used to demonstrate changes that a normal code diff cannot summarize for users.</p>
          <div className="hero-actions"><Link className="button primary" href="/search">Search products</Link><Link className="button" href="/checkout">Try checkout</Link></div>
        </div>
        <aside className="hero-proof" aria-label="Store promises"><b>6</b><span>curated products</span><b>30d</b><span>returns</span><b>1%</b><span>for open source</span></aside>
      </section>
      <section className="section-heading"><div><span className="eyebrow">Catalog</span><h2>Small batch essentials</h2></div><p>Designed for the workbench, desk, and commute.</p></section>
      <ProductGrid items={products} />
    </>
  );
}
