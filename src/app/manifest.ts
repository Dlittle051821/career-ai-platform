import type { MetadataRoute } from "next";
import { BRAND_LOGO, BRAND_NAME, BRAND_SHORT_DESCRIPTION, BRAND_SHORT_NAME } from "@/config/site";

/**
 * Web app manifest (served at /manifest.webmanifest), generated from the
 * central brand config so it never drifts from the rest of the app's
 * branding. Not tied to any PWA install-prompt work — Next.js serves this
 * automatically for any app that has one, and browsers use a subset of it
 * (name, icons, theme_color) even without a full "installable" experience.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND_NAME,
    short_name: BRAND_SHORT_NAME,
    description: BRAND_SHORT_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1c2b4a",
    icons: [
      { src: BRAND_LOGO.icon192, sizes: "192x192", type: "image/png" },
      { src: BRAND_LOGO.icon512, sizes: "512x512", type: "image/png" },
    ],
  };
}
