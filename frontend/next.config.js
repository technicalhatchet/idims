/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  pageExtensions: ['js', 'jsx', 'ts', 'tsx'],
  sassOptions: {
    includePaths: [
      path.join(__dirname, 'styles'),
      path.join(__dirname, 'frontend/styles')
    ],
  },
  webpack: (config, { isServer }) => {
    // Add resolution for frontend directory
    config.resolve.alias['@'] = path.join(__dirname, 'frontend');

    // Support SVG imports
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });

    // Ensure CSS/SCSS modules work correctly
    const rules = config.module.rules;
    const cssLoaderRule = rules.find(rule => rule.oneOf && Array.isArray(rule.oneOf));

    if (cssLoaderRule && cssLoaderRule.oneOf) {
      cssLoaderRule.oneOf.forEach(moduleRule => {
        if (moduleRule.test && moduleRule.test.test &&
            (moduleRule.test.test('.module.css') || moduleRule.test.test('.module.scss'))) {
          if (moduleRule.use && Array.isArray(moduleRule.use)) {
            const cssLoader = moduleRule.use.find(u => u.loader && u.loader.includes('css-loader'));
            if (cssLoader && cssLoader.options) {
              cssLoader.options.modules = {
                ...cssLoader.options.modules,
                exportLocalsConvention: 'camelCase',
              };
            }
          }
        }
      });
    }

    return config;
  },
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'),
  },

  // Environment variables that will be available at build time
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '/api'
  }
}

module.exports = nextConfig