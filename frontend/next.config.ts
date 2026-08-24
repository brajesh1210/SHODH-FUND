import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The repository has separate root, frontend, and backend lockfiles. The
  // frontend does not import backend packages, so trace from its own cwd.
  outputFileTracingRoot: process.cwd(),
  allowedDevOrigins: ["*.e2b.app"],
  serverExternalPackages: ["pdfkit", "jsonwebtoken"],
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;