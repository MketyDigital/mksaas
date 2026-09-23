'use client';

import { Lock } from 'lucide-react';
import { useState } from 'react';

import { useAuth } from '@/features/auth/hooks/use-auth';
import { Button, Card, CardContent, FormGlobalError } from '@/shared/components/ui';

interface LoginFormProps {
  initialEmail?: string;
  mode?: 'signin' | 'signup';
  callbackUrl?: string;
}

export const LoginForm = ({ initialEmail: _initialEmail = '', mode = 'signin', callbackUrl = '/select-tenant' }: LoginFormProps) => {
  const { login, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const handleLogin = async () => {
    setIsLoading(true);
    setServerError(null);
    try {
      await login(callbackUrl, mode);
    } catch {
      setServerError(mode === 'signup' ? 'Failed to initiate account creation' : 'Failed to initiate sign in');
      setIsLoading(false);
    }
  };

  const busy = isLoading || authLoading;

  return (
    <Card className="w-full border shadow-xl bg-card backdrop-blur-sm">
      <CardContent className="space-y-4 p-6">
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
          {busy
            ? mode === 'signup'
              ? 'Creating account...'
              : 'Signing in...'
            : mode === 'signup'
              ? 'Create Mkety account'
              : 'Continue to Mkety'}
        </Button>
      </CardContent>
    </Card>
  );
};
