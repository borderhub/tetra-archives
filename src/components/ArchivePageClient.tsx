'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import MobileHeader from '@/components/MobileHeader';
import Sidebar from '@/components/Sidebar';
import SidebarNavigation from '@/components/SidebarNavigation';
import Footer from '@/components/Footer';
import Pagination from '@/components/Pagination';
import { stripHtmlTags } from '@/helper';

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
  thumbnail: string | null;
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

  // ヘルパー関数
  const getCategoryCountForYear = (categoryBasename: string, targetYear: string) => {
    return allPosts.filter(p => 
      p.year === targetYear && p.categories.some(c => c.basename === categoryBasename)
    ).length;
  };

  const getYearCount = (targetYear: string) => {
    return allPosts.filter(p => p.year === targetYear).length;
  };

  const allPostsInYearCount = allPosts.filter(p => p.year === year).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* ヘッダー（モバイル用） */}
      <MobileHeader 
        year={year}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className="flex">
        {/* サイドバー */}
        <Sidebar
          title="ARCHIVE"
          titleLink={`/archive/all/year/${year}/page/1`}
          mobileTitle="MENU"
          isMobile={isMobile}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        >
          <SidebarNavigation
            categories={uniqueCategories}
            years={uniqueYears}
            currentCategory={category}
            currentYear={year}
            isMobile={isMobile}
            onLinkClick={() => setSidebarOpen(false)}
            getCategoryCountForYear={getCategoryCountForYear}
            getYearCount={getYearCount}
            allPostsInYearCount={allPostsInYearCount}
          />
        </Sidebar>

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
                        {/* ★ サムネイル画像（なければ no-image.png） */}
                        <Link href={`/posts/${post.slug}`} className="pb-4 block">
                        { post.thumbnail ?
                            <img
                                src={post.thumbnail}
                                alt={post.title}
                                className="w-full h-48 object-cover border-b border-gray-200 group-hover:opacity-90 transition"
                            />
                            : <svg width="100%" height="100%" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect width="1200" height="640" fill="#f3f4f6"/>
                                <path d="M300 200 L900 430 L900 200 Z" fill="#e5e7eb"/>
                                <circle cx="600" cy="315" r="120" fill="#d1d5db"/>
                                <path d="M550 280 L650 380 M650 280 L550 380" stroke="#9ca3af" strokeWidth="40" strokeLinecap="round"/>
                                <text x="600" y="520" fontFamily="system-ui, sans-serif" fontSize="80" fill="#6b7280" textAnchor="middle">NO IMAGE</text>
                            </svg>
                        }
                        </Link>
                        <h3 className="text-xl font-bold mb-3 leading-tight text-gray-900 group-hover:text-gray-600 transition-colors">
                          <Link href={`/posts/${post.slug}`} className="block">
                            {stripHtmlTags(post.title)}
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
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            maxDisplay={MAX_PAGES_DISPLAY}
            baseUrl={`/archive/${category}/year/${year}/page`}
          />
        </main>
      </div>

      {/* フッター */}
      <Footer
        categories={uniqueCategories}
        years={uniqueYears}
        allPostsCount={allPosts.length}
        currentYear={year}
        currentCategory={category}
        getYearCount={getYearCount}
      />
    </div>
  );
}
