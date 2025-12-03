'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import MobileHeader from '@/components/MobileHeader';
import Sidebar from '@/components/Sidebar';
import SidebarNavigation from '@/components/SidebarNavigation';
import Footer from '@/components/Footer';
import Pagination from '@/components/Pagination';
import { stripHtmlTags } from '@/helper';

const POSTS_PER_PAGE = 10;
const MAX_PAGES_DISPLAY = 10;

// 非表示にするカテゴリのbasenameリスト
const HIDDEN_CATEGORIES = [
  'top', // トップ掲載
  'info', // 事務情報
];

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

// タイトルが画像パスかどうかを判定
const isImagePath = (str: string): boolean => {
  return /^\/title\/\d+\/title\.(gif|jpg|jpeg|png|webp)$/i.test(str);
};

// 表示するカテゴリのみをフィルタリング
const filterVisibleCategories = (
  categories: CategoryBaseInfo[]
): CategoryBaseInfo[] => {
  return categories.filter((cat) => !HIDDEN_CATEGORIES.includes(cat.basename));
};

export default function ArchivePageClient({
  allPosts,
  category,
  year,
  page: pageStr,
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

  // カテゴリが0個の記事は非表示
  filtegrayPosts = filtegrayPosts.filter((post) => post.categories.length > 0);

  if (category !== 'all') {
    filtegrayPosts = filtegrayPosts.filter((post) =>
      post.categories.some((c) => c.basename === category)
    );
  }

  filtegrayPosts = filtegrayPosts.filter((post) => post.year === year);

  const totalPosts = filtegrayPosts.length;
  const totalPages = Math.max(1, Math.ceil(totalPosts / POSTS_PER_PAGE));
  if (currentPage > totalPages) notFound();

  const paginatedPosts = filtegrayPosts.slice(
    (currentPage - 1) * POSTS_PER_PAGE,
    currentPage * POSTS_PER_PAGE
  );

  // サイドバー用データ
  const categoryMap = new Map<
    number,
    { id: number; label: string; basename: string; count: number }
  >();
  allPosts.forEach((post) => {
    post.categories.forEach((cat) => {
      // 非表示カテゴリは除外
      if (HIDDEN_CATEGORIES.includes(cat.basename)) return;

      if (!categoryMap.has(cat.id))
        categoryMap.set(cat.id, { ...cat, count: 0 });
      categoryMap.get(cat.id)!.count++;
    });
  });

  const uniqueCategories = Array.from(categoryMap.values()).sort((a, b) =>
    a.label.localeCompare(b.label, 'ja')
  );

  const uniqueYears = Array.from(new Set(allPosts.map((p) => p.year))).sort(
    (a, b) => b.localeCompare(a)
  );

  const currentCategoryLabel =
    category === 'all'
      ? 'ALL'
      : uniqueCategories.find((c) => c.basename === category)?.label ||
        category.toUpperCase();

  // ヘルパー関数
  const getCategoryCountForYear = (
    categoryBasename: string,
    targetYear: string
  ) => {
    return allPosts.filter(
      (p) =>
        p.year === targetYear &&
        p.categories.some((c) => c.basename === categoryBasename)
    ).length;
  };

  const getYearCount = (targetYear: string) => {
    return allPosts.filter((p) => p.year === targetYear).length;
  };

  const allPostsInYearCount = allPosts.filter((p) => p.year === year).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* ヘッダー(モバイル用) */}
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
              {currentCategoryLabel} <span className="text-gray-600">・</span>{' '}
              {year}
            </h2>
            <p className="text-sm text-gray-600 mt-2">
              {totalPosts} entries found
            </p>
          </div>

          {/* タイムライン */}
          <div className="relative">
            {/* 縦線(デスクトップ) */}
            <div className="hidden lg:block absolute top-0 bottom-0 left-8 w-0.5 bg-gradient-to-b from-gray-600 via-gray-400 to-gray-200"></div>
            <div className="space-y-8">
              {paginatedPosts.length > 0 ? (
                paginatedPosts.map((post, index) => {
                  // excerpt を120文字で切り詰め
                  const truncatedExcerpt =
                    post.excerpt.length > 120
                      ? post.excerpt.slice(0, 120) + '...'
                      : post.excerpt;

                  // タイトルが画像パスかチェック
                  const titleIsImage = isImagePath(post.title);

                  // サムネイル: thumbnailがあればそれを、なければタイトルが画像パスならそれを使用
                  const thumbnailSrc =
                    post.thumbnail || (titleIsImage ? post.title : null);

                  return (
                    <article
                      key={post.slug}
                      className="relative lg:pl-20 group mb-8"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      {/* タイムラインドット(デスクトップ) */}
                      <div className="hidden lg:flex absolute left-6 top-8 w-5 h-5 rounded-full bg-gray-600 border-4 border-white shadow-lg z-10 group-hover:scale-125 transition-transform duration-200"></div>

                      {/* 日付バッジ(モバイル) */}
                      <div className="lg:hidden mb-4 inline-block bg-gray-600 text-white px-4 py-1.5 rounded-full text-sm font-bold">
                        {post.date}
                      </div>

                      {/* 日付(デスクトップ) */}
                      <div className="hidden lg:block absolute left-0 top-6 text-right pr-12 w-20">
                        <div className="text-sm font-bold text-gray-900">
                          {post.year}
                        </div>
                        <div className="text-xs text-gray-500">
                          {post.date.split('-').slice(1).join('/')}
                        </div>
                      </div>

                      {/* カード本体:横並びレイアウト */}
                      <Link
                        href={`/posts/${post.slug}`}
                        className="block h-full"
                      >
                        <div className="bg-white rounded-xl shadow-md hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-200 hover:border-gray-400 group">
                          <div className="flex flex-col lg:flex-row">
                            {/* サムネイル(左側) */}
                            <div className="lg:w-80 lg:flex-shrink-0">
                              {thumbnailSrc ? (
                                <Image
                                  src={thumbnailSrc}
                                  alt={
                                    titleIsImage ? 'Title Image' : post.title
                                  }
                                  width={320}
                                  height={192}
                                  className="w-full h-48 lg:h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                  unoptimized
                                />
                              ) : (
                                <div className="bg-gray-200 border-2 border-dashed border-gray-300 rounded-t-xl lg:rounded-l-xl lg:rounded-t-none flex items-center justify-center h-48 lg:h-64">
                                  <span className="text-gray-500 font-medium">
                                    NO IMAGE
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* テキストエリア(右側) */}
                            <div className="flex-1 p-6 lg:p-8">
                              {/* タイトル: 画像パスの場合は画像として表示、それ以外はテキスト */}
                              {titleIsImage ? (
                                <div className="mb-3">
                                  <Image
                                    src={`/tetra-archives/${post.title}`}
                                    alt="Title"
                                    width={320}
                                    height={192}
                                    className="max-w-full h-auto max-h-24 object-contain"
                                    unoptimized
                                  />
                                </div>
                              ) : (
                                <h3 className="text-xl lg:text-2xl font-bold text-gray-900 mb-3 leading-tight group-hover:text-gray-700 transition-colors">
                                  {stripHtmlTags(post.title)}
                                </h3>
                              )}

                              <p className="text-gray-600 text-sm lg:text-base leading-relaxed mb-5 line-clamp-3">
                                {truncatedExcerpt}
                              </p>

                              {/* カテゴリタグ */}
                              <div className="flex flex-wrap gap-2">
                                {filterVisibleCategories(post.categories).map(
                                  (cat) => (
                                    <span
                                      key={cat.id}
                                      className="inline-block px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-full hover:bg-gray-700 hover:text-white transition-all duration-200"
                                    >
                                      {cat.label}
                                    </span>
                                  )
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    </article>
                  );
                })
              ) : (
                <div className="text-center py-12 bg-white rounded-lg shadow-md">
                  <svg
                    className="w-16 h-16 mx-auto text-gray-400 mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="text-gray-500 text-lg">
                    該当する記事は見つかりませんでした
                  </p>
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
        currentYear={year}
        currentCategory={category}
        getYearCount={getYearCount}
        getCategoryCountForYear={getCategoryCountForYear}
        allPostsInYearCount={allPostsInYearCount}
      />
    </div>
  );
}
