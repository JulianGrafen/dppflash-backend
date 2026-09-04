import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

function resolveProjectRoot(): string {
  const candidates = [
    path.dirname(fileURLToPath(import.meta.url)),
    process.cwd(),
    path.join(process.cwd(), "dppf-backend"),
  ];

  for (const candidate of candidates) {
    const packageJsonPath = path.join(candidate, "package.json");
    if (!existsSync(packageJsonPath)) {
      continue;
    }
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { name?: string };
      if (pkg.name === "dppf-backend") {
        return candidate;
      }
    } catch {
      // try next candidate
    }
  }

  return path.dirname(fileURLToPath(import.meta.url));
}

const projectRoot = resolveProjectRoot();

// Vercel sets VERCEL_URL automatically (e.g. "my-app.vercel.app").
const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined;

const nextConfig: NextConfig = {
  // Prevent Turbopack from picking ~/package-lock.json as workspace root.
  turbopack: {
    root: projectRoot,
    resolveAlias: {
      tailwindcss: path.join(projectRoot, "node_modules/tailwindcss"),
    },
  },
  outputFileTracingRoot: projectRoot,
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist"],
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_DPP_URL || vercelUrl || "http://localhost:3000",
  },
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
