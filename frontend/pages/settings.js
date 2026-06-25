import { useState, useEffect } from 'react';
import TechDashboardLayout from '../components/layouts/TechDashboardLayout';
import { useUIPreferences } from '../context/UIPreferencesContext';
import { apiClient } from '../utils/api-client';
import toast from 'react-hot-toast';

const DAYS = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

const DEFAULT_DAY_HOURS = {
  regular: { enabled: false, start: '09:00', end: '17:00' },
  evening: { enabled: false, start: '17:00', end: '21:00' },
};

const DEFAULT_ZONES = {
  zones: {
    local: { name: 'Local', tripCharge: 0, zipCodes: [], color: '#22c55e' },
    extended: { name: 'Extended', tripCharge: 29, zipCodes: [], color: '#eab308' },
    far: { name: 'Far', tripCharge: 50, zipCodes: [], color: '#f97316' },
    custom: { name: 'Custom', tripCharge: 0, zipCodes: [], color: '#ef4444' },
  },
  driveTimeFallback: {
    enabled: true,
    shopAddress: '',
    ranges: [
      { maxMinutes: 20, charge: 0, zone: 'local' },
      { maxMinutes: 35, charge: 29, zone: 'extended' },
      { maxMinutes: 50, charge: 50, zone: 'far' },
      { maxMinutes: null, charge: null, zone: 'custom' },
    ],
  },
};

const DEFAULT_TAX = {
  defaultCounty: 'lucas',
  counties: {
    lucas: { name: 'Lucas County', rate: 0.0775, zipCodes: [] },
    wood: { name: 'Wood County', rate: 0.0675, zipCodes: [] },
    fulton: { name: 'Fulton County', rate: 0.0725, zipCodes: [] },
    henry: { name: 'Henry County', rate: 0.0725, zipCodes: [] },
    ottawa: { name: 'Ottawa County', rate: 0.07, zipCodes: [] },
    sandusky: { name: 'Sandusky County', rate: 0.0725, zipCodes: [] },
    erie: { name: 'Erie County', rate: 0.0675, zipCodes: [] },
    hancock: { name: 'Hancock County', rate: 0.0675, zipCodes: [] },
    putnam: { name: 'Putnam County', rate: 0.07, zipCodes: [] },
    seneca: { name: 'Seneca County', rate: 0.0725, zipCodes: [] },
  },
};

const TABS = [
  { id: 'interface', label: 'Interface', icon: 'layout' },
  { id: 'availability', label: 'Availability', icon: 'calendar' },
  { id: 'service-areas', label: 'Service Areas', icon: 'map' },
  { id: 'tax', label: 'Tax', icon: 'tax' },
  { id: 'price-book', label: 'Price Book', icon: 'price' },
];

const PRICE_BOOK_TYPES = [
  { key: 'diagnostic', label: 'Diagnostic' },
  { key: 'repair', label: 'Repair' },
  { key: 'installation', label: 'Installation' },
  { key: 'remote', label: 'Remote' },
  { key: 'custom', label: 'Custom' },
];

const SKU_FORM_TYPES = [
  ...PRICE_BOOK_TYPES,
  { key: 'additional_time', label: 'Additional Time' },
  { key: 'network', label: 'Network' },
];

const EQUIPMENT_TYPES = [
  { key: '', label: 'Any / N/A' },
  { key: 'washer', label: 'Washer' },
  { key: 'dryer', label: 'Dryer' },
  { key: 'stacked_laundry', label: 'Stacked Laundry' },
  { key: 'aio_laundry', label: 'All-In-One Laundry' },
  { key: 'refrigerator', label: 'Refrigerator' },
  { key: 'dishwasher', label: 'Dishwasher' },
  { key: 'range', label: 'Range' },
  { key: 'wall_oven', label: 'Wall Oven' },
  { key: 'tv', label: 'TV' },
  { key: 'network', label: 'Network' },
  { key: 'other', label: 'Other' },
];

const SKILL_LEVELS = [
  { key: '', label: 'Not specified' },
  { key: 'basic', label: 'Basic' },
  { key: 'intermediate', label: 'Intermediate' },
  { key: 'advanced', label: 'Advanced' },
];

const EMPTY_SKU_FORM = {
  sku_code: '',
  name: '',
  description: '',
  service_type: 'repair',
  equipment_type: '',
  skill_level: '',
  base_price: '0.00',
  duration_minutes: '',
  is_custom_price: false,
  requires_diagnostic: false,
  is_active: true,
};

function normalizeServiceType(service) {
  const raw = service?.service_type;
  const value = (typeof raw === 'string' ? raw : raw?.value || '').toLowerCase();
  if (PRICE_BOOK_TYPES.some((t) => t.key === value)) return value;
  return 'other';
}

function formatEquipmentLabel(equipmentType) {
  const raw = typeof equipmentType === 'string' ? equipmentType : equipmentType?.value;
  if (!raw) return '—';
  return String(raw).replace(/_/g, ' ');
}

