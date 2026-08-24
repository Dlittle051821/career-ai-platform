import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { AuthLayout } from "@/components/sections/auth/AuthLayout";
import { LoginForm } from "@/components/sections/auth/LoginForm";

export const metadata: Metadata = {
  title: "Log in",
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
