import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['www.feelcycle.com', 'm.feelcycle.com'],
  },
};

export default nextConfig;
