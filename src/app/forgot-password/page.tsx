import type { Metadata } from "next";
import { AuthLayout } from "@/components/sections/auth/AuthLayout";
import { ForgotPasswordForm } from "@/components/sections/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Reset your password",
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
