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

export default function PostPageClient({
  post,
  allPosts,
}: {
  post: Post;
  allPosts: PostData[];
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

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

  const getYearCount = (targetYear: string) => {
    return allPosts.filter((p) => p.year === targetYear).length;
  };

  // タイトルが画像パスかチェック
  const titleIsImage = isImagePath(post.title);

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
        <main className="flex-1 p-4 lg:p-8 max-w-5xl mx-auto w-full">
          <article className="bg-white rounded-lg shadow-md overflow-hidden">
            {/* ヘッダー */}
            <header className="p-8 lg:p-12 border-b-4 border-gray-600 bg-gradient-to-r from-gray-50 to-white">
              <div className="mb-4 flex flex-wrap gap-2">
                {post.categories.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/archive/${cat.basename}/year/${year}/page/1`}
                    className="inline-block px-3 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full hover:bg-gray-600 hover:text-white transition-colors"
                  >
                    {cat.label}
                  </Link>
                ))}
              </div>

              {/* タイトル: 画像パスの場合は画像として表示、それ以外はテキスト */}
              {titleIsImage ? (
                <div className="mb-6">
                  <img
                    src={`/tetra-archives/${post.title}`}
                    alt="Title"
                    className="max-w-full h-auto max-h-32 object-contain"
                  />
                </div>
              ) : (
                <h1 className="text-3xl lg:text-5xl font-black mb-6 leading-tight text-gray-900">
                  {stripHtmlTagsKeepLineBreaks(post.title)}
                </h1>
              )}

              <div className="flex flex-wrap gap-4 text-sm text-gray-600">
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
            </header>

            {/* カスタムフィールズ */}
            {post.customField ? (
              <div className="p-8 lg:p-12 prose prose-lg max-w-none">
                {post.customField}
              </div>
            ) : null}

            {/* コンテンツ */}
            {post.content ? (
              <div className="p-8 lg:p-12 prose prose-lg max-w-none lg:p-12 border-t-1 border-gray-600 bg-gradient-to-r from-gray-50">
                {parse(post.content, { replace })}
              </div>
            ) : null}

            {/* フッターナビ */}
            <footer className="p-8 border-t border-gray-200 bg-gray-50">
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
        allPostsCount={allPosts.length}
        currentYear={year}
        currentCategory="all"
        getYearCount={getYearCount}
      />
    </div>
  );
}
