import Link from 'next/link';

import { getPublishedDocsTree } from '@/features/platform-content/server/queries';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';

export default async function DocsIndexPage() {
  const tree = await getPublishedDocsTree();

  return (
    <div className="space-y-10">
      <section className="rounded-3xl border bg-gradient-to-br from-primary/10 via-background to-muted/40 p-8 shadow-sm md:p-12">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Mkety Docs</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground md:text-5xl">
            Build, automate, deploy, and operate with Mkety.
          </h1>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">
            Learn how Mkety Platform, Workspaces, SolutionHub, Academy, Enterprise solutions, usage, credits, billing,
            deployment, and administration fit together.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {tree.categories.map((category) => {
          const categoryArticles = tree.articles.filter((article) => article.categoryKey === category.key);
          const firstArticle = categoryArticles[0];

          return (
            <Card key={category.key} className="rounded-2xl border-border/70 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <CardHeader>
                <CardTitle>{category.title}</CardTitle>
                {category.description && <CardDescription>{category.description}</CardDescription>}
              </CardHeader>
              <CardContent className="space-y-3">
                {categoryArticles.map((article) => (
                  <Link
                    key={`${category.key}/${article.slug}`}
                    href={`/docs/${category.key}/${article.slug}`}
                    className="block rounded-xl border bg-muted/20 px-4 py-3 text-sm transition hover:border-primary/40 hover:bg-primary/5"
                  >
                    <span className="font-medium text-foreground">{article.title}</span>
                    {article.excerpt && <span className="mt-1 block text-muted-foreground">{article.excerpt}</span>}
                  </Link>
                ))}

                {!firstArticle && <p className="text-sm text-muted-foreground">More Mkety documentation is being prepared.</p>}
              </CardContent>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
