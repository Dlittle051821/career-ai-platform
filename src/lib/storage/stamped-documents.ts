import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Milestone 11-A (F-123) — mirrors src/lib/storage/signed-documents.ts
 * exactly, for the stamped-document equivalent. Second use of Supabase
 * Storage in this codebase.
 *
 * MANUAL SETUP REQUIRED (cannot be done from a SQL migration or this
 * sandbox — see docs/milestones/M11-electronic-stamping-assisted-onboarding.md):
 * create a bucket named exactly `STAMPED_AGREEMENTS_BUCKET` below, in the
 * Supabase dashboard, with "Public bucket" UNCHECKED.
 * 0012_electronic_stamping_and_assisted_onboarding.sql PART 4 adds the
 * storage.objects RLS policies this bucket needs; they take effect
 * automatically once the bucket exists.
 *
 * Path convention (enforced here, matched by those RLS policies):
 * `<agreementId>/<stampRequestId>/<fileName>` — same shape as the signed
 * documents bucket, deliberately, since both policies resolve access via
 * the same parent `agreements` row.
 *
 * TWO DIFFERENT CLIENTS, DELIBERATELY — same rationale as
 * signed-documents.ts: uploading (from the stamp webhook route, no
 * session) uses the service-role client; reading a signed URL always goes
 * through the normal RLS-respecting client so only a caller whose own real
 * session satisfies storage.objects' SELECT policy succeeds. Never exposes
 * or constructs a public bucket URL.
 */

export const STAMPED_AGREEMENTS_BUCKET = "stamped-agreements";

/** Minutes a generated download link stays valid for — short-lived by design, regenerated fresh on every click, never cached client-side. */
const SIGNED_URL_TTL_SECONDS = 5 * 60;

export function buildStampedDocumentStoragePath(agreementId: string, stampRequestId: string, fileName: string): string {
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${agreementId}/${stampRequestId}/${safeFileName}`;
}

/**
 * Uploads the stamped document bytes to the private bucket. Called only
 * from src/app/api/webhooks/stamp/route.ts, right after a verified webhook
 * delivery confirms a request is 'completed' — never from anywhere a
 * client-supplied file could land here unverified. Degrades gracefully —
 * never throws — when SUPABASE_SERVICE_ROLE_KEY is unset: returns
 * `{ ok: false, error: "not_configured" }`, which the webhook route logs
 * and moves on from without failing the whole webhook (the stamp_requests
 * status transition already succeeded independently, via the database
 * RPC).
 */
export async function uploadStampedDocument(params: {
  storagePath: string;
  bytes: Uint8Array;
  contentType: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = getServiceRoleClient();
  if (!client) {
    console.warn("[storage/stamped-documents] SUPABASE_SERVICE_ROLE_KEY is not configured — skipping stamped document upload.");
    return { ok: false, error: "not_configured" };
  }
  const { error } = await client.storage.from(STAMPED_AGREEMENTS_BUCKET).upload(params.storagePath, params.bytes, {
    contentType: params.contentType,
    upsert: false,
  });
  if (error) {
    console.error("[storage/stamped-documents] uploadStampedDocument failed:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * Generates a short-lived signed download URL for an already-uploaded
 * stamped document. Relies entirely on storage.objects' own RLS policies
 * (0012_electronic_stamping_and_assisted_onboarding.sql PART 4) to decide
 * whether the CALLING session may read this specific object. Returns null
 * on any failure (not found, not authorized, bucket not yet created).
 */
export async function createStampedDownloadUrl(storagePath: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(STAMPED_AGREEMENTS_BUCKET).createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    if (error) console.error("[storage/stamped-documents] createStampedDownloadUrl failed:", error);
    return null;
  }
  return data.signedUrl;
}
