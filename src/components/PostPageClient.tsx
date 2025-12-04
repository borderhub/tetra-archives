'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import parse, { DOMNode, domToReact, Element } from 'html-react-parser';
import React, { Fragment } from 'react';
import MobileHeader from '@/components/MobileHeader';
import Sidebar from '@/components/Sidebar';
import SidebarToggle from '@/components/SidebarToggle';
import PostSidebarNavigation from '@/components/PostSidebarNavigation';
import Footer from '@/components/Footer';
import { stripHtmlTagsKeepLineBreaks } from '@/helper';

type CategoryBaseInfo = {
  id: number;
  label: string;
  basename: string;
  path: string[];
};

type Post = {
  title: string;
  date: string;
  author: string;
  content: string;
  categories: CategoryBaseInfo[];
  customField: string;
  thumbnail?: string | null;
};

type PostData = {
  slug: string;
  year: string;
  categories: CategoryBaseInfo[];
  customField: string;
};

const VOID_ELEMENTS = [
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'keygen',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
];

// タイトルが画像パスかどうかを判定
const isImagePath = (str: string): boolean => {
  return /^\/title\/\d+\/title\.(gif|jpg|jpeg|png|webp)$/i.test(str);
};

// HTMLタグを除去してテキストのみ抽出
const stripHtmlTags = (html: string): string => {
  return html.replace(/<[^>]*>/g, '');
};

