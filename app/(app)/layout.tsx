"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/client/auth-context";
import { Button } from "@/components/button";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, ready, logout } = useAuth();
  const router = useRouter();

  // Client-side route guard: tokens live in localStorage, so the redirect has to happen here
  // once hydration is done. `ready` prevents a flash-redirect before we've read storage.
  useEffect(() => {
    if (ready && !user) router.replace("/signin");
  }, [ready, user, router]);

  if (!ready || !user) {
    return <div className="p-8 text-sm text-neutral-500">Loading…</div>;
  }

  return (
    <div className="mx-auto flex h-dvh max-w-4xl flex-col px-4 py-6">
      <header className="mb-6 flex shrink-0 items-center justify-between border-b border-neutral-200 pb-4">
        <Link href="/jobs" className="text-lg font-semibold tracking-tight">
          Encodr
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-neutral-500">{user.email}</span>
          <Button variant="secondary" onClick={logout}>
            Sign out
          </Button>
        </div>
      </header>
      <main className="min-h-0 flex-1">{children}</main>
    </div>
  );
}
