'use client';

import Link from 'next/link';

type CategoryInfo = {
  id: number;
  label: string;
  basename: string;
  count: number;
};

type ArchiveFooterProps = {
  categories: CategoryInfo[];
  years: string[];
  currentYear: string;
  currentCategory?: string;
  getYearCount: (year: string) => number;
  getCategoryCountForYear: (categoryBasename: string, year: string) => number;
  allPostsInYearCount: number;
};

export default function Footer({
  categories,
  years,
  currentYear,
  currentCategory = 'all',
  getYearCount,
  getCategoryCountForYear,
  allPostsInYearCount,
}: ArchiveFooterProps) {
  return (
    <footer className="bg-gray-300 text-gray-500 mt-16">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* カテゴリー一覧 */}
          <div>
            <h3 className="text-lg font-bold mb-4 text-gray-400">Categories</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href={`/archive/all/year/${currentYear}/page/1`}
                  className="hover:text-gray-400 transition-colors"
                >
                  All Categories ({allPostsInYearCount})
                </Link>
              </li>
              {categories.slice(0, 8).map((cat) => {
                const yearCount = getCategoryCountForYear(
                  cat.basename,
                  currentYear
                );
                if (yearCount === 0) return null;

                return (
                  <li key={cat.id}>
                    <Link
                      href={`/archive/${cat.basename}/year/${currentYear}/page/1`}
                      className="hover:text-gray-400 transition-colors"
                    >
                      {cat.label} ({yearCount})
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* 年別アーカイブ */}
          <div>
            <h3 className="text-lg font-bold mb-4 text-gray-400">
              Archives by Year
            </h3>
            <ul className="space-y-2 text-sm">
              {years.map((y) => {
                const count = getYearCount(y);
                if (count === 0) return null;

                return (
                  <li key={y}>
                    <Link
                      href={`/archive/${currentCategory}/year/${y}/page/1`}
                      className="hover:text-gray-400 transition-colors"
                    >
                      {y} ({count} entries)
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* サイト情報 */}
          <div>
            <h3 className="text-lg font-bold mb-4 text-gray-400">Archive</h3>
            <p className="text-sm text-gray-400 mb-4">
              タイムライン形式で過去の記事を閲覧できます。カテゴリーや年別でフィルタリングが可能です。
            </p>
            <Link
              href={`/archive/all/year/${currentYear}/page/1`}
              className="inline-block px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
            >
              View All Posts
            </Link>
          </div>
        </div>

        <div className="border-t border-gray-700 mt-8 pt-8 text-center text-sm text-gray-500">
          <p>© {new Date().getFullYear()} Archive. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
