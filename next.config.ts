import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Phones on the LAN open the dev server by IP, not localhost.
  allowedDevOrigins: ["*.*.*.*"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "i.ytimg.com", pathname: "/vi/**" }],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
