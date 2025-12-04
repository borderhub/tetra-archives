'use client';

import Link from 'next/link';
import Image from 'next/image';
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

interface PostListProps {
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

export default function PostList({ posts, HIDDEN_CATEGORIES }: PostListProps) {
  return (
    <div className="relative">
      {/* 縦線(デスクトップ) */}
      <div className="hidden lg:block absolute top-0 bottom-0 left-8 w-0.5 bg-gradient-to-b from-gray-600 via-gray-400 to-gray-200"></div>
      <div className="space-y-8">
        {posts.map((post, index) => {
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
              className="relative lg:pl-20 group mb-8 animate-fade-in-up"
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
              <Link href={`/posts/${post.slug}`} className="block h-full">
                <div className="bg-white rounded-xl shadow-md hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-200 hover:border-gray-400 group">
                  <div className="flex flex-col lg:flex-row">
                    {/* サムネイル(左側) */}
                    <div className="lg:w-80 lg:flex-shrink-0">
                      {thumbnailSrc ? (
                        <Image
                          src={thumbnailSrc}
                          alt={titleIsImage ? 'Title Image' : post.title}
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
                        {filterVisibleCategories(
                          post.categories,
                          HIDDEN_CATEGORIES
                        ).map((cat) => (
                          <span
                            key={cat.id}
                            className="inline-block px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-full hover:bg-gray-700 hover:text-white transition-all duration-200"
                          >
                            {cat.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            </article>
          );
        })}
      </div>
    </div>
  );
}
