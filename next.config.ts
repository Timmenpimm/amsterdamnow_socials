import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @resvg/resvg-js ships a native (.node) addon for PNG rasterization used
  // by lib/renderer.ts (Fase 4 carousel renderer). Turbopack can't bundle
  // native addons into an ESM chunk, so it must stay an external require
  // resolved at runtime instead.
  //
  // The NOW renderer (lib/renderer-now.ts) drives a headless Chromium:
  // - @sparticuz/chromium resolves its brotli-packed binaries through paths
  //   relative to its own package directory, which breaks once bundled;
  // - playwright-core / playwright ship their own browser registry and driver
  //   files for the same reason.
  // All three must stay plain runtime requires. `playwright` is a
  // devDependency (local rendering only) and is deliberately never resolved on
  // Vercel — keeping it external is what makes its absence there harmless.
  serverExternalPackages: [
    "@resvg/resvg-js",
    "@sparticuz/chromium",
    "playwright-core",
    "playwright",
  ],

  // The built-in NOW templates are read from disk at request time with paths
  // built from the manifest, so output file tracing can't discover them and
  // they would be missing from the serverless bundle.
  outputFileTracingIncludes: {
    "/api/templates/import/builtin": ["./templates/now/*.html"],
    // Same story for the render route: lib/renderer-now.ts reads
    // templates/now/<spec.file> at request time.
    "/api/render": ["./templates/now/*.html"],
  },
};

export default nextConfig;
