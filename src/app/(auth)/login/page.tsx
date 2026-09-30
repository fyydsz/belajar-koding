import React, { Suspense } from 'react';
import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
  return (
    <div className="w-full max-w-[420px]">
      <Suspense
        fallback={
          <div className="w-full animate-pulse rounded-2xl border border-fd-border/80 bg-fd-card/90 p-5 sm:p-6 shadow-xl">
            <div className="mx-auto mb-3 size-9 rounded-xl bg-fd-muted" />
            <div className="h-5 w-1/2 mx-auto rounded bg-fd-muted mb-2" />
            <div className="h-3.5 w-3/4 mx-auto rounded bg-fd-muted mb-5" />
            <div className="h-9.5 w-full rounded-lg bg-fd-muted mb-3" />
            <div className="h-9.5 w-full rounded-lg bg-fd-muted mb-4" />
            <div className="h-9.5 w-full rounded-lg bg-fd-muted" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
