import type { Metadata } from "next";
import { AuthLayout } from "@/components/sections/auth/AuthLayout";
import { ResetPasswordForm } from "@/components/sections/auth/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Choose a new password",
};

export default function ResetPasswordPage() {
  return (
    <AuthLayout title="Choose a new password" description="This link is single-use and time-limited.">
      <ResetPasswordForm />
    </AuthLayout>
  );
}
