import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure Turbopack uses this project as the root (avoids picking D:\ by mistake)
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
