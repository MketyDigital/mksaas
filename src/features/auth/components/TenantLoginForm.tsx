'use client';

import { useState } from 'react';

import { useAuth } from '@/features/auth/hooks/use-auth';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FormGlobalError,
} from '@/shared/components/ui';

interface TenantLoginFormProps {
  tenantSlug: string;
  tenantName: string;
  initialEmail?: string;
}

export function TenantLoginForm({ tenantSlug, tenantName, initialEmail: _initialEmail = '' }: TenantLoginFormProps) {
  const { login, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const handleLogin = async () => {
    setIsLoading(true);
    setServerError(null);
    try {
      await login(`/t/${tenantSlug}`);
    } catch {
      setServerError('Failed to initiate sign in');
      setIsLoading(false);
    }
  };

  const busy = isLoading || authLoading;

  return (
    <Card className="w-full border shadow-xl bg-card">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl">Sign in to {tenantName}</CardTitle>
        <CardDescription>Continue securely with Mkety authentication</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormGlobalError visible={!!serverError} id="tenant-login-error">
          {serverError}
        </FormGlobalError>
        <Button
          type="button"
          className="w-full h-12 bg-primary hover:opacity-90 shadow-md text-base font-medium"
          onClick={handleLogin}
          disabled={busy}
          aria-busy={busy}
        >
          {busy ? 'Signing in...' : 'Continue with ZITADEL'}
        </Button>
        <p className="text-xs text-center text-muted-foreground mt-4">
          By signing in, you agree to access {tenantName}&apos;s workspace.
        </p>
      </CardContent>
    </Card>
  );
}
