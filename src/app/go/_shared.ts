import { NextResponse } from "next/server";
import { BRAND_NAME } from "@/config/site";

/**
 * Shared helper for the /go/course-search/** secure outbound-redirect route
 * handlers. Not itself a route (no exported GET/POST) — a plain helper
 * module Next.js does not treat as a page/route, same convention as any
 * other non-route .ts file colocated under src/app/.
 *
 * When validation fails for any reason, these routes must "return a safe
 * NextWise error page and do not redirect" (spec) — this renders that
 * error directly as the route handler's own HTML response, rather than
 * issuing a second redirect to a separate error page (which would just be
 * another hop, and a route handler is not a React Server Component, so it
 * cannot render a JSX page component). The styling below intentionally
 * mirrors this app's brand tokens (src/app/globals.css) using the same hex
 * values verbatim, since a raw Response here is outside the Next.js render
 * tree and cannot read a CSS custom property file.
 */
export function renderGoErrorPage(message: string, status = 404): NextResponse {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Link unavailable — ${BRAND_NAME}</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #faf7f1; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #000c24; padding: 24px; }
  .card { max-width: 420px; width: 100%; background: #ffffff; border: 1px solid #c3ccda; border-radius: 16px; padding: 32px; text-align: center; }
  .badge { display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 999px; background: #fbe7e1; color: #af351c; font-size: 22px; margin-bottom: 16px; }
  h1 { font-size: 20px; margin: 0 0 8px; }
  p { font-size: 14px; line-height: 1.5; color: #5b6472; margin: 0 0 20px; }
  a { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 20px; border-radius: 10px; background: #005ef6; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; }
  a:focus-visible { outline: 2px solid #005ef6; outline-offset: 2px; }
</style>
</head>
<body>
  <main class="card" role="main">
    <div class="badge" aria-hidden="true">&#9888;</div>
    <h1>This trusted-portal link isn&rsquo;t available</h1>
    <p>${message} No external site was opened. Please return to ${BRAND_NAME} and try your search again.</p>
    <a href="/courses">Back to Course Explorer</a>
  </main>
</body>
</html>`;
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
