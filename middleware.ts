import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  LAUNCH_MODE_HEADER,
  PUBLIC_MARKETING,
  classifyPublicMarketingRequest,
  isPublicMarketingMode,
} from "@/lib/launch/launch-mode";

/** Rewriting to a path no route serves renders the site's 404 page with status 404. */
const NOT_FOUND_PATH = "/__nextwise-not-public";

export async function middleware(request: NextRequest) {
  // V5.6.2 public launch: in public-marketing mode only the public website is
  // served. See src/lib/launch/launch-mode.ts.
  if (isPublicMarketingMode()) {
    const decision = classifyPublicMarketingRequest(request.method, request.nextUrl.pathname, request.headers);
    let response: NextResponse;
    switch (decision.action) {
      case "allow":
        // No Supabase session refresh: public pages need no account.
        response = NextResponse.next();
        break;
      case "redirect":
        response = NextResponse.redirect(new URL(decision.location, request.url), 307);
        break;
      case "method-not-allowed":
        response = new NextResponse("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } });
        break;
      default:
        response = NextResponse.rewrite(new URL(NOT_FOUND_PATH, request.url), { status: 404 });
    }
    response.headers.set(LAUNCH_MODE_HEADER, PUBLIC_MARKETING);
    return response;
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on every route except static assets and Next.js internals, so
     * the session cookie stays fresh site-wide — not just on protected
     * pages. Route protection itself is scoped inside updateSession().
     *
     * V5.6.2 public launch: only image files inside public/'s own folders
     * skip the middleware. The earlier rule skipped ANY path ending in an
     * image extension, so a restricted dynamic route such as
     * /pay/<token>.png or /payments/<id>/receipts/<x>.png bypassed it.
     * Kept in step with src/lib/launch/launch-mode.ts (STATIC_DIRS); a test
     * checks the two lists match.
     */
    "/((?!_next/static|_next/image|favicon\\.ico$|icon\\.svg$|(?:brand|cards|cta|dashboard|hero|home-v4|home-v54|home-v562|profile)/.+\\.(?:svg|png|jpg|jpeg|gif|webp|avif)$).*)",
  ],
};
