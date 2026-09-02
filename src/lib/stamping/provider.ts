import "server-only";

/**
 * Milestone 11-A (F-123) — provider-agnostic electronic-stamping gateway
 * abstraction, mirroring src/lib/signatures/provider.ts's SignatureProvider
 * pattern exactly (which itself mirrors src/lib/payments/gateway.ts's
 * PaymentGateway): every call site in this application (the stamping
 * service layer, the webhook route) depends only on this interface —
 * plugging in a real e-stamping provider (jurisdiction-specific — India has
 * several state-level and SHCIL-integrated e-stamping services, other
 * countries have their own) later means writing one new file that
 * implements it, never touching business logic. Deliberately generic — no
 * method or shape here assumes any one real provider's API surface or any
 * one jurisdiction's stamp-duty rules; every field is either an identifier
 * this application already owns, or a provider-agnostic status this
 * application's own StampRequestStatus (src/types/stamping.ts) is mapped
 * from/to, never a raw provider enum leaking through.
 *
 * This is a DIFFERENT gateway from SignatureProvider — stamping and
 * signing are distinct legal/technical concepts (spec §5: this application
 * never assumes one universal order between them, or that both are even
 * required for a given agreement) — so this interface is deliberately not
 * merged with, or made to extend, SignatureProvider.
 */

export type ProviderStampStatus = "pending" | "processing" | "completed" | "failed" | "cancelled" | "expired";

export interface CreateStampRequestParams {
  /** This application's own agreement id — passed through as opaque metadata a real provider adapter could put in its own "reference"/"tag" field; never used to look anything up provider-side. */
  agreementId: string;
  agreementVersionId: string;
  /** Human-readable label for the document being stamped (e.g. the agreement type) — shown in the provider's own dashboard, never used for authorization. */
  documentTitle: string;
  /** Free-text jurisdiction/state — passed through as-is; this application never validates it against a hardcoded state list or computes a stamp value itself (spec §6: "do not guess state-specific stamp values" — that number always comes from the provider, or is left null pending one). */
  jurisdiction: string | null;
  state: string | null;
  documentType: string | null;
}

export interface StampRequestResult {
  providerRequestId: string;
  status: ProviderStampStatus;
  /** The provider's own reported stamp value (minor units), if it returns one synchronously. Null is valid and means "not yet known" — never defaulted to a guessed number. */
  stampValue: number | null;
  currency: string | null;
}

export interface GetStampStatusResult {
  status: ProviderStampStatus;
  processingAt?: string | null;
  completedAt?: string | null;
  failedAt?: string | null;
  expiredAt?: string | null;
  stampValue?: number | null;
}

export interface VerifyStampWebhookParams {
  rawBody: string;
  signature: string;
}

export interface StampedDocument {
  bytes: Uint8Array;
  contentType: string;
  fileName: string;
}

/**
 * Every method that talks to a real provider is async (a genuine network
 * call in a real implementation); verifyWebhook is a pure, synchronous
 * local check (same "verify* methods are local-only pre-checks" note as
 * PaymentGateway/SignatureProvider — the authoritative check for stamp
 * webhook state changes is still the database, via
 * public.apply_stamp_webhook_event() in
 * 0012_electronic_stamping_and_assisted_onboarding.sql, independent of what
 * this method reports; see that function's own comment for why).
 */
export interface StampProvider {
  readonly providerName: string;
  createStampRequest(params: CreateStampRequestParams): Promise<StampRequestResult>;
  getStampStatus(providerRequestId: string): Promise<GetStampStatusResult>;
  cancelStampRequest(providerRequestId: string): Promise<void>;
  /** Local-only pre-check — never the authoritative check for a database write (see interface docblock above). */
  verifyWebhook(params: VerifyStampWebhookParams): boolean;
  retrieveStampedDocument(providerRequestId: string): Promise<StampedDocument>;
  /**
   * Returns the jurisdiction/state/document-type/value combinations this
   * provider currently supports, exactly as the provider itself reports
   * them — never a hardcoded application-level list of real stamp values
   * (spec §6). The mock provider returns a small illustrative set clearly
   * labeled as such.
   */
  getAvailableStampOptions(): Promise<import("@/types/stamping").StampOption[]>;
}

export class StampProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StampProviderError";
  }
}
