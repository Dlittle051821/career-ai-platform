import "server-only";
import { notFound } from "next/navigation";
import { isPublicMarketingMode } from "./launch-mode";

/**
 * Defence in depth for the V5.6.2 public launch. middleware.ts already refuses
 * every restricted route in public-marketing mode; the restricted layouts call
 * this too, so a page still returns 404 if the middleware were ever skipped.
 */
export function notFoundInPublicMarketingMode(): void {
  if (isPublicMarketingMode()) notFound();
}
