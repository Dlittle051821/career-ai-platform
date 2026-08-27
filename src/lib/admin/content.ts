/**
 * Content-safety for the CMS module (content_items.body). The rule is
 * simple and absolute: body text is ALWAYS plain text, never interpreted
 * as HTML. There is no dangerouslySetInnerHTML anywhere in this feature —
 * splitting into paragraphs is done with plain string operations and
 * rendered as React text nodes, which React escapes automatically. This
 * file exists so that logic is written once, tested, and reused by every
 * place content is previewed (the admin editor's preview pane and, in the
 * future, any public page that reads published content — see
 * docs/admin-system-guide.md §9).
 */

const MAX_BODY_LENGTH = 20_000;

/** Trims, caps length, and normalizes line endings — the ONLY processing content body ever gets before being handed to React for plain-text rendering. Never strips or transforms characters in a way that could be mistaken for sanitizing HTML, because it is never treated as HTML in the first place. */
export function normalizeContentBody(raw: string): string {
  return raw.replace(/\r\n/g, "\n").trim().slice(0, MAX_BODY_LENGTH);
}

/** Splits a normalized body into paragraphs (blank-line-separated) for plain-text rendering — one <p> per paragraph, line breaks within a paragraph preserved as separate lines. Never returns HTML markup, only plain strings. */
export function splitContentParagraphs(normalizedBody: string): string[][] {
  if (normalizedBody.length === 0) return [];
  return normalizedBody
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.split("\n").map((line) => line.trim()))
    .filter((lines) => lines.some((line) => line.length > 0));
}

/** A short plain-text preview for list pages — collapses to one line, no markup, truncated with an ellipsis. */
export function contentPreview(rawBody: string, maxLength = 140): string {
  const collapsed = normalizeContentBody(rawBody).replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxLength) return collapsed;
  return `${collapsed.slice(0, maxLength - 1).trimEnd()}…`;
}

export function isValidContentSlug(slug: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length > 0 && slug.length <= 100;
}
