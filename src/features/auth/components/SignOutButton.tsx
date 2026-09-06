'use client';

import { Button } from '@/shared/components/ui';
import { signOut } from '@/shared/lib/auth-client';

export function SignOutButton() {
  return (
    <Button variant="outline" size="sm" onClick={() => void signOut({ callbackUrl: '/' })}>
      Sign Out
    </Button>
  );
}
