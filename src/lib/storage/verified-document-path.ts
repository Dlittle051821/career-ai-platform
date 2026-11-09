import "server-only";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

/** Called only after both webhook verifiers succeed and the upload completes.
 * Never forwards a request's cookies or Authorization header to the privileged client.
 * SQL revalidates the canonical object path, object existence and immutable binding.
 */
export async function recordVerifiedDocumentPath(
  kind: "signature" | "stamp",
  params: { provider: string; providerRequestId: string; storagePath: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = getServiceRoleClient();
  if (!client) return { ok: false, error: "not_configured" };
  const rpc = kind === "signature" ? "set_signature_document_path" : "set_stamp_document_path";
  const { error } = await client.rpc(rpc, {
    p_provider: params.provider,
    p_provider_request_id: params.providerRequestId,
    p_storage_path: params.storagePath,
  });
  return error ? { ok: false, error: "document_path_not_recorded" } : { ok: true };
}
