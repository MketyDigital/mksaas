'use client';

import { BookOpen, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { cn } from '@/shared/lib/utils';

interface DocsTree {
  categories: Array<{ key: string; title: string; description?: string; sortOrder: number }>;
  articles: Array<{ categoryKey: string; slug: string; title: string; excerpt?: string; sortOrder: number }>;
}

interface DocsSidebarProps {
  docsTree: DocsTree;
  onNavigate?: () => void;
}

export function DocsSidebar({ docsTree, onNavigate }: DocsSidebarProps) {
  const pathname = usePathname();
  const currentSlug = pathname.replace('/docs/', '').replace('/docs', '');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(docsTree.categories.map((category) => [category.key, true])),
  );

  return (
    <nav className="space-y-1" aria-label="Documentation navigation">
      <Link
        href="/docs"
        onClick={onNavigate}
        className={cn(
          'mb-2 flex items-center gap-2 rounded-md px-2 py-2 text-sm font-semibold transition-colors',
          currentSlug === '' ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted',
        )}
      >
        <BookOpen className="h-4 w-4 shrink-0" />
        Mkety Docs
      </Link>

      {docsTree.categories.map((category) => {
        const pages = docsTree.articles.filter((article) => article.categoryKey === category.key);
        const isOpen = openSections[category.key] ?? true;
        const hasActivePage = pages.some((page) => `${category.key}/${page.slug}` === currentSlug);

        return (
          <div key={category.key}>
            <button
              type="button"
              onClick={() => setOpenSections((current) => ({ ...current, [category.key]: !isOpen }))}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold transition-colors',
                hasActivePage ? 'text-primary' : 'text-foreground hover:bg-muted',
              )}
            >
              <span className="flex-1 text-left">{category.title}</span>
              <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', !isOpen && '-rotate-90')} />
            </button>

            {isOpen && (
              <ul className="ml-2 mt-0.5 space-y-0.5 border-l border-border pl-3">
                {pages.map((page) => {
                  const slug = `${category.key}/${page.slug}`;
                  const isActive = slug === currentSlug;
                  return (
                    <li key={slug}>
                      <Link
                        href={`/docs/${slug}`}
                        onClick={onNavigate}
                        className={cn(
                          'block rounded-md px-2 py-1.5 text-sm transition-colors',
                          isActive
                            ? 'bg-primary/10 font-medium text-primary'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                      >
                        {page.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}
