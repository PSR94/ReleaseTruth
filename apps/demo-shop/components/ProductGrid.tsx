import Link from 'next/link';
import type { Product } from '../lib/products';

export function ProductGrid({ items }: { items: Product[] }) {
  return (
    <div className="product-grid" aria-label="Products">
      {items.map((product) => (
        <article className="product-card" key={product.id}>
          <div className={`product-art accent-${product.accent}`} aria-hidden="true"><span>{product.name.slice(0, 1)}</span></div>
          <div className="product-copy">
            <span className="eyebrow">{product.category}</span>
            <h2>{product.name}</h2>
            <p>{product.description}</p>
            <div className="product-footer"><strong>${product.price}</strong><Link href={`/cart?add=${product.id}`}>Add to cart</Link></div>
          </div>
        </article>
      ))}
    </div>
  );
}
