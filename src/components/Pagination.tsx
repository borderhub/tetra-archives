'use client';

import Link from 'next/link';

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  maxDisplay: number;
  baseUrl: string;
};

export default function Pagination({ currentPage, totalPages, maxDisplay, baseUrl }: PaginationProps) {
  if (totalPages <= 1) return null;

  const displayedPages = Array.from(
    { length: Math.min(maxDisplay, totalPages) },
    (_, i) => i + 1
  );

  return (
    <nav className="mt-12 bg-white rounded-lg shadow-md p-6">
      <div className="text-sm text-gray-600 text-center mb-4">
        Page {currentPage} of {totalPages}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {/* Prev ボタン */}
        {currentPage > 1 ? (
          <Link 
            href={`${baseUrl}/${currentPage - 1}`}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-600 hover:text-white hover:border-gray-600 transition-all duration-200 font-medium"
          >
            ← Prev
          </Link>
        ) : (
          <span className="px-4 py-2 bg-gray-100 border border-gray-200 text-gray-400 rounded-lg cursor-not-allowed font-medium">
            ← Prev
          </span>
        )}
        
        {/* ページ番号 */}
        {displayedPages.map(n => (
          <Link
            key={n}
            href={`${baseUrl}/${n}`}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
              n === currentPage 
                ? 'bg-gray-600 text-white shadow-md' 
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
            }`}
          >
            {n}
          </Link>
        ))}
        
        {/* Next ボタン */}
        {currentPage < totalPages ? (
          <Link 
            href={`${baseUrl}/${currentPage + 1}`}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-600 hover:text-white hover:border-gray-600 transition-all duration-200 font-medium"
          >
            Next →
          </Link>
        ) : (
          <span className="px-4 py-2 bg-gray-100 border border-gray-200 text-gray-400 rounded-lg cursor-not-allowed font-medium">
            Next →
          </span>
        )}
      </div>
    </nav>
  );
}
