import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import Link from 'next/link';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'art space tetra archives',
  description: 'art space tetraの活動記録',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <nav className="bg-gray-800 p-4 text-white">
          <Link href="/" className="text-xl font-bold">art space tetra archives</Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
