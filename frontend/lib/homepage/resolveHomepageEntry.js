/**
 * Build-time homepage entry selector for `pages/index.js`.
 *
 * Exactly one `./entries/*` module is bundled per deploy: Next inlines `NEXT_PUBLIC_*`
 * at compile time and webpack dead-code-eliminates the other `require()` branches.
 *
 * Do not add static `import` of entry modules here — that would merge all variant graphs.
 * Entry modules themselves use static ESM only (SSR-safe default exports).
 */

function loadHomepageEntryModule() {
  if (process.env.NEXT_PUBLIC_HOMEPAGE_SAFARI_PAINT_TEST === '1') {
    return require('./entries/safariPaint.home');
  }
  if (process.env.NEXT_PUBLIC_HOMEPAGE_PERF_VARIANT === 'app_shell_probe') {
    return require('./entries/appShellProbe.home');
  }
  if (process.env.NEXT_PUBLIC_HOMEPAGE_PERF_VARIANT === 'layout_shell_probe') {
    return require('./entries/layoutShellProbe.home');
  }
  return require('./entries/marketing.home');
}

const homepageEntry = loadHomepageEntryModule();

export default homepageEntry.default;

/** `null` when the active entry has no layout wrapper (paint test, app_shell_probe). */
export const homeGetLayout =
  typeof homepageEntry.getLayout === 'function' ? homepageEntry.getLayout : null;
