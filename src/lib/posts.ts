import fs from 'fs';
import path from 'path';
import { marked } from 'marked';

const postsDirectory = path.join(process.cwd(), 'src/data');

export type Post = {
  slug: string;
  title: string;
  date: string;
  author?: string;
  content: string;
  excerpt?: string;
};

export async function getAllPosts(): Promise<Post[]> {
  if (!fs.existsSync(postsDirectory)) {
    return [];
  }

  const fileNames = fs
    .readdirSync(postsDirectory)
    .filter((f) => f.endsWith('.json'));

  const posts = await Promise.all(
    fileNames.map(async (fileName) => {
      const slug = fileName.replace(/\.json$/, '');
      const fullPath = path.join(postsDirectory, fileName);
      const raw = JSON.parse(fs.readFileSync(fullPath, 'utf8'));

      const contentHtml = await marked(raw.content || raw.rawContent || '');

      return {
        slug,
        title: raw.title || '(無題)',
        date: raw.date || '1970-01-01',
        author: raw.author || 'Anonymous',
        content: contentHtml,
        excerpt:
          raw.excerpt ||
          contentHtml.replace(/<[^>]+>/g, '').slice(0, 160) + '...',
      };
    })
  );

  return posts.sort((a, b) => b.date.localeCompare(a.date));
}

export async function getPostBySlug(slug: string): Promise<Post> {
  const posts = await getAllPosts();
  const post = posts.find((p) => p.slug === slug);
  if (!post) throw new Error('Post not found');
  return post;
}
