import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { BillingSettingsForm } from "@/components/admin/billing-settings/BillingSettingsForm";
import { getBillingSettings } from "@/lib/supabase/admin/billing-settings";
import { isGstConfigured } from "@/lib/payments/tax";
import { isPaymentGatewayConfigured, isWebhookConfigured } from "@/lib/payments/env";
import { updateBillingSettingsAction } from "./actions";

export const metadata: Metadata = { title: "Billing Settings" };

interface BillingSettingsPageProps {
  searchParams: Promise<{ saved?: string }>;
}

export default async function BillingSettingsPage({ searchParams }: BillingSettingsPageProps) {
  const params = await searchParams;
  const settings = await getBillingSettings();
  const gatewayConfigured = isPaymentGatewayConfigured();
  const webhookConfigured = isWebhookConfigured();

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Billing Settings</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">Billing settings</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Configure the business details, tax settings, and gateway status behind every invoice and payment.
        </p>
      </div>

      {params.saved ? (
        <p className="mb-6 flex items-center gap-2 rounded-[var(--radius-control)] border border-success/25 bg-success-light px-3.5 py-2.5 text-sm text-success">
          <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
          Billing settings saved.
        </p>
      ) : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className={`rounded-[var(--radius-control)] border px-4 py-3 text-sm ${isGstConfigured(settings) ? "border-success/25 bg-success-light text-success" : "border-border-strong bg-surface-alt text-text-soft"}`}>
          GST: {isGstConfigured(settings) ? "Configured" : "Not configured"}
        </div>
        <div className={`rounded-[var(--radius-control)] border px-4 py-3 text-sm ${gatewayConfigured ? "border-success/25 bg-success-light text-success" : "border-warning/25 bg-warning-light text-warning"}`}>
          Payment gateway: {gatewayConfigured ? "Configured" : "Not configured"}
        </div>
        <div className={`rounded-[var(--radius-control)] border px-4 py-3 text-sm ${webhookConfigured ? "border-success/25 bg-success-light text-success" : "border-warning/25 bg-warning-light text-warning"}`}>
          Webhook secret: {webhookConfigured ? "Configured" : "Not configured"}
        </div>
      </div>
      {(!gatewayConfigured || !webhookConfigured) && (
        <p className="mb-6 text-xs text-muted">
          Payment gateway/webhook credentials are environment variables (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET,
          RAZORPAY_WEBHOOK_SECRET), not set here — see docs/payments-billing-guide.md for setup. The gateway also
          needs its secrets bootstrapped once into the database — see the migration file&apos;s BOOTSTRAP section.
        </p>
      )}

      <BillingSettingsForm action={updateBillingSettingsAction} defaultValues={settings} />
    </div>
  );
}
