import type { Metadata } from "next";
import Link from "next/link";
import { AuthLayout } from "@/components/sections/auth/AuthLayout";
import { RegisterForm } from "@/components/sections/auth/RegisterForm";

export const metadata: Metadata = {
  title: "Create your account",
};

export default function RegisterPage() {
  return (
    <AuthLayout
      title="Create your student account"
      description="Track your career discovery, roadmap, and counselling in one place."
      footer={
        <>
          Prefer to talk to someone first?{" "}
          <Link href="/book-counselling" className="font-medium text-secondary-dark underline underline-offset-2">
            Book free counselling
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthLayout>
  );
}
