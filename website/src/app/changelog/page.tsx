import type { Metadata } from 'next';
import { getPosts, renderMarkdown } from '@/lib/content';

export const metadata: Metadata = { title: 'Changelog', description: 'Release history and what changed in each version of Anvil.' };

export default async function ChangelogPage() {
  const posts = getPosts('changelog');
  const rendered = await Promise.all(posts.map(async p => ({
    ...p,
    html: await renderMarkdown(p.content),
  })));
  return (
    <div className="prose">
      <h1>Changelog</h1>
      {rendered.map(p => (
        <section key={p.slug} style={{marginBottom:'3rem'}}>
          <h2 id={p.slug}>{p.title}</h2>
          <p className="prose-meta">{p.date}</p>
          <div dangerouslySetInnerHTML={{ __html: p.html }} />
        </section>
      ))}
    </div>
  );
}
