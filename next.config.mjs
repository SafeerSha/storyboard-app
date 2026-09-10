/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      { message: /\[webpack\.cache\.PackFileCacheStrategy\]/ },
    ];
    return config;
  },
};

export default nextConfig;
