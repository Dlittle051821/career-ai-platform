/**
 * V5.6.2 public launch: the restricted "public marketing" mode.
 *
 * Production publishes the public website only. Student accounts, booking,
 * applications, payments, the counsellor and admin studios, AI and every
 * internal API stay closed until each is cleared on its own.
 *
 * How it is enforced:
 *   1. middleware.ts calls classifyPublicMarketingRequest() on every request,
 *      on the server, before any page or Server Action runs:
 *      - only GET and HEAD are served (every Server Action, form post and
 *        webhook is refused with 405);
 *      - only the public pages listed below are served;
 *      - account entry points redirect to /book-counselling, which explains
 *        that accounts are not open and how to book by email or phone;
 *      - everything else (admin, counsellor, studio, APIs, auth callbacks)
 *        returns 404.
 *      The middleware also skips the Supabase session refresh, so no auth call
 *      is made from the server for public traffic.
 *   2. The restricted layouts call notFound() in this mode (defence in depth).
 *   3. Payments and paid AI are forced off in this mode, whatever the
 *      environment variables say.
 *
 * What this mode does NOT do: it does not change the database. The Supabase
 * project URL and publishable key are public by design, so anyone can call
 * PostgREST and the RPCs directly, without this website. Database exposure is
 * controlled only by RLS, grants and the Auth settings. See
 * docs/release/V562-PUBLIC-LAUNCH.md.
 *
 * Mode selection (fail closed):
 *   NEXTWISE_LAUNCH_MODE=public-marketing  -> public marketing
 *   NEXTWISE_LAUNCH_MODE=full-platform     -> full platform
 *   unset, and VERCEL_ENV=production       -> public marketing
 *   unset, anywhere else                   -> full platform (local, Preview)
 *   any other value                        -> public marketing
 */

export const LAUNCH_MODE_ENV = "NEXTWISE_LAUNCH_MODE";
export const PUBLIC_MARKETING = "public-marketing";
export const FULL_PLATFORM = "full-platform";
export type LaunchMode = typeof PUBLIC_MARKETING | typeof FULL_PLATFORM;

/** Response header that lets a release check confirm which mode a deployment runs in. */
export const LAUNCH_MODE_HEADER = "x-nextwise-launch-mode";

type EnvLike = Readonly<Record<string, string | undefined>>;

export function resolveLaunchMode(env: EnvLike = process.env): LaunchMode {
  const raw = env[LAUNCH_MODE_ENV]?.trim();
  if (raw === FULL_PLATFORM) return FULL_PLATFORM;
  if (raw === PUBLIC_MARKETING) return PUBLIC_MARKETING;
  if (raw) return PUBLIC_MARKETING; // unknown value: fail closed
  return env.VERCEL_ENV === "production" ? PUBLIC_MARKETING : FULL_PLATFORM;
}

export function isPublicMarketingMode(env: EnvLike = process.env): boolean {
  return resolveLaunchMode(env) === PUBLIC_MARKETING;
}

/** Public pages served in public-marketing mode (exact path). */
export const PUBLIC_EXACT_PATHS: readonly string[] = [
  "/",
  "/how-it-works",
  "/career",
  "/careers",
  "/career-discovery",
  "/compare",
  "/universities",
  "/courses",
  "/courses/compare",
  "/abroad",
  "/study-europe",
  "/study-options",
  "/pricing",
  "/about",
  "/contact",
  "/parents",
  "/trust",
  "/privacy",
  "/terms",
  "/refund-policy",
  "/book-counselling",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/icon.png",
  "/apple-icon.png",
];

/**
 * Public pages with a dynamic tail. Each pattern is matched against the whole
 * path, so `/courses/a/b` is public but `/courses/a/b/c` is not.
 */
export const PUBLIC_PATTERNS: readonly RegExp[] = [
  /^\/careers\/[^/]+$/,
  /^\/universities\/[^/]+$/,
  /^\/courses\/[^/]+\/[^/]+$/,
  // Outbound links to official course-search portals (anonymous click log, RLS-limited insert).
  /^\/go\/course-search\/[^/]+$/,
  /^\/go\/course-search\/provider\/[^/]+$/,
];

/**
 * Account and booking entry points that public pages link to. In
 * public-marketing mode they redirect to /book-counselling, which explains
 * that online accounts are not open yet and how to book by email or phone.
 */
export const ACCOUNT_ENTRY_PREFIXES: readonly string[] = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/welcome",
  "/discovery-session",
  "/dashboard",
  "/recommendations",
  "/profile",
  "/saved",
  "/applications",
  "/roadmap",
  "/payments",
  "/pay",
  "/pricing/checkout",
  "/agreements",
  "/studio",
];

export const ACCOUNTS_CLOSED_REDIRECT = "/book-counselling";

/** Static files from public/ and Next.js build output. */
const STATIC_DIRS = ["/brand/", "/cards/", "/cta/", "/dashboard/", "/hero/", "/home-v4/", "/home-v54/", "/home-v562/", "/profile/"];
const STATIC_FILE = /\.(?:avif|webp|png|jpe?g|gif|svg|ico|mp4|webm|woff2?|txt|xml|webmanifest|json)$/i;

export type MarketingDecision =
  | { action: "allow" }
  | { action: "redirect"; location: string }
  | { action: "not-found" }
  | { action: "method-not-allowed" };

const underPrefix = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

/**
 * Decides what a request gets in public-marketing mode. Deny by default:
 * anything not listed is a 404.
 */
export function classifyPublicMarketingRequest(
  method: string,
  pathname: string,
  headers?: { has(name: string): boolean },
): MarketingDecision {
  const m = method.toUpperCase();
  if (m !== "GET" && m !== "HEAD") return { action: "method-not-allowed" };
  // A Server Action is always a POST, but refuse the header on any method too.
  if (headers?.has("next-action")) return { action: "method-not-allowed" };

  // Normalise: no trailing slash (except "/"), no encoded traversal tricks.
  let path = pathname;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    return { action: "not-found" };
  }
  if (path.includes("..") || path.includes("\\") || path.includes("//")) return { action: "not-found" };
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);

  // Build output and image files from public/ (no page route lives at these paths).
  if (path.startsWith("/_next/static/") || path === "/_next/image") return { action: "allow" };
  if (STATIC_DIRS.some((p) => path.startsWith(p)) && STATIC_FILE.test(path)) return { action: "allow" };

  if (ACCOUNT_ENTRY_PREFIXES.some((p) => underPrefix(path, p))) {
    return { action: "redirect", location: ACCOUNTS_CLOSED_REDIRECT };
  }
  if (PUBLIC_EXACT_PATHS.includes(path)) return { action: "allow" };
  if (PUBLIC_PATTERNS.some((rx) => rx.test(path))) return { action: "allow" };
  return { action: "not-found" };
}
