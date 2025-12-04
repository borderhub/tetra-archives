import fs from 'fs';
import path from 'path';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import PostPageClient from '@/components/PostPageClient';

const postsDirectory = path.join(process.cwd(), 'src/data');

type CategoryBaseInfo = {
  id: number;
  label: string;
  basename: string;
  path: string[];
};

export function generateStaticParams() {
  const files = fs
    .readdirSync(postsDirectory)
    .filter((f) => f.endsWith('.json'));
  return files.map((file) => ({ id: file.replace(/\.json$/, '') }));
}

function getPostById(id: string) {
  const fullPath = path.join(postsDirectory, `${id}.json`);
  if (!fs.existsSync(fullPath)) notFound();

  const raw = JSON.parse(fs.readFileSync(fullPath, 'utf8'));

  let content = raw.content as string;

  // 改行コードを正規化
  content = content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/<dm[^>]*>(.*?)<\/dm[^>]*>/gi, '※$1')
    .replace(/<転載[^>]*>(.*?)<\/転載[^>]*>/gi, '※$1')
    .replace(
      /<\s*\/?\s*(?!p|div|strong|b|i|em|br|ul|ol|li|a[href]|img[src|alt]|details|summary)[a-zA-Z0-9-]+[^>]*>/gi,
      ''
    );

  // HTMLエンティティのアンエスケープ
  const contentProcessed = content
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' '); // non-breaking space を通常スペースに

  return {
    title: raw.title as string,
    date: raw.date as string,
    author: raw.author as string,
    content: contentProcessed,
    categories: (raw.categories as CategoryBaseInfo[]) || [],
    customField: raw.customField as string,
    thumbnail: (raw.thumbnail as string) || null,
  };
}

// 全記事データを取得（フッター用）
function getAllPosts() {
  try {
    const fileNames = fs
      .readdirSync(postsDirectory)
      .filter((f) => f.endsWith('.json'));
    const posts = fileNames.map((fileName) => {
      const fullPath = path.join(postsDirectory, fileName);
      const raw = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      const date = raw.date as string;
      const year = date ? date.substring(0, 4) : 'Unknown';
      const customField = raw.customField as string;
      const thumbnail = (raw.thumbnail as string) || null;

      return {
        slug: fileName.replace(/\.json$/, ''),
        year,
        categories: (raw.categories as CategoryBaseInfo[]) || [],
        customField,
        thumbnail,
      };
    });
    return posts;
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const post = getPostById(id);
  return {
    title: post.title,
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = getPostById(id);
  const allPosts = getAllPosts();

  return <PostPageClient post={post} allPosts={allPosts} slug={id} />;
}
