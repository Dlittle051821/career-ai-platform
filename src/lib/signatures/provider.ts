import "server-only";

/**
 * Milestone 10 (F-122) — provider-agnostic electronic-signature gateway
 * abstraction, mirroring src/lib/payments/gateway.ts's PaymentGateway
 * pattern exactly: every call site in this application (the signature
 * service layer, the webhook route) depends only on this interface —
 * plugging in a real provider (DocuSign, Dropbox Sign, Adobe Sign, Zoho
 * Sign, ...) later means writing one new file that implements it, never
 * touching business logic. Deliberately generic — no method or shape here
 * assumes any one real provider's API surface; every field is either an
 * identifier this application already owns (agreement/version id, signer
 * name/email, a callback URL) or a provider-agnostic status this
 * application's own SignatureRequestStatus (src/types/signatures.ts) is
 * mapped from/to, never a raw provider enum leaking through.
 */

export type ProviderSignatureStatus = "pending" | "sent" | "viewed" | "signed" | "declined" | "cancelled" | "expired" | "failed";

export interface CreateSignatureRequestParams {
  /** This application's own agreement id — passed through as opaque metadata a real provider adapter could put in its own "reference"/"tag" field; never used to look anything up provider-side. */
  agreementId: string;
  agreementVersionId: string;
  signerName: string;
  signerEmail: string;
  /** Human-readable label for the document being signed (e.g. the agreement type) — shown in the provider's own signing UI/email, never used for authorization. */
  documentTitle: string;
  /** Where the signer should land after completing/declining, if the provider supports a return URL. Never required — this application never depends on a signer visiting it (the real state comes from the webhook, not a redirect). */
  returnUrl?: string;
}

export interface SignatureRequestResult {
  providerRequestId: string;
  status: ProviderSignatureStatus;
}

export interface GetSignatureStatusResult {
  status: ProviderSignatureStatus;
  viewedAt?: string | null;
  signedAt?: string | null;
  declinedAt?: string | null;
  expiredAt?: string | null;
}

export interface VerifyWebhookParams {
  rawBody: string;
  signature: string;
}

export interface SignedDocument {
  bytes: Uint8Array;
  contentType: string;
  fileName: string;
}

/**
 * Every method that talks to a real provider is async (a genuine network
 * call in a real implementation); verifyWebhook is a pure, synchronous
 * local check (same "verify* methods are local-only pre-checks" note as
 * PaymentGateway — the authoritative check for signature webhook state
 * changes is still the database, via public.apply_signature_webhook_event()
 * in 0011_electronic_signature.sql, independent of what this method
 * reports; see that function's own comment for why).
 */
export interface SignatureProvider {
  readonly providerName: string;
  createSignatureRequest(params: CreateSignatureRequestParams): Promise<SignatureRequestResult>;
  getSignatureStatus(providerRequestId: string): Promise<GetSignatureStatusResult>;
  cancelSignatureRequest(providerRequestId: string): Promise<void>;
  resendSignatureRequest(providerRequestId: string): Promise<void>;
  /** Local-only pre-check — never the authoritative check for a database write (see class docblock above). */
  verifyWebhook(params: VerifyWebhookParams): boolean;
  getSignedDocument(providerRequestId: string): Promise<SignedDocument>;
}

export class SignatureProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SignatureProviderError";
  }
}
