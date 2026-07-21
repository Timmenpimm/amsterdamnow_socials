import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @resvg/resvg-js ships a native (.node) addon for PNG rasterization used
  // by lib/renderer.ts (Fase 4 carousel renderer). Turbopack can't bundle
  // native addons into an ESM chunk, so it must stay an external require
  // resolved at runtime instead.
  serverExternalPackages: ["@resvg/resvg-js"],
};

export default nextConfig;
