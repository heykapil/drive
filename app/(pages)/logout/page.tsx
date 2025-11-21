'use client';

import { deleteSession } from '@/lib/actions';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

export default function LogoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const callbackUrl = searchParams.get('callbackUrl') || '';

    const handleLogout = async () => {
      await deleteSession();

      const betterAuthUrl =
        process.env.BETTER_AUTH_URL || 'https://auth.kapil.app';
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

      const targetUrl = `${betterAuthUrl}/login?redirectTo=${encodeURIComponent(appUrl)}${callbackUrl}`;

      router.push(targetUrl);
    };

    toast.promise(handleLogout(), {
      loading: 'Logging you out...',
      success: 'You have been logged out successfully.',
      error: 'Failed to log you out. Please try again.',
    });
  }, [router, searchParams]);

  return (
    <div className="flex h-screen w-full items-center justify-center">
      <p className="text-muted-foreground text-sm">Logging out...</p>
    </div>
  );
}
