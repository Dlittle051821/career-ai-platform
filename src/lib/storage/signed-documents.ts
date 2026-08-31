import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Milestone 10 (F-122) — the FIRST use of Supabase Storage anywhere in
 * this codebase. Thin, narrow helper for the one thing this milestone
 * needs: uploading a signed agreement document to a PRIVATE bucket and
 * generating short-lived signed download URLs, server-side only.
 *
 * MANUAL SETUP REQUIRED (cannot be done from a SQL migration or this
 * sandbox — see docs/milestones/M10-electronic-signature.md): create a
 * bucket named exactly `SIGNED_AGREEMENTS_BUCKET` below, in the Supabase
 * dashboard, with "Public bucket" UNCHECKED. 0011_electronic_signature.sql
 * PART 8 adds the storage.objects RLS policies this bucket needs; they
 * take effect automatically once the bucket exists.
 *
 * Path convention (enforced here, matched by those RLS policies):
 * `<agreementId>/<signatureRequestId>/<fileName>`.
 *
 * TWO DIFFERENT CLIENTS, DELIBERATELY: reading a signed URL
 * (createSignedDownloadUrl, below) always goes through the normal
 * RLS-respecting client every other Supabase call in this codebase uses
 * (src/lib/supabase/server.ts's createClient()) — a caller only succeeds
 * if their OWN real session satisfies storage.objects' SELECT policy
 * (admin/finance/assigned counsellor/owning student). Uploading
 * (uploadSignedDocument, below) is the one narrow exception: it runs from
 * the signature webhook route, which carries no session at all, so it
 * uses the service-role client instead — see src/lib/supabase/
 * service-role.ts for the full justification. This file never exposes or
 * constructs a public bucket URL — only ever a short-lived signed URL via
 * createSignedUrl().
 */

export const SIGNED_AGREEMENTS_BUCKET = "signed-agreements";

/** Minutes a generated download link stays valid for — short-lived by design; a fresh one is generated on every "View signed document" click, never cached client-side. */
const SIGNED_URL_TTL_SECONDS = 5 * 60;

export function buildSignedDocumentStoragePath(agreementId: string, signatureRequestId: string, fileName: string): string {
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${agreementId}/${signatureRequestId}/${safeFileName}`;
}

/**
 * Uploads the signed document bytes to the private bucket. Called only
 * from src/app/api/webhooks/signature/route.ts, right after a verified
 * webhook delivery confirms a request is 'signed' — never from anywhere a
 * client-supplied file could land here unverified. Uses the service-role
 * client (see this file's own docblock and src/lib/supabase/
 * service-role.ts) since the webhook route has no session to write
 * through. Degrades gracefully — never throws — when
 * SUPABASE_SERVICE_ROLE_KEY is unset: returns `{ ok: false, error:
 * "not_configured" }`, which the webhook route logs and moves on from
 * without failing the whole webhook (the signature_requests status
 * transition already succeeded independently, via the database RPC).
 */
export async function uploadSignedDocument(params: {
  storagePath: string;
  bytes: Uint8Array;
  contentType: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = getServiceRoleClient();
  if (!client) {
    console.warn("[storage/signed-documents] SUPABASE_SERVICE_ROLE_KEY is not configured — skipping signed document upload.");
    return { ok: false, error: "not_configured" };
  }
  const { error } = await client.storage.from(SIGNED_AGREEMENTS_BUCKET).upload(params.storagePath, params.bytes, {
    contentType: params.contentType,
    upsert: false,
  });
  if (error) {
    console.error("[storage/signed-documents] uploadSignedDocument failed:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * Generates a short-lived signed download URL for an already-uploaded
 * signed document. Relies entirely on storage.objects' own RLS policies
 * (0011_electronic_signature.sql PART 8) to decide whether the CALLING
 * session may read this specific object — this function does not itself
 * re-check ownership, so every call site (the admin "View signed
 * agreement" action, the student download route) must already be reading
 * through a client scoped to that caller's own real session. Returns null
 * on any failure (not found, not authorized, bucket not yet created) —
 * callers render a "not available yet" state rather than a raw error.
 */
export async function createSignedDownloadUrl(storagePath: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(SIGNED_AGREEMENTS_BUCKET).createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    if (error) console.error("[storage/signed-documents] createSignedDownloadUrl failed:", error);
    return null;
  }
  return data.signedUrl;
}
