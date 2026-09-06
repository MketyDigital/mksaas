'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FormFieldError,
  FormGlobalError,
  FormLabel,
  Input,
} from '@/shared/components/ui';
import { signIn } from '@/shared/lib/auth-client';

const tenantLoginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
});

type TenantLoginFormValues = z.infer<typeof tenantLoginSchema>;

interface TenantLoginFormProps {
  tenantSlug: string;
  tenantName: string;
  initialEmail?: string;
}

export function TenantLoginForm({ tenantSlug, tenantName, initialEmail = '' }: TenantLoginFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TenantLoginFormValues>({
    resolver: zodResolver(tenantLoginSchema),
    defaultValues: {
      email: initialEmail,
    },
  });

  const callbackUrl = `/t/${tenantSlug}`;

  const onSubmit = async (data: TenantLoginFormValues) => {
    setIsLoading(true);
    setServerError(null);

    try {
      const result = await signIn('development', {
        email: data.email,
        redirect: false,
        callbackUrl,
      });

      if (result.error) {
        setServerError(result.error);
      } else if (result.url) {
        const target = new URL(result.url, window.location.origin);
        window.location.assign(`${target.pathname}${target.search}${target.hash}`);
      }
    } catch {
      setServerError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleIdentityLogin = async () => {
    setIsLoading(true);
    setServerError(null);
    try {
      const result = await signIn(undefined, { callbackUrl, redirect: false });
      setServerError(result.error ?? 'Mkety identity is not configured yet.');
    } catch {
      setServerError('Failed to initiate login');
    } finally {
      setIsLoading(false);
    }
  };

  const emailError = errors.email?.message;
  const hasError = !!emailError || !!serverError;

  return (
    <Card className="w-full border shadow-xl bg-card">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl">Sign in to {tenantName}</CardTitle>
        <CardDescription>Mkety identity will use the configured identity provider when it is connected.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormGlobalError visible={!!serverError} id="tenant-login-error">
          {serverError}
        </FormGlobalError>

        <Button
          type="button"
          className="w-full h-12 bg-primary hover:opacity-90 shadow-md text-base font-medium"
          onClick={handleIdentityLogin}
          disabled={isLoading}
          aria-busy={isLoading}
        >
          {isLoading ? 'Checking identity...' : 'Continue with Mkety identity'}
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">Development identity unavailable</span>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" aria-label="Development login form" noValidate>
          <div className="space-y-2">
            <FormLabel htmlFor="tenant-email" required>
              Email
            </FormLabel>
            <Input
              id="tenant-email"
              type="email"
              placeholder="admin@example.com"
              {...register('email')}
              aria-required="true"
              aria-invalid={hasError ? 'true' : undefined}
              aria-describedby={emailError ? 'tenant-email-error' : serverError ? 'tenant-login-error' : undefined}
              disabled={isLoading}
              className={emailError ? 'h-11 border-destructive focus-visible:ring-destructive' : 'h-11'}
            />
            <FormFieldError visible={!!emailError} id="tenant-email-error">
              {emailError}
            </FormFieldError>
          </div>
          <Button type="submit" variant="outline" className="w-full h-11" disabled={isLoading} aria-busy={isLoading}>
            {isLoading ? 'Checking...' : 'Check development identity'}
          </Button>
        </form>

        <p className="text-xs text-center text-muted-foreground mt-4">
          Access remains closed until Mkety&apos;s identity provider is connected.
        </p>
      </CardContent>
    </Card>
  );
}
