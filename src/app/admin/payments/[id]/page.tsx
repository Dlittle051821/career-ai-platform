import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PaymentForm } from "@/components/admin/payments/PaymentForm";
import { getPaymentById } from "@/lib/supabase/admin/payments";
import { formatMoney } from "@/lib/admin/money";
import { updatePaymentAction } from "../actions";

interface PaymentDetailPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Edit Payment Record" };

export default async function PaymentDetailPage({ params }: PaymentDetailPageProps) {
  const { id } = await params;
  const payment = await getPaymentById(id);
  if (!payment) notFound();

  const boundAction = updatePaymentAction.bind(null, id);

  return (
    <div className="max-w-3xl">
      <Link href="/admin/payments" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Back to payments
      </Link>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Payments</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">
          {payment.invoiceReference ?? payment.id.slice(0, 8)} — {formatMoney(payment.amountMinorUnits, payment.currency)}
        </h1>
        <p className="mt-2 text-sm text-muted">Last updated {new Date(payment.updatedAt).toLocaleString("en-IN")}</p>
      </div>
      <PaymentForm action={boundAction} defaultValues={payment} submitLabel="Save changes" />
    </div>
  );
}
