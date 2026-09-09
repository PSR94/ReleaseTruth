import { ProductGrid } from '../../components/ProductGrid';
import { searchProducts } from '../../lib/products';

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams;
  const results = searchProducts(q);
  return (
    <section className="page-stack">
      <div className="page-header"><span className="eyebrow">Catalog search</span><h1>Find your next useful thing.</h1><p>Search names, categories, and descriptions.</p></div>
      <form className="search-form" action="/search"><label htmlFor="q">Search products</label><div><input id="q" name="q" defaultValue={q} placeholder="Try “desk”" /><button type="submit">Search</button></div></form>
      <p className="result-count" aria-live="polite">{results.length} result{results.length === 1 ? '' : 's'}{q ? ` for “${q}”` : ''}</p>
      <ProductGrid items={results} />
    </section>
  );
}
