import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // CC-22B: branded 404 for unmatched top-level URLs (src/app/global-not-found.tsx).
    globalNotFound: true,
    serverActions: {
      // The CSV import pipeline (src/lib/education/csv.ts) enforces a
      // 10MB file-size limit of its own; the Server Action default (1MB)
      // is well under that, so a multipart upload posted via
      // src/app/admin/education/imports/new's form would be rejected by
      // the framework before ever reaching that check. Leave headroom for
      // multipart boundaries/field metadata on top of the 10MB CSV itself.
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
