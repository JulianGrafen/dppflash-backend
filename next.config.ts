import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // CORS für Development erlauben
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        { key: "Access-Control-Allow-Origin", value: "*" },
        { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
      ],
    },
  ],
};

export default nextConfig;
