import type { NextConfig } from "next"

// Backend origin the /api/* proxy forwards to. Server-side only (not exposed to
// the browser), so the API never needs a public hostname — Cloudflare Tunnel
// only has to expose the web server, and the browser calls same-origin /api/*.
const API_PROXY_TARGET = process.env.API_PROXY_TARGET ?? "http://localhost:8080"
const ALLOWED_DEV_ORIGINS = process.env.ALLOWED_DEV_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? []

const nextConfig: NextConfig = {
  transpilePackages: ["@tempo/ui", "@tempo/wallet-bridge", "@tempo/types"],
  ...(ALLOWED_DEV_ORIGINS.length > 0 && { allowedDevOrigins: ALLOWED_DEV_ORIGINS }),
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_PROXY_TARGET}/:path*`,
      },
    ]
  },
}

export default nextConfig
