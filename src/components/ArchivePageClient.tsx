'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

const POSTS_PER_PAGE = 10;
const MAX_PAGES_DISPLAY = 10;

type CategoryBaseInfo = {
  id: number;
  label: string;
  basename: string;
  path: string[];
};

type PostMeta = {
  slug: string;
  id: number;
  title: string;
  date: string;
  year: string;
  excerpt: string;
  categories: CategoryBaseInfo[];
};

export default function ArchivePageClient({ 
  allPosts,
  category,
  year,
  page: pageStr
}: { 
  allPosts: PostMeta[];
  category: string;
  year: string;
  page: string;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const currentPage = parseInt(pageStr, 10);
  if (isNaN(currentPage) || currentPage < 1) notFound();

  // ========== フィルタリング ==========
  let filtegrayPosts = allPosts;

  if (category !== 'all') {
    filtegrayPosts = filtegrayPosts.filter(post =>
      post.categories.some(c => c.basename === category)
    );
  }

  filtegrayPosts = filtegrayPosts.filter(post => post.year === year);
  
  const totalPosts = filtegrayPosts.length;
  const totalPages = Math.max(1, Math.ceil(totalPosts / POSTS_PER_PAGE));
  if (currentPage > totalPages) notFound();

  const paginatedPosts = filtegrayPosts.slice(
    (currentPage - 1) * POSTS_PER_PAGE,
    currentPage * POSTS_PER_PAGE
  );

  // サイドバー用データ
  const categoryMap = new Map<number, { id: number; label: string; basename: string; count: number }>();
  allPosts.forEach(post => {
    post.categories.forEach(cat => {
      if (!categoryMap.has(cat.id)) categoryMap.set(cat.id, { ...cat, count: 0 });
      categoryMap.get(cat.id)!.count++;
    });
  });

  const uniqueCategories = Array.from(categoryMap.values())
    .sort((a, b) => a.label.localeCompare(b.label, 'ja'));

  const uniqueYears = Array.from(new Set(allPosts.map(p => p.year)))
    .sort((a, b) => b.localeCompare(a));

  const currentCategoryLabel = category === 'all'
    ? 'ALL'
    : uniqueCategories.find(c => c.basename === category)?.label || category.toUpperCase();

  // ナビゲーションコンポーネント
  const NavigationContent = () => (
    <>
      <section className="mb-8 pb-6 border-b border-gray-200">
        <h2 className={`text-xs font-bold uppercase mb-4 tracking-wider ${category !== 'all' ? 'text-gray-600' : 'text-gray-600'}`}>
          Category
        </h2>
        <ul className="space-y-2">
          <li>
            <Link 
              href={`/archive/all/year/${year}/page/1`} 
              className={`block px-3 py-2 rounded-lg transition-all duration-200 ${
                category === 'all' 
                  ? 'bg-gray-600 text-white font-semibold' 
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
              onClick={() => isMobile && setSidebarOpen(false)}
            >
              <span className="flex justify-between items-center">
                <span>All Categories</span>
                <span className="text-xs opacity-70">({allPosts.filter(p => p.year === year).length})</span>
              </span>
            </Link>
          </li>
          {uniqueCategories.map(cat => (
            <li key={cat.id}>
              <Link
                href={`/archive/${cat.basename}/year/${year}/page/1`}
                className={`block px-3 py-2 rounded-lg transition-all duration-200 ${
                  category === cat.basename 
                    ? 'bg-gray-600 text-white font-semibold' 
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
                onClick={() => isMobile && setSidebarOpen(false)}
              >
                <span className="flex justify-between items-center">
                  <span>{cat.label}</span>
                  <span className="text-xs opacity-70">
                    ({allPosts.filter(p => p.year === year && p.categories.some(c => c.basename === cat.basename)).length})
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-xs font-bold uppercase mb-4 tracking-wider text-gray-600">
          Year
        </h2>
        <ul className="space-y-2">
          {uniqueYears.map(y => (
            <li key={y}>
              <Link
                href={`/archive/${category}/year/${y}/page/1`}
                className={`block px-3 py-2 rounded-lg transition-all duration-200 ${
                  y === year 
                    ? 'bg-gray-600 text-white font-semibold' 
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
                onClick={() => isMobile && setSidebarOpen(false)}
              >
                <span className="flex justify-between items-center">
                  <span>{y}</span>
                  <span className="text-xs opacity-70">({allPosts.filter(p => p.year === y).length})</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* ヘッダー（モバイル用） */}
      <header className="lg:hidden sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-4 py-4">
          <Link href={`/archive/all/year/${year}/page/1`} className="text-2xl font-black tracking-wider">
            ARCHIVE
          </Link>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {sidebarOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </header>

      <div className="flex">
        {/* サイドバー（デスクトップ） */}
        <aside className="hidden lg:block w-80 bg-white border-r border-gray-200 sticky top-0 h-screen overflow-y-auto shadow-lg">
          <div className="p-8">
            <h1 className="text-3xl font-black mb-10 tracking-wider">
              <Link href={`/archive/all/year/${year}/page/1`} className="hover:text-gray-600 transition-colors">
                ARCHIVE
              </Link>
            </h1>
            <NavigationContent />
          </div>
        </aside>

        {/* サイドバー（モバイル - オーバーレイ） */}
        {isMobile && (
          <>
            {/* オーバーレイ背景 */}
            <div
              className={`fixed inset-0 bg-black transition-opacity duration-300 z-40 lg:hidden ${
                sidebarOpen ? 'opacity-50' : 'opacity-0 pointer-events-none'
              }`}
              onClick={() => setSidebarOpen(false)}
            />
            
            {/* サイドバーパネル */}
            <aside
              className={`fixed top-0 left-0 h-full w-80 bg-white shadow-2xl transform transition-transform duration-300 z-50 lg:hidden overflow-y-auto ${
                sidebarOpen ? 'translate-x-0' : '-translate-x-full'
              }`}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-black tracking-wider">MENU</h2>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    aria-label="Close menu"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <NavigationContent />
              </div>
            </aside>
          </>
        )}

        {/* メインコンテンツ */}
        <main className="flex-1 p-4 lg:p-8 max-w-6xl mx-auto w-full">
          {/* タイトル */}
          <div className="mb-8 bg-white rounded-lg shadow-md p-6 border-l-4 border-gray-600">
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-900">
              {currentCategoryLabel} <span className="text-gray-600">・</span> {year}
            </h2>
            <p className="text-sm text-gray-600 mt-2">{totalPosts} entries found</p>
          </div>

          {/* タイムライン */}
          <div className="relative">
            {/* 縦線（デスクトップ） */}
            <div className="hidden lg:block absolute top-0 bottom-0 left-8 w-0.5 bg-gradient-to-b from-gray-600 via-gray-400 to-gray-200"></div>
            
            <div className="space-y-8">
              {paginatedPosts.length > 0 ? (
                paginatedPosts.map((post, index) => (
                  <article
                    key={post.slug}
                    className="relative lg:pl-20 group"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    {/* タイムラインドット */}
                    <div className="hidden lg:flex absolute left-6 top-4 w-5 h-5 rounded-full bg-gray-600 border-4 border-white shadow-lg z-10 group-hover:scale-125 transition-transform duration-200"></div>
                    
                    {/* 日付バッジ（モバイル） */}
                    <div className="lg:hidden mb-3 inline-block bg-gray-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                      {post.date}
                    </div>

                    {/* 日付（デスクトップ） */}
                    <div className="hidden lg:block absolute left-0 top-0 text-right pr-12 w-20">
                      <div className="text-sm font-bold text-gray-900">{post.year}</div>
                      <div className="text-xs text-gray-500">{post.date.split('-').slice(1).join('/')}</div>
                    </div>

                    {/* カードコンテンツ */}
                    <div className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200 group-hover:border-gray-600">
                      <div className="p-6">
                        <h3 className="text-xl font-bold mb-3 leading-tight text-gray-900 group-hover:text-gray-600 transition-colors">
                          <Link href={`/posts/${post.slug}`} className="block">
                            {post.title}
                          </Link>
                        </h3>
                        
                        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                          {post.excerpt}
                        </p>
                        
                        {/* カテゴリタグ */}
                        <div className="flex flex-wrap gap-2">
                          {post.categories.map(cat => (
                            <Link
                              key={cat.id}
                              href={`/archive/${cat.basename}/year/${year}/page/1`}
                              className="inline-block px-3 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full hover:bg-gray-600 hover:text-white transition-colors duration-200"
                            >
                              {cat.label}
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="text-center py-12 bg-white rounded-lg shadow-md">
                  <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-gray-500 text-lg">該当する記事は見つかりませんでした</p>
                </div>
              )}
            </div>
          </div>

          {/* ページネーション */}
          {totalPages > 1 && (
            <nav className="mt-12 bg-white rounded-lg shadow-md p-6">
              <div className="text-sm text-gray-600 text-center mb-4">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {currentPage > 1 && (
                  <Link 
                    href={`/archive/${category}/year/${year}/page/${currentPage - 1}`} 
                    className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-600 hover:text-white hover:border-gray-600 transition-all duration-200 font-medium"
                  >
                    ← Prev
                  </Link>
                )}
                
                {Array.from({ length: Math.min(MAX_PAGES_DISPLAY, totalPages) }, (_, i) => i + 1).map(n => (
                  <Link
                    key={n}
                    href={`/archive/${category}/year/${year}/page/${n}`}
                    className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                      n === currentPage 
                        ? 'bg-gray-600 text-white shadow-md' 
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {n}
                  </Link>
                ))}
                
                {currentPage < totalPages && (
                  <Link 
                    href={`/archive/${category}/year/${year}/page/${currentPage + 1}`} 
                    className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-600 hover:text-white hover:border-gray-600 transition-all duration-200 font-medium"
                  >
                    Next →
                  </Link>
                )}
              </div>
            </nav>
          )}
        </main>
      </div>

      {/* フッター */}
      <footer className="bg-gray-800 text-white mt-16">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* カテゴリー一覧 */}
            <div>
              <h3 className="text-lg font-bold mb-4 text-gray-400">Categories</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href={`/archive/all/year/${year}/page/1`} className="hover:text-gray-400 transition-colors">
                    All Categories ({allPosts.length})
                  </Link>
                </li>
                {uniqueCategories.slice(0, 8).map(cat => (
                  <li key={cat.id}>
                    <Link 
                      href={`/archive/${cat.basename}/year/${year}/page/1`} 
                      className="hover:text-gray-400 transition-colors"
                    >
                      {cat.label} ({cat.count})
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* 年別アーカイブ */}
            <div>
              <h3 className="text-lg font-bold mb-4 text-gray-400">Archives by Year</h3>
              <ul className="space-y-2 text-sm">
                {uniqueYears.map(y => (
                  <li key={y}>
                    <Link 
                      href={`/archive/${category}/year/${y}/page/1`} 
                      className="hover:text-gray-400 transition-colors"
                    >
                      {y} ({allPosts.filter(p => p.year === y).length} entries)
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* サイト情報 */}
            <div>
              <h3 className="text-lg font-bold mb-4 text-gray-400">Archive</h3>
              <p className="text-sm text-gray-400 mb-4">
                タイムライン形式で過去の記事を閲覧できます。カテゴリーや年別でフィルタリングが可能です。
              </p>
              <Link 
                href="/archive/all/year/2025/page/1" 
                className="inline-block px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
              >
                View All Posts
              </Link>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-500">
            <p>© 2025 Archive. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
