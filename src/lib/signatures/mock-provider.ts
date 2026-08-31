import "server-only";
import { randomUUID, createHmac } from "node:crypto";
import { PDFDocument, StandardFonts } from "pdf-lib";
import type {
  CreateSignatureRequestParams,
  GetSignatureStatusResult,
  ProviderSignatureStatus,
  SignatureProvider,
  SignatureRequestResult,
  SignedDocument,
  VerifyWebhookParams,
} from "./provider";
import { getSignatureWebhookSecret } from "./config";

/**
 * Milestone 10 (F-122) — the default SignatureProvider implementation,
 * used whenever SIGNATURE_PROVIDER is unset or 'mock' (i.e. this whole
 * milestone works with zero external configuration). Simulates a real
 * e-signature provider's request lifecycle entirely in memory: state does
 * NOT persist across process restarts and is NOT shared across serverless
 * instances — this is a development/testing aid, never a production
 * signature backend (see docs/milestones/M10-electronic-signature.md
 * "Known limitations"). Each instance owns its own state (not a module-
 * level singleton) so tests can create isolated instances; the app's real
 * runtime singleton lives in src/lib/signatures/get-provider.ts.
 *
 * The test-harness half of this class (simulateEvent below) is what makes
 * the webhook route genuinely exercisable end-to-end in dev/tests: rather
 * than a shortcut that directly flips a database row, it builds the EXACT
 * same JSON envelope and HMAC signature a real webhook delivery would
 * carry (using the same secret src/app/api/webhooks/signature/route.ts and
 * public.apply_signature_webhook_event() verify against), so POSTing the
 * result at that route exercises real signature verification + idempotency
 * + status-mapping, never bypassed.
 */

interface MockRequestState {
  providerRequestId: string;
  agreementId: string;
  agreementVersionId: string;
  signerName: string;
  signerEmail: string;
  documentTitle: string;
  status: ProviderSignatureStatus;
  viewedAt: string | null;
  signedAt: string | null;
  declinedAt: string | null;
  expiredAt: string | null;
}

export type MockSimulatableEvent = "sent" | "viewed" | "signed" | "declined" | "cancelled" | "expired" | "failed";

export interface SimulatedWebhookDelivery {
  rawBody: string;
  signature: string;
}

export class MockSignatureProvider implements SignatureProvider {
  readonly providerName = "mock";
  private readonly requests = new Map<string, MockRequestState>();

  async createSignatureRequest(params: CreateSignatureRequestParams): Promise<SignatureRequestResult> {
    const providerRequestId = `mock_req_${randomUUID()}`;
    this.requests.set(providerRequestId, {
      providerRequestId,
      agreementId: params.agreementId,
      agreementVersionId: params.agreementVersionId,
      signerName: params.signerName,
      signerEmail: params.signerEmail,
      documentTitle: params.documentTitle,
      status: "sent",
      viewedAt: null,
      signedAt: null,
      declinedAt: null,
      expiredAt: null,
    });
    return { providerRequestId, status: "sent" };
  }

  async getSignatureStatus(providerRequestId: string): Promise<GetSignatureStatusResult> {
    const state = this.requests.get(providerRequestId);
    if (!state) throw new Error(`Mock provider has no request "${providerRequestId}".`);
    return { status: state.status, viewedAt: state.viewedAt, signedAt: state.signedAt, declinedAt: state.declinedAt, expiredAt: state.expiredAt };
  }

  async cancelSignatureRequest(providerRequestId: string): Promise<void> {
    const state = this.requests.get(providerRequestId);
    if (!state) throw new Error(`Mock provider has no request "${providerRequestId}".`);
    state.status = "cancelled";
  }

  async resendSignatureRequest(providerRequestId: string): Promise<void> {
    const state = this.requests.get(providerRequestId);
    if (!state) throw new Error(`Mock provider has no request "${providerRequestId}".`);
    // A resend never changes status — it is a re-delivery of the same
    // outstanding request, never a new one.
  }

  /** Local-only pre-check (see SignatureProvider's own docblock) — the authoritative check is always public.apply_signature_webhook_event(), independent of this. */
  verifyWebhook({ rawBody, signature }: VerifyWebhookParams): boolean {
    const secret = getSignatureWebhookSecret();
    if (!secret) return false;
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    return timingSafeEqualHex(expected, signature);
  }

  async getSignedDocument(providerRequestId: string): Promise<SignedDocument> {
    const state = this.requests.get(providerRequestId);
    if (!state) throw new Error(`Mock provider has no request "${providerRequestId}".`);
    const bytes = await buildMockSignedPdf(state);
    return { bytes, contentType: "application/pdf", fileName: `signed-agreement-${providerRequestId}.pdf` };
  }

  // -------------------------------------------------------------------
  // Test harness — NOT part of the SignatureProvider interface. See this
  // file's docblock for why this exists and how it keeps the webhook path
  // honestly exercised.
  // -------------------------------------------------------------------

  /**
   * Flips this mock request's internal state to `event` and returns a
   * {rawBody, signature} pair shaped and signed exactly like a real
   * webhook delivery — POST it to /api/webhooks/signature to exercise the
   * real verification + processing path end-to-end. Throws if no webhook
   * secret is configured (mirrors the route's own "not configured" guard)
   * or if the request id is unknown to this instance.
   */
  simulateEvent(providerRequestId: string, event: MockSimulatableEvent, metadata: Record<string, unknown> = {}): SimulatedWebhookDelivery {
    const state = this.requests.get(providerRequestId);
    if (!state) throw new Error(`Mock provider has no request "${providerRequestId}".`);
    const secret = getSignatureWebhookSecret();
    if (!secret) throw new Error("Signature webhook secret is not configured — cannot sign a simulated delivery.");

    const now = new Date().toISOString();
    if (event === "viewed") state.viewedAt = now;
    if (event === "signed") state.signedAt = now;
    if (event === "declined") state.declinedAt = now;
    if (event === "expired") state.expiredAt = now;
    state.status = event;

    const rawBody = JSON.stringify({
      eventType: `signature_request.${event}`,
      provider: this.providerName,
      providerRequestId,
      metadata,
    });
    const signature = createHmac("sha256", secret).update(rawBody).digest("hex");
    return { rawBody, signature };
  }

  /** Test/QA convenience — not part of the interface. */
  getInternalState(providerRequestId: string): Readonly<MockRequestState> | undefined {
    return this.requests.get(providerRequestId);
  }
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function buildMockSignedPdf(state: MockRequestState): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let y = 780;
  const draw = (text: string, size = 11, f = font) => {
    page.drawText(text, { x: 56, y, size, font: f });
    y -= size + 10;
  };
  draw("MOCK SIGNED DOCUMENT", 16, bold);
  draw("This file was generated by NextWise's development-only mock signature provider.", 10);
  draw("It does not represent a real, provider-signed legal document.", 10);
  y -= 10;
  draw(`Document: ${state.documentTitle}`);
  draw(`Signer: ${state.signerName} <${state.signerEmail}>`);
  draw(`Provider request ID: ${state.providerRequestId}`);
  draw(`Signed at: ${state.signedAt ?? "(not signed)"}`);
  return doc.save();
}
