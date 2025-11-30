import fs from "fs";
import path from "path";
import { notFound } from "next/navigation";
import Image from "next/image";
import parse, { DOMNode, domToReact, Element } from 'html-react-parser';
import React, { Fragment } from 'react'; // ★ 修正点1: React をインポートに追加 ★
import Link from "next/link";
import PdfDownloadButton from "@/components/PdfDownloadButton";

const postsDirectory = path.join(process.cwd(), "src/data");

type CategoryBaseInfo = {
  id: number;
  label: string;
  basename: string;
  path: string[];
};

export function generateStaticParams() {
  const files = fs.readdirSync(postsDirectory).filter((f) => f.endsWith(".json"));
  return files.map((file) => ({ id: file.replace(/\.json$/, "") }));
}

function getPostById(id: string) {
  const fullPath = path.join(postsDirectory, `${id}.json`);
  if (!fs.existsSync(fullPath)) notFound();

  const raw = JSON.parse(fs.readFileSync(fullPath, "utf8"));

  let content = raw.content as string;

  // 1. 改行コードを正規化 (★ 修正: 不要な <p> 置換を削除し、純粋な正規化に戻す)
  content = content
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n")
            .replace(/<dm[^>]*>(.*?)<\/dm[^>]*>/gi, '※$1')
            .replace(/<転載[^>]*>(.*?)<\/転載[^>]*>/gi, '※$1')
            .replace(/<\s*\/?\s*(?!p|div|strong|b|i|em|br|ul|ol|li|a[href]|img[src|alt])[a-zA-Z0-9-]+[^>]*>/gi, ''); // 変なタグだけ削除

  // 2. HTMLエンティティのアンエスケープ
  const contentProcessed = content
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  return {
    title: raw.title as string,
    date: raw.date as string,
    author: raw.author as string,
    content: contentProcessed,
    categories: raw.categories as CategoryBaseInfo[] || [], // カテゴリ情報を追加
  };
}

// ★ 修正点: void elements (子要素を持てないタグ) のリストを定義
const VOID_ELEMENTS = [
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'keygen', 
  'link', 'meta', 'param', 'source', 'track', 'wbr'
];

// HTML要素をReactコンポーネントに変換・置換する関数
const replace = (node: DOMNode) => {

  // =========================================================
  // 1. テキストノードの改行と段落処理 (変更なし)
  // =========================================================
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
        <p key={index} className="my-4 leading-relaxed"> {/* クラスは下記と統一 */}
          {contentWithBreaks}
        </p>
      );
    });
  }

  // =========================================================
  // 2. 要素ノードの処理（タグのカスタム）
  // =========================================================
  if (node.type !== 'tag') {
    return;
  }

  const elem = node as Element;
  const children = domToReact(elem.children as DOMNode[], { replace });

  // <img> タグの置換
  if (elem.name === 'img') {
    const src = elem.attribs.src ? `/tetra-archives/${elem.attribs.src}` : '';
    const alt = elem.attribs.alt || '';
    // ★ デザイン変更: 強いボーダーとゆったりとしたマージン
    const classNames = `my-8 max-w-full h-auto border border-black ${elem.attribs.class || ''}`;

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

  // <a> タグの置換
  if (elem.name === 'a') {
    const href = elem.attribs.href || '';
    const isExternal = href.startsWith("http");
    const baseClass = "text-gray-600 hover:text-black hover:bg-gray-200 transition-colors duration-200"; 
    const externalClass = "font-medium inline-flex items-center gap-1";

    return (
      <a
        href={href}
        target={isExternal ? "_blank" : elem.attribs.target} 
        rel={isExternal ? "noopener noreferrer" : elem.attribs.rel}
        className={`${baseClass} ${isExternal ? externalClass : ''} ${elem.attribs.class || ''}`}
      >
        {children} {isExternal && <span className="text-xs ml-1">→</span>}
      </a>
    );
  }

  // <p> タグの置換
  if (elem.name === 'p') {
      return <p className={`my-4 leading-relaxed ${elem.attribs.class || ''}`}>{children}</p>;
  }

  // <div> タグの置換
  if (elem.name === 'div') {
      return <div className={`my-6 border-l-4 border-gray-600 pl-4 ${elem.attribs.class || ''}`}>{children}</div>; 
  }

  // <br> タグの置換
  if (elem.name === 'br') { return <br />; }
 
  // <details>/<summary> 処理
  if (elem.name === 'details') {
    return <details className={`bg-gray-100 rounded-none p-4 my-6 border border-black ${elem.attribs.class || ''}`}>{children}</details>;
  }
  if (elem.name === 'summary') {
    return (
      <summary className={`cursor-pointer font-bold text-lg list-none flex items-center gap-2 ${elem.attribs.class || ''}`}>
        <span className="text-gray-600">▼</span> {children}
      </summary>
    );
  }

  // その他のタグのフォールバック処理
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


export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = getPostById(id);
  const year = post.date ? post.date.substring(0, 4) : 'Unknown';

  return (
    <div className="flex min-h-screen bg-white text-black font-serif">
      {/* サイドバー：記事情報とPDFボタン */}
      <aside className="w-64 p-8 border-r border-black flex-shrink-0 sticky top-0 h-screen overflow-y-auto">
        <h1 className="text-3xl font-black mb-10 tracking-wider">ARCHIVE</h1>
        
        {/* 年とカテゴリ */}
        <section className="mb-8 text-sm">
          <p className="font-bold uppercase tracking-widest mb-2">YEAR</p>
          <Link href={`/?year=${year}`} className="text-xl font-bold text-gray-600 hover:text-black transition-colors duration-200 block mb-4 underline-offset-4">
            {year}
          </Link>
          
          <p className="font-bold uppercase tracking-widest mb-2 mt-4">CATEGORIES</p>
          <ul className="space-y-1">
            {post.categories.map(cat => (
              <li key={cat.id}>
                <Link 
                  href={`/?category=${cat.basename}`} 
                  className="inline-block text-black hover:text-gray-600 transition-colors duration-200 text-sm"
                >
                  {cat.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
        
        <hr className="border-black my-8" />
        
        {/* PDFダウンロード機能（プレースホルダー） */}
        <PdfDownloadButton />

      </aside>

      {/* メインコンテンツ */}
      <article className="flex-grow p-8 max-w-4xl">
        {/* タイトルとメタデータ */}
        <header className="mb-10 border-b-8 border-gray-600 pb-4">
          <h1 className="text-5xl font-black mb-4 leading-tight">{post.title}</h1>
          <div className="text-sm flex justify-between text-gray-600 font-mono">
            <span>{post.author}</span>
            <span>{post.date}</span>
          </div>
        </header>

        {/* 記事コンテンツ */}
        <div className="text-lg leading-relaxed font-serif">
          {parse(post.content, { replace })}
        </div>
        
        {/* トップへ戻るリンク */}
        <div className="mt-16 pt-8 border-t border-black">
          <Link href="/" className="text-black font-bold text-lg hover:text-gray-600 transition-colors duration-200 inline-flex items-center">
            ← ARCHIVE TOP
          </Link>
        </div>
      </article>
    </div>
  );
}
