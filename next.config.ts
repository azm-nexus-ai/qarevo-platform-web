import type { NextConfig } from "next";
import { portalHostRedirects } from './lib/server/portal-host-routing';
import { selectBuildRevision } from './lib/server/build-revision';

const nextConfig: NextConfig = {
  devIndicators: false,
  // Next substitutes this value into the built server bundle. A later runtime
  // environment change must not relabel an already-built release.
  env: { QAREVO_BUILD_REVISION: selectBuildRevision(process.env) ?? '' },
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
