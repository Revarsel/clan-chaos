/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@clan-chaos/shared", "@clan-chaos/game-content", "@clan-chaos/game-engine"],
  webpack: (config) => {
    // Workspace packages use NodeNext-style ".js" specifiers that point at ".ts" sources.
    config.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js"] };
    return config;
  },
};
export default nextConfig;
