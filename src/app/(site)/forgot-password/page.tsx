import type { Metadata } from "next";
import { AuthLayout } from "@/components/sections/auth/AuthLayout";
import { ForgotPasswordForm } from "@/components/sections/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Reset your password",
  // M17A Step 2 — permanent, page-level noindex protection; see
  // src/app/(site)/login/page.tsx's metadata comment.
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <AuthLayout
      title="Forgot your password?"
      description="Enter the email on your account and we'll send you a reset link."
    >
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
