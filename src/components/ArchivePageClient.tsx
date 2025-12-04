'use client';

import { useState, useEffect } from 'react';
import { notFound } from 'next/navigation';
import MobileHeader from '@/components/MobileHeader';
import Sidebar from '@/components/Sidebar';
import SidebarNavigation from '@/components/SidebarNavigation';
import Footer from '@/components/Footer';
import Pagination from '@/components/Pagination';
import ViewToggle, { ViewMode } from '@/components/ViewToggle';
import SidebarToggle from '@/components/SidebarToggle';
import PostList from '@/components/PostList';
import PostMasonry from '@/components/PostMasonry';
import { POSTS_PER_PAGE, MAX_PAGES_DISPLAY, HIDDEN_CATEGORIES } from '@/constants';

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
  page: pageStr,
}: {
  allPosts: PostMeta[];
  category: string;
  year: string;
  page: string;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false); // モバイル用

  // 初期値は常に同じ値を使用（Hydrationエラー対策）
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);

  const [isMobile, setIsMobile] = useState(false);

  // 初期値は常に同じ値を使用（Hydrationエラー対策）
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // アニメーション制御用（初期化が終わるまでfalse）
  const [shouldAnimate, setShouldAnimate] = useState(false);

  // 初期化処理（モバイル判定・LocalStorage復元・アニメーション有効化）
  useEffect(() => {
    // 1. 同期setState警告回避のため setTimeout を使用
    const initTimer = setTimeout(() => {
      // モバイル判定
      const mobileCheck = window.innerWidth < 1024;
      setIsMobile(mobileCheck);
      if (!mobileCheck) {
        setSidebarOpen(false);
      }

      // LocalStorage復元
      const savedDesktopSidebar = localStorage.getItem('desktopSidebarOpen');
      if (savedDesktopSidebar !== null) {
        setDesktopSidebarOpen(savedDesktopSidebar === 'true');
      }

      const savedViewMode = localStorage.getItem('archiveViewMode') as ViewMode;
      if (savedViewMode && (savedViewMode === 'list' || savedViewMode === 'masonry')) {
        setViewMode(savedViewMode);
      }

      // 2. 状態更新がDOMに反映され、レイアウトが確定した後にアニメーションを有効化
      // 即座に有効化すると、初期レイアウト調整の動きが見えてしまうため遅延させる
      setTimeout(() => {
        setShouldAnimate(true);
      }, 150);
    }, 0);

    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(initTimer);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // ビューモード変更時にローカルストレージに保存
  const handleViewChange = (view: ViewMode) => {
    setViewMode(view);
    localStorage.setItem('archiveViewMode', view);
  };

  // デスクトップサイドバーの開閉切り替え
  const toggleDesktopSidebar = () => {
    const newState = !desktopSidebarOpen;
    setDesktopSidebarOpen(newState);
    localStorage.setItem('desktopSidebarOpen', String(newState));
  };

  const currentPage = parseInt(pageStr, 10);
  if (isNaN(currentPage) || currentPage < 1) notFound();

  // ========== フィルタリング ==========
  let filteredPosts = allPosts;

  // カテゴリが0個の記事は非表示
  filteredPosts = filteredPosts.filter((post) => post.categories.length > 0);

  if (category !== 'all') {
    filteredPosts = filteredPosts.filter((post) =>
      post.categories.some((c) => c.basename === category)
    );
  }

  filteredPosts = filteredPosts.filter((post) => post.year === year);

  const totalPosts = filteredPosts.length;
  const totalPages = Math.max(1, Math.ceil(totalPosts / POSTS_PER_PAGE));
  if (currentPage > totalPages) notFound();

  const paginatedPosts = filteredPosts.slice(
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

      {/* デスクトップ用サイドバートグルボタン */}
      <SidebarToggle
        isOpen={desktopSidebarOpen}
        onToggle={toggleDesktopSidebar}
      />

      <div className="flex">
        {/* サイドバー */}
        <div
          className={`${shouldAnimate ? 'transition-all duration-300' : ''} ${isMobile
            ? '' // モバイルは元の動作（幅制御なし）
            : desktopSidebarOpen
              ? 'w-80' // デスクトップでサイドバーが開いている
              : 'w-0' // デスクトップでサイドバーが閉じている
            }`}
        >
          <Sidebar
            title="ARCHIVE"
            titleLink={`/archive/all/year/${year}/page/1`}
            mobileTitle="MENU"
            isMobile={isMobile}
            isOpen={isMobile ? sidebarOpen : desktopSidebarOpen}
            onClose={() => setSidebarOpen(false)}
            shouldAnimate={shouldAnimate}
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
        </div>

        {/* メインコンテンツ */}
        <main
          className={`flex-1 p-4 lg:p-8 mx-auto w-full ${shouldAnimate ? 'transition-all duration-100' : ''} ${!isMobile && !desktopSidebarOpen
            ? 'max-w-full lg:px-16' // サイドバー閉: フルサイズ
            : 'max-w-6xl' // サイドバー開: 通常の最大幅
            }`}
        >
          {/* タイトルとトグルスイッチ */}
          <div className="mb-8 bg-white rounded-lg shadow-md p-6 border-l-4 border-gray-600">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-2xl lg:text-3xl font-bold text-gray-900">
                  {currentCategoryLabel}{' '}
                  <span className="text-gray-600">・</span> {year}
                </h2>
                <p className="text-sm text-gray-600 mt-2">
                  {totalPosts} entries found
                </p>
              </div>
              <ViewToggle
                currentView={viewMode}
                onViewChange={handleViewChange}
              />
            </div>
          </div>

          {/* 投稿表示エリア */}
          {paginatedPosts.length > 0 ? (
            <>
              {viewMode === 'list' ? (
                <PostList
                  posts={paginatedPosts}
                  HIDDEN_CATEGORIES={HIDDEN_CATEGORIES}
                />
              ) : (
                <PostMasonry
                  posts={paginatedPosts}
                  HIDDEN_CATEGORIES={HIDDEN_CATEGORIES}
                />
              )}
            </>
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
