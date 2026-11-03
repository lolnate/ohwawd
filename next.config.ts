import type { NextConfig } from "next";

const allowedDevOrigins = process.env.DEV_ALLOWED_ORIGINS?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  ...(allowedDevOrigins ? { allowedDevOrigins } : {}),
  output: "standalone",
};

export default nextConfig;
