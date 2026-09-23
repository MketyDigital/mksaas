import { NextResponse } from 'next/server';

import { getPublishedDocsTree } from '@/features/platform-content/server/queries';

function stripMarkdown(value: string) {
  return value
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/^>\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/---/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim()
    .slice(0, 2000);
}

export async function GET() {
  const tree = await getPublishedDocsTree();
  const categoryTitle = new Map(tree.categories.map((category) => [category.key, category.title]));

  const index = tree.articles.map((article) => ({
    slug: `${article.categoryKey}/${article.slug}`,
    title: article.title,
    description: article.excerpt ?? '',
    section: categoryTitle.get(article.categoryKey) ?? article.categoryKey,
    sectionId: article.categoryKey,
    content: stripMarkdown(article.bodyMarkdown),
  }));

  return NextResponse.json(index, {
    headers: {
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
    },
  });
}
