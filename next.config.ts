import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
      // ppr: true,
      serverActions: {
      allowedOrigins: ["api.kapil.app", "api2.kapil.app", "auth.kapil.app", "us-chunk.kapil.app"],
      },

    },
  eslint: {
    ignoreDuringBuilds: true
  }
  /* config options here */
};

export default nextConfig;
