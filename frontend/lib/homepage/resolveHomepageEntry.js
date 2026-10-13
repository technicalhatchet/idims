/**
 * Homepage page component for `pages/index.js`.
 *
 * `@idims/homepage-entry` is resolved at build time in next.config.js (one entries/*.home.js
 * module per Preview deploy). Static ESM only — no runtime require() of entry modules.
 */
import HomepageEntryPage from '@idims/homepage-entry';
import * as homepageEntryModule from '@idims/homepage-entry';

export default HomepageEntryPage;

/** `null` when the active entry has no layout wrapper (paint test, app_shell_probe). */
export const homeGetLayout =
  typeof homepageEntryModule.getLayout === 'function'
    ? homepageEntryModule.getLayout
    : null;
