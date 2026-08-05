import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { apiClient } from '../../utils/api-client';
import { updatePartStatusOffline } from '../../lib/offlineWrites';
import { fetchWorkOrderPartsWithCache } from '../../lib/offlineReads';

function getWorkOrderPartsSeed(workOrder) {
  return Array.isArray(workOrder?.parts) ? workOrder.parts : [];
}
import Button from '../ui/Button';
import { SelectInput, TextInput, CheckboxInput } from '../ui/FormElements';
import { FaTrash, FaEdit, FaTimes, FaInfoCircle } from 'react-icons/fa';
import Image from 'next/image';
import EquipmentDetailsMobile from './EquipmentDetailsMobile';
import { isWorkOrderClosed } from '../../utils/workOrderPermissions';
import {
  PART_SOURCE_OPTIONS,
  formatPartSourceLabel,
  formatPartWarrantySummary,
  isValidPartSource,
  partToFormState,
  emptyPartFormState,
  normalizePartSource,
} from '../../utils/partWarranty';
import {
  normalizePartsSettings,
  getVendorSelectOptions,
  getVendorLabel,
  getLookupProvidersForEquipment,
  buildPartLookupUrl,
  resolvePartsLogoUrl,
  isBackendHostedPartsLogo,
} from '../../utils/partsSettings';

// Equipment types
const EQUIPMENT_TYPES = [
  { value: '', label: 'Select Equipment Type' },
  { value: 'appliance', label: 'Appliance' },
  { value: 'tv', label: 'TV' }
];

// Equipment subtypes
const EQUIPMENT_SUBTYPES = {
  appliance: [
    { value: '', label: 'Select Appliance Type' },
    { value: 'refrigerator', label: 'Refrigerator' },
    { value: 'freezer', label: 'Freezer' },
    { value: 'dishwasher', label: 'Dishwasher' },
    { value: 'washing_machine', label: 'Washing Machine' },
    { value: 'dryer', label: 'Dryer (unspecified)' },
    { value: 'electric_dryer', label: 'Electric Dryer' },
    { value: 'gas_dryer', label: 'Gas Dryer' },
    { value: 'aio_laundry', label: 'AIO Laundry' },
    { value: 'oven', label: 'Oven (unspecified)' },
    { value: 'electric_range', label: 'Electric Range' },
    { value: 'gas_range', label: 'Gas Range' },
    { value: 'microwave', label: 'Microwave' },
    { value: 'cooktop', label: 'Cooktop' },
    { value: 'range_hood', label: 'Range Hood' },
    { value: 'other', label: 'Other' }
  ],
  tv: [
    { value: '', label: 'Select TV Size' },
    { value: 'under_32', label: 'Under 32"' },
    { value: '32_to_43', label: '32" to 43"' },
    { value: '44_to_55', label: '44" to 55"' },
    { value: '56_to_65', label: '56" to 65"' },
    { value: '66_to_75', label: '66" to 75"' },
    { value: 'over_75', label: 'Over 75"' }
  ]
};

// Manufacturers
const MANUFACTURERS = [
  { value: '', label: 'Select Manufacturer' },
  { value: 'Samsung', label: 'Samsung' },
  { value: 'LG', label: 'LG' },
  { value: 'Whirlpool', label: 'Whirlpool' },
  { value: 'GE', label: 'GE' },
  { value: 'Maytag', label: 'Maytag' },
  { value: 'Sony', label: 'Sony' },
  { value: 'Frigidaire', label: 'Frigidaire' },
  { value: 'Bosch', label: 'Bosch' },
  { value: 'KitchenAid', label: 'KitchenAid' },
  { value: 'Kenmore', label: 'Kenmore' },
  { value: 'Electrolux', label: 'Electrolux' },
  { value: 'Haier', label: 'Haier' },
  { value: 'TCL', label: 'TCL' },
  { value: 'Hisense', label: 'Hisense' },
  { value: 'Vizio', label: 'Vizio' },
  { value: 'Other', label: 'Other' }
];

