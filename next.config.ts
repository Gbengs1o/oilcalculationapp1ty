import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* other config options here */
  eslint: {
    // Disable ESLint during production builds
    ignoreDuringBuilds: true,
    
    // Or if you want ESLint to run but not fail builds
    // ignoreDuringBuilds: false,
  },
};

export default nextConfig;