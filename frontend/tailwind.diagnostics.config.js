const baseConfig = require('./tailwind.config.js');

/** Supplemental utilities for diagnostics / wizard UI (excluded from the global purge). */
module.exports = {
  ...baseConfig,
  content: [
    './components/diagnostics/**/*.{js,ts,jsx,tsx}',
    './components/wizard/**/*.{js,ts,jsx,tsx}',
  ],
};
