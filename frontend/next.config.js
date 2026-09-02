/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  customWorkerDir: 'worker',
  // Offline data lives in IndexedDB (prefetch.js + useOfflineData), NOT in the SW.
  // The SW only caches the app shell + static assets so techboard loads with no network.
  // Do NOT add Railway / Auth0 / any API URL to runtimeCaching — Workbox intercept breaks CORS.
  runtimeCaching: [
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
    // Solomon — cache HTML + Next data for offline in-app navigation (before global NetworkOnly rule)
    {
      urlPattern: /\/_next\/data\/.*\/solomon\/.*\.json/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'solomon-next-data',
        networkTimeoutSeconds: 4,
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 60 * 60 * 24 * 7,
        },
      },
    },
    {
      urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/solomon'),
      handler: 'NetworkFirst',
      options: {
        cacheName: 'solomon-pages',
        networkTimeoutSeconds: 4,
        expiration: {
          maxEntries: 16,
          maxAgeSeconds: 60 * 60 * 24 * 7,
        },
      },
    },
    // LoGiT — lightweight capture shell
    {
      urlPattern: /\/_next\/data\/.*\/logit\/.*\.json/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'logit-next-data',
        networkTimeoutSeconds: 4,
        expiration: {
          maxEntries: 8,
          maxAgeSeconds: 60 * 60 * 24 * 7,
        },
      },
    },
    {
      urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/logit'),
      handler: 'NetworkFirst',
      options: {
        cacheName: 'logit-pages',
        networkTimeoutSeconds: 4,
        expiration: {
          maxEntries: 8,
          maxAgeSeconds: 60 * 60 * 24 * 7,
        },
      },
    },
    // Never cache Next.js data routes — build ID changes every deploy; stale cache = 404 spam
    {
      urlPattern: /\/_next\/data\/.*/i,
      handler: 'NetworkOnly',
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
    // Same-origin navigations only — do not catch-all cache HTML/API
    {
      urlPattern: ({ sameOrigin, request }) =>
        sameOrigin && request.mode === 'navigate',
      handler: 'NetworkFirst',
      options: {
        cacheName: 'pages-cache',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 60 * 24,
        },
        networkTimeoutSeconds: 10,
      },
    },
  ],
});

const isSolomonStandaloneBranch =
  process.env.VERCEL_GIT_COMMIT_REF === 'feature/solomon-standalone';

const nextConfig = {
  reactStrictMode: true,

  env: {
    SOLOMON_STANDALONE: isSolomonStandaloneBranch ? 'true' : process.env.SOLOMON_STANDALONE,
    NEXT_PUBLIC_SOLOMON_STANDALONE: isSolomonStandaloneBranch
      ? 'true'
      : process.env.NEXT_PUBLIC_SOLOMON_STANDALONE,
  },

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
