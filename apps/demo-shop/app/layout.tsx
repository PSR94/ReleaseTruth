import type { Metadata } from 'next';
import { Nav } from '../components/Nav';
import './globals.css';

export const metadata: Metadata = {
  title: 'TruthShop — ReleaseTruth Demo',
  description: 'A realistic demonstration storefront for behavioral release comparison.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main>{children}</main>
        <footer><span>TruthShop</span><span>Built to make release behavior observable.</span></footer>
      </body>
    </html>
  );
}
