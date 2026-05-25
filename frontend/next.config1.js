/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  staticPageGenerationTimeout: 1000,

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
      },
      {
        protocol: 'https',
        hostname: 's.gravatar.com',
      },
    ],
  },

  webpack(config) {
    return config;
  },

  compiler: {
    styledComponents: true,
  },

  eslint: {
    ignoreDuringBuilds: true,
  },

  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
