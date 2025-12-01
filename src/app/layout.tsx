import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import Link from 'next/link';
import Logo from '@/components/Logo';

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
        <nav className="bg-gray-300 p-4 text-white">
          <Link href="/" className="text-xl font-bold">
            <Logo height="2.5rem" width="100%" className="block fill-white" />
          </Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
