'use client';

import { Lock } from 'lucide-react';
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

interface LoginFormProps {
  initialEmail?: string;
}

export const LoginForm = ({ initialEmail: _initialEmail = '' }: LoginFormProps) => {
  const { login, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const handleLogin = async () => {
    setIsLoading(true);
    setServerError(null);
    try {
      await login('/select-tenant');
    } catch {
      setServerError('Failed to initiate sign in');
      setIsLoading(false);
    }
  };

  const busy = isLoading || authLoading;

  return (
    <Card className="w-full border shadow-xl bg-card backdrop-blur-sm">
      <CardHeader className="space-y-1 text-center pb-6">
        <CardTitle className="text-2xl font-bold">Sign in</CardTitle>
        <CardDescription>Continue securely with Mkety authentication</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormGlobalError visible={!!serverError} id="login-server-error">
          {serverError}
        </FormGlobalError>
        <Button
          type="button"
          className="w-full h-12 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-200 text-base font-semibold group"
          onClick={handleLogin}
          disabled={busy}
          aria-busy={busy}
        >
          <Lock className="mr-2 h-4 w-4 group-hover:scale-110 transition-transform" />
          {busy ? 'Signing in...' : 'Continue with ZITADEL'}
        </Button>
        <p className="text-xs text-center text-muted-foreground pt-2">
          Authentication is managed by Mkety. ZITADEL is the current identity-provider adapter.
        </p>
      </CardContent>
    </Card>
  );
};
