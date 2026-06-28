import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Pin the workspace root to this app (multiple lockfiles exist above it).
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
