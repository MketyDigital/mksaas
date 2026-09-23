'use client';

import { BookOpen, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { cn } from '@/shared/lib/utils';

export interface PublishedDocsNavigationTree {
  categories: Array<{ key: string; title: string; description?: string }>;
  articles: Array<{ categoryKey: string; slug: string; title: string; sortOrder: number }>;
}

interface DocsSidebarProps {
  tree: PublishedDocsNavigationTree;
  onNavigate?: () => void;
}

export function DocsSidebar({ tree, onNavigate }: DocsSidebarProps) {
  const pathname = usePathname();
  const currentSlug = pathname.replace('/docs/', '').replace('/docs', '');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(tree.categories.map((category) => [category.key, true])),
  );

  return (
    <nav className="space-y-1" aria-label="Documentation navigation">
      {tree.categories.map((category) => {
        const pages = tree.articles.filter((article) => article.categoryKey === category.key);
        if (pages.length === 0) return null;
        const isOpen = openSections[category.key] ?? true;
        const hasActivePage = pages.some((page) => `${category.key}/${page.slug}` === currentSlug);

        return (
          <div key={category.key}>
            <button
              type="button"
              onClick={() => setOpenSections((prev) => ({ ...prev, [category.key]: !isOpen }))}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold transition-colors',
                hasActivePage ? 'text-primary' : 'text-foreground hover:bg-muted',
              )}
            >
              <BookOpen className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">{category.title}</span>
              <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', !isOpen && '-rotate-90')} />
            </button>

            {isOpen ? (
              <ul className="ml-4 mt-0.5 space-y-0.5 border-l border-border pl-3">
                {pages.map((page) => {
                  const slug = `${category.key}/${page.slug}`;
                  const isActive = slug === currentSlug;
                  return (
                    <li key={slug}>
                      <Link
                        href={`/docs/${slug}`}
                        onClick={onNavigate}
                        className={cn(
                          'block rounded-md px-2 py-1 text-sm transition-colors',
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
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
