'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Lock } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, FormFieldError, FormGlobalError, FormLabel, Input } from '@/shared/components/ui';

const loginSchema = z.object({ email: z.string().min(1, 'Email is required').email('Please enter a valid email address') });
type LoginFormValues = z.infer<typeof loginSchema>;

interface LoginFormProps {
  initialEmail?: string;
  enableDevelopmentLogin?: boolean;
  enableAuth0Login?: boolean;
}

export const LoginForm = ({ initialEmail = '', enableDevelopmentLogin = false, enableAuth0Login = false }: LoginFormProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: initialEmail } });
  const callbackUrl = '/select-tenant';

  const onSubmit = async (data: LoginFormValues) => {
    if (!enableDevelopmentLogin) return;
    setIsLoading(true);
    setServerError(null);
    try {
      const result = await signIn('development', { email: data.email, redirect: false, callbackUrl });
      if (result?.error) setServerError(result.error);
      else if (result?.url) {
        const target = new URL(result.url, window.location.origin);
        window.location.assign(`${target.pathname}${target.search}${target.hash}`);
      }
    } catch {
      setServerError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuth0Login = async () => {
    setIsLoading(true);
    try {
      await signIn('auth0', { callbackUrl });
    } catch {
      setServerError('Failed to initiate login');
      setIsLoading(false);
    }
  };

  const emailError = errors.email?.message;
  const hasError = !!emailError || !!serverError;

  return (
    <Card className="w-full border shadow-xl bg-card backdrop-blur-sm">
      <CardHeader className="space-y-1 text-center pb-6">
        <CardTitle className="text-2xl font-bold">Sign in</CardTitle>
        <CardDescription>Choose your preferred sign in method</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormGlobalError visible={!!serverError} id="login-server-error">{serverError}</FormGlobalError>

        {enableAuth0Login && (
          <Button type="button" className="w-full h-12 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-200 text-base font-semibold group" onClick={handleAuth0Login} disabled={isLoading} aria-busy={isLoading}>
            <Lock className="mr-2 h-4 w-4 group-hover:scale-110 transition-transform" />
            {isLoading ? 'Signing in...' : 'Continue with Auth0'}
          </Button>
        )}

        {enableDevelopmentLogin && (
          <>
            {enableAuth0Login && <div className="relative"><div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/50" /></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-3 py-1 text-muted-foreground font-medium rounded-full">Or development login</span></div></div>}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" aria-label="Development login form" noValidate>
              <div className="space-y-2">
                <FormLabel htmlFor="email" required>Email</FormLabel>
                <Input id="email" type="email" placeholder="user@example.com" {...register('email')} aria-required="true" aria-invalid={hasError ? 'true' : undefined} aria-describedby={emailError ? 'email-error' : serverError ? 'login-server-error' : undefined} className={emailError ? 'h-11 border-destructive focus-visible:ring-destructive' : 'h-11'} />
                <FormFieldError visible={!!emailError} id="email-error">{emailError}</FormFieldError>
              </div>
              <Button type="submit" variant="outline" className="w-full h-11 shadow-sm hover:bg-muted/50 transition-colors" disabled={isLoading} aria-busy={isLoading}>{isLoading ? 'Signing in...' : 'Development Login'}</Button>
            </form>
            <p className="text-xs text-center text-muted-foreground pt-2">Temporary test login is enabled for this deployment.</p>
          </>
        )}

        {!enableAuth0Login && !enableDevelopmentLogin && <p className="text-sm text-center text-muted-foreground">No authentication provider is configured for this test deployment yet.</p>}
      </CardContent>
    </Card>
  );
};
