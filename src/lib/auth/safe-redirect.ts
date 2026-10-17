/**
 * UX10-DS02 "Public Discovery Entry & Auth Flow" — a single, shared
 * internal-redirect validator for every place this codebase accepts a
 * `?next=...` (or equivalent) query value and later redirects to it.
 *
 * Before this milestone, `/auth/callback` (src/app/auth/callback/route.ts)
 * and `LoginForm.tsx` each had their own inline check —
 * `next.startsWith("/")` — which is NOT sufficient: a value like
 * `//evil.example` or `/\evil.example` also "starts with /" but a browser
 * resolves it as a protocol-relative, cross-origin URL (an open-redirect
 * vulnerability). This helper replaces both inline checks with one
 * reviewed implementation; nothing else in this codebase should hand-roll
 * its own "is this a safe internal path" check.
 *
 * A value is accepted only if it is a single-leading-slash, same-origin
 * relative path: it must start with exactly one `/` (not `//`, not `/\`),
 * must not contain a `://` scheme separator anywhere, and must not decode
 * (once) to something that fails either check. Anything else — an
 * absolute URL, a protocol-relative URL, `javascript:`/`data:`/any other
 * scheme, a backslash-prefixed value, or malformed percent-encoding —
 * falls back to the caller-supplied default.
 */

// Exactly one leading "/", not followed by another "/" or a "\" (both of
// which a browser can treat as the start of a protocol-relative,
// cross-origin URL), and no embedded whitespace.
const SAFE_INTERNAL_PATH = /^\/(?!\/|\\)\S*$/;

export function getSafeRedirectPath(rawNext: string | null | undefined, fallback: string): string {
  if (!rawNext) return fallback;

  let decoded: string;
  try {
    decoded = decodeURIComponent(rawNext);
  } catch {
    // Malformed percent-encoding (e.g. a lone "%") — reject, don't throw.
    return fallback;
  }

  if (!SAFE_INTERNAL_PATH.test(decoded)) return fallback;
  // Belt-and-braces: reject anything carrying a scheme separator
  // (http://, javascript:, etc.) even if it somehow passed the leading-
  // slash check above.
  if (decoded.toLowerCase().includes("://")) return fallback;

  return decoded;
}
