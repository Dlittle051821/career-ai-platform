import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHero } from "@/components/sections/PageHero";
import { Section } from "@/components/layout/Section";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { resolvePaymentLinkToken } from "@/lib/supabase/payments/resolve-token";

interface PayTokenPageProps {
  params: Promise<{ token: string }>;
}

export const metadata: Metadata = { title: "Pay Invoice", robots: { index: false, follow: false } };

/**
 * Public entry point for a copyable "pay this invoice" link
 * (src/lib/supabase/admin/invoices.ts's createPaymentLink). `/pay` is in
 * PROTECTED_PATHS (src/lib/supabase/middleware.ts), so a signed-out visitor
 * is redirected to /login?next=/pay/<token> first and lands back here
 * already authenticated — this page then still independently verifies the
 * token resolves to an invoice THIS signed-in user owns before doing
 * anything else. Possessing the link is a convenience, never a bypass of
 * that ownership check.
 */
export default async function PayTokenPage({ params }: PayTokenPageProps) {
  const { token } = await params;
  const invoiceId = await resolvePaymentLinkToken(token);

  if (invoiceId) {
    redirect(`/payments/${invoiceId}`);
  }

  return (
    <>
      <PageHero eyebrow="Payments" title="This payment link isn't valid" />
      <Section>
        <Card className="mx-auto max-w-md text-center">
          <p className="text-sm text-muted">
            This link may have expired, already been used, or belongs to a different account than the one you&apos;re
            signed in with. If you&apos;re expecting to pay an invoice, check your payments list or contact support
            for a new link.
          </p>
          <LinkButton href="/payments" size="sm" className="mt-5">
            Go to payments
          </LinkButton>
        </Card>
      </Section>
    </>
  );
}
