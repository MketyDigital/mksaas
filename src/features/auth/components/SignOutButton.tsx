'use client';

import { useAuth } from '@/features/auth/hooks/use-auth';
import { Button } from '@/shared/components/ui';

export function SignOutButton() {
  const { logout, isLoading } = useAuth();

  return (
    <Button variant="outline" size="sm" onClick={() => void logout('/')} disabled={isLoading}>
      Sign Out
    </Button>
  );
}
