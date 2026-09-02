import "server-only";
import { randomUUID, createHmac } from "node:crypto";
import { PDFDocument, StandardFonts } from "pdf-lib";
import type {
  CreateStampRequestParams,
  GetStampStatusResult,
  ProviderStampStatus,
  StampProvider,
  StampRequestResult,
  StampedDocument,
  VerifyStampWebhookParams,
} from "./provider";
import type { StampOption } from "@/types/stamping";
import { getStampWebhookSecret } from "./config";

/**
 * Milestone 11-A (F-123) — the default StampProvider implementation, used
 * whenever STAMP_PROVIDER is unset or 'mock' (i.e. this whole milestone
 * works with zero external configuration, same posture as
 * src/lib/signatures/mock-provider.ts's MockSignatureProvider). Simulates a
 * real e-stamping provider's request lifecycle entirely in memory: state
 * does NOT persist across process restarts and is NOT shared across
 * serverless instances — this is a development/testing aid, never a
 * production stamping backend (see
 * docs/milestones/M11-electronic-stamping-assisted-onboarding.md "Known
 * limitations"). Each instance owns its own state (not a module-level
 * singleton) so tests can create isolated instances; the app's real runtime
 * singleton lives in src/lib/stamping/get-provider.ts.
 *
 * Allows exercising every state the spec asks for: create request ->
 * processing -> completed | failed | cancelled | expired.
 *
 * The test-harness half of this class (simulateEvent below) is what makes
 * the webhook route genuinely exercisable end-to-end in dev/tests: rather
 * than a shortcut that directly flips a database row, it builds the EXACT
 * same JSON envelope and HMAC signature a real webhook delivery would
 * carry, so POSTing the result at /api/webhooks/stamp exercises real
 * signature verification + idempotency + status-mapping, never bypassed —
 * same discipline as MockSignatureProvider.simulateEvent().
 */

interface MockStampRequestState {
  providerRequestId: string;
  agreementId: string;
  agreementVersionId: string;
  documentTitle: string;
  jurisdiction: string | null;
  state: string | null;
  documentType: string | null;
  status: ProviderStampStatus;
  stampValue: number | null;
  currency: string;
  processingAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  expiredAt: string | null;
}

export type MockStampSimulatableEvent = "processing" | "completed" | "failed" | "cancelled" | "expired";

export interface SimulatedStampWebhookDelivery {
  rawBody: string;
  signature: string;
}

/**
 * A small, clearly-illustrative set of stamp options — NOT real
 * jurisdiction-specific stamp-duty values (spec §6: "do not guess
 * state-specific stamp values"). Every value here is a round, obviously
 * placeholder number a real provider integration would replace entirely.
 */
const MOCK_STAMP_OPTIONS: StampOption[] = [
  { jurisdiction: "Mock Jurisdiction A", state: "State A", documentType: "counselling_agreement", stampValue: 10000, currency: "INR" },
  { jurisdiction: "Mock Jurisdiction B", state: "State B", documentType: "counselling_agreement", stampValue: 20000, currency: "INR" },
];

export class MockStampProvider implements StampProvider {
  readonly providerName = "mock";
  private readonly requests = new Map<string, MockStampRequestState>();

  async createStampRequest(params: CreateStampRequestParams): Promise<StampRequestResult> {
    const providerRequestId = `mock_stamp_${randomUUID()}`;
    const now = new Date().toISOString();
    this.requests.set(providerRequestId, {
      providerRequestId,
      agreementId: params.agreementId,
      agreementVersionId: params.agreementVersionId,
      documentTitle: params.documentTitle,
      jurisdiction: params.jurisdiction,
      state: params.state,
      documentType: params.documentType,
      status: "processing",
      stampValue: null,
      currency: "INR",
      processingAt: now,
      completedAt: null,
      failedAt: null,
      expiredAt: null,
    });
    return { providerRequestId, status: "processing", stampValue: null, currency: "INR" };
  }

  async getStampStatus(providerRequestId: string): Promise<GetStampStatusResult> {
    const state = this.requests.get(providerRequestId);
    if (!state) throw new Error(`Mock stamp provider has no request "${providerRequestId}".`);
    return {
      status: state.status,
      processingAt: state.processingAt,
      completedAt: state.completedAt,
      failedAt: state.failedAt,
      expiredAt: state.expiredAt,
      stampValue: state.stampValue,
    };
  }

