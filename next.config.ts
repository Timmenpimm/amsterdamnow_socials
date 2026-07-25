import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @resvg/resvg-js ships a native (.node) addon for PNG rasterization used
  // by lib/renderer.ts (Fase 4 carousel renderer). Turbopack can't bundle
  // native addons into an ESM chunk, so it must stay an external require
  // resolved at runtime instead.
  serverExternalPackages: ["@resvg/resvg-js"],

  // The built-in NOW templates are read from disk at request time with paths
  // built from the manifest, so output file tracing can't discover them and
  // they would be missing from the serverless bundle.
  outputFileTracingIncludes: {
    "/api/templates/import/builtin": ["./templates/now/*.html"],
  },
};

export default nextConfig;