function TabIcon({ type, className }) {
  const icons = {
    layout: (
      <svg viewBox="0 0 24 24" className={className} style={{ strokeWidth: 1.75, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18" />
        <path d="M9 21V9" />
      </svg>
    ),
    calendar: (
      <svg viewBox="0 0 24 24" className={className} style={{ strokeWidth: 1.75, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    map: (
      <svg viewBox="0 0 24 24" className={className} style={{ strokeWidth: 1.75, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
        <line x1="8" y1="2" x2="8" y2="18" />
        <line x1="16" y1="6" x2="16" y2="22" />
      </svg>
    ),
    tax: (
      <svg viewBox="0 0 24 24" className={className} style={{ strokeWidth: 1.75, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
    price: (
      <svg viewBox="0 0 24 24" className={className} style={{ strokeWidth: 1.75, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
        <path d="M4 7h16" />
        <path d="M4 12h16" />
        <path d="M4 17h10" />
        <rect x="2" y="3" width="20" height="18" rx="2" />
      </svg>
    ),
  };
  return icons[type] || null;
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState('interface');
  const { preferences, setRailPosition } = useUIPreferences();
  
  // UI saving state
  const [saving, setSaving] = useState(false);
  
  // Shop Hours state
  const [savingHours, setSavingHours] = useState(false);
  const [shopHours, setShopHours] = useState({});
  const [loadingHours, setLoadingHours] = useState(true);
  
  // Zone settings state
  const [zoneSettings, setZoneSettings] = useState(DEFAULT_ZONES);
  const [loadingZones, setLoadingZones] = useState(true);
  const [savingZones, setSavingZones] = useState(false);
  const [newZipCode, setNewZipCode] = useState('');
  const [taxSettings, setTaxSettings] = useState(DEFAULT_TAX);
  const [loadingTax, setLoadingTax] = useState(true);
  const [savingTax, setSavingTax] = useState(false);
  const [newTaxZip, setNewTaxZip] = useState('');
  const [taxZipCounty, setTaxZipCounty] = useState('lucas');

  const [catalogServices, setCatalogServices] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [savingServiceId, setSavingServiceId] = useState(null);
  const [priceDrafts, setPriceDrafts] = useState({});
  const [skuModalOpen, setSkuModalOpen] = useState(false);
  const [skuModalMode, setSkuModalMode] = useState('create');
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [skuForm, setSkuForm] = useState(EMPTY_SKU_FORM);
  const [skuFormErrors, setSkuFormErrors] = useState({});
  const [savingSku, setSavingSku] = useState(false);
  const [generatingSku, setGeneratingSku] = useState(false);
  const [bulkScope, setBulkScope] = useState('all');
  const [bulkMode, setBulkMode] = useState('percent');
  const [bulkAmount, setBulkAmount] = useState('');
  const [applyingBulk, setApplyingBulk] = useState(false);
  const [bulkPanelOpen, setBulkPanelOpen] = useState(false);

  const loadCatalog = async () => {
    setLoadingCatalog(true);
    try {
      const response = await apiClient('/api/services?limit=500');
      const items = response?.items || [];
      setCatalogServices(items);
      const drafts = {};
      items.forEach((svc) => {
        drafts[svc.id] = Number(svc.base_price ?? 0).toFixed(2);
      });
      setPriceDrafts(drafts);
    } catch (err) {
      console.error('Error loading price book:', err);
      toast.error('Failed to load price book');
    } finally {
      setLoadingCatalog(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'price-book') {
      loadCatalog();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const updateService = async (serviceId, payload) => {
    setSavingServiceId(serviceId);
    try {
      const updated = await apiClient(`/api/services/${serviceId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setCatalogServices((prev) =>
        prev.map((svc) => (svc.id === serviceId ? { ...svc, ...updated } : svc))
      );
      if (payload.base_price !== undefined) {
        setPriceDrafts((prev) => ({
          ...prev,
          [serviceId]: Number(updated.base_price ?? payload.base_price ?? 0).toFixed(2),
        }));
      }
      return updated;
    } catch (err) {
      console.error('Error updating service:', err);
      toast.error(err.message || 'Failed to update SKU');
      throw err;
    } finally {
      setSavingServiceId(null);
    }
  };

  const createService = async (payload) => {
    const created = await apiClient('/api/services/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setCatalogServices((prev) => [...prev, created]);
    setPriceDrafts((prev) => ({
      ...prev,
      [created.id]: Number(created.base_price ?? 0).toFixed(2),
    }));
    return created;
  };

  const openCreateSku = () => {
    setSkuModalMode('create');
    setEditingServiceId(null);
    setSkuForm({ ...EMPTY_SKU_FORM });
    setSkuFormErrors({});
    setSkuModalOpen(true);
  };

  const openEditSku = (service) => {
    setSkuModalMode('edit');
    setEditingServiceId(service.id);
    setSkuForm({
      sku_code: service.sku_code || '',
      name: service.name || '',
      description: service.description || '',
      service_type: (typeof service.service_type === 'string'
        ? service.service_type
        : service.service_type?.value || 'repair').toLowerCase(),
      equipment_type: service.equipment_type?.value || service.equipment_type || '',
      skill_level: service.skill_level?.value || service.skill_level || '',
      base_price: Number(service.base_price ?? 0).toFixed(2),
      duration_minutes: service.duration_minutes != null ? String(service.duration_minutes) : '',
      is_custom_price: Boolean(service.is_custom_price),
      requires_diagnostic: Boolean(service.requires_diagnostic),
      is_active: service.is_active !== false,
    });
    setSkuFormErrors({});
    setSkuModalOpen(true);
  };

  const closeSkuModal = () => {
    if (savingSku) return;
    setSkuModalOpen(false);
    setSkuFormErrors({});
  };

  const handleSkuField = (field, value) => {
    setSkuForm((prev) => ({ ...prev, [field]: value }));
    if (skuFormErrors[field]) {
      setSkuFormErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const generateSkuCode = async () => {
    if (!skuForm.service_type) {
      setSkuFormErrors((prev) => ({ ...prev, service_type: 'Select a type first' }));
      return;
    }
    setGeneratingSku(true);
    try {
      const params = new URLSearchParams({ service_type: skuForm.service_type });
      if (skuForm.equipment_type) params.append('equipment_type', skuForm.equipment_type);
      const code = await apiClient(`/api/services/generate-sku?${params.toString()}`, {
        method: 'POST',
      });
      if (typeof code === 'string' && code.trim()) {
        handleSkuField('sku_code', code.trim().toUpperCase());
      }
    } catch (err) {
      console.error('Error generating SKU:', err);
      toast.error('Could not generate SKU code');
    } finally {
      setGeneratingSku(false);
    }
  };

  const validateSkuForm = () => {
    const errors = {};
    if (!skuForm.sku_code.trim()) errors.sku_code = 'SKU code is required';
    if (!skuForm.name.trim()) errors.name = 'Name is required';
    if (!skuForm.service_type) errors.service_type = 'Type is required';
    if (!skuForm.is_custom_price) {
      const price = parseFloat(skuForm.base_price);
      if (!Number.isFinite(price) || price < 0) errors.base_price = 'Enter a valid price';
    }
    if (skuForm.duration_minutes !== '') {
      const mins = parseInt(skuForm.duration_minutes, 10);
      if (!Number.isFinite(mins) || mins < 0) errors.duration_minutes = 'Enter valid minutes';
    }
    setSkuFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const buildSkuPayload = () => {
    const payload = {
      sku_code: skuForm.sku_code.trim().toUpperCase(),
      name: skuForm.name.trim(),
      description: skuForm.description.trim() || null,
      service_type: skuForm.service_type,
      base_price: skuForm.is_custom_price ? 0 : parseFloat(skuForm.base_price),
      unit: 'job',
      is_custom_price: skuForm.is_custom_price,
      requires_diagnostic: skuForm.requires_diagnostic,
      is_active: skuForm.is_active,
    };
    if (skuForm.equipment_type) payload.equipment_type = skuForm.equipment_type;
    if (skuForm.skill_level) payload.skill_level = skuForm.skill_level;
    if (skuForm.duration_minutes !== '') {
      payload.duration_minutes = parseInt(skuForm.duration_minutes, 10);
    }
    return payload;
  };

  const saveSku = async () => {
    if (!validateSkuForm()) return;
    setSavingSku(true);
    try {
      const payload = buildSkuPayload();
      if (skuModalMode === 'create') {
        const created = await createService(payload);
        toast.success(`${created.sku_code} created`);
      } else {
        await updateService(editingServiceId, payload);
        toast.success(`${payload.sku_code} updated`);
      }
      setSkuModalOpen(false);
    } catch {
      /* toast from api layer */
    } finally {
      setSavingSku(false);
    }
  };

  const bulkTargetServices = catalogServices.filter((svc) => {
    if (svc.is_custom_price) return false;
    if (bulkScope === 'all') return true;
    if (bulkScope === 'other') return normalizeServiceType(svc) === 'other';
    return normalizeServiceType(svc) === bulkScope;
  });

  const applyBulkPriceUpdate = async () => {
    const amount = parseFloat(bulkAmount);
    if (!Number.isFinite(amount)) {
      toast.error('Enter a valid adjustment amount');
      return;
    }
    if (bulkMode === 'percent' && amount === 0) {
      toast.error('Enter a non-zero percentage');
      return;
    }
    if (bulkTargetServices.length === 0) {
      toast.error('No fixed-price SKUs in this scope');
      return;
    }

    const label = bulkMode === 'percent'
      ? `${amount > 0 ? '+' : ''}${amount}%`
      : `${amount >= 0 ? '+' : ''}$${amount.toFixed(2)}`;
    if (!window.confirm(`Apply ${label} to ${bulkTargetServices.length} SKU(s)? Variable-price SKUs are skipped.`)) {
      return;
    }

    setApplyingBulk(true);
    let updated = 0;
    let failed = 0;
    try {
      for (const svc of bulkTargetServices) {
        const current = Number(svc.base_price ?? 0);
        let next = bulkMode === 'percent'
          ? current * (1 + amount / 100)
          : current + amount;
        next = Math.max(0, Math.round(next * 100) / 100);
        if (Math.abs(next - current) < 0.001) continue;
        try {
          await updateService(svc.id, { base_price: next });
          updated += 1;
        } catch {
          failed += 1;
        }
      }
      if (updated > 0) {
        toast.success(`Updated ${updated} price${updated === 1 ? '' : 's'}`);
      }
      if (failed > 0) {
        toast.error(`${failed} update${failed === 1 ? '' : 's'} failed`);
      }
      if (updated === 0 && failed === 0) {
        toast('No prices changed', { icon: 'ℹ️' });
      }
      setBulkAmount('');
    } finally {
      setApplyingBulk(false);
    }
  };

  const handlePriceBlur = async (service) => {
    if (service.is_custom_price) return;
    const draft = priceDrafts[service.id];
    const parsed = parseFloat(draft);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setPriceDrafts((prev) => ({
        ...prev,
        [service.id]: Number(service.base_price ?? 0).toFixed(2),
      }));
      toast.error('Enter a valid price');
      return;
    }
    if (Math.abs(parsed - Number(service.base_price ?? 0)) < 0.001) return;
    try {
      await updateService(service.id, { base_price: parsed });
      toast.success(`${service.sku_code} updated`);
    } catch {
      setPriceDrafts((prev) => ({
        ...prev,
        [service.id]: Number(service.base_price ?? 0).toFixed(2),
      }));
    }
  };

  const handleActiveToggle = async (service) => {
    const next = !service.is_active;
    try {
      await updateService(service.id, { is_active: next });
      toast.success(next ? `${service.sku_code} activated` : `${service.sku_code} deactivated`);
    } catch {
      /* state unchanged on failure */
    }
  };

  const filteredCatalog = catalogServices.filter((svc) => {
    if (!catalogSearch.trim()) return true;
    const q = catalogSearch.trim().toLowerCase();
    return (
      svc.name?.toLowerCase().includes(q)
      || svc.sku_code?.toLowerCase().includes(q)
      || formatEquipmentLabel(svc.equipment_type).toLowerCase().includes(q)
    );
  });

  const catalogByType = PRICE_BOOK_TYPES.map((type) => ({
    ...type,
    items: filteredCatalog
      .filter((svc) => normalizeServiceType(svc) === type.key)
      .sort((a, b) => (a.name || '').localeCompare(b.name || '')),
  }));

  const otherCatalogItems = filteredCatalog
    .filter((svc) => normalizeServiceType(svc) === 'other')
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  // Load settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const response = await apiClient('/api/settings');
        
        // Load shop hours
        const hours = response?.settings?.shop_hours || {};
        const normalizedHours = {};
        DAYS.forEach(({ key }) => {
          const dayData = hours[key] || {};
          normalizedHours[key] = {
            regular: {
              enabled: dayData.regular?.enabled ?? dayData.enabled ?? false,
              start: dayData.regular?.start ?? dayData.open ?? '09:00',
              end: dayData.regular?.end ?? dayData.close ?? '17:00',
            },
            evening: {
              enabled: dayData.evening?.enabled ?? false,
              start: dayData.evening?.start ?? '17:00',
              end: dayData.evening?.end ?? '21:00',
            },
          };
        });
        setShopHours(normalizedHours);
        
        // Load zone settings
        const zones = response?.settings?.trip_zones;
        if (zones) {
          setZoneSettings(zones);
        }

        const tax = response?.settings?.tax_jurisdictions;
        if (tax?.counties) {
          setTaxSettings(tax);
        } else {
          try {
            const taxConfig = await apiClient('/api/settings/tax/config');
            if (taxConfig?.counties) {
              setTaxSettings(taxConfig);
            }
          } catch (taxErr) {
            console.warn('Could not load tax config defaults:', taxErr);
          }
        }
      } catch (err) {
        console.error('Error loading settings:', err);
      } finally {
        setLoadingHours(false);
        setLoadingZones(false);
        setLoadingTax(false);
      }
    }
    loadSettings();
  }, []);

  const handleRailPositionChange = async (position) => {
    setSaving(true);
    await setRailPosition(position);
    setSaving(false);
  };

  const updateDayHours = (day, period, field, value) => {
    setShopHours(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [period]: {
          ...prev[day]?.[period],
          [field]: value,
        },
      },
    }));
  };

  const saveShopHours = async () => {
    setSavingHours(true);
    try {
      await apiClient('/api/settings/shop_hours', {
        method: 'PATCH',
        body: JSON.stringify({ value: shopHours }),
      });
      toast.success('Hours saved');
    } catch (err) {
      if (err.message?.includes('404') || err.message?.includes('not found')) {
        try {
          await apiClient('/api/settings/', {
            method: 'POST',
            body: JSON.stringify({ 
              key: 'shop_hours',
              value: shopHours,
              description: 'Business operating hours by day'
            }),
          });
          toast.success('Hours saved');
        } catch (createErr) {
          console.error('Error creating shop hours:', createErr);
          toast.error('Failed to save hours');
        }
      } else {
        console.error('Error saving shop hours:', err);
        toast.error('Failed to save hours');
      }
    } finally {
      setSavingHours(false);
    }
  };

  // Zone management functions
  const addZipCode = (zoneKey) => {
    const zip = newZipCode.trim();
    if (!zip || zip.length !== 5 || !/^\d+$/.test(zip)) {
      toast.error('Enter a valid 5-digit zip code');
      return;
    }
    
    // Check if already exists in any zone
    for (const [key, zone] of Object.entries(zoneSettings.zones)) {
      if (zone.zipCodes?.includes(zip)) {
        toast.error(`Zip code already in ${zone.name} zone`);
        return;
      }
    }
    
    setZoneSettings(prev => ({
      ...prev,
      zones: {
        ...prev.zones,
        [zoneKey]: {
          ...prev.zones[zoneKey],
          zipCodes: [...(prev.zones[zoneKey].zipCodes || []), zip],
        },
      },
    }));
    setNewZipCode('');
  };

  const removeZipCode = (zoneKey, zip) => {
    setZoneSettings(prev => ({
      ...prev,
      zones: {
        ...prev.zones,
        [zoneKey]: {
          ...prev.zones[zoneKey],
          zipCodes: prev.zones[zoneKey].zipCodes.filter(z => z !== zip),
        },
      },
    }));
  };

  const updateZoneCharge = (zoneKey, charge) => {
    setZoneSettings(prev => ({
      ...prev,
      zones: {
        ...prev.zones,
        [zoneKey]: {
          ...prev.zones[zoneKey],
          tripCharge: parseFloat(charge) || 0,
        },
      },
    }));
  };

  const updateDriveTimeRange = (index, field, value) => {
    setZoneSettings(prev => {
      const fallback = prev.driveTimeFallback || prev.distanceFallback || { ranges: [] };
      const newRanges = [...fallback.ranges];
      newRanges[index] = {
        ...newRanges[index],
        [field]: field === 'maxMinutes' || field === 'charge' 
          ? (value === '' || value === null ? null : parseFloat(value))
          : value,
      };
      return {
        ...prev,
        driveTimeFallback: {
          ...fallback,
          ranges: newRanges,
        },
      };
    });
  };

  const saveZoneSettings = async () => {
    setSavingZones(true);
    try {
      await apiClient('/api/settings/trip_zones', {
        method: 'PATCH',
        body: JSON.stringify({ value: zoneSettings }),
      });
      toast.success('Service areas saved');
    } catch (err) {
      if (err.message?.includes('404') || err.message?.includes('not found')) {
        try {
          await apiClient('/api/settings/', {
            method: 'POST',
            body: JSON.stringify({ 
              key: 'trip_zones',
              value: zoneSettings,
              description: 'Service zone and trip charge configuration'
            }),
          });
          toast.success('Service areas saved');
        } catch (createErr) {
          console.error('Error creating zone settings:', createErr);
          toast.error('Failed to save');
        }
      } else {
        console.error('Error saving zone settings:', err);
        toast.error('Failed to save');
      }
    } finally {
      setSavingZones(false);
    }
  };

  const updateCountyRate = (countyKey, percentValue) => {
    const parsed = parseFloat(percentValue);
    setTaxSettings((prev) => ({
      ...prev,
      counties: {
        ...prev.counties,
        [countyKey]: {
          ...prev.counties[countyKey],
          rate: Number.isFinite(parsed) ? parsed / 100 : 0,
        },
      },
    }));
  };

  const addTaxZipCode = (countyKey) => {
    const zip = newTaxZip.trim();
    if (!zip || zip.length !== 5 || !/^\d+$/.test(zip)) {
      toast.error('Enter a valid 5-digit zip code');
      return;
    }
    for (const [key, county] of Object.entries(taxSettings.counties || {})) {
      if (county.zipCodes?.includes(zip)) {
        toast.error(`Zip already assigned to ${county.name || key}`);
        return;
      }
    }
    setTaxSettings((prev) => ({
      ...prev,
      counties: {
        ...prev.counties,
        [countyKey]: {
          ...prev.counties[countyKey],
          zipCodes: [...(prev.counties[countyKey]?.zipCodes || []), zip],
        },
      },
    }));
    setNewTaxZip('');
  };

  const removeTaxZipCode = (countyKey, zip) => {
    setTaxSettings((prev) => ({
      ...prev,
      counties: {
        ...prev.counties,
        [countyKey]: {
          ...prev.counties[countyKey],
          zipCodes: (prev.counties[countyKey]?.zipCodes || []).filter((z) => z !== zip),
        },
      },
    }));
  };

  const saveTaxSettings = async () => {
    setSavingTax(true);
    try {
      await apiClient('/api/settings/tax_jurisdictions', {
        method: 'PATCH',
        body: JSON.stringify({ value: taxSettings }),
      });
      toast.success('Tax settings saved');
    } catch (err) {
      if (err.message?.includes('404') || err.message?.includes('not found')) {
        try {
          await apiClient('/api/settings/', {
            method: 'POST',
            body: JSON.stringify({
              key: 'tax_jurisdictions',
              value: taxSettings,
              description: 'County sales tax rates and zip mappings',
            }),
          });
          toast.success('Tax settings saved');
        } catch (createErr) {
          console.error('Error creating tax settings:', createErr);
          toast.error('Failed to save tax settings');
        }
      } else {
        console.error('Error saving tax settings:', err);
        toast.error('Failed to save tax settings');
      }
    } finally {
      setSavingTax(false);
    }
  };

  // Render tab content
  const renderInterfaceTab = () => (
    <section className="rounded-xl p-5" style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.07)' }}>
      <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <TabIcon type="layout" className="w-5 h-5 stroke-cyan-400" />
        Navigation Rail Position
      </h2>
      <p className="text-xs text-gray-500 mb-4">Choose which side of the screen the navigation menu appears on</p>
      
      <div className="flex gap-3">
        {/* Left Option */}
        <button
          onClick={() => handleRailPositionChange('left')}
          disabled={saving}
          className={`flex-1 relative rounded-lg p-4 transition-all ${preferences.railPosition === 'left' ? 'ring-2 ring-cyan-400' : 'hover:bg-white/5'}`}
          style={{ background: preferences.railPosition === 'left' ? 'rgba(34, 211, 238, 0.1)' : 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <div className="w-full h-20 rounded-md mb-3 relative overflow-hidden" style={{ background: '#0B0F1A' }}>
            <div className="absolute left-0 top-0 bottom-0 w-3 rounded-r" style={{ background: 'linear-gradient(to right, #22D3EE, #0B0F1A)' }} />
            <div className="absolute top-0 left-0 right-0 h-2" style={{ background: 'rgba(255,255,255,0.05)' }} />
          </div>
          <div className="flex items-center justify-between">
            <span className={`text-sm font-medium ${preferences.railPosition === 'left' ? 'text-cyan-400' : 'text-gray-400'}`}>Left Side</span>
            {preferences.railPosition === 'left' && (
              <svg viewBox="0 0 24 24" width="18" height="18" style={{ stroke: '#22D3EE', strokeWidth: 2, fill: 'none' }}><polyline points="20 6 9 17 4 12" /></svg>
            )}
          </div>
        </button>

        {/* Right Option */}
        <button
          onClick={() => handleRailPositionChange('right')}
          disabled={saving}
          className={`flex-1 relative rounded-lg p-4 transition-all ${preferences.railPosition === 'right' ? 'ring-2 ring-cyan-400' : 'hover:bg-white/5'}`}
          style={{ background: preferences.railPosition === 'right' ? 'rgba(34, 211, 238, 0.1)' : 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <div className="w-full h-20 rounded-md mb-3 relative overflow-hidden" style={{ background: '#0B0F1A' }}>
            <div className="absolute right-0 top-0 bottom-0 w-3 rounded-l" style={{ background: 'linear-gradient(to left, #22D3EE, #0B0F1A)' }} />
            <div className="absolute top-0 left-0 right-0 h-2" style={{ background: 'rgba(255,255,255,0.05)' }} />
          </div>
          <div className="flex items-center justify-between">
            <span className={`text-sm font-medium ${preferences.railPosition === 'right' ? 'text-cyan-400' : 'text-gray-400'}`}>Right Side</span>
            {preferences.railPosition === 'right' && (
              <svg viewBox="0 0 24 24" width="18" height="18" style={{ stroke: '#22D3EE', strokeWidth: 2, fill: 'none' }}><polyline points="20 6 9 17 4 12" /></svg>
            )}
          </div>
        </button>
      </div>
      
      {saving && (
        <p className="text-xs text-cyan-400 mt-2 flex items-center gap-2">
          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Saving...
        </p>
      )}
    </section>
  );

  const renderAvailabilityTab = () => (
    <section className="rounded-xl p-5" style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <TabIcon type="calendar" className="w-5 h-5 stroke-cyan-400" />
          Shop Hours
        </h2>
        <button
          onClick={saveShopHours}
          disabled={savingHours || loadingHours}
          className="px-3 py-1.5 text-sm font-medium rounded-lg transition-all disabled:opacity-50"
          style={{ background: 'rgba(34, 211, 238, 0.15)', color: '#22D3EE', border: '1px solid rgba(34, 211, 238, 0.3)' }}
        >
          {savingHours ? 'Saving...' : 'Save Hours'}
        </button>
      </div>

      <p className="text-xs text-gray-500 mb-4">
        Configure your working hours. Regular hours cover Morning & Afternoon windows. Evening hours extend availability past 5 PM.
      </p>

      {loadingHours ? (
        <div className="text-gray-500 text-sm py-4">Loading...</div>
      ) : (
        <div className="space-y-3">
          {DAYS.map(({ key, label }) => {
            const dayHours = shopHours[key] || DEFAULT_DAY_HOURS;
            const hasAnyHours = dayHours.regular?.enabled || dayHours.evening?.enabled;
            
            return (
              <div 
                key={key} 
                className="rounded-lg p-3 transition-all"
                style={{ 
                  background: hasAnyHours ? 'rgba(34, 211, 238, 0.05)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${hasAnyHours ? 'rgba(34, 211, 238, 0.15)' : 'rgba(255,255,255,0.05)'}`,
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`font-medium ${hasAnyHours ? 'text-white' : 'text-gray-500'}`}>{label}</span>
                  {!hasAnyHours && <span className="text-xs text-gray-600">Closed</span>}
                </div>

                <div className="flex items-center gap-3 mb-2">
                  <label className="flex items-center gap-2 min-w-[100px]">
                    <input
                      type="checkbox"
                      checked={dayHours.regular?.enabled || false}
                      onChange={(e) => updateDayHours(key, 'regular', 'enabled', e.target.checked)}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-gray-900"
                    />
                    <span className="text-sm text-gray-400">Regular</span>
                  </label>
                  
                  {dayHours.regular?.enabled && (
                    <div className="flex items-center gap-2 flex-1">
                      <input type="time" value={dayHours.regular?.start || '09:00'} onChange={(e) => updateDayHours(key, 'regular', 'start', e.target.value)} className="px-2 py-1 text-sm rounded border border-gray-600 bg-gray-800 text-white focus:border-cyan-500 focus:outline-none" />
                      <span className="text-gray-500 text-sm">to</span>
                      <input type="time" value={dayHours.regular?.end || '17:00'} onChange={(e) => updateDayHours(key, 'regular', 'end', e.target.value)} className="px-2 py-1 text-sm rounded border border-gray-600 bg-gray-800 text-white focus:border-cyan-500 focus:outline-none" />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 min-w-[100px]">
                    <input
                      type="checkbox"
                      checked={dayHours.evening?.enabled || false}
                      onChange={(e) => updateDayHours(key, 'evening', 'enabled', e.target.checked)}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-gray-900"
                    />
                    <span className="text-sm text-gray-400">Evening</span>
                  </label>
                  
                  {dayHours.evening?.enabled && (
                    <div className="flex items-center gap-2 flex-1">
                      <input type="time" value={dayHours.evening?.start || '17:00'} onChange={(e) => updateDayHours(key, 'evening', 'start', e.target.value)} className="px-2 py-1 text-sm rounded border border-gray-600 bg-gray-800 text-white focus:border-cyan-500 focus:outline-none" />
                      <span className="text-gray-500 text-sm">to</span>
                      <input type="time" value={dayHours.evening?.end || '21:00'} onChange={(e) => updateDayHours(key, 'evening', 'end', e.target.value)} className="px-2 py-1 text-sm rounded border border-gray-600 bg-gray-800 text-white focus:border-cyan-500 focus:outline-none" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );

  const renderServiceAreasTab = () => (
    <div className="space-y-6">
      {/* Zone Definitions */}
      <section className="rounded-xl p-5" style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <TabIcon type="map" className="w-5 h-5 stroke-cyan-400" />
            Service Zones
          </h2>
          <button
            onClick={saveZoneSettings}
            disabled={savingZones || loadingZones}
            className="px-3 py-1.5 text-sm font-medium rounded-lg transition-all disabled:opacity-50"
            style={{ background: 'rgba(34, 211, 238, 0.15)', color: '#22D3EE', border: '1px solid rgba(34, 211, 238, 0.3)' }}
          >
            {savingZones ? 'Saving...' : 'Save Zones'}
          </button>
        </div>

        <p className="text-xs text-gray-500 mb-4">
          Define your service zones and trip charges. Zip codes in the Local zone have $0 trip charge.
          Locations not in any zone use distance-based pricing.
        </p>

        {loadingZones ? (
          <div className="text-gray-500 text-sm py-4">Loading...</div>
        ) : (
          <div className="space-y-4">
            {Object.entries(zoneSettings.zones).map(([zoneKey, zone]) => (
              <div 
                key={zoneKey}
                className="rounded-lg p-4"
                style={{ 
                  background: 'rgba(255,255,255,0.02)', 
                  border: `1px solid ${zone.color}40`,
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: zone.color }} />
                    <span className="font-medium text-white">{zone.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">Trip charge:</span>
                    <span className="text-gray-400">$</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={zone.tripCharge}
                      onChange={(e) => updateZoneCharge(zoneKey, e.target.value)}
                      className="w-16 px-2 py-1 text-sm rounded border border-gray-600 bg-gray-800 text-white focus:border-cyan-500 focus:outline-none"
                      disabled={zoneKey === 'custom'}
                    />
                    {zoneKey === 'custom' && <span className="text-xs text-gray-500">(manual)</span>}
                  </div>
                </div>

                {zoneKey !== 'custom' && (
                  <>
                    {/* Zip codes list */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {(zone.zipCodes || []).map(zip => (
                        <span 
                          key={zip}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md"
                          style={{ background: `${zone.color}20`, color: zone.color }}
                        >
                          {zip}
                          <button 
                            onClick={() => removeZipCode(zoneKey, zip)}
                            className="hover:opacity-70"
                          >
                            <svg viewBox="0 0 24 24" width="14" height="14" style={{ stroke: 'currentColor', strokeWidth: 2, fill: 'none' }}>
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </span>
                      ))}
                      {(zone.zipCodes || []).length === 0 && (
                        <span className="text-xs text-gray-500 italic">No zip codes assigned</span>
                      )}
                    </div>

                    {/* Add zip code input */}
                    {zoneKey === 'local' && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Add zip code"
                          maxLength={5}
                          value={newZipCode}
                          onChange={(e) => setNewZipCode(e.target.value.replace(/\D/g, ''))}
                          onKeyDown={(e) => e.key === 'Enter' && addZipCode(zoneKey)}
                          className="flex-1 px-3 py-1.5 text-sm rounded border border-gray-600 bg-gray-800 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
                        />
                        <button
                          onClick={() => addZipCode(zoneKey)}
                          className="px-3 py-1.5 text-sm rounded border border-gray-600 bg-gray-700 text-white hover:bg-gray-600 transition-colors"
                        >
                          Add
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Drive Time Fallback */}
      <section className="rounded-xl p-5" style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.07)' }}>
        <h3 className="text-md font-semibold text-white mb-3 flex items-center gap-2">
          <svg viewBox="0 0 24 24" width="18" height="18" style={{ stroke: '#22D3EE', strokeWidth: 1.75, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Drive Time-Based Pricing
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          For zip codes not explicitly assigned to a zone, pricing is based on drive time from your shop.
        </p>

        <div className="space-y-3">
          {(zoneSettings.driveTimeFallback?.ranges || zoneSettings.distanceFallback?.ranges || []).map((range, idx) => {
            const ranges = zoneSettings.driveTimeFallback?.ranges || zoneSettings.distanceFallback?.ranges || [];
            const maxVal = range.maxMinutes ?? range.maxMiles;
            const prevMaxVal = ranges[idx-1]?.maxMinutes ?? ranges[idx-1]?.maxMiles ?? 0;
            
            return (
              <div key={idx} className="flex items-center gap-3 text-sm">
                {idx === 0 ? (
                  <span className="text-gray-400 min-w-[110px]">0 - {maxVal} min</span>
                ) : maxVal === null ? (
                  <span className="text-gray-400 min-w-[110px]">&gt; {prevMaxVal} min</span>
                ) : (
                  <span className="text-gray-400 min-w-[110px]">{prevMaxVal} - {maxVal} min</span>
                )}
                <span className="text-gray-500">=</span>
                {range.charge === null ? (
                  <span className="text-gray-400 italic">Custom (manual entry)</span>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400">$</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={range.charge ?? ''}
                      onChange={(e) => updateDriveTimeRange(idx, 'charge', e.target.value)}
                      className="w-16 px-2 py-1 text-sm rounded border border-gray-600 bg-gray-800 text-white focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                )}
                <span 
                  className="px-2 py-0.5 text-xs rounded"
                  style={{ 
                    background: `${zoneSettings.zones[range.zone]?.color}20`, 
                    color: zoneSettings.zones[range.zone]?.color 
                  }}
                >
                  {zoneSettings.zones[range.zone]?.name || range.zone}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );

  const renderTaxTab = () => (
    <div className="space-y-6">
      <section className="rounded-xl p-5" style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <TabIcon type="tax" className="w-5 h-5 stroke-cyan-400" />
            County Tax Rates
          </h2>
          <button
            onClick={saveTaxSettings}
            disabled={savingTax || loadingTax}
            className="px-3 py-1.5 text-sm font-medium rounded-lg transition-all disabled:opacity-50"
            style={{ background: 'rgba(34, 211, 238, 0.15)', color: '#22D3EE', border: '1px solid rgba(34, 211, 238, 0.3)' }}
          >
            {savingTax ? 'Saving...' : 'Save Tax'}
          </button>
        </div>

        <p className="text-xs text-gray-500 mb-4">
          Parts tax rate is set from the job zip code. Unknown zips default to{' '}
          {taxSettings.counties?.[taxSettings.defaultCounty || 'lucas']?.name || 'Lucas County'}.
        </p>

        {loadingTax ? (
          <div className="text-gray-500 text-sm py-4">Loading...</div>
        ) : (
          <div className="space-y-4">
            {Object.entries(taxSettings.counties || {}).map(([countyKey, county]) => (
              <div
                key={countyKey}
                className="rounded-lg p-4"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                  <span className="font-medium text-white">{county.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">Rate:</span>
                    <input
                      type="number"
                      min="0"
                      max="20"
                      step="0.01"
                      value={((county.rate ?? 0) * 100).toFixed(2)}
                      onChange={(e) => updateCountyRate(countyKey, e.target.value)}
                      className="w-20 px-2 py-1 text-sm rounded border border-gray-600 bg-gray-800 text-white focus:border-cyan-500 focus:outline-none"
                    />
                    <span className="text-sm text-gray-400">%</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-3 max-h-24 overflow-y-auto">
                  {(county.zipCodes || []).map((zip) => (
                    <span
                      key={zip}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-cyan-500/10 text-cyan-300"
                    >
                      {zip}
                      <button type="button" onClick={() => removeTaxZipCode(countyKey, zip)} className="hover:opacity-70">
                        ×
                      </button>
                    </span>
                  ))}
                  {(county.zipCodes || []).length === 0 && (
                    <span className="text-xs text-gray-500 italic">No zips — uses default county if unmatched</span>
                  )}
                </div>
              </div>
            ))}

            <div className="rounded-lg p-4 border border-dashed border-gray-600">
              <p className="text-xs text-gray-500 mb-2">Add zip to county</p>
              <div className="flex flex-wrap gap-2">
                <select
                  value={taxZipCounty}
                  onChange={(e) => setTaxZipCounty(e.target.value)}
                  className="px-3 py-1.5 text-sm rounded border border-gray-600 bg-gray-800 text-white focus:border-cyan-500 focus:outline-none"
                >
                  {Object.entries(taxSettings.counties || {}).map(([key, county]) => (
                    <option key={key} value={key}>{county.name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Zip code"
                  maxLength={5}
                  value={newTaxZip}
                  onChange={(e) => setNewTaxZip(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && addTaxZipCode(taxZipCounty)}
                  className="flex-1 min-w-[120px] px-3 py-1.5 text-sm rounded border border-gray-600 bg-gray-800 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => addTaxZipCode(taxZipCounty)}
                  className="px-3 py-1.5 text-sm rounded border border-gray-600 bg-gray-700 text-white hover:bg-gray-600 transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );

  const renderPriceBookTab = () => {
    const inputClass =
      'w-full px-3 py-2 text-sm rounded-lg border border-gray-600 bg-gray-800 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none disabled:opacity-50';
    const labelClass = 'block text-xs font-medium text-gray-400 mb-1';

    const renderSkuRow = (service) => {
      const isSaving = savingServiceId === service.id;
      const isVariable = service.is_custom_price;

      return (
        <div
          key={service.id}
          className={`flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 px-3 rounded-lg border border-white/5 ${
            service.is_active ? 'bg-white/[0.02]' : 'bg-white/[0.01] opacity-60'
          }`}
        >
          <div className="flex-1 min-w-[140px]">
            <p className="text-sm text-white font-medium leading-tight">{service.name}</p>
            <p className="text-xs text-gray-500 font-mono mt-0.5">{service.sku_code}</p>
          </div>
          <span className="text-xs text-gray-500 capitalize min-w-[72px]">
            {formatEquipmentLabel(service.equipment_type)}
          </span>
          <div className="flex items-center gap-1">
            {isVariable ? (
              <span className="text-xs text-amber-400/90 italic px-2">Variable</span>
            ) : (
              <>
                <span className="text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={isSaving}
                  value={priceDrafts[service.id] ?? ''}
                  onChange={(e) =>
                    setPriceDrafts((prev) => ({ ...prev, [service.id]: e.target.value }))
                  }
                  onBlur={() => handlePriceBlur(service)}
                  onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                  className="w-20 px-2 py-1 text-sm rounded border border-gray-600 bg-gray-800 text-white focus:border-cyan-500 focus:outline-none disabled:opacity-50"
                />
              </>
            )}
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={Boolean(service.is_active)}
              disabled={isSaving}
              onChange={() => handleActiveToggle(service)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-gray-900"
            />
            <span className="text-xs text-gray-400">Active</span>
          </label>
          <button
            type="button"
            onClick={() => openEditSku(service)}
            disabled={isSaving}
            className="text-xs px-2 py-1 rounded border border-gray-600 text-gray-300 hover:text-white hover:border-gray-500 disabled:opacity-50"
          >
            Edit
          </button>
          {isSaving && (
            <span className="text-xs text-cyan-400/80">Saving…</span>
          )}
        </div>
      );
    };

    const renderSkuModal = () => {
      if (!skuModalOpen) return null;
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/60"
            onClick={closeSkuModal}
          />
          <div
            className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl p-5 shadow-xl"
            style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <h3 className="text-lg font-semibold text-white mb-4">
              {skuModalMode === 'create' ? 'Add SKU' : 'Edit SKU'}
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className={labelClass}>SKU code</label>
                  <div className="flex gap-2">
                    <input
                      className={inputClass}
                      value={skuForm.sku_code}
                      onChange={(e) => handleSkuField('sku_code', e.target.value.toUpperCase())}
                      disabled={savingSku}
                      placeholder="REP-WSH-001"
                    />
                    {skuModalMode === 'create' && (
                      <button
                        type="button"
                        onClick={generateSkuCode}
                        disabled={savingSku || generatingSku || !skuForm.service_type}
                        className="flex-shrink-0 px-3 py-2 text-xs font-medium rounded-lg disabled:opacity-50"
                        style={{ background: 'rgba(255,255,255,0.06)', color: '#9CA3AF', border: '1px solid rgba(255,255,255,0.1)' }}
                      >
                        {generatingSku ? '…' : 'Generate'}
                      </button>
                    )}
                  </div>
                  {skuFormErrors.sku_code && (
                    <p className="text-xs text-red-400 mt-1">{skuFormErrors.sku_code}</p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className={labelClass}>Name</label>
                  <input
                    className={inputClass}
                    value={skuForm.name}
                    onChange={(e) => handleSkuField('name', e.target.value)}
                    disabled={savingSku}
                  />
                  {skuFormErrors.name && (
                    <p className="text-xs text-red-400 mt-1">{skuFormErrors.name}</p>
                  )}
                </div>

                <div>
                  <label className={labelClass}>Type</label>
                  <select
                    className={inputClass}
                    value={skuForm.service_type}
                    onChange={(e) => handleSkuField('service_type', e.target.value)}
                    disabled={savingSku}
                  >
                    {SKU_FORM_TYPES.map((t) => (
                      <option key={t.key} value={t.key}>{t.label}</option>
                    ))}
                  </select>
                  {skuFormErrors.service_type && (
                    <p className="text-xs text-red-400 mt-1">{skuFormErrors.service_type}</p>
                  )}
                </div>

                <div>
                  <label className={labelClass}>Equipment</label>
                  <select
                    className={inputClass}
                    value={skuForm.equipment_type}
                    onChange={(e) => handleSkuField('equipment_type', e.target.value)}
                    disabled={savingSku}
                  >
                    {EQUIPMENT_TYPES.map((t) => (
                      <option key={t.key || 'any'} value={t.key}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Base price ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputClass}
                    value={skuForm.base_price}
                    onChange={(e) => handleSkuField('base_price', e.target.value)}
                    disabled={savingSku || skuForm.is_custom_price}
                  />
                  {skuFormErrors.base_price && (
                    <p className="text-xs text-red-400 mt-1">{skuFormErrors.base_price}</p>
                  )}
                </div>

                <div>
                  <label className={labelClass}>Duration (min)</label>
                  <input
                    type="number"
                    min="0"
                    className={inputClass}
                    value={skuForm.duration_minutes}
                    onChange={(e) => handleSkuField('duration_minutes', e.target.value)}
                    disabled={savingSku}
                    placeholder="Optional"
                  />
                  {skuFormErrors.duration_minutes && (
                    <p className="text-xs text-red-400 mt-1">{skuFormErrors.duration_minutes}</p>
                  )}
                </div>

                <div>
                  <label className={labelClass}>Skill level</label>
                  <select
                    className={inputClass}
                    value={skuForm.skill_level}
                    onChange={(e) => handleSkuField('skill_level', e.target.value)}
                    disabled={savingSku}
                  >
                    {SKILL_LEVELS.map((t) => (
                      <option key={t.key || 'none'} value={t.key}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className={labelClass}>Description</label>
                  <textarea
                    rows={2}
                    className={inputClass}
                    value={skuForm.description}
                    onChange={(e) => handleSkuField('description', e.target.value)}
                    disabled={savingSku}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={skuForm.is_custom_price}
                    onChange={(e) => handleSkuField('is_custom_price', e.target.checked)}
                    disabled={savingSku}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-cyan-500"
                  />
                  <span className="text-xs text-gray-400">Variable pricing</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={skuForm.requires_diagnostic}
                    onChange={(e) => handleSkuField('requires_diagnostic', e.target.checked)}
                    disabled={savingSku}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-cyan-500"
                  />
                  <span className="text-xs text-gray-400">Requires diagnostic</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={skuForm.is_active}
                    onChange={(e) => handleSkuField('is_active', e.target.checked)}
                    disabled={savingSku}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-cyan-500"
                  />
                  <span className="text-xs text-gray-400">Active</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={closeSkuModal}
                disabled={savingSku}
                className="px-4 py-2 text-sm rounded-lg text-gray-400 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveSku}
                disabled={savingSku}
                className="px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50"
                style={{ background: 'rgba(34, 211, 238, 0.15)', color: '#22D3EE', border: '1px solid rgba(34, 211, 238, 0.3)' }}
              >
                {savingSku ? 'Saving…' : skuModalMode === 'create' ? 'Create SKU' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-6">
        {renderSkuModal()}
        <section className="rounded-xl p-5" style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <TabIcon type="price" className="w-5 h-5 stroke-cyan-400" />
              Price Book
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openCreateSku}
                className="px-3 py-1.5 text-sm font-medium rounded-lg transition-all"
                style={{ background: 'rgba(34, 211, 238, 0.2)', color: '#22D3EE', border: '1px solid rgba(34, 211, 238, 0.4)' }}
              >
                Add SKU
              </button>
              <button
                type="button"
                onClick={loadCatalog}
                disabled={loadingCatalog}
                className="px-3 py-1.5 text-sm font-medium rounded-lg transition-all disabled:opacity-50"
                style={{ background: 'rgba(34, 211, 238, 0.15)', color: '#22D3EE', border: '1px solid rgba(34, 211, 238, 0.3)' }}
              >
                {loadingCatalog ? 'Loading…' : 'Refresh'}
              </button>
            </div>
          </div>

          <p className="text-xs text-gray-500 mb-4">
            Manage catalog SKUs and prices for new work order line items. Changes apply to new line items only — not existing jobs.
          </p>

          <input
            type="search"
            placeholder="Search name, SKU, or equipment…"
            value={catalogSearch}
            onChange={(e) => setCatalogSearch(e.target.value)}
            className="w-full mb-4 px-3 py-2 text-sm rounded-lg border border-gray-600 bg-gray-800 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
          />

          <div className="mb-5 rounded-lg border border-white/5 overflow-hidden">
            <button
              type="button"
              onClick={() => setBulkPanelOpen((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-left text-gray-300 hover:bg-white/[0.03]"
            >
              <span className="font-medium">Bulk price update</span>
              <span className="text-xs text-gray-500">
                {bulkPanelOpen ? 'Hide' : 'Show'}
                {bulkTargetServices.length > 0 && ` · ${bulkTargetServices.length} eligible`}
              </span>
            </button>
            {bulkPanelOpen && (
              <div className="px-3 pb-3 pt-1 border-t border-white/5 space-y-3">
                <p className="text-xs text-gray-500">
                  Adjust fixed-price SKUs by category. Variable-price SKUs are always skipped.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>Category</label>
                    <select
                      className={inputClass}
                      value={bulkScope}
                      onChange={(e) => setBulkScope(e.target.value)}
                      disabled={applyingBulk}
                    >
                      <option value="all">All categories</option>
                      {PRICE_BOOK_TYPES.map((t) => (
                        <option key={t.key} value={t.key}>{t.label}</option>
                      ))}
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Adjustment</label>
                    <select
                      className={inputClass}
                      value={bulkMode}
                      onChange={(e) => setBulkMode(e.target.value)}
                      disabled={applyingBulk}
                    >
                      <option value="percent">Percent change (%)</option>
                      <option value="fixed">Dollar change ($)</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>
                      {bulkMode === 'percent' ? 'Percent (e.g. 5 or -10)' : 'Dollars (e.g. 10 or -5)'}
                    </label>
                    <input
                      type="number"
                      step={bulkMode === 'percent' ? '0.1' : '0.01'}
                      className={inputClass}
                      value={bulkAmount}
                      onChange={(e) => setBulkAmount(e.target.value)}
                      disabled={applyingBulk}
                      placeholder={bulkMode === 'percent' ? '5' : '10.00'}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={applyBulkPriceUpdate}
                  disabled={applyingBulk || bulkTargetServices.length === 0}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg disabled:opacity-50"
                  style={{ background: 'rgba(34, 211, 238, 0.15)', color: '#22D3EE', border: '1px solid rgba(34, 211, 238, 0.3)' }}
                >
                  {applyingBulk
                    ? 'Applying…'
                    : `Apply to ${bulkTargetServices.length} SKU${bulkTargetServices.length === 1 ? '' : 's'}`}
                </button>
              </div>
            )}
          </div>

          {loadingCatalog ? (
            <div className="text-gray-500 text-sm py-6 text-center">Loading catalog…</div>
          ) : (
            <div className="space-y-5">
              {catalogByType.map((group) =>
                group.items.length > 0 ? (
                  <div key={group.key}>
                    <h3 className="text-sm font-semibold text-cyan-400/90 mb-2 uppercase tracking-wide">
                      {group.label}
                      <span className="text-gray-500 font-normal normal-case ml-2">
                        ({group.items.length})
                      </span>
                    </h3>
                    <div className="space-y-2">{group.items.map(renderSkuRow)}</div>
                  </div>
                ) : null
              )}

              {otherCatalogItems.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-400 mb-2 uppercase tracking-wide">
                    Other
                    <span className="text-gray-500 font-normal normal-case ml-2">
                      ({otherCatalogItems.length})
                    </span>
                  </h3>
                  <div className="space-y-2">{otherCatalogItems.map(renderSkuRow)}</div>
                </div>
              )}

              {filteredCatalog.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-6">No SKUs match your search.</p>
              )}
            </div>
          )}
        </section>
      </div>
    );
  };

  return (
    <div className="min-h-screen p-4 sm:p-6" style={{ background: '#0B0F1A' }}>
      <div className="max-w-2xl mx-auto">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-gray-400 mt-1">Customize your experience</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-lg overflow-x-auto" style={{ background: 'rgba(255,255,255,0.03)' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.id 
                  ? 'bg-cyan-500/10 text-cyan-400' 
                  : 'text-gray-400 hover:text-gray-300 hover:bg-white/5'
              }`}
            >
              <TabIcon type={tab.icon} className={`w-4 h-4 ${activeTab === tab.id ? 'stroke-cyan-400' : 'stroke-current'}`} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'interface' && renderInterfaceTab()}
          {activeTab === 'availability' && renderAvailabilityTab()}
          {activeTab === 'service-areas' && renderServiceAreasTab()}
          {activeTab === 'tax' && renderTaxTab()}
          {activeTab === 'price-book' && renderPriceBookTab()}
        </div>
      </div>
    </div>
  );
}

Settings.getLayout = function getLayout(page) {
  return <TechDashboardLayout>{page}</TechDashboardLayout>;
};
