import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { AuthLayout } from "@/components/sections/auth/AuthLayout";
import { RegisterForm } from "@/components/sections/auth/RegisterForm";
import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";

export const metadata: Metadata = {
  title: "Create your account",
  // M17A Step 2 — permanent, page-level noindex protection; see
  // src/app/(site)/login/page.tsx's metadata comment.
  robots: { index: false, follow: false },
};

interface RegisterPageProps {
  searchParams: Promise<{ next?: string }>;
}

/**
 * UX10-DS02 — same narrow, intent-aware copy treatment as
 * src/app/(site)/login/page.tsx: only when `next` is exactly
 * `/discovery-session/book` does the description acknowledge the booking
 * intent. Registration's own post-signup redirect target is deliberately
 * NOT changed by this `next` value — see RegisterForm.tsx's own docblock
 * and UX10-DS02_REFERENCE_AUDIT.md section 3 for why a brand-new account
 * still lands on the existing, locked `/welcome` Assisted Onboarding
 * choice screen (whose "Book a Free NextWise Discovery Session" option,
 * already the recommended first choice, is what completes this journey
 * for a new registrant).
 */
export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const { next } = await searchParams;
  const safeNext = getSafeRedirectPath(next, "");
  const isDiscoveryIntent = safeNext === "/discovery-session/book";

  return (
    <AuthLayout
      title={isDiscoveryIntent ? "Welcome to Nextwise" : "Create your student account"}
      description={
        isDiscoveryIntent
          ? "Sign in or create a free account to book your Discovery Session."
          : "Track your career discovery, roadmap, and counselling in one place."
      }
      footer={
        <>
          Prefer to talk to someone first?{" "}
          <Link href="/book-counselling" className="font-medium text-secondary-dark underline underline-offset-2">
            Book free counselling
          </Link>
        </>
      }
    >
      <Suspense fallback={null}>
        <RegisterForm />
      </Suspense>
    </AuthLayout>
  );
}
