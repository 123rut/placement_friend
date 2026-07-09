import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@piaa/domain"],
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
    };
    return config;
  },
};

export default nextConfig;
