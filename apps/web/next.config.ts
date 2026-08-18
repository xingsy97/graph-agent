import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@graph-agent/domain"],
  serverExternalPackages: ["@github/copilot-sdk"],
};

export default config;
