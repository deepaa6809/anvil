import type { Metadata } from 'next';
import { getPosts, getPost, renderMarkdown } from '@/lib/content';

export async function generateStaticParams() {
  return getPosts('blog').map(p => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost('blog', slug);
  return { title: post?.title, description: post?.description };
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost('blog', slug);
  if (!post) return <div className="prose"><h1>Not Found</h1></div>;
  const html = await renderMarkdown(post.content);
  return (
    <article className="prose">
      <h1>{post.title}</h1>
      <p className="prose-meta">{post.date}</p>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}
