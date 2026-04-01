import type { Metadata } from 'next';
import Link from 'next/link';
import { getPosts } from '@/lib/content';

export const metadata: Metadata = { title: 'Blog', description: 'News, updates, and deep dives from the Anvil team.' };

export default function BlogIndex() {
  const posts = getPosts('blog');
  return (
    <div className="prose">
      <h1>Blog</h1>
      {posts.length === 0 ? <p>No posts yet.</p> : (
        <ul className="post-list">
          {posts.map(p => (
            <li key={p.slug} className="post-item">
              <time>{p.date}</time>
              <h3><Link href={`/blog/${p.slug}/`}>{p.title}</Link></h3>
              <p>{p.description}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
