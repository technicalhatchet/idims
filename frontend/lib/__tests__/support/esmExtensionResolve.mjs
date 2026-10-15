/** Test-only: resolve extensionless relative imports like Next/webpack (e.g. `requestAuth0` → `requestAuth0.js`). */
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (
      error?.code === 'ERR_MODULE_NOT_FOUND'
      && !specifier.endsWith('.js')
      && !specifier.endsWith('.json')
      && !specifier.endsWith('.mjs')
      && !specifier.startsWith('node:')
    ) {
      return nextResolve(`${specifier}.js`, context);
    }
    throw error;
  }
}
