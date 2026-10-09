import type { NextConfig } from "next";
import { securityHeaders } from "./src/security-headers";

// Cache Components is left off on purpose: the spec requires store and
// backend pages to render dynamically per request, so stock and session
// reads never depend on cache invalidation.
const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders(process.env.NODE_ENV !== "production") }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
