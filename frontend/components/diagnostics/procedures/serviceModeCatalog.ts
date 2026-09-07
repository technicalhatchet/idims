import type {
  ServiceModeBundle,
  ServiceModeKind,
  ServiceModeRef,
  ServiceModeUiVariant,
} from './types';

export const SERVICE_MODE_KIND_LABELS: Record<ServiceModeKind, string> = {
  service_diagnostic_entry: 'Service Diagnostic entry',
  quick_service_cycle: 'Quick Service Cycle',
  combined_qsc: 'Service Diagnostic + Quick Service Cycle',
  component_activation: 'Component activation',
  load_test: 'Load test',
  fault_codes: 'Fault / error codes',
  hmi_test: 'HMI test',
  voltage_check: 'Live voltage check',
};

export interface ServiceModeLookupOptions {
  modeKind?: ServiceModeKind;
  modeKinds?: ServiceModeKind[];
  uiVariant?: ServiceModeUiVariant;
  manualId?: string;
  tags?: string[];
}

function matchesTags(bundle: ServiceModeBundle, tags?: string[]): boolean {
  if (!tags?.length) return true;
  const bundleTags = new Set(bundle.tags ?? []);
  return tags.every((tag) => bundleTags.has(tag));
}

export function listServiceModeBundles(
  bundles: ServiceModeBundle[],
  platformId: string,
  options: ServiceModeLookupOptions = {},
): ServiceModeBundle[] {
  const kindFilter = new Set(
    options.modeKinds ?? (options.modeKind ? [options.modeKind] : []),
  );

  return bundles.filter((bundle) => {
    if (bundle.platformId !== platformId) return false;
    if (options.manualId && bundle.manualId !== options.manualId) return false;
    if (kindFilter.size > 0 && !kindFilter.has(bundle.modeKind)) return false;
    if (
      options.uiVariant &&
      options.uiVariant !== 'any' &&
      !bundle.uiVariants.includes(options.uiVariant) &&
      !bundle.uiVariants.includes('any')
    ) {
      return false;
    }
    if (!matchesTags(bundle, options.tags)) return false;
    return true;
  });
}

export function findServiceModeBundle(
  bundles: ServiceModeBundle[],
  bundleId: string,
): ServiceModeBundle | null {
  return bundles.find((bundle) => bundle.id === bundleId) ?? null;
}

export function normalizeServiceModeRefs(
  seed: { serviceMode?: ServiceModeRef; serviceModes?: ServiceModeRef[] },
): ServiceModeRef[] {
  if (seed.serviceModes?.length) return seed.serviceModes;
  if (seed.serviceMode) return [seed.serviceMode];
  return [];
}

export function getServiceModeKindsForRefs(
  refs: ServiceModeRef[],
  bundleById: Map<string, ServiceModeBundle>,
): ServiceModeKind[] {
  return refs.map((ref) => {
    const bundle = bundleById.get(ref.bundleId);
    return bundle?.modeKind ?? ref.modeKind;
  });
}
