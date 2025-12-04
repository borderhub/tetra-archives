'use client';

import Link from 'next/link';
import Image from 'next/image';
import Masonry from 'react-masonry-css';
import { stripHtmlTags } from '@/helper';

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

interface PostMasonryProps {
  posts: PostMeta[];
  HIDDEN_CATEGORIES: string[];
}

// タイトルが画像パスかどうかを判定
const isImagePath = (str: string): boolean => {
  return /^\/title\/\d+\/title\.(gif|jpg|jpeg|png|webp)$/i.test(str);
};

// 表示するカテゴリのみをフィルタリング
const filterVisibleCategories = (
  categories: CategoryBaseInfo[],
  hiddenCategories: string[]
): CategoryBaseInfo[] => {
  return categories.filter((cat) => !hiddenCategories.includes(cat.basename));
};

export default function PostMasonry({
  posts,
  HIDDEN_CATEGORIES,
}: PostMasonryProps) {
  // ブレークポイント設定
  const breakpointColumns = {
    default: 3, // デスクトップ
    1280: 2, // タブレット横
    768: 1, // モバイル・タブレット縦
  };

  return (
    <Masonry
      breakpointCols={breakpointColumns}
      className="masonry-grid"
      columnClassName="masonry-grid-column"
    >
      {posts.map((post, index) => {
        // excerpt を150文字で切り詰め
        const truncatedExcerpt =
          post.excerpt.length > 150
            ? post.excerpt.slice(0, 150) + '...'
            : post.excerpt;

        // タイトルが画像パスかチェック
        const titleIsImage = isImagePath(post.title);

        // サムネイル: thumbnailがあればそれを、なければタイトルが画像パスならそれを使用
        const thumbnailSrc =
          post.thumbnail || (titleIsImage ? post.title : null);

        return (
          <article
            key={post.slug}
            className="mb-6 animate-fade-in-scale"
            style={{ animationDelay: `${index * 30}ms` }}
          >
            <Link href={`/posts/${post.slug}`} className="block">
              <div className="bg-white rounded-xl shadow-md hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-200 hover:border-gray-400 group">
                {/* サムネイル */}
                <div className="relative overflow-hidden">
                  {thumbnailSrc ? (
                    <Image
                      src={thumbnailSrc}
                      alt={titleIsImage ? 'Title Image' : post.title}
                      width={400}
                      height={300}
                      className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-110"
                      unoptimized
                    />
                  ) : (
                    <div className="bg-gray-200 border-2 border-dashed border-gray-300 flex items-center justify-center h-48">
                      <span className="text-gray-500 font-medium">
                        NO IMAGE
                      </span>
                    </div>
                  )}
                  {/* 日付バッジ */}
                  <div className="absolute top-3 right-3 bg-gray-600 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg">
                    {post.date}
                  </div>
                </div>

                {/* コンテンツ */}
                <div className="p-5">
                  {/* タイトル: 画像パスの場合は画像として表示、それ以外はテキスト */}
                  {titleIsImage ? (
                    <div className="mb-3">
                      <Image
                        src={`/tetra-archives/${post.title}`}
                        alt="Title"
                        width={320}
                        height={192}
                        className="max-w-full h-auto max-h-20 object-contain"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <h3 className="text-lg font-bold text-gray-900 mb-3 leading-tight group-hover:text-gray-700 transition-colors line-clamp-2">
                      {stripHtmlTags(post.title)}
                    </h3>
                  )}

                  <p className="text-gray-600 text-sm leading-relaxed mb-4 line-clamp-4">
                    {truncatedExcerpt}
                  </p>

                  {/* カテゴリタグ */}
                  <div className="flex flex-wrap gap-2">
                    {filterVisibleCategories(
                      post.categories,
                      HIDDEN_CATEGORIES
                    ).map((cat) => (
                      <span
                        key={cat.id}
                        className="inline-block px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full hover:bg-gray-700 hover:text-white transition-all duration-200"
                      >
                        {cat.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Link>
          </article>
        );
      })}
    </Masonry>
  );
}
