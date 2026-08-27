import "server-only";
import { createClient } from "../server";
import { requireAdminPermission } from "../admin-auth";
import { recordAuditLog } from "./audit";
import { AdminValidationError } from "@/lib/admin/form-state";
import type { BillingSettings } from "@/types/payments";

/**
 * Business/tax configuration (public.billing_settings — a singleton row,
 * id always 1). No invoice may show GST fields until this is genuinely
 * filled in — see src/lib/payments/tax.ts's isGstConfigured(). Gated on
 * new permissions billing-settings:read/billing-settings:write (see
 * src/lib/admin/permissions.ts).
 */

function logDbError(context: string, error: unknown) {
  console.error(`[admin/billing-settings] ${context}:`, error);
}

interface BillingSettingsRow {
  legal_entity_name: string | null;
  business_address: string | null;
  support_email: string | null;
  support_phone: string | null;
  gst_registered: boolean;
  gstin: string | null;
  default_tax_rate_bps: number | null;
  invoice_footer_note: string | null;
  updated_at: string;
}

function toBillingSettings(row: BillingSettingsRow): BillingSettings {
  return {
    legalEntityName: row.legal_entity_name,
    businessAddress: row.business_address,
    supportEmail: row.support_email,
    supportPhone: row.support_phone,
    gstRegistered: row.gst_registered,
    gstin: row.gstin,
    defaultTaxRateBps: row.default_tax_rate_bps,
    invoiceFooterNote: row.invoice_footer_note,
    updatedAt: row.updated_at,
  };
}

export async function getBillingSettings(): Promise<BillingSettings | null> {
  await requireAdminPermission("billing-settings:read");
  const supabase = await createClient();
  const { data, error } = await supabase.from("billing_settings").select("*").eq("id", 1).maybeSingle();
  if (error) {
    logDbError("getBillingSettings", error);
    return null;
  }
  if (!data) return null;
  return toBillingSettings(data as BillingSettingsRow);
}

/**
 * Read-only variant used by non-admin-gated call sites that still need to
 * know whether GST is configured (invoice/receipt PDF generation, the
 * student invoice view). Deliberately bypasses the admin permission check
 * — billing_settings' own RLS already restricts this to admin roles for
 * direct table access, but PDF generation runs as part of an
 * already-authorized invoice read (a student reading their OWN invoice, or
 * an admin), so it needs the tax configuration without itself being an
 * admin action. Returns null (never throws) on any failure — a PDF must
 * still render as a plain, non-GST "Invoice" if this can't be read for any
 * reason, never crash.
 */
export async function getBillingSettingsForDocument(): Promise<BillingSettings | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("billing_settings").select("*").eq("id", 1).maybeSingle();
  if (error || !data) return null;
  return toBillingSettings(data as BillingSettingsRow);
}

function parseBillingSettingsForm(formData: FormData): {
  legalEntityName: string | null;
  businessAddress: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  gstRegistered: boolean;
  gstin: string | null;
  defaultTaxRateBps: number | null;
  invoiceFooterNote: string | null;
} {
  const gstRegistered = formData.get("gstRegistered") === "on" || formData.get("gstRegistered") === "true";
  const gstinRaw = String(formData.get("gstin") ?? "").trim().toUpperCase();
  if (gstinRaw && !/^[0-9A-Z]{15}$/.test(gstinRaw)) {
    throw new AdminValidationError("GSTIN must be exactly 15 alphanumeric characters as issued by the GST authority.");
  }
  if (gstinRaw && !gstRegistered) {
    throw new AdminValidationError("Mark the business as GST-registered before saving a GSTIN.");
  }

  const rateRaw = String(formData.get("defaultTaxRateBps") ?? "").trim();
  let defaultTaxRateBps: number | null = null;
  if (rateRaw) {
    const percent = Number.parseFloat(rateRaw);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      throw new AdminValidationError("Default tax rate must be a percentage between 0 and 100.");
    }
    defaultTaxRateBps = Math.round(percent * 100);
  }

  return {
    legalEntityName: String(formData.get("legalEntityName") ?? "").trim() || null,
    businessAddress: String(formData.get("businessAddress") ?? "").trim() || null,
    supportEmail: String(formData.get("supportEmail") ?? "").trim() || null,
    supportPhone: String(formData.get("supportPhone") ?? "").trim() || null,
    gstRegistered,
    gstin: gstinRaw || null,
    defaultTaxRateBps,
    invoiceFooterNote: String(formData.get("invoiceFooterNote") ?? "").trim() || null,
  };
}

export async function updateBillingSettings(formData: FormData): Promise<void> {
  const admin = await requireAdminPermission("billing-settings:write");
  const input = parseBillingSettingsForm(formData);
  const supabase = await createClient();

  const before = await getBillingSettings();

  const { error } = await supabase
    .from("billing_settings")
    .update({
      legal_entity_name: input.legalEntityName,
      business_address: input.businessAddress,
      support_email: input.supportEmail,
      support_phone: input.supportPhone,
      gst_registered: input.gstRegistered,
      gstin: input.gstin,
      default_tax_rate_bps: input.defaultTaxRateBps,
      invoice_footer_note: input.invoiceFooterNote,
      updated_by: admin.userId,
    })
    .eq("id", 1);

  if (error) {
    logDbError("updateBillingSettings", error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    action: "Updated",
    entityType: "billing_settings",
    entityId: "1",
    entityLabel: "billing settings",
    before: before ? { ...before } : undefined,
    after: { ...input },
  });
}
