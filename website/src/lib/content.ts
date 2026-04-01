import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { remark } from 'remark';
import html from 'remark-html';

const contentDir = path.join(process.cwd(), 'src', 'content');

export interface Post {
  slug: string;
  title: string;
  date: string;
  description: string;
  content: string;
}

export function getPosts(type: 'blog' | 'changelog' | 'docs'): Post[] {
  const dir = path.join(contentDir, type);
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  return files.map(file => {
    const slug = file.replace(/\.md$/, '');
    const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
    const { data, content } = matter(raw);
    return {
      slug,
      title: data.title ?? slug,
      date: data.date ?? '',
      description: data.description ?? '',
      content,
    };
  }).sort((a, b) => (b.date > a.date ? 1 : -1));
}

export async function renderMarkdown(md: string): Promise<string> {
  const result = await remark().use(html).process(md);
  return result.toString();
}

export function getPost(type: 'blog' | 'changelog' | 'docs', slug: string): Post | null {
  const filePath = path.join(contentDir, type, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);
  return {
    slug,
    title: data.title ?? slug,
    date: data.date ?? '',
    description: data.description ?? '',
    content,
  };
}
