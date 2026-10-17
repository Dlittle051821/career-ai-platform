import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { AuthLayout } from "@/components/sections/auth/AuthLayout";
import { LoginForm } from "@/components/sections/auth/LoginForm";
import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";

export const metadata: Metadata = {
  title: "Log in",
  // M17A Step 2 — permanent, page-level noindex protection for this
  // auth-utility page (no search intent to serve, and it redirects a
  // logged-in visitor away — see AUTH_ONLY_PATHS in
  // src/lib/supabase/middleware.ts). Independent of the temporary
  // site-wide noindex on src/app/(site)/layout.tsx.
  robots: { index: false, follow: false },
};

interface LoginPageProps {
  searchParams: Promise<{ next?: string }>;
}

/**
 * UX10-DS02 — intent-aware copy, added narrowly and safely: only when
 * `next` is exactly `/discovery-session/book` (the one destination this
 * milestone's public Discovery landing ever sends people here with) does
 * the title/description change to acknowledge the booking intent, per the
 * reference image's "Welcome to Nextwise — Sign in or create a free
 * account to book your Discovery Session" copy. Any other `next` value
 * (or none at all) renders the exact original, fully generic copy — this
 * page is not being turned into a Discovery-only login screen (brief
 * section 7's own explicit constraint). The actual redirect behavior is
 * unchanged by this — it was already handled by LoginForm's own
 * `next`-aware redirect, now hardened via getSafeRedirectPath (see
 * src/lib/auth/safe-redirect.ts).
 */
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams;
  const safeNext = getSafeRedirectPath(next, "");
  const isDiscoveryIntent = safeNext === "/discovery-session/book";
  const registerHref = safeNext ? `/register?next=${encodeURIComponent(safeNext)}` : "/register";

  return (
    <AuthLayout
      title={isDiscoveryIntent ? "Welcome to Nextwise" : "Welcome back"}
      description={
        isDiscoveryIntent
          ? "Sign in or create a free account to book your Discovery Session."
          : "Log in to see your career discovery progress and roadmap."
      }
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href={registerHref} className="font-medium text-secondary-dark underline underline-offset-2">
            Register
          </Link>
        </>
      }
    >
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthLayout>
  );
}
