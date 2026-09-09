import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Nav } from '../components/Nav';
import './globals.css';

export const metadata: Metadata = {
  title: 'ReleaseTruth Dashboard',
  description: 'Evidence-backed behavioral release compatibility history.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="shell">{children}</main>
        <footer>ReleaseTruth · deterministic evidence first · AI optional</footer>
      </body>
    </html>
  );
}
