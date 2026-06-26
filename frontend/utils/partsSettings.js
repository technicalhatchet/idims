export const DEFAULT_PARTS_SETTINGS = {
  lookupEnabled: true,
  markupPercent: 28,
  oemWarrantyDays: 365,
  aftermarketWarrantyDays: 0,
  lookupProviders: [
    {
      id: 'google',
      name: 'Google',
      logoPath: '/images/logos/google.png',
      urlTemplate: 'https://www.google.com/search?q={search}',
      equipmentTypes: ['appliance', 'tv'],
      enabled: true,
    },
    {
      id: 'tribles',
      name: 'Tribles',
      logoPath: '/images/logos/tribles.png',
      urlTemplate: 'https://www.tribles.com/search?q={model}',
      equipmentTypes: ['appliance'],
      enabled: true,
    },
    {
      id: 'sears',
      name: 'Sears Parts Direct',
      logoPath: '/images/logos/sears.png',
      urlTemplate: 'https://www.searspartsdirect.com/search?q={model}',
      equipmentTypes: ['appliance'],
      enabled: true,
    },
    {
      id: 'apppartspros',
      name: 'Appliance Parts Pros',
      logoPath: '/images/logos/app_parts_pros.png',
      urlTemplate: 'https://appliancepartspros.com/search.aspx?model={model}',
      equipmentTypes: ['appliance'],
      enabled: true,
    },
    {
      id: 'shopjimmy',
      name: 'ShopJimmy',
      logoPath: '/images/logos/shopjimmy.png',
      urlTemplate: 'https://www.shopjimmy.com/search.php?search_query={model}',
      equipmentTypes: ['tv'],
      enabled: true,
    },
    {
      id: 'encompass',
      name: 'Encompass',
      logoPath: '/images/logos/encompass.png',
      urlTemplate: 'https://www.encompass.com/search?q={model}',
      equipmentTypes: ['tv'],
      enabled: true,
    },
  ],
  partVendors: [
    { id: 'Tribles', label: 'Tribles', enabled: true },
    { id: 'ShopJimmy', label: 'ShopJimmy', enabled: true },
    { id: 'Encompass', label: 'Encompass', enabled: true },
    { id: 'Sears', label: 'Sears', enabled: true },
    { id: 'Amazon', label: 'Amazon', enabled: true },
    { id: 'PartsSelect', label: 'Parts Select', enabled: true },
    { id: 'AppliancePartsPros', label: 'Appliance Parts Pros', enabled: true },
    { id: 'Other', label: 'Other', enabled: true },
  ],
};

export function normalizePartsSettings(raw) {
  const base = JSON.parse(JSON.stringify(DEFAULT_PARTS_SETTINGS));
  if (!raw || typeof raw !== 'object') return base;
  return {
    ...base,
    ...raw,
    lookupProviders: Array.isArray(raw.lookupProviders) ? raw.lookupProviders : base.lookupProviders,
    partVendors: Array.isArray(raw.partVendors) ? raw.partVendors : base.partVendors,
  };
}

export function getVendorSelectOptions(settings) {
  const vendors = (settings?.partVendors || []).filter((v) => v.enabled !== false);
  return [
    { value: '', label: 'Select Vendor' },
    ...vendors.map((v) => ({ value: v.id, label: v.label || v.id })),
  ];
}

export function getVendorLabel(settings, vendorId) {
  const match = (settings?.partVendors || []).find((v) => v.id === vendorId);
  return match?.label || vendorId || '—';
}

export function getLookupProvidersForEquipment(settings, equipmentType) {
  if (!settings?.lookupEnabled) return [];
  return (settings.lookupProviders || []).filter(
    (p) => p.enabled !== false && (p.equipmentTypes || []).includes(equipmentType),
  );
}

export function buildPartLookupUrl(urlTemplate, { manufacturer = '', modelNumber = '' } = {}) {
  const searchTerm = `${manufacturer} ${modelNumber} parts`.trim();
  const encoded = {
    '{model}': encodeURIComponent(modelNumber || ''),
    '{manufacturer}': encodeURIComponent(manufacturer || ''),
    '{search}': encodeURIComponent(searchTerm),
  };
  let url = urlTemplate || '';
  Object.entries(encoded).forEach(([token, value]) => {
    url = url.split(token).join(value);
  });
  return url;
}

export function slugifyProviderId(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40) || `provider_${Date.now()}`;
}

function getBackendBaseUrl() {
  const raw = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/';
  return raw.replace(/\/api\/?$/i, '').replace(/\/$/, '');
}

/** Resolve logo path for display (bundled public assets vs backend-uploaded static files). */
export function resolvePartsLogoUrl(logoPath) {
  if (!isValidPartsLogoPath(logoPath)) return '';
  if (logoPath.startsWith('http://') || logoPath.startsWith('https://')) {
    return logoPath;
  }
  if (logoPath.startsWith('/static/')) {
    return `${getBackendBaseUrl()}${logoPath}`;
  }
  return logoPath;
}

export function isValidPartsLogoPath(logoPath) {
  if (!logoPath || typeof logoPath !== 'string') return false;
  const trimmed = logoPath.trim();
  if (!trimmed || trimmed.endsWith('/')) return false;
  const filename = trimmed.split('/').pop() || '';
  return filename.length > 0 && filename !== '.' && filename !== '..';
}

export function isBackendHostedPartsLogo(logoPath) {
  if (!isValidPartsLogoPath(logoPath)) return false;
  return (
    logoPath.startsWith('/static/')
    || logoPath.startsWith('http://')
    || logoPath.startsWith('https://')
  );
}
