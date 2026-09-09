import Link from 'next/link';

export function Nav() {
  return (
    <header className="site-header">
      <Link className="brand" href="/"><span className="brand-mark">RT</span><span>TruthShop</span></Link>
      <nav aria-label="Primary navigation">
        <Link href="/">Shop</Link>
        <Link href="/search">Search</Link>
        <Link href="/cart">Cart</Link>
        <Link href="/orders">Orders</Link>
        <Link href="/account">Account</Link>
      </nav>
    </header>
  );
}
