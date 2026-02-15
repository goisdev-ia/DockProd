import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async headers() {
    return [
      {
        source: '/manifest.json',
        headers: [{ key: 'Content-Type', value: 'application/manifest+json' }],
      },
    ]
  },
  images: {
    qualities: [100, 75],
  },
  turbopack: {
    resolveAlias: {
      tailwindcss: path.join(path.resolve(__dirname), "node_modules", "tailwindcss"),
      "@tailwindcss/postcss": path.join(path.resolve(__dirname), "node_modules", "@tailwindcss/postcss"),
    },
  },
  webpack: (config) => {
    const projectRoot = path.resolve(__dirname);
    const nodeModules = path.join(projectRoot, "node_modules");
    config.resolve = config.resolve ?? {};
    config.resolve.modules = [
      nodeModules,
      ...(Array.isArray(config.resolve.modules) ? config.resolve.modules : ["node_modules"]),
    ];
    config.resolve.alias = {
      ...config.resolve.alias,
      tailwindcss: path.join(nodeModules, "tailwindcss"),
      "@tailwindcss/postcss": path.join(nodeModules, "@tailwindcss/postcss"),
    };
    return config;
  },
};

export default nextConfig;
