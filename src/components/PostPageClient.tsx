'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import parse, { DOMNode, domToReact, Element } from 'html-react-parser';
import React, { Fragment } from 'react';
import MobileHeader from '@/components/MobileHeader';
import Sidebar from '@/components/Sidebar';
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) {
        setSidebarOpen(false);
      }
    };

    let timeoutId: NodeJS.Timeout;
    const debouncedCheckMobile = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(checkMobile, 150);
    };

    checkMobile();
    window.addEventListener('resize', debouncedCheckMobile);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', debouncedCheckMobile);
    };
  }, []);

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

      // PDF用のコンテンツ要素を取得
      const element = document.getElementById('pdf-content');
      if (!element) {
        console.error('pdf-content要素が見つかりません');
        throw new Error('PDF content element not found');
      }
      console.log('要素取得成功:', element.tagName);

      // 一時的にスクロール位置を保存
      const scrollY = window.scrollY;
      console.log('スクロール位置:', scrollY);

      // html2canvasでキャプチャ
      console.log('html2canvasキャプチャ開始...');
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: true, // デバッグ用に一時的にtrueに
        backgroundColor: '#ffffff',
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
        onclone: (clonedDoc) => {
          const clonedElement = clonedDoc.getElementById('pdf-content');
          if (!clonedElement) return;

          // ▼▼▼▼▼ ここが修正ポイント ▼▼▼▼▼
          // 1. PDFに含めたくない要素（カテゴリ・ダウンロードボタン）を削除
          const elementsToRemove = clonedElement.querySelectorAll('.pdf-ignore-element');
          elementsToRemove.forEach((el) => el.remove());

          // 2. グラデーションの互換性処理
          const header = clonedElement.querySelector('header');
          if (header) {
            header.style.backgroundImage = 'linear-gradient(to right, #d1d5db, #9ca3af)';
          }

          const gradientElements = clonedElement.querySelectorAll('[class*="bg-gradient-to-"]');
          gradientElements.forEach((el) => {
            const element = el as HTMLElement;
            const className = element.className;
            if (element.tagName === 'HEADER') return;

            if (className.includes('from-gray-50') || className.includes('to-gray-50')) {
              const direction = className.includes('bg-gradient-to-br') ? 'to bottom right' : 'to right';
              if (className.includes('from-white')) {
                element.style.backgroundImage = `linear-gradient(${direction}, #ffffff, #f9fafb)`;
              } else {
                element.style.backgroundImage = `linear-gradient(${direction}, #f9fafb, #ffffff)`;
              }
            }
          });
        }
      });

      console.log('キャプチャ成功! Canvas:', canvas.width, 'x', canvas.height);

      // 元のスクロール位置に戻す
      window.scrollTo(0, scrollY);

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      console.log('画像データ変換成功');

      const imgWidth = 210; // A4幅 (mm)
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // PDFを作成
      const pdf = new jsPDF({
        orientation: imgHeight > imgWidth ? 'portrait' : 'landscape',
        unit: 'mm',
        format: 'a4',
      });
      console.log('PDF作成成功');

      let heightLeft = imgHeight;
      let position = 0;

      // 最初のページ
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= 297; // A4の高さ

      // 複数ページに分割
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= 297;
      }

      // PDFを保存
      pdf.save(`${slug}.pdf`);
      console.log('PDF保存成功:', `${slug}.pdf`);
    } catch (error) {
      console.error('PDF download error:', error);
      console.error('エラースタック:', error instanceof Error ? error.stack : 'スタックなし');

      const errorMessage = error instanceof Error ? error.message : 'PDFダウンロードに失敗しました';
      alert(`PDFダウンロードエラー: ${errorMessage}\n\nブラウザのコンソールで詳細を確認してください。`);
    } finally {
      setIsDownloading(false);
      console.log('PDF生成処理終了');
    }
  };

  // HTML変換関数
  const replace = (node: DOMNode) => {
    if (node.type === 'text') {
      const text = node.data;

      // 完全に空白だけで改行もない場合はスキップ
      if (!text.trim() && !/\n/.test(text)) return null;

      // 改行を含む場合の処理
      if (text.includes('\n')) {
        // 2つ以上の連続改行で段落を分割
        const paragraphs = text.split(/\n\n+/);

        const processedParagraphs = paragraphs
          .map((paragraph, pIndex) => {
            const trimmedParagraph = paragraph.trim();

            // 空の段落はスキップ
            if (!trimmedParagraph) return null;

            // 段落内の単一改行を処理
            const lines = trimmedParagraph.split('\n');

            // 各行を処理
            const contentWithBreaks = lines.map((line, lIndex) => (
              <Fragment key={lIndex}>
                {line}
                {lIndex < lines.length - 1 && <br />}
              </Fragment>
            ));

            return (
              <p key={pIndex} className="my-4 leading-relaxed text-gray-700">
                {contentWithBreaks}
              </p>
            );
          })
          .filter(Boolean); // null を除外

        return processedParagraphs.length > 0 ? processedParagraphs : null;
      }

      // 改行がない通常のテキスト
      return text;
    }

    if (node.type !== 'tag') return;

    const elem = node as Element;
    const children = domToReact(elem.children as DOMNode[], { replace });

    if (elem.name === 'img') {
      const src = elem.attribs.src ? `/tetra-archives/${elem.attribs.src}` : '';
      const alt = elem.attribs.alt || '';
      const classNames = `my-8 rounded-lg shadow-lg border border-gray-200 ${elem.attribs.class || ''}`;

      const parseSize = (val: string | number | undefined) => {
        if (typeof val === 'number') return val;
        if (typeof val === 'string')
          return (
            parseInt(val.replace('px', '').replace('auto', '0'), 10) ||
            undefined
          );
        return undefined;
      };

      const w = parseSize(elem.attribs.width) || 800;
      const h = parseSize(elem.attribs.height) || 600;

      if (src.startsWith('/upload/')) {
        return (
          <Image
            src={src}
            alt={alt}
            width={w}
            height={h}
            className={classNames}
            style={{ width: w ? `${w}px` : '100%', height: 'auto' }}
          />
        );
      }
      return (
        <Image
          src={src}
          alt={alt}
          width={parseInt(elem.attribs.width, 10) || 0}
          height={parseInt(elem.attribs.height, 10) || 0}
          className={classNames}
          loading="lazy"
          unoptimized
        />
      );
    }

    if (elem.name === 'a') {
      const href = elem.attribs.href || '';
      const isExternal = href.startsWith('http');
      const baseClass =
        'text-gray-600 hover:text-gray-800 underline transition-colors duration-200';
      const externalClass = 'inline-flex items-center gap-1';

      return (
        <a
          href={href}
          target={isExternal ? '_blank' : elem.attribs.target}
          rel={isExternal ? 'noopener noreferrer' : elem.attribs.rel}
          className={`${baseClass} ${isExternal ? externalClass : ''} ${elem.attribs.class || ''}`}
        >
          {children} {isExternal && <span className="text-xs">↗</span>}
        </a>
      );
    }

    if (elem.name === 'p') {
      return (
        <p
          className={`my-4 leading-relaxed text-gray-700 ${elem.attribs.class || ''}`}
        >
          {children}
        </p>
      );
    }

    if (elem.name === 'div') {
      return (
        <div
          className={`my-6 p-4 bg-gray-50 border-l-4 border-gray-600 rounded ${elem.attribs.class || ''}`}
        >
          {children}
        </div>
      );
    }

    if (elem.name === 'br') return <br />;

    if (elem.name === 'details') {
      return (
        <details
          className={`bg-gray-50 rounded-lg p-4 my-6 border border-gray-200 ${elem.attribs.class || ''}`}
        >
          {children}
        </details>
      );
    }
    if (elem.name === 'summary') {
      return (
        <summary
          className={`cursor-pointer font-bold text-lg list-none flex items-center gap-2 hover:text-gray-600 transition-colors ${elem.attribs.class || ''}`}
        >
          <span className="text-gray-600">▼</span> {children}
        </summary>
      );
    }

    const { name, attribs } = elem;
    const props = { ...attribs, key: node.startIndex || undefined };

    if (typeof name === 'string' && name.match(/^[a-z0-9]+/)) {
      if (VOID_ELEMENTS.includes(name)) {
        return React.createElement(name, props);
      }
      return React.createElement(name, props, children);
    }

    return null;
  };

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
          mobileTitle="INFO"
          isMobile={isMobile}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        >
          <PostSidebarNavigation
            year={year}
            categories={post.categories}
            isMobile={isMobile}
            onLinkClick={() => setSidebarOpen(false)}
          />
        </Sidebar>

        {/* メインコンテンツ */}
        <main className="flex-1 p-4 lg:p-6 max-w-5xl mx-auto w-full">
          <article id="pdf-content" className="bg-white rounded-lg overflow-hidden">
            {/* ヘッダー - 資料風デザイン */}
            <header className="relative text-gray-600 border-b-2 border-gray-100 ">
              <div className="p-6 lg:p-12">
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
                    <div className="flex flex-row gap-3 lg:justify-between">  {/* ← ここは常に横並びでOK（モバイルでも2個なら横で十分） */}
                      <button
                        onClick={handleDownloadPDF}
                        disabled={isDownloading}
                        className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-100 hover:bg-white/30 backdrop-blur-sm text-gray-700 rounded-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Download PDF"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 0 01-2 2z" />
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
