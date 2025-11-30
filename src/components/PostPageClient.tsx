'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import parse, { DOMNode, domToReact, Element } from 'html-react-parser';
import React, { Fragment } from 'react';
import PdfDownloadButton from '@/components/PdfDownloadButton';

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
};

type PostData = {
  slug: string;
  year: string;
  categories: CategoryBaseInfo[];
};

const VOID_ELEMENTS = [
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'keygen',
  'link', 'meta', 'param', 'source', 'track', 'wbr'
];

export default function PostPageClient({
  post,
  postId,
  allPosts
}: {
  post: Post;
  postId: string;
  allPosts: PostData[];
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

  const year = post.date ? post.date.substring(0, 4) : 'Unknown';

  // フッター用データ
  const categoryMap = new Map<number, { id: number; label: string; basename: string; count: number }>();
  allPosts.forEach(p => {
    p.categories.forEach(cat => {
      if (!categoryMap.has(cat.id)) categoryMap.set(cat.id, { ...cat, count: 0 });
      categoryMap.get(cat.id)!.count++;
    });
  });

  const uniqueCategories = Array.from(categoryMap.values())
    .sort((a, b) => a.label.localeCompare(b.label, 'ja'));

  const uniqueYears = Array.from(new Set(allPosts.map(p => p.year)))
    .sort((a, b) => b.localeCompare(a));

  // HTML変換関数
  const replace = (node: DOMNode) => {
    if (node.type === 'text') {
      const text = node.data;
      if (!text.trim() && !/\n/.test(text)) return null;

      const paragraphs = text.split(/\n{2,}/);
      return paragraphs.map((paragraph, index) => {
        if (paragraph.trim() === '') return null;
        const contentWithBreaks = paragraph.split('\n').map((line, lineIndex) => (
          <Fragment key={lineIndex}>
            {line}
            {lineIndex < paragraph.split('\n').length - 1 && <br />}
          </Fragment>
        ));

        return (
          <p key={index} className="my-4 leading-relaxed text-gray-700">
            {contentWithBreaks}
          </p>
        );
      });
    }

    if (node.type !== 'tag') return;

    const elem = node as Element;
    const children = domToReact(elem.children as DOMNode[], { replace });

    // <img> タグ
    if (elem.name === 'img') {
      const src = elem.attribs.src ? `/tetra-archives/${elem.attribs.src}` : '';
      const alt = elem.attribs.alt || '';
      const classNames = `my-8 rounded-lg shadow-lg border border-gray-200 ${elem.attribs.class || ''}`;

      const parseSize = (val: string | number | undefined) => {
        if (typeof val === "number") return val;
        if (typeof val === "string") return parseInt(val.replace("px", "").replace("auto", "0"), 10) || undefined;
        return undefined;
      };

      const w = parseSize(elem.attribs.width) || 800;
      const h = parseSize(elem.attribs.height) || 600;

      if (src.startsWith("/upload/")) {
        return (
          <Image
            src={src}
            alt={alt}
            width={w}
            height={h}
            className={classNames}
            style={{ width: w ? `${w}px` : "100%", height: "auto" }}
          />
        );
      }
      return (
        <img
          src={src}
          alt={alt}
          width={elem.attribs.width}
          height={elem.attribs.height}
          className={classNames}
          loading="lazy"
        />
      );
    }

    // <a> タグ
    if (elem.name === 'a') {
      const href = elem.attribs.href || '';
      const isExternal = href.startsWith("http");
      const baseClass = "text-red-600 hover:text-red-700 underline transition-colors duration-200";
      const externalClass = "inline-flex items-center gap-1";

      return (
        <a
          href={href}
          target={isExternal ? "_blank" : elem.attribs.target}
          rel={isExternal ? "noopener noreferrer" : elem.attribs.rel}
          className={`${baseClass} ${isExternal ? externalClass : ''} ${elem.attribs.class || ''}`}
        >
          {children} {isExternal && <span className="text-xs">↗</span>}
        </a>
      );
    }

    // <p> タグ
    if (elem.name === 'p') {
      return <p className={`my-4 leading-relaxed text-gray-700 ${elem.attribs.class || ''}`}>{children}</p>;
    }

    // <div> タグ
    if (elem.name === 'div') {
      return <div className={`my-6 p-4 bg-gray-50 border-l-4 border-red-600 rounded ${elem.attribs.class || ''}`}>{children}</div>;
    }

    // <br> タグ
    if (elem.name === 'br') return <br />;

    // <details>/<summary>
    if (elem.name === 'details') {
      return <details className={`bg-gray-50 rounded-lg p-4 my-6 border border-gray-200 ${elem.attribs.class || ''}`}>{children}</details>;
    }
    if (elem.name === 'summary') {
      return (
        <summary className={`cursor-pointer font-bold text-lg list-none flex items-center gap-2 hover:text-red-600 transition-colors ${elem.attribs.class || ''}`}>
          <span className="text-red-600">▼</span> {children}
        </summary>
      );
    }

    // その他のタグ
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

  // サイドバーコンテンツ
  const SidebarContent = () => (
    <>
      <section className="mb-8 pb-6 border-b border-gray-200">
        <h2 className="text-xs font-bold uppercase mb-4 tracking-wider text-gray-600">Year</h2>
        <Link
          href={`/archive/all/year/${year}/page/1`}
          className="block px-3 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors"
          onClick={() => isMobile && setSidebarOpen(false)}
        >
          {year}
        </Link>
      </section>

      <section className="mb-8">
        <h2 className="text-xs font-bold uppercase mb-4 tracking-wider text-gray-600">Categories</h2>
        <ul className="space-y-2">
          {post.categories.map(cat => (
            <li key={cat.id}>
              <Link
                href={`/archive/${cat.basename}/year/${year}/page/1`}
                className="block px-3 py-2 rounded-lg hover:bg-gray-100 text-gray-700 transition-colors"
                onClick={() => isMobile && setSidebarOpen(false)}
              >
                {cat.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <PdfDownloadButton />
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
              <Link href={`/archive/all/year/${year}/page/1`} className="hover:text-red-600 transition-colors">
                ARCHIVE
              </Link>
            </h1>
            <SidebarContent />
          </div>
        </aside>

        {/* サイドバー（モバイル - オーバーレイ） */}
        {isMobile && (
          <>
            <div
              className={`fixed inset-0 bg-black transition-opacity duration-300 z-40 lg:hidden ${
                sidebarOpen ? 'opacity-50' : 'opacity-0 pointer-events-none'
              }`}
              onClick={() => setSidebarOpen(false)}
            />
            <aside
              className={`fixed top-0 left-0 h-full w-80 bg-white shadow-2xl transform transition-transform duration-300 z-50 lg:hidden overflow-y-auto ${
                sidebarOpen ? 'translate-x-0' : '-translate-x-full'
              }`}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-black tracking-wider">INFO</h2>
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
                <SidebarContent />
              </div>
            </aside>
          </>
        )}

        {/* メインコンテンツ */}
        <main className="flex-1 p-4 lg:p-8 max-w-5xl mx-auto w-full">
          <article className="bg-white rounded-lg shadow-md overflow-hidden">
            {/* ヘッダー */}
            <header className="p-8 lg:p-12 border-b-4 border-red-600 bg-gradient-to-r from-gray-50 to-white">
              <div className="mb-4 flex flex-wrap gap-2">
                {post.categories.map(cat => (
                  <Link
                    key={cat.id}
                    href={`/archive/${cat.basename}/year/${year}/page/1`}
                    className="inline-block px-3 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full hover:bg-red-600 hover:text-white transition-colors"
                  >
                    {cat.label}
                  </Link>
                ))}
              </div>
              <h1 className="text-3xl lg:text-5xl font-black mb-6 leading-tight text-gray-900">
                {post.title}
              </h1>
              <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>{post.author}</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>{post.date}</span>
                </div>
              </div>
            </header>

            {/* コンテンツ */}
            <div className="p-8 lg:p-12 prose prose-lg max-w-none">
              {parse(post.content, { replace })}
            </div>

            {/* フッターナビ */}
            <footer className="p-8 border-t border-gray-200 bg-gray-50">
              <Link
                href={`/archive/all/year/${year}/page/1`}
                className="inline-flex items-center gap-2 text-red-600 hover:text-red-700 font-bold transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Archive
              </Link>
            </footer>
          </article>
        </main>
      </div>

      {/* フッター */}
      <footer className="bg-gray-900 text-white mt-16">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* カテゴリー一覧 */}
            <div>
              <h3 className="text-lg font-bold mb-4 text-red-400">Categories</h3>
              <ul className="space-y-2 text-sm">
                {uniqueCategories.slice(0, 8).map(cat => (
                  <li key={cat.id}>
                    <Link
                      href={`/archive/${cat.basename}/year/${year}/page/1`}
                      className="hover:text-red-400 transition-colors"
                    >
                      {cat.label} ({cat.count})
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* 年別アーカイブ */}
            <div>
              <h3 className="text-lg font-bold mb-4 text-red-400">Archives by Year</h3>
              <ul className="space-y-2 text-sm">
                {uniqueYears.map(y => (
                  <li key={y}>
                    <Link
                      href={`/archive/all/year/${y}/page/1`}
                      className="hover:text-red-400 transition-colors"
                    >
                      {y} ({allPosts.filter(p => p.year === y).length} entries)
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* サイト情報 */}
            <div>
              <h3 className="text-lg font-bold mb-4 text-red-400">Archive</h3>
              <p className="text-sm text-gray-400 mb-4">
                タイムライン形式で過去の記事を閲覧できます。カテゴリーや年別でフィルタリングが可能です。
              </p>
              <Link
                href={`/archive/all/year/${year}/page/1`}
                className="inline-block px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
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
