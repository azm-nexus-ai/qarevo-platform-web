import type { NextConfig } from "next";
import { portalHostRedirects } from './lib/server/portal-host-routing';

const nextConfig: NextConfig = {
  devIndicators: false,
  redirects: () => portalHostRedirects(process.env),

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },

};

export default nextConfig;
