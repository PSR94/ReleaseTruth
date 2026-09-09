import Link from 'next/link';

export function Nav() {
  return (
    <header className="topbar">
      <Link className="brand" href="/" aria-label="ReleaseTruth dashboard home">
        <span className="brandMark" aria-hidden="true">RT</span>
        <span>ReleaseTruth</span>
      </Link>
      <nav aria-label="Dashboard navigation">
        <Link href="/">Overview</Link>
        <a href="https://github.com/PSR94/ReleaseTruth">Repository</a>
      </nav>
    </header>
  );
}
