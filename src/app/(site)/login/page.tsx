import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { AuthLayout } from "@/components/sections/auth/AuthLayout";
import { LoginForm } from "@/components/sections/auth/LoginForm";

export const metadata: Metadata = {
  title: "Log in",
  // M17A Step 2 — permanent, page-level noindex protection for this
  // auth-utility page (no search intent to serve, and it redirects a
  // logged-in visitor away — see AUTH_ONLY_PATHS in
  // src/lib/supabase/middleware.ts). Independent of the temporary
  // site-wide noindex on src/app/(site)/layout.tsx.
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <AuthLayout
      title="Welcome back"
      description="Log in to see your career discovery progress and roadmap."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-medium text-secondary-dark underline underline-offset-2">
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