// Part statuses
const PART_STATUSES = [
  { value: 'needed', label: 'Needed', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  { value: 'ordered', label: 'Ordered', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  { value: 'received', label: 'Received', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200' },
  { value: 'upfront_50', label: '50% Upfront', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
  { value: 'phone_payment', label: 'Phone Payment', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200' },
  { value: 'paid_not_installed', label: 'PdNI', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  { value: 'installed', label: 'Installed', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
  { value: 'not_installed', label: 'Not Installed', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' }
];

export default forwardRef(function EquipmentDetails({ workOrderId, workOrder, onUpdate, variant = 'desktop', readOnly = false }, ref) {
  const isMobile = variant === 'mobile';
  const structuralReadOnly = readOnly || isWorkOrderClosed(workOrder);
  const [openSection, setOpenSection] = useState(null);
  // Equipment details
  const [equipmentType, setEquipmentType] = useState(workOrder?.equipment_type || '');
  const [equipmentSubtype, setEquipmentSubtype] = useState(workOrder?.equipment_subtype || '');
  const [manufacturer, setManufacturer] = useState(workOrder?.equipment_make || '');
  const [modelNumber, setModelNumber] = useState(workOrder?.equipment_model || '');
  const [serialNumber, setSerialNumber] = useState(workOrder?.equipment_serial || '');
  const [versionNumber, setVersionNumber] = useState(workOrder?.equipment_version || '');
  const [isWallMounted, setIsWallMounted] = useState(workOrder?.is_wall_mounted || false);
  const [equipmentNotes, setEquipmentNotes] = useState(workOrder?.equipment_notes || '');
  
  // Status indicators
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Parts management
  const seedParts = getWorkOrderPartsSeed(workOrder);
  const [parts, setParts] = useState(seedParts);
  const [showPartForm, setShowPartForm] = useState(false);
  const [editingPartIndex, setEditingPartIndex] = useState(null);
  const [currentPart, setCurrentPart] = useState(emptyPartFormState());

  // Modal state
  const [showPartModal, setShowPartModal] = useState(false);
  const [selectedPart, setSelectedPart] = useState(null);
  const [partsSettings, setPartsSettings] = useState(() => normalizePartsSettings(null));

  useEffect(() => {
    apiClient('/api/settings/parts/config')
      .then((cfg) => setPartsSettings(normalizePartsSettings(cfg)))
      .catch(() => setPartsSettings(normalizePartsSettings(null)));
  }, []);

  useEffect(() => {
    if (workOrder) {
      console.log('[EquipmentDetails] Syncing from workOrder:', workOrder.equipment_type, workOrder.equipment_subtype, workOrder.equipment_make);
      setEquipmentType(workOrder.equipment_type || '');
      setEquipmentSubtype(workOrder.equipment_subtype || '');
      setManufacturer(workOrder.equipment_make || '');
      setModelNumber(workOrder.equipment_model || '');
      setSerialNumber(workOrder.equipment_serial || '');
      setVersionNumber(workOrder.equipment_version || '');
      setIsWallMounted(workOrder.is_wall_mounted || false);
      setEquipmentNotes(workOrder.equipment_notes || '');
    }
  }, [workOrder?.id]);

  useEffect(() => {
    if (workOrderId) {
      const hasSeed = getWorkOrderPartsSeed(workOrder).length > 0;
      fetchParts({ silent: hasSeed });
    }
  }, [workOrderId]);

  useEffect(() => {
    const seeded = getWorkOrderPartsSeed(workOrder);
    if (seeded.length === 0) return;
    setParts((prev) => {
      const prevById = new Map(prev.map((p) => [p.id, p]));
      return seeded.map((p) => {
        const existing = prevById.get(p.id);
        const merged = existing ? { ...existing, ...p } : p;
        return {
          ...merged,
          part_source: normalizePartSource(merged.part_source ?? existing?.part_source),
        };
      });
    });
  }, [workOrder?.parts]);

  const fetchParts = async ({ silent = false } = {}) => {
    try {
      const response = await fetchWorkOrderPartsWithCache(workOrderId);
      const items = Array.isArray(response) ? response : [];
      setParts(items.map((p) => ({ ...p, part_source: normalizePartSource(p.part_source) })));
    } catch (err) {
      console.error('Error fetching parts:', err);
      if (!silent) {
        setParts([]);
      }
    }
  };

  const handleEquipmentTypeChange = (e) => {
    const newType = e.target.value;
    setEquipmentType(newType);
    // Reset subtype when type changes
    setEquipmentSubtype('');
    // Reset wall mounted if changing away from TV
    if (newType !== 'tv') {
      setIsWallMounted(false);
    }
  };

  const saveEquipmentDetails = async () => {
    if (structuralReadOnly) return;
    try {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      
      // Prepare equipment data
      const equipmentData = {
        equipment_make: manufacturer,
        equipment_model: modelNumber,
        equipment_serial: serialNumber,
        equipment_version: versionNumber,
        equipment_type: equipmentType,
        equipment_subtype: equipmentSubtype,
        is_wall_mounted: isWallMounted,
        equipment_notes: equipmentNotes
      };
      
      // Send to the backend
      const response = await apiClient(`work-orders/${workOrderId}/equipment`, {
        method: 'PUT',
        body: JSON.stringify(equipmentData)
      });
      
      setSuccessMessage('Equipment details saved successfully');
      
      // Notify parent component of update
      if (onUpdate) {
        onUpdate({
          equipment_type: equipmentType,
          equipment_subtype: equipmentSubtype,
          equipment_make: manufacturer, 
          equipment_model: modelNumber,
          equipment_serial: serialNumber,
          equipment_version: versionNumber,
          is_wall_mounted: isWallMounted,
          equipment_notes: equipmentNotes
        });
      }
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
      
    } catch (error) {
      console.error('Error saving equipment details:', error);
      setError('Failed to save equipment details');
    } finally {
      setLoading(false);
    }
  };

  const handlePartChange = (field, value) => {
    const updated = { ...currentPart, [field]: value };
    
    // Auto-calculate price when cost changes (28% markup)
    if (field === 'cost') {
      const cost = parseFloat(value);
      if (!isNaN(cost)) {
        const markupPct = Number(partsSettings.markupPercent) || 28;
        updated.price = (cost * (1 + markupPct / 100)).toFixed(2);
      }
    }
    
    setCurrentPart(updated);
  };

  const addOrUpdatePart = async () => {
    if (structuralReadOnly) return;
    const partSource = normalizePartSource(currentPart.part_source);
    if (!isValidPartSource(partSource)) {
      setError('Select OEM or Aftermarket for this part');
      return;
    }
    setLoading(true);
    try {
      let warranty_days_override = null;
      const overrideRaw = currentPart.warranty_days_override;
      if (overrideRaw !== '' && overrideRaw !== null && overrideRaw !== undefined) {
        const parsed = parseInt(overrideRaw, 10);
        if (!Number.isFinite(parsed) || parsed < 0) {
          setError('Custom warranty must be a non-negative number of days');
          setLoading(false);
          return;
        }
        warranty_days_override = parsed;
      }

      // Prepare data for API - handle vendor field
      const partData = {
        number: currentPart.number,
        description: currentPart.description,
        cost: parseFloat(currentPart.cost),
        price: parseFloat(currentPart.price),
        part_source: partSource,
        status: currentPart.status,
        vendor: currentPart.vendor === '' ? null : currentPart.vendor,
        tracking_number: currentPart.tracking_number || '',
        notes: currentPart.notes || '',
        warranty_days_override,
        // Auto-set amount_upfront_collected based on status
        amount_upfront_collected: currentPart.status === 'phone_payment'
          ? parseFloat(currentPart.price)  // full price collected
          : currentPart.status === 'upfront_50'
          ? parseFloat(currentPart.price) * 0.5  // half collected
          : parseFloat(currentPart.amount_upfront_collected || 0)  // manual or zero
      };
      
      if (editingPartIndex !== null) {
        // Update existing part
        const part = parts[editingPartIndex];
        const response = await apiClient(`work-orders/parts/${part.id}`, {
          method: 'PUT',
          body: JSON.stringify(partData)
        });
        
        // Update local state
        const updatedParts = [...parts];
        updatedParts[editingPartIndex] = response;
        setParts(updatedParts);
      } else {
        // Add new part
        const response = await apiClient(`work-orders/${workOrderId}/parts`, {
          method: 'POST',
          body: JSON.stringify({
            work_order_id: workOrderId,
            ...partData
          })
        });
        
        // Update local state
        setParts([...parts, response]);
      }
      
      // Reset form
      resetPartForm();
      
      // Notify parent to refetch so invoices tab stays in sync
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Error saving part:', err);
      setError('Failed to save part. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const startEditPart = (index) => {
    if (structuralReadOnly) return;
    setCurrentPart(partToFormState(parts[index]));
    setEditingPartIndex(index);
    setShowPartForm(true);
  };

  const deletePart = async (index) => {
    if (structuralReadOnly) return;
    const part = parts[index];
    if (!part) return;

    try {
      setLoading(true);
      setError(null);

      if (part.id) {
        await apiClient(`work-orders/parts/${part.id}`, { method: 'DELETE' });
      }

      const updatedParts = [...parts];
      updatedParts.splice(index, 1);
      setParts(updatedParts);
      resetPartForm();
      if (onUpdate) onUpdate();
      setSuccessMessage('Part deleted successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error deleting part:', err);
      setError('Failed to delete part. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetPartForm = () => {
    setCurrentPart(emptyPartFormState());
    setEditingPartIndex(null);
    setShowPartForm(false);
  };

  const generateSearchLink = (provider) => {
    const template = typeof provider === 'string'
      ? (partsSettings.lookupProviders || []).find((p) => p.id === provider)?.urlTemplate
      : provider?.urlTemplate;
    return buildPartLookupUrl(template || '', { manufacturer, modelNumber });
  };

  const vendorSelectOptions = getVendorSelectOptions(partsSettings);
  const lookupProviders = equipmentType
    ? getLookupProvidersForEquipment(partsSettings, equipmentType)
    : [];
  const warrantyDefaults = {
    oemWarrantyDays: partsSettings.oemWarrantyDays,
    aftermarketWarrantyDays: partsSettings.aftermarketWarrantyDays,
  };

  const renderLookupLink = (provider) => {
    const enabled = Boolean(manufacturer && modelNumber);
    const logoSrc = resolvePartsLogoUrl(provider.logoPath);
    const useNativeImg = isBackendHostedPartsLogo(provider.logoPath);
    return (
      <a
        key={provider.id}
        href={generateSearchLink(provider)}
        target="_blank"
        rel="noopener noreferrer"
        title={`Search ${provider.name} for parts`}
        className={`inline-flex items-center justify-center p-3 border border-transparent rounded-md shadow-sm ${
          enabled
            ? 'bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 dark:bg-gray-800 dark:hover:bg-gray-700'
            : 'bg-gray-100 cursor-not-allowed dark:bg-gray-800'
        }`}
        style={{ width: '140px', height: '70px' }}
        onClick={(e) => {
          if (!enabled) {
            e.preventDefault();
            alert('Please fill in manufacturer and model number to use this link');
          }
        }}
      >
        {logoSrc ? (
          useNativeImg ? (
            <img
              src={logoSrc}
              alt={provider.name}
              className="w-24 h-12 object-contain"
            />
          ) : (
            <Image
              src={logoSrc}
              alt={provider.name}
              width={100}
              height={50}
              className="w-24 h-12 object-contain"
            />
          )
        ) : (
          <span className="text-xs text-center text-gray-500 dark:text-gray-400 px-2">{provider.name}</span>
        )}
      </a>
    );
  };

  const openPartModal = (part) => {
    setSelectedPart(part);
    setShowPartModal(true);
  };
  
  const closePartModal = () => {
    setShowPartModal(false);
    setSelectedPart(null);
  };

  // Add a function to update just the part status
  const updatePartStatus = async (partIndex, newStatus) => {
    if (structuralReadOnly) return;
    try {
      const part = parts[partIndex];
      const price = parseFloat(part.price || 0);
      
      // Auto-calculate amount_upfront_collected when changing status
      // Backend now handles tax_collected calculation automatically
      const amountUpfront = newStatus === 'phone_payment' || newStatus === 'paid_not_installed'
        ? price  // full price committed
        : newStatus === 'upfront_50'
        ? price * 0.5  // half committed
        : newStatus === 'installed' || newStatus === 'needed' || newStatus === 'ordered' || newStatus === 'received'
        ? 0  // reset on earlier statuses
        : parseFloat(part.amount_upfront_collected || 0);  // keep existing
      
      const response = await updatePartStatusOffline({
        partId: part.id,
        status: newStatus,
        amountUpfrontCollected: amountUpfront,
        partSnapshot: part,
      });

      const updatedPart = response?.queued
        ? { ...part, status: newStatus, amount_upfront_collected: amountUpfront }
        : response;
      
      // Update local state
      const updatedParts = [...parts];
      updatedParts[partIndex] = updatedPart;
      setParts(updatedParts);
      
      // Notify parent to refetch work order so invoices tab reflects new status
      if (onUpdate) onUpdate();
      
      // Show success indicator briefly
      const label = PART_STATUSES.find(s => s.value === newStatus)?.label;
      setSuccessMessage(
        response?.queued
          ? `Part status saved offline (${label}) — will sync when online`
          : `Part status updated to ${label}`
      );
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
      
    } catch (err) {
      console.error('Error updating part status:', err);
      setError('Failed to update part status');
    }
  };

  const toggleMobileSection = (id) => {
    setOpenSection((cur) => (cur === id ? null : id));
  };

  const subtypeLabel =
    equipmentType && equipmentSubtype
      ? (EQUIPMENT_SUBTYPES[equipmentType] || []).find((o) => o.value === equipmentSubtype)?.label
      : null;
  const equipmentSummary =
    [subtypeLabel, manufacturer, modelNumber].filter(Boolean).join(' · ') || 'Add equipment details';
  const identificationSummary =
    [serialNumber && `S/N ${serialNumber}`, versionNumber && `Ver ${versionNumber}`]
      .filter(Boolean)
      .join(' · ') || 'Serial & version';
  const partsSummary = parts.length ? `${parts.length} part${parts.length === 1 ? '' : 's'}` : 'No parts yet';

  useEffect(() => {
    if (isMobile && showPartForm) setOpenSection('parts');
  }, [showPartForm, isMobile]);

  useImperativeHandle(ref, () => ({
    openAddPartForm: () => {
      if (structuralReadOnly) return { ok: false, reason: 'readonly' };
      setShowPartForm(true);
      if (isMobile) setOpenSection('parts');
      return { ok: true };
    },
  }), [structuralReadOnly, isMobile]);

  if (isMobile) {
    return (
      <EquipmentDetailsMobile
        workOrderId={workOrderId}
        openSection={openSection}
        toggleMobileSection={toggleMobileSection}
        equipmentSummary={equipmentSummary}
        identificationSummary={identificationSummary}
        partsSummary={partsSummary}
        equipmentType={equipmentType}
        equipmentSubtype={equipmentSubtype}
        manufacturer={manufacturer}
        modelNumber={modelNumber}
        serialNumber={serialNumber}
        versionNumber={versionNumber}
        isWallMounted={isWallMounted}
        equipmentNotes={equipmentNotes}
        loading={loading}
        error={error}
        successMessage={successMessage}
        parts={parts}
        showPartForm={showPartForm}
        showPartModal={showPartModal}
        selectedPart={selectedPart}
        currentPart={currentPart}
        editingPartIndex={editingPartIndex}
        setEquipmentSubtype={setEquipmentSubtype}
        setManufacturer={setManufacturer}
        setModelNumber={setModelNumber}
        setSerialNumber={setSerialNumber}
        setVersionNumber={setVersionNumber}
        setIsWallMounted={setIsWallMounted}
        setEquipmentNotes={setEquipmentNotes}
        setShowPartForm={setShowPartForm}
        handleEquipmentTypeChange={handleEquipmentTypeChange}
        saveEquipmentDetails={saveEquipmentDetails}
        handlePartChange={handlePartChange}
        addOrUpdatePart={addOrUpdatePart}
        resetPartForm={resetPartForm}
        startEditPart={startEditPart}
        deletePart={deletePart}
        openPartModal={openPartModal}
        closePartModal={closePartModal}
        updatePartStatus={updatePartStatus}
        readOnly={structuralReadOnly}
        generateSearchLink={generateSearchLink}
        lookupProviders={lookupProviders}
        vendorSelectOptions={vendorSelectOptions}
        getVendorLabel={(vendorId) => getVendorLabel(partsSettings, vendorId)}
        partsWarrantyDefaults={{
          oemWarrantyDays: partsSettings.oemWarrantyDays,
          aftermarketWarrantyDays: partsSettings.aftermarketWarrantyDays,
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Equipment Information</h3>
          
          <div className="space-y-4">
            <SelectInput 
              label="Equipment Type" 
              value={equipmentType} 
              onChange={handleEquipmentTypeChange}
              options={EQUIPMENT_TYPES}
              required={!equipmentType}
            />
            
            {equipmentType && (
              <SelectInput 
                label={equipmentType === 'appliance' ? "Appliance Type" : "TV Size"}
                value={equipmentSubtype} 
                onChange={(e) => setEquipmentSubtype(e.target.value)}
                options={EQUIPMENT_SUBTYPES[equipmentType] || []}
                required={!equipmentSubtype}
              />
            )}
            
            <SelectInput 
              label="Manufacturer" 
              value={manufacturer} 
              onChange={(e) => setManufacturer(e.target.value)}
              options={MANUFACTURERS}
              required={!manufacturer}
            />
            
            <TextInput 
              label="Model Number" 
              value={modelNumber} 
              onChange={(e) => setModelNumber(e.target.value.toUpperCase())}
              placeholder="Enter model number"
              required={!modelNumber}
            />
            
            <TextInput 
              label="Serial Number" 
              value={serialNumber} 
              onChange={(e) => setSerialNumber(e.target.value.toUpperCase())}
              placeholder="Enter serial number"
            />
            
            <TextInput 
              label="Version Number" 
              value={versionNumber} 
              onChange={(e) => setVersionNumber(e.target.value.toUpperCase())}
              placeholder="Enter version number"
            />
            
            {equipmentType === 'tv' && (
              <CheckboxInput
                label="TV is Wall Mounted"
                checked={isWallMounted}
                onChange={(e) => setIsWallMounted(e.target.checked)}
              />
            )}
            
            <div className="pt-2">
              {!structuralReadOnly && (
              <Button 
                onClick={saveEquipmentDetails} 
                disabled={loading}
                color="blue"
                className="w-full"
              >
                {loading ? 'Saving...' : 'Save Equipment Details'}
              </Button>
              )}
              
              {error && (
                <div className="mt-2 text-red-600 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}
              
              {successMessage && (
                <div className="mt-2 text-green-600 dark:text-green-400 text-sm">
                  {successMessage}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Equipment Notes</h3>
            <div>
              <textarea
                value={equipmentNotes}
                onChange={(e) => setEquipmentNotes(e.target.value)}
                className="w-full h-28 p-3 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="Enter notes about the equipment here..."
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Notes are saved when you click 'Save Equipment Details'
              </p>
            </div>
          </div>
        </div>
        
        <div className="md:col-span-2">
          {/* Parts Lookup Links */}
          {partsSettings.lookupEnabled && (
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Parts Lookup</h3>
            <div className="flex flex-wrap gap-4">
              {!equipmentType ? (
                <div className="text-gray-500 dark:text-gray-400">
                  Please select an equipment type to see parts lookup options
                </div>
              ) : lookupProviders.length === 0 ? (
                <div className="text-gray-500 dark:text-gray-400">
                  No lookup providers configured for this equipment type.
                </div>
              ) : (
                lookupProviders.map(renderLookupLink)
              )}
            </div>
          </div>
          )}

          {/* Parts Management */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Parts List</h3>
              
              {!structuralReadOnly && !showPartForm && (
                <Button 
                  onClick={() => setShowPartForm(true)} 
                  color="green" 
                  size="sm"
                >
                  Add Part
                </Button>
              )}
            </div>
            
            {showPartForm && (
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-md mb-4">
                <h4 className="text-md font-medium mb-3">
                  {editingPartIndex !== null ? 'Edit Part' : 'Add New Part'}
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <TextInput 
                    label="Part Number" 
                    value={currentPart.number} 
                    onChange={(e) => handlePartChange('number', e.target.value.toUpperCase())}
                    placeholder="Enter part number"
                  />
                  
                  <TextInput 
                    label="Description" 
                    value={currentPart.description} 
                    onChange={(e) => handlePartChange('description', e.target.value)}
                    placeholder="Enter description"
                  />
                  
                  <TextInput 
                    label="Cost" 
                    value={currentPart.cost} 
                    onChange={(e) => handlePartChange('cost', e.target.value)}
                    type="number"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                  
                  <TextInput 
                    label="Price" 
                    value={currentPart.price} 
                    onChange={(e) => handlePartChange('price', e.target.value)}
                    type="number"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                  
                  <SelectInput 
                    label="Status" 
                    value={currentPart.status} 
                    onChange={(e) => handlePartChange('status', e.target.value)}
                    options={PART_STATUSES.map(status => ({ value: status.value, label: status.label }))}
                  />

                  <SelectInput
                    label="Part source"
                    value={normalizePartSource(currentPart.part_source)}
                    onChange={(e) => handlePartChange('part_source', e.target.value)}
                    options={PART_SOURCE_OPTIONS}
                  />
                  
                  <SelectInput 
                    label="Vendor" 
                    value={currentPart.vendor} 
                    onChange={(e) => handlePartChange('vendor', e.target.value)}
                    options={vendorSelectOptions}
                  />
                  
                  <TextInput 
                    label="Tracking Number" 
                    value={currentPart.tracking_number} 
                    onChange={(e) => handlePartChange('tracking_number', e.target.value.toUpperCase())}
                    placeholder="Enter tracking number"
                  />

                  <TextInput
                    label="Custom warranty (days)"
                    value={currentPart.warranty_days_override}
                    onChange={(e) => handlePartChange('warranty_days_override', e.target.value)}
                    type="number"
                    min="0"
                    step="1"
                    placeholder={`Default: ${partsSettings.oemWarrantyDays ?? 365} OEM / ${partsSettings.aftermarketWarrantyDays ?? 0} AM`}
                  />
                </div>

                {isValidPartSource(normalizePartSource(currentPart.part_source)) && (
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Parts warranty: {formatPartWarrantySummary({
                      ...currentPart,
                      part_source: normalizePartSource(currentPart.part_source),
                      warranty_days_override: currentPart.warranty_days_override === ''
                        ? null
                        : currentPart.warranty_days_override,
                    }, warrantyDefaults)}
                    {!currentPart.warranty_days_override && normalizePartSource(currentPart.part_source) === 'oem' && ' (1 year default)'}
                    {!currentPart.warranty_days_override && normalizePartSource(currentPart.part_source) === 'aftermarket' && ' (none by default)'}
                  </p>
                )}
                
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={currentPart.notes || ''}
                    onChange={(e) => handlePartChange('notes', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Enter additional notes about this part..."
                    rows="2"
                  />
                </div>
                
                <div className="flex space-x-2 mt-4">
                  <Button onClick={addOrUpdatePart} color="blue" size="sm">
                    {editingPartIndex !== null ? 'Update Part' : 'Add Part'}
                  </Button>
                  
                  <Button onClick={resetPartForm} color="gray" size="sm">
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            
            {parts.length > 0 ? (
              <div className="bg-white dark:bg-gray-900 shadow overflow-hidden sm:rounded-md">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Part #</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Description</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Source</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Price</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Status</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
                    {parts.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">No parts added yet</td>
                      </tr>
                    ) : (
                      parts.map((part) => (
                        <tr 
                          key={part.id || part.temp_id} 
                          className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                          onClick={() => openPartModal(part)}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{part.number}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{part.description}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                            {formatPartSourceLabel(part.part_source)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">${part.price}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${PART_STATUSES.find(status => status.value === part.status)?.color || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'}`}>
                              {PART_STATUSES.find(status => status.value === part.status)?.label || 'Unknown'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium" onClick={e => e.stopPropagation()}>
                            <div className="flex space-x-2 items-center">
                              {!structuralReadOnly ? (
                                <>
                              <button 
                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditPart(parts.indexOf(part));
                                }}
                                title="Edit part"
                              >
                                <FaEdit className="h-4 w-4" />
                              </button>
                              <button 
                                className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deletePart(parts.indexOf(part));
                                }}
                                title="Delete part"
                              >
                                <FaTrash className="h-4 w-4" />
                              </button>
                              <div className="relative ml-2">
                                <select
                                  className="appearance-none w-24 text-xs bg-transparent border border-gray-300 dark:border-gray-600 rounded px-2 py-1 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  value={part.status}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    updatePartStatus(parts.indexOf(part), e.target.value);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  title="Update status"
                                >
                                  {PART_STATUSES.map(status => (
                                    <option key={status.value} value={status.value}>
                                      {status.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                                </>
                              ) : (
                                <span className="text-xs text-gray-400">Read-only</span>
                              )}
                              <button 
                                className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openPartModal(part);
                                }}
                                title="View details"
                              >
                                <FaInfoCircle className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                No parts added yet. Click "Add Part" to get started.
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Part Details Modal */}
      {showPartModal && selectedPart && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Part Details</h3>
              <button 
                onClick={closePartModal}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <FaTimes className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Part Number</p>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedPart.number}</p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</p>
                  <div className="mt-1">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${PART_STATUSES.find(status => status.value === selectedPart.status)?.color || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'}`}>
                      {PART_STATUSES.find(status => status.value === selectedPart.status)?.label || 'Unknown'}
                    </span>
                  </div>
                </div>
                
                <div className="col-span-2">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Description</p>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedPart.description}</p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Cost</p>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">${selectedPart.cost}</p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Price</p>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">${selectedPart.price}</p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Part source</p>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    {formatPartSourceLabel(selectedPart.part_source)}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Parts warranty</p>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    {formatPartWarrantySummary(selectedPart, warrantyDefaults)}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Vendor</p>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    {getVendorLabel(partsSettings, selectedPart.vendor)}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Tracking Number</p>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedPart.tracking_number || '-'}</p>
                </div>
                
                {selectedPart.notes && (
                  <div className="col-span-2">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Notes</p>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedPart.notes}</p>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button 
                  onClick={() => {
                    closePartModal();
                    startEditPart(parts.findIndex(p => p.id === selectedPart.id));
                  }} 
                  color="blue" 
                  size="sm"
                >
                  Edit Part
                </Button>
                <Button onClick={closePartModal} color="gray" size="sm">
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});