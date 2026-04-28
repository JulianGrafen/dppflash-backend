import type { NextConfig } from "next";

// Vercel sets VERCEL_URL automatically (e.g. "my-app.vercel.app").
// We expose it as NEXT_PUBLIC_APP_URL so client components can use it.
const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined;

const nextConfig: NextConfig = {
  serverExternalPackages: ['@napi-rs/canvas'],
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_DPP_URL || vercelUrl || 'http://localhost:3000',
  },
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
