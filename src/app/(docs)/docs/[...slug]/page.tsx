import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { DocsContent } from '@/features/docs/components/DocsContent';
import { DocsTableOfContents } from '@/features/docs/components/DocsTableOfContents';
import { getPublishedDocsArticle, getPublishedDocsTree } from '@/features/platform-content/server/queries';

interface DocsPageProps {
  params: Promise<{ slug: string[] }>;
}

export async function generateMetadata({ params }: DocsPageProps): Promise<Metadata> {
  const { slug: slugParts } = await params;
  const slug = slugParts.join('/');
  const article = await getPublishedDocsArticle(slug);

  if (!article) {
    return {
      title: 'Not Found | Mkety Docs',
      description: 'The requested Mkety documentation page could not be found.',
    };
  }

  return {
    title: `${article.title} | Mkety Docs`,
    description: article.seoDescription ?? article.excerpt ?? `Mkety documentation — ${article.title}`,
    openGraph: {
      title: `${article.title} | Mkety Docs`,
      description: article.seoDescription ?? article.excerpt ?? `Mkety documentation — ${article.title}`,
      type: 'article',
    },
  };
}

export default async function DocsPage({ params }: DocsPageProps) {
  const { slug: slugParts } = await params;
  const slug = slugParts.join('/');
  const article = await getPublishedDocsArticle(slug);

  if (!article) notFound();

  const tree = await getPublishedDocsTree();
  const category = tree.categories.find((item) => item.key === article.categoryKey);

  return (
    <div className="flex gap-8">
      <article className="min-w-0 flex-1">
        <nav className="mb-6 text-sm text-muted-foreground">
          <a href="/docs" className="font-medium text-primary hover:underline">
            Mkety Docs
          </a>
          <span className="mx-2">/</span>
          {category && <span>{category.title}</span>}
        </nav>

        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">{category?.title ?? 'Mkety'}</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{article.title}</h1>
          {article.excerpt && <p className="mt-2 text-lg text-muted-foreground">{article.excerpt}</p>}
        </div>

        <DocsContent content={article.bodyMarkdown} />
      </article>

      <aside className="hidden w-56 shrink-0 xl:block">
        <DocsTableOfContents content={article.bodyMarkdown} />
      </aside>
    </div>
  );
}
