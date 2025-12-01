'use client';

import Link from 'next/link';

type CategoryInfo = {
  id: number;
  label: string;
  basename: string;
  count: number;
};

type SidebarNavigationProps = {
  categories: CategoryInfo[];
  years: string[];
  currentCategory: string;
  currentYear: string;
  isMobile: boolean;
  onLinkClick: () => void;
  getCategoryCountForYear: (categoryBasename: string, year: string) => number;
  getYearCount: (year: string) => number;
  allPostsInYearCount: number;
};

export default function SidebarNavigation({
  categories,
  years,
  currentCategory,
  currentYear,
  isMobile,
  onLinkClick,
  getCategoryCountForYear,
  getYearCount,
  allPostsInYearCount,
}: SidebarNavigationProps) {
  return (
    <>
      <section className="mb-8 pb-6 border-b border-gray-200">
        <h2 className="text-xs font-bold uppercase mb-4 tracking-wider text-gray-600">
          Category
        </h2>
        <ul className="space-y-2">
          {allPostsInYearCount > 0 && (
            <li>
              <Link
                href={`/archive/all/year/${currentYear}/page/1`}
                className={`block px-3 py-2 rounded-lg transition-all duration-200 ${
                  currentCategory === 'all'
                    ? 'bg-gray-600 text-white font-semibold'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
                onClick={() => isMobile && onLinkClick()}
              >
                <span className="flex justify-between items-center">
                  <span>All Categories</span>
                  <span className="text-xs opacity-70">
                    ({allPostsInYearCount})
                  </span>
                </span>
              </Link>
            </li>
          )}
          {categories.map((cat) => {
            const count = getCategoryCountForYear(cat.basename, currentYear);
            if (count === 0) return null;

            return (
              <li key={cat.id}>
                <Link
                  href={`/archive/${cat.basename}/year/${currentYear}/page/1`}
                  className={`block px-3 py-2 rounded-lg transition-all duration-200 ${
                    currentCategory === cat.basename
                      ? 'bg-gray-600 text-white font-semibold'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                  onClick={() => isMobile && onLinkClick()}
                >
                  <span className="flex justify-between items-center">
                    <span>{cat.label}</span>
                    <span className="text-xs opacity-70">
                      ({count})
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="text-xs font-bold uppercase mb-4 tracking-wider text-gray-600">
          Year
        </h2>
        <ul className="space-y-2">
          {years.map((y) => {
            const count = getYearCount(y);
            if (count === 0) return null;

            return (
              <li key={y}>
                <Link
                  href={`/archive/${currentCategory}/year/${y}/page/1`}
                  className={`block px-3 py-2 rounded-lg transition-all duration-200 ${
                    y === currentYear
                      ? 'bg-gray-600 text-white font-semibold'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                  onClick={() => isMobile && onLinkClick()}
                >
                  <span className="flex justify-between items-center">
                    <span>{y}</span>
                    <span className="text-xs opacity-70">
                      ({count})
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
