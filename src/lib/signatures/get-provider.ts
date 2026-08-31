import "server-only";
import type { SignatureProvider } from "./provider";
import { MockSignatureProvider } from "./mock-provider";
import { getSignatureProviderName } from "./config";

/**
 * Milestone 10 (F-122) — resolves SIGNATURE_PROVIDER to a real
 * SignatureProvider instance. Today only 'mock' is implemented (this
 * milestone ships no real provider integration — see
 * docs/milestones/M10-electronic-signature.md "Future provider
 * integration" for exactly how one plugs in here later: add a new
 * `case` below returning a new adapter class that implements
 * src/lib/signatures/provider.ts's SignatureProvider interface, same
 * shape as src/lib/payments/get-gateway.ts does for PaymentGateway/
 * RazorpayGateway). Any unrecognized provider name falls back to mock
 * rather than crashing — matches this codebase's "the app must run with
 * none of these set" posture.
 *
 * Returns a process-wide singleton mock instance (not a fresh one per
 * call): "Send for Signature" and a later "Resend"/"Cancel" happen in
 * separate HTTP requests, so the mock provider needs its in-memory map to
 * survive between calls within the same running process for those flows
 * to work at all. KNOWN LIMITATION (documented again in
 * docs/milestones/M10-electronic-signature.md): this state is lost on a
 * cold start/restart and is never shared across multiple serverless
 * instances — acceptable for a development/testing-only mock provider,
 * not something a real implementation would ever do (a real provider's
 * state of course lives on the provider's own servers, not in this
 * process). The DATABASE (signature_requests) is always the actual
 * source of truth for this application's own UI and authorization
 * decisions; the mock provider's memory is only ever consulted for the
 * handful of direct provider-adapter calls in src/lib/supabase/admin/
 * signatures.ts (create/resend/cancel/getSignedDocument).
 */
let mockProviderSingleton: MockSignatureProvider | null = null;

export function getSignatureProvider(): SignatureProvider {
  const name = getSignatureProviderName();
  switch (name) {
    case "mock":
    default:
      if (!mockProviderSingleton) mockProviderSingleton = new MockSignatureProvider();
      return mockProviderSingleton;
  }
}
