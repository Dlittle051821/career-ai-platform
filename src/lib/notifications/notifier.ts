/**
 * Milestone 10 (F-122) — the honest F-190 substitute. This codebase has NO
 * real email/notification system anywhere ("F-190 email/notification
 * system" the M10 spec assumed already existed does not actually exist —
 * no mailer, no sendEmail(), nothing). This file does NOT build one. It
 * ships a minimal `Notifier` interface plus a default `LoggingNotifier`
 * that safely logs instead of sending real email — every "notification"
 * this milestone fires today is, honestly, a structured log line.
 *
 * A future milestone (or a configuration change) plugs in a real
 * implementation — Resend, SendGrid, SES, or similar — by writing a class
 * that implements `Notifier` and swapping it in at
 * src/lib/notifications/get-notifier.ts's one switch statement, exactly
 * the same "one file to add, nothing else to touch" shape as
 * src/lib/signatures/get-provider.ts. See
 * docs/milestones/M10-electronic-signature.md "Known limitations" for the
 * full write-up.
 *
 * Deliberately pure/framework-free (no Supabase import) so it is trivially
 * unit-testable — see notifier.test.ts.
 */

export const NOTIFICATION_TEMPLATES = [
  "signature_requested",
  "signature_reminder",
  "signature_completed",
  "signature_declined",
  "signature_expired",
] as const;
export type NotificationTemplate = (typeof NOTIFICATION_TEMPLATES)[number];

export interface NotifyInput {
  to: string;
  template: NotificationTemplate;
  /** Small, non-sensitive data for the template — never a raw document, password, token, or full payment detail (same discipline as src/lib/admin/audit.ts's redaction pattern, mirrored below by REDACTED_DATA_KEY_PATTERN). */
  data: Record<string, unknown>;
}

export interface Notifier {
  /**
   * Fire-and-forget, same discipline as src/lib/supabase/analytics/
   * track.ts's trackEvent(): NEVER throws and its returned promise NEVER
   * rejects — a notification failure must never break the signature flow
   * that triggered it. Implementations are responsible for their own
   * internal try/catch; callers never need to wrap this in one.
   */
  notify(input: NotifyInput): Promise<void>;
}

const REDACTED_DATA_KEY_PATTERN = /password|token|secret|api[_-]?key|credential|card[_-]?number|cvv|cvc|ssn|service[_-]?role/i;

/** Same shallow redaction discipline as src/lib/admin/audit.ts's redactSensitiveFields — a template author who accidentally passes a sensitive-looking key gets it stripped from the logged/sent payload rather than persisted. */
export function redactNotificationData(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    out[key] = REDACTED_DATA_KEY_PATTERN.test(key) ? "[redacted]" : value;
  }
  return out;
}

/**
 * Default, always-available Notifier. In development, logs a full,
 * readable line so a developer can verify the right notification would
 * have fired. In production, logs a single, quiet, structured line (no
 * stack trace flood, no PII beyond what the caller already put in `data`
 * after redaction) — matches src/lib/supabase/analytics/track.ts's
 * logAnalyticsFailure() dev/production split exactly.
 */
export class LoggingNotifier implements Notifier {
  async notify(input: NotifyInput): Promise<void> {
    try {
      const safeData = redactNotificationData(input.data);
      if (process.env.NODE_ENV === "production") {
        console.warn(`[notifications] (not sent — no real provider configured) template="${input.template}" to="${input.to}"`);
      } else {
        console.warn(`[notifications] (not sent — no real provider configured) template="${input.template}" to="${input.to}" data=`, safeData);
      }
    } catch {
      // Never let a logging failure escape — see this class's own
      // interface docblock: notify() must never throw. Deliberately does
      // NOT attempt another console call here (which could itself throw,
      // e.g. in a test harness or an unusual host environment) — silently
      // swallowing is the correct behavior for a best-effort notification.
    }
  }
}
