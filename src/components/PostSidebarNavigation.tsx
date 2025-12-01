'use client';

import Link from 'next/link';
import PdfDownloadButton from '@/components/PdfDownloadButton';

type CategoryInfo = {
  id: number;
  label: string;
  basename: string;
  path: string[];
};

type PostSidebarNavigationProps = {
  year: string;
  categories: CategoryInfo[];
  isMobile: boolean;
  onLinkClick: () => void;
};

export default function PostSidebarNavigation({
  year,
  categories,
  isMobile,
  onLinkClick,
}: PostSidebarNavigationProps) {
  return (
    <>
      <section className="mb-8 pb-6 border-b border-gray-200">
        <h2 className="text-xs font-bold uppercase mb-4 tracking-wider text-gray-600">
          Year
        </h2>
        <Link
          href={`/archive/all/year/${year}/page/1`}
          className="block px-3 py-2 rounded-lg bg-gray-600 text-white font-semibold hover:bg-gray-700 transition-colors"
          onClick={() => isMobile && onLinkClick()}
        >
          {year}
        </Link>
      </section>

      <section className="mb-8">
        <h2 className="text-xs font-bold uppercase mb-4 tracking-wider text-gray-600">
          Categories
        </h2>
        <ul className="space-y-2">
          {categories.map((cat) => (
            <li key={cat.id}>
              <Link
                href={`/archive/${cat.basename}/year/${year}/page/1`}
                className="block px-3 py-2 rounded-lg hover:bg-gray-100 text-gray-700 transition-colors"
                onClick={() => isMobile && onLinkClick()}
              >
                {cat.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <PdfDownloadButton />
      </section>
    </>
  );
}
