import { ArrowLeft, Home } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';

export const dynamic = 'force-dynamic';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <Card className="w-full max-w-lg rounded-3xl border-border/70 shadow-xl">
        <CardContent className="flex flex-col items-center px-8 py-14 text-center">
          <Link href="/" className="mb-8 flex items-center gap-2 font-bold tracking-tight" aria-label="Mkety home">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"
              aria-hidden="true"
            >
              M
            </span>
            <span>Mkety</span>
          </Link>

          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">404</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">This page is not available.</h1>
          <p className="mt-4 max-w-md leading-7 text-muted-foreground">
            The address may have changed, or the page may not be part of the current Mkety public site.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/">
                <Home className="mr-2 h-4 w-4" />
                Mkety Home
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/docs">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Explore Docs
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