  async cancelStampRequest(providerRequestId: string): Promise<void> {
    const state = this.requests.get(providerRequestId);
    if (!state) throw new Error(`Mock stamp provider has no request "${providerRequestId}".`);
    state.status = "cancelled";
  }

  /** Local-only pre-check (see StampProvider's own docblock) — the authoritative check is always public.apply_stamp_webhook_event(), independent of this. */
  verifyWebhook({ rawBody, signature }: VerifyStampWebhookParams): boolean {
    const secret = getStampWebhookSecret();
    if (!secret) return false;
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    return timingSafeEqualHex(expected, signature);
  }

  async retrieveStampedDocument(providerRequestId: string): Promise<StampedDocument> {
    const state = this.requests.get(providerRequestId);
    if (!state) throw new Error(`Mock stamp provider has no request "${providerRequestId}".`);
    const bytes = await buildMockStampedPdf(state);
    return { bytes, contentType: "application/pdf", fileName: `stamped-agreement-${providerRequestId}.pdf` };
  }

  async getAvailableStampOptions(): Promise<StampOption[]> {
    return MOCK_STAMP_OPTIONS;
  }

  // -------------------------------------------------------------------
  // Test harness — NOT part of the StampProvider interface. See this
  // file's docblock for why this exists and how it keeps the webhook path
  // honestly exercised.
  // -------------------------------------------------------------------

  /**
   * Flips this mock request's internal state to `event` and returns a
   * {rawBody, signature} pair shaped and signed exactly like a real
   * webhook delivery — POST it to /api/webhooks/stamp to exercise the real
   * verification + processing path end-to-end. Throws if no webhook secret
   * is configured (mirrors the route's own "not configured" guard) or if
   * the request id is unknown to this instance.
   */
  simulateEvent(providerRequestId: string, event: MockStampSimulatableEvent, opts: { stampValue?: number } = {}): SimulatedStampWebhookDelivery {
    const state = this.requests.get(providerRequestId);
    if (!state) throw new Error(`Mock stamp provider has no request "${providerRequestId}".`);
    const secret = getStampWebhookSecret();
    if (!secret) throw new Error("Stamp webhook secret is not configured — cannot sign a simulated delivery.");

    const now = new Date().toISOString();
    if (event === "completed") {
      state.completedAt = now;
      state.stampValue = opts.stampValue ?? MOCK_STAMP_OPTIONS[0].stampValue;
    }
    if (event === "failed") state.failedAt = now;
    if (event === "expired") state.expiredAt = now;
    state.status = event;

    const rawBody = JSON.stringify({
      eventType: `stamp_request.${event}`,
      provider: this.providerName,
      providerRequestId,
      metadata: event === "completed" ? { stampValue: state.stampValue, currency: state.currency } : {},
    });
    const signature = createHmac("sha256", secret).update(rawBody).digest("hex");
    return { rawBody, signature };
  }

  /** Test/QA convenience — not part of the interface. */
  getInternalState(providerRequestId: string): Readonly<MockStampRequestState> | undefined {
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

async function buildMockStampedPdf(state: MockStampRequestState): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let y = 780;
  const draw = (text: string, size = 11, f = font) => {
    page.drawText(text, { x: 56, y, size, font: f });
    y -= size + 10;
  };
  draw("MOCK STAMPED DOCUMENT", 16, bold);
  draw("This file was generated by NextWise's development-only mock e-stamping provider.", 10);
  draw("It does not represent a real, provider-issued electronic stamp.", 10);
  y -= 10;
  draw(`Document: ${state.documentTitle}`);
  draw(`Provider request ID: ${state.providerRequestId}`);
  draw(`Jurisdiction: ${state.jurisdiction ?? "(not set)"} / ${state.state ?? "(not set)"}`);
  draw(`Stamp value: ${state.stampValue !== null ? `${state.stampValue} (minor units, ${state.currency})` : "(not yet known)"}`);
  draw(`Completed at: ${state.completedAt ?? "(not completed)"}`);
  return doc.save();
}
