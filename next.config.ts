import type { NextConfig } from "next";

// Cache Components is left off on purpose: the spec requires store and
// backend pages to render dynamically per request, so stock and session
// reads never depend on cache invalidation.
const nextConfig: NextConfig = {
  experimental: {
    // Logo and product image uploads go through server actions; images may
    // be up to 2 MB, plus multipart overhead.
    serverActions: { bodySizeLimit: "3mb" },
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
