import fs from 'fs';
import path from 'path';
import { Metadata } from 'next';
import ArchivePageClient from '@/components/ArchivePageClient';

// ==================== 定数・データ取得 ====================
const POSTS_PER_PAGE = 10;
const postsDirectory = path.join(process.cwd(), 'src/data');

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
};

function getAllPosts(): PostMeta[] {
  try {
    const fileNames = fs.readdirSync(postsDirectory).filter(f => f.endsWith('.json'));
    const posts: PostMeta[] = fileNames.map(fileName => {
      const slug = fileName.replace(/\.json$/, '');
      const fullPath = path.join(postsDirectory, fileName);
      const raw = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      const date = raw.date as string;
      const year = date ? date.substring(0, 4) : 'Unknown';

      return {
        slug,
        id: raw.id,
        title: raw.title,
        date,
        year,
        excerpt: raw.excerpt || '',
        categories: (raw.categories as CategoryBaseInfo[]) || [],
      };
    });
    return posts.sort((a, b) => (a.date < b.date ? 1 : -1));
  } catch (error) {
    console.error('記事読み込みエラー:', error);
    return [];
  }
}

// ==================== 静的生成 ====================
export async function generateStaticParams() {
  const allPosts = getAllPosts();

  const categorySet = new Set<string>(['all']);
  const yearSet = new Set<string>();

  allPosts.forEach(post => {
    post.categories.forEach(cat => categorySet.add(cat.basename));
    yearSet.add(post.year);
  });

  const categories = Array.from(categorySet);
  const years = Array.from(yearSet);

  const paths: { category: string; year: string; page: string }[] = [];

  for (const category of categories) {
    for (const year of years) {
      let filtered = allPosts;
      if (category !== 'all') {
        filtered = filtered.filter(p => p.categories.some(c => c.basename === category));
      }
      filtered = filtered.filter(p => p.year === year);

      const totalPages = Math.max(1, Math.ceil(filtered.length / POSTS_PER_PAGE));

      for (let i = 1; i <= totalPages; i++) {
        paths.push({ category, year, page: String(i) });
      }
    }
  }
  return paths;
}

type Props = {
  params: Promise<{
    category: string;
    year: string;
    page: string;
  }>;
};

// メタデータ生成
export async function generateMetadata({ params: paramsPromise }: Props): Promise<Metadata> {
  const { category, year, page } = await paramsPromise;
  const categoryLabel = category === 'all' ? 'ALL' : category.replace(/_/g, ' ').toUpperCase();
  return {
    title: `ARCHIVE - ${categoryLabel} (${year}) | Page ${page}`,
  };
}

export default async function ArchivePage({ params }: Props) {
  const { category, year, page } = await params;
  const allPosts = getAllPosts();
  
  return <ArchivePageClient allPosts={allPosts} category={category} year={year} page={page} />;
}
