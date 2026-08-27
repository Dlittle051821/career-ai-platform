import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PaymentForm } from "@/components/admin/payments/PaymentForm";
import { createPaymentAction } from "../actions";

export const metadata: Metadata = { title: "New Payment Record" };

export default function NewPaymentPage() {
  return (
    <div className="max-w-3xl">
      <Link href="/admin/payments" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Back to payments
      </Link>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Payments</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">New payment record</h1>
      </div>
      <PaymentForm action={createPaymentAction} submitLabel="Create payment record" />
    </div>
  );
}
