import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@tempo/ui", "@tempo/wallet-bridge", "@tempo/types"],
}

export default nextConfig