export default function PostPageClient({
  post,
  allPosts,
  slug,
}: {
  post: Post;
  allPosts: PostData[];
  slug: string;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false); // モバイル用
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true); // デスクトップ用
  const [isMobile, setIsMobile] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

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

      // LocalStorageからサイドバー状態を復元
      const savedSidebarState = localStorage.getItem('desktopSidebarOpen');
      if (savedSidebarState !== null) {
        setDesktopSidebarOpen(savedSidebarState === 'true');
      }

      // 2. 状態更新がDOMに反映され、レイアウトが確定した後にアニメーションを有効化
      // 300ms待つことで、モバイルでの初期幅調整時のアニメーションを防ぐ
      setTimeout(() => {
        setShouldAnimate(true);
      }, 150);
    }, 0);

    // リサイズイベントの処理（デバウンス付き）
    let resizeTimer: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const mobile = window.innerWidth < 1024;
        setIsMobile(mobile);
        if (!mobile) {
          setSidebarOpen(false);
        }
      }, 150);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(initTimer);
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // デスクトップサイドバーの開閉切り替え
  const toggleDesktopSidebar = () => {
    const newState = !desktopSidebarOpen;
    setDesktopSidebarOpen(newState);
    localStorage.setItem('desktopSidebarOpen', String(newState));
  };

  const year = post.date ? post.date.substring(0, 4) : 'Unknown';

  // フッター用データ
  const categoryMap = new Map<
    number,
    { id: number; label: string; basename: string; count: number }
  >();
  allPosts.forEach((p) => {
    p.categories.forEach((cat) => {
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

  // タイトルが画像パスかチェック
  const titleIsImage = isImagePath(post.title);

  // サムネイル画像のソースを決定
  const thumbnailSrc = post.thumbnail || (titleIsImage ? post.title : null);

  // CSVダウンロード（クライアントサイド）
  const handleDownloadCSV = () => {
    setIsDownloading(true);
    try {
      const title = titleIsImage ? 'Title Image' : stripHtmlTags(post.title);
      const customField = stripHtmlTags(post.customField || '');
      const content = stripHtmlTags(post.content || '');

      const escapeCsv = (str: string) => {
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const csvRows = [
        ['項目', '内容'],
        ['タイトル', title],
        ['日付', post.date],
        ['著者', post.author],
        ['カテゴリ', post.categories.map((c) => c.label).join(', ')],
        ['カスタム情報', customField],
        ['本文', content],
      ];

      const csvContent = csvRows
        .map((row) => row.map(escapeCsv).join(','))
        .join('\n');

      // BOM付きUTF-8でエンコード（Excel対応）
      const bom = '\uFEFF';
      const csvWithBom = bom + csvContent;

      const blob = new Blob([csvWithBom], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slug}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('CSV download error:', error);
      alert('CSVダウンロードに失敗しました。');
    } finally {
      setIsDownloading(false);
    }
  };

  // PDFダウンロード（html2canvasを使用）
  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      console.log('PDF生成開始...');

      // 動的にライブラリをインポート
      let html2canvas;
      let jsPDF;

      try {
        const html2canvasModule = await import('html2canvas-pro');
        html2canvas = html2canvasModule.default;
        console.log('html2canvas読み込み成功:', typeof html2canvas);
      } catch (importError) {
        console.error('html2canvasインポートエラー:', importError);
        throw new Error('html2canvasの読み込みに失敗しました。npm install html2canvas を実行してください。');
      }

      try {
        const jsPDFModule = await import('jspdf');
        jsPDF = jsPDFModule.jsPDF;
        console.log('jsPDF読み込み成功:', typeof jsPDF);
      } catch (importError) {
        console.error('jsPDFインポートエラー:', importError);
        throw new Error('jsPDFの読み込みに失敗しました。npm install jspdf を実行してください。');
      }

      const articleElement = document.querySelector('.pdf-article-content');
      if (!articleElement) {
        throw new Error('PDF変換対象の要素が見つかりません。');
      }

      console.log('キャンバス変換中...');
      const canvas = await html2canvas(articleElement as HTMLElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        ignoreElements: (element: Element) => {
          return (element as unknown as HTMLElement).classList?.contains('pdf-ignore-element') || false;
        },
      });

      console.log('キャンバス変換完了:', canvas.width, 'x', canvas.height);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 10;

      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight - 20;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight + 10;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight - 20;
      }

      pdf.save(`${slug}.pdf`);
      console.log('PDF保存完了');
    } catch (error) {
      console.error('PDF生成エラー:', error);
      alert(`PDFダウンロードに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    } finally {
      setIsDownloading(false);
    }
  };

  // html-react-parserの変換設定（画像をSSG対応に変換）
  const replace = (domNode: DOMNode) => {
    if (domNode instanceof Element && domNode.name) {
      const { name, attribs, children } = domNode;

      // 自己閉じタグの処理
      if (VOID_ELEMENTS.includes(name)) {
        const props: Record<string, unknown> = { ...attribs };

        // img タグの場合のみ、Imageコンポーネントに変換
        if (name === 'img' && attribs.src) {
          const src = attribs.src.startsWith('/')
            ? `/tetra-archives${attribs.src}`
            : `/tetra-archives/${attribs.src}`;

          // width/heightを安全にパース
          const parseSize = (value: string | undefined, defaultValue: number): number => {
            if (!value) return defaultValue;
            const parsed = parseInt(value, 10);
            return isNaN(parsed) || parsed <= 0 ? defaultValue : parsed;
          };

          const width = parseSize(attribs.width, 800);
          const height = parseSize(attribs.height, 450);

          return (
            <Image
              src={src}
              alt={attribs.alt || 'Content Image'}
              width={width}
              height={height}
              className={attribs.class || ''}
              loading="lazy"
              unoptimized
            />
          );
        }

        // その他の自己閉じタグはそのまま
        return React.createElement(name, props);
      }

      // 通常のタグ（子要素あり）
      const props: Record<string, unknown> = { ...attribs };
      return React.createElement(
        name,
        props,
        domToReact(children as DOMNode[], { replace })
      );
    }

    // それ以外はそのまま
    return domNode;
  };

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
          className={`${shouldAnimate ? 'transition-all duration-100' : ''} ${isMobile
            ? ''
            : desktopSidebarOpen
              ? 'w-80'
              : 'w-0'
            }`}
        >
          <Sidebar
            title="POST"
            titleLink={`/archive/all/year/${year}/page/1`}
            mobileTitle="MENU"
            isMobile={isMobile}
            isOpen={isMobile ? sidebarOpen : desktopSidebarOpen}
            onClose={() => setSidebarOpen(false)}
            shouldAnimate={shouldAnimate}
          >
            <PostSidebarNavigation
              categories={post.categories}
              year={year}
              isMobile={isMobile}
              onLinkClick={() => setSidebarOpen(false)}
            />
          </Sidebar>
        </div>

        {/* メインコンテンツ */}
        <main
          className={`flex-1 mx-auto w-full ${shouldAnimate ? 'transition-all duration-300' : ''} ${!isMobile && !desktopSidebarOpen
            ? 'max-w-full lg:px-16'  // サイドバー閉: フルサイズ
            : `max-w-6xl`           // サイドバー開: 通常幅
            }`}
        >
          <article className="pdf-article-content bg-white rounded-lg shadow-xl overflow-hidden my-8">
            {/* ヘッダー部分 */}
            <header className="relative text-gray-600 p-6 lg:p-12 border-b-1 border-gray-200">
              {/* 背景装飾 */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
              </div>

              <div className="relative z-10">
                <div className="mb-8 pdf-ignore-element">
                  {/* 全体：PCは横並び / モバイルは縦 */}
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">

                    {/* ① カテゴリタグ（常に左寄せ・フル幅で折り返しOK） */}
                    <div className="flex flex-wrap gap-2">
                      {post.categories.map((cat) => (
                        <Link
                          key={cat.id}
                          href={`/archive/${cat.basename}/year/${year}/page/1`}
                          className="inline-block px-3 py-1 text-xs font-medium bg-gray-100 text-gray-600"
                        >
                          {cat.label}
                        </Link>
                      ))}
                    </div>

                    {/* ② ダウンロードボタン（モバイル：縦 / PC：横） */}
                    <div className="flex flex-row gap-3 lg:justify-between">
                      <button
                        onClick={handleDownloadPDF}
                        disabled={isDownloading}
                        className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-100 hover:bg-white/30 backdrop-blur-sm text-gray-700 rounded-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Download PDF"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 0 1-2 2z" />
                        </svg>
                        <span className="text-sm font-medium">PDF</span>
                      </button>

                      <button
                        onClick={handleDownloadCSV}
                        disabled={isDownloading}
                        className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-100 hover:bg-white/30 backdrop-blur-sm text-gray-700 rounded-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Download CSV"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-sm font-medium">CSV</span>
                      </button>
                    </div>
                  </div>
                </div>
                {/* タイトル: 画像パスの場合は画像として表示、それ以外はテキスト */}
                {titleIsImage ? (
                  <div className="mb-6 bg-white/10 p-6 rounded-lg backdrop-blur-sm">
                    <Image
                      src={`/tetra-archives/${post.title}`}
                      alt="Title"
                      width={400}
                      height={225}
                      className="max-w-full h-auto max-h-40 object-contain mx-auto"
                      loading="lazy"
                      unoptimized
                    />
                  </div>
                ) : (
                  <h1 className="text-3xl lg:text-5xl font-black mb-6 leading-tight">
                    {stripHtmlTagsKeepLineBreaks(post.title)}
                  </h1>
                )}

                {/* メタ情報 */}
                <div className="flex flex-wrap gap-4 text-sm text-gray-500/90">
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    <span>{post.author}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <span>{post.date}</span>
                  </div>
                </div>
              </div>
            </header>

            {/* サムネイル画像 & 補足情報セクション - 統合レイアウト */}
            {(thumbnailSrc || post.customField) && (
              <section>
                <div className="p-6 lg:p-12 bg-white">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-1 h-8 bg-gray-600 rounded"></div>
                    <h2 className="text-xl lg:text-2xl font-bold text-gray-900">
                      概要
                    </h2>
                  </div>

                  {/* 2カラムレイアウト（デスクトップ）/ 縦積み（モバイル） */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-6">
                    {/* サムネイル画像 */}
                    {thumbnailSrc && (
                      <div className="order-1 lg:order-2">
                        <div className="p-4 h-full">
                          <Image
                            src={thumbnailSrc.startsWith('/') ? `/tetra-archives${thumbnailSrc}` : `/tetra-archives/${thumbnailSrc}`}
                            alt={titleIsImage ? 'Title Image' : post.title}
                            width={800}
                            height={450}
                            className="w-full h-auto rounded-lg"
                            unoptimized
                          />
                        </div>
                      </div>
                    )}

                    {/* 補足情報 */}
                    {post.customField && (
                      <div className={`order-2 lg:order-1 ${!thumbnailSrc ? 'lg:col-span-2' : ''}`}>
                        <div className="bg-gradient-to-br from-gray-50 to-white rounded-lg shadow-md p-6 lg:p-6 border-l-4 border-gray-600 h-full">
                          <div className="text-sm font-bold text-gray-600 mb-4 uppercase tracking-wide">
                            補足情報
                          </div>
                          <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed">
                            {post.customField}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* サムネイルのみの場合、フル幅で表示 */}
                    {!post.customField && thumbnailSrc && (
                      <div className="lg:col-span-2 order-1">
                        <div className="bg-gradient-to-br from-gray-50 to-white rounded-lg shadow-lg p-6 border border-gray-200">
                          <Image
                            src={thumbnailSrc.startsWith('/') ? `/tetra-archives${thumbnailSrc}` : `/tetra-archives/${thumbnailSrc}`}
                            alt={titleIsImage ? 'Title Image' : post.title}
                            width={1200}
                            height={675}
                            className="w-full h-auto rounded-lg"
                            unoptimized
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* コンテンツ - 本文セクション */}
            {post.content && (
              <section className="border-b-4 border-gray-200">
                <div className="p-6 lg:p-12 bg-gradient-to-br from-white to-gray-50">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-1 h-8 bg-gray-600 rounded"></div>
                    <h2 className="text-xl lg:text-2xl font-bold text-gray-900">
                      詳細
                    </h2>
                  </div>
                  <div className="prose prose-lg max-w-none">
                    {parse(post.content, { replace })}
                  </div>
                </div>
              </section>
            )}

            {/* フッターナビ */}
            <footer className="p-6 bg-gray-50">
              <Link
                href={`/archive/all/year/${year}/page/1`}
                className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-800 font-bold transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                Back to Archive
              </Link>
            </footer>
          </article>
        </main>
      </div>

      {/* フッター */}
      <Footer
        categories={uniqueCategories}
        years={uniqueYears}
        currentYear={year}
        currentCategory="all"
        getYearCount={getYearCount}
        getCategoryCountForYear={getCategoryCountForYear}
        allPostsInYearCount={allPostsInYearCount}
      />
    </div>
  );
}
