import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { DocsContent } from '@/features/docs/components/DocsContent';
import { DocsTableOfContents } from '@/features/docs/components/DocsTableOfContents';
import { getPublishedDocsArticle, getPublishedDocsTree } from '@/features/platform-content/server/queries';

export const dynamic = 'force-dynamic';

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
  const currentIndex = tree.articles.findIndex(
    (item) => item.categoryKey === article.categoryKey && item.slug === article.slug,
  );
  const previousArticle = currentIndex > 0 ? tree.articles[currentIndex - 1] : undefined;
  const nextArticle = currentIndex >= 0 ? tree.articles[currentIndex + 1] : undefined;

  return (
    <div className="flex gap-8">
      <article className="min-w-0 flex-1">
        <nav className="mb-6 text-sm text-muted-foreground">
          <Link href="/docs" className="font-medium text-primary hover:underline">
            Mkety Docs
          </Link>
          <span className="mx-2">/</span>
          {category && <span>{category.title}</span>}
        </nav>

        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">{category?.title ?? 'Mkety'}</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{article.title}</h1>
          {article.excerpt && <p className="mt-2 text-lg text-muted-foreground">{article.excerpt}</p>}
        </div>

        <DocsContent content={article.bodyMarkdown} />

        <nav className="mt-12 grid gap-3 border-t pt-6 sm:grid-cols-2" aria-label="Documentation article navigation">
          {previousArticle ? (
            <Link
              href={`/docs/${previousArticle.categoryKey}/${previousArticle.slug}`}
              className="rounded-xl border bg-muted/20 p-4 transition hover:border-primary/40 hover:bg-primary/5"
            >
              <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Previous</span>
              <span className="mt-1 block font-medium text-foreground">← {previousArticle.title}</span>
            </Link>
          ) : <span />}
          {nextArticle ? (
            <Link
              href={`/docs/${nextArticle.categoryKey}/${nextArticle.slug}`}
              className="rounded-xl border bg-muted/20 p-4 text-right transition hover:border-primary/40 hover:bg-primary/5"
            >
              <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next</span>
              <span className="mt-1 block font-medium text-foreground">{nextArticle.title} →</span>
            </Link>
          ) : null}
        </nav>
      </article>

      <aside className="hidden w-56 shrink-0 xl:block">
        <DocsTableOfContents content={article.bodyMarkdown} />
      </aside>
    </div>
  );
}
