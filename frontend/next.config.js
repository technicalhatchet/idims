/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  // Disable in development so you're not fighting the service worker while coding
  disable: process.env.NODE_ENV === 'development',
  // Register the service worker automatically
  register: true,
  // Skip waiting so new versions activate immediately
  skipWaiting: true,
  runtimeCaching: [
    // Auth0 — always network, never cache tokens
    {
      urlPattern: /^https:\/\/dev-fqp1z1l3km7uj2gq\.us\.auth0\.com\/.*/i,
      handler: 'NetworkOnly',
    },
    // Railway API — stale-while-revalidate: show cached instantly, fetch fresh in background
    // Good for schedule, work orders, clients — data that changes but you want fast loads
    {
      urlPattern: /^https:\/\/idims-production\.up\.railway\.app\/api\/.*/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'idims-api-cache',
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 60 * 5, // 5 minutes
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    // Public booking endpoint — network only, never cache POST
    {
      urlPattern: /\/api\/public\/booking/i,
      handler: 'NetworkOnly',
    },
    // Google Fonts
    {
      urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'google-fonts-stylesheets',
      },
    },
    {
      urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts-webfonts',
        expiration: {
          maxEntries: 30,
          maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    // Next.js static assets — cache first, they have content hashes so safe to cache forever
    {
      urlPattern: /\/_next\/static\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'next-static-assets',
        expiration: {
          maxEntries: 500,
          maxAgeSeconds: 60 * 60 * 24 * 365,
        },
      },
    },
    // Next.js image optimization
    {
      urlPattern: /\/_next\/image\?.*/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'next-image-cache',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60 * 24 * 7, // 1 week
        },
      },
    },
    // Your public images (wrenches.png, arpano.png, arvan.png, icons)
    {
      urlPattern: /\/icons\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'app-icons',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
        },
      },
    },
    {
      urlPattern: /\.(png|jpg|jpeg|gif|svg|webp)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-images',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60 * 24 * 7,
        },
      },
    },
    // Leaflet (used in route page)
    {
      urlPattern: /^https:\/\/unpkg\.com\/leaflet.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'leaflet-cache',
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 60 * 60 * 24 * 30,
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    // OpenStreetMap tiles (used in route page map)
    {
      urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'osm-tiles',
        expiration: {
          maxEntries: 500,
          maxAgeSeconds: 60 * 60 * 24 * 7,
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    // Everything else — network first, fall back to cache
    {
      urlPattern: /.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'fallback-cache',
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 60 * 60 * 24,
        },
        networkTimeoutSeconds: 10,
      },
    },
  ],
});

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

module.exports = withPWA(nextConfig);
