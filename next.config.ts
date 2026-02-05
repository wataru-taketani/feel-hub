import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.feelcycle.com',
      },
      {
        protocol: 'https',
        hostname: 'm.feelcycle.com',
      },
    ],
  },
};

export default nextConfig;
