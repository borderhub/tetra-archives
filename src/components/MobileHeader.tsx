'use client';

import Link from 'next/link';

type MobileHeaderProps = {
  year: string;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
};

export default function MobileHeader({
  year,
  sidebarOpen,
  onToggleSidebar,
}: MobileHeaderProps) {
  return (
    <header className="lg:hidden sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
      <div className="flex items-center justify-between px-4 py-4">
        <Link
          href={`/archive/all/year/${year}/page/1`}
          className="text-2xl font-black tracking-wider"
        >
          ARCHIVE
        </Link>
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Toggle menu"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {sidebarOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
      </div>
    </header>
  );
}
