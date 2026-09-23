'use client';

import { BookOpen, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { cn } from '@/shared/lib/utils';

import type { PublicDocsTree } from './DocsLayoutClient';

interface DocsSidebarProps {
  docsTree: PublicDocsTree;
  onNavigate?: () => void;
}

export function DocsSidebar({ docsTree, onNavigate }: DocsSidebarProps) {
  const pathname = usePathname();
  const currentSlug = pathname.replace(/^\/docs\/?/, '');

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(docsTree.categories.map((category) => [category.key, true])),
  );

  return (
    <nav className="space-y-2" aria-label="Documentation navigation">
      <Link
        href="/docs"
        onClick={onNavigate}
        className={cn(
          'mb-3 flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold transition-colors',
          !currentSlug ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted',
        )}
      >
        <BookOpen className="h-4 w-4 shrink-0" />
        Mkety Docs
      </Link>

      {docsTree.categories.map((category) => {
        const articles = docsTree.articles.filter((article) => article.categoryKey === category.key);
        const isOpen = openSections[category.key] ?? true;
        const hasActivePage = articles.some(
          (article) => `${category.key}/${article.slug}` === currentSlug,
        );

        return (
          <div key={category.key}>
            <button
              type="button"
              onClick={() =>
                setOpenSections((current) => ({ ...current, [category.key]: !isOpen }))
              }
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold transition-colors',
                hasActivePage ? 'text-primary' : 'text-foreground hover:bg-muted',
              )}
            >
              <span className="flex-1 text-left">{category.title}</span>
              <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', !isOpen && '-rotate-90')} />
            </button>

            {isOpen ? (
              <ul className="ml-2 mt-1 space-y-0.5 border-l border-border pl-3">
                {articles.map((article) => {
                  const slug = `${category.key}/${article.slug}`;
                  const isActive = slug === currentSlug;
                  return (
                    <li key={slug}>
                      <Link
                        href={`/docs/${slug}`}
                        onClick={onNavigate}
                        className={cn(
                          'block rounded-md px-2 py-1.5 text-sm leading-5 transition-colors',
                          isActive
                            ? 'bg-primary/10 font-medium text-primary'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                      >
                        {article.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
