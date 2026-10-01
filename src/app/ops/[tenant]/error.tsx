'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect } from 'react';

import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { logger } from '@/shared/lib/logger';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function OpsError({ error, reset }: ErrorProps) {
  const params = useParams();
  const tenant = String(params.tenant ?? '');

  useEffect(() => {
    logger.error({ error: error.message, digest: error.digest }, 'Standalone Platform Control error');
  }, [error]);

  return (
    <div className="flex min-h-96 items-center justify-center">
      <Card className="w-full max-w-lg border-destructive/20">
        <CardHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle>Platform Control module failed</CardTitle>
          <CardDescription>
            This failure is isolated to Mkety Ops and cannot take down the tenant admin dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error.digest ? <p className="font-mono text-xs text-muted-foreground">Error ID: {error.digest}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button onClick={reset}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry module
            </Button>
            <Button asChild variant="outline">
              <Link href={`/ops/${tenant}/platform-control`}>Control Center</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href={`/t/${tenant}`}>Workspace</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
