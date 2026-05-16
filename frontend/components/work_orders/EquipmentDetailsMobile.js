import Image from 'next/image';
import { FaTrash, FaEdit, FaTimes, FaChevronDown, FaChevronUp, FaPlus } from 'react-icons/fa';
import Button from '../ui/Button';
import { SelectInput, TextInput, CheckboxInput } from '../ui/FormElements';

const EQUIPMENT_TYPES = [
  { value: '', label: 'Select Equipment Type' },
  { value: 'appliance', label: 'Appliance' },
  { value: 'tv', label: 'TV' },
];

const EQUIPMENT_SUBTYPES = {
  appliance: [
    { value: '', label: 'Select Appliance Type' },
    { value: 'refrigerator', label: 'Refrigerator' },
    { value: 'dishwasher', label: 'Dishwasher' },
    { value: 'washing_machine', label: 'Washing Machine' },
    { value: 'dryer', label: 'Dryer' },
    { value: 'oven', label: 'Oven' },
    { value: 'microwave', label: 'Microwave' },
    { value: 'cooktop', label: 'Cooktop' },
    { value: 'range_hood', label: 'Range Hood' },
    { value: 'other', label: 'Other' },
  ],
  tv: [
    { value: '', label: 'Select TV Size' },
    { value: 'under_32', label: 'Under 32"' },
    { value: '32_to_43', label: '32" to 43"' },
    { value: '44_to_55', label: '44" to 55"' },
    { value: '56_to_65', label: '56" to 65"' },
    { value: '66_to_75', label: '66" to 75"' },
    { value: 'over_75', label: 'Over 75"' },
  ],
};

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
  { value: 'Other', label: 'Other' },
];

const PART_STATUSES = [
  { value: 'needed', label: 'Needed', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  { value: 'ordered', label: 'Ordered', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  { value: 'received', label: 'Received', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200' },
  { value: 'upfront_50', label: '50% Upfront', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
  { value: 'phone_payment', label: 'Phone Payment', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200' },
  { value: 'paid_not_installed', label: 'PdNI', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  { value: 'installed', label: 'Installed', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
  { value: 'not_installed', label: 'Not Installed', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
];

const PART_VENDORS = [
  { value: '', label: 'Select Vendor' },
  { value: 'Tribles', label: 'Tribles' },
  { value: 'ShopJimmy', label: 'ShopJimmy' },
  { value: 'Encompass', label: 'Encompass' },
  { value: 'Sears', label: 'Sears' },
  { value: 'Amazon', label: 'Amazon' },
  { value: 'PartsSelect', label: 'Parts Select' },
  { value: 'Other', label: 'Other' },
];

const PART_LOOKUP_LOGOS = {
  google: <Image src="/images/logos/google.png" alt="Google" width={100} height={50} className="w-24 h-12 object-contain" />,
  tribles: <Image src="/images/logos/tribles.png" alt="Tribles" width={100} height={50} className="w-24 h-12 object-contain" />,
  sears: <Image src="/images/logos/sears.png" alt="Sears Parts Direct" width={100} height={50} className="w-24 h-12 object-contain" />,
  shopjimmy: <Image src="/images/logos/shopjimmy.png" alt="ShopJimmy" width={100} height={50} className="w-24 h-12 object-contain" />,
  encompass: <Image src="/images/logos/encompass.png" alt="Encompass" width={100} height={50} className="w-24 h-12 object-contain" />,
};

function MobileAccordionSection({ id, title, summary, isOpen, onToggle, children }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left active:bg-white/[0.05]"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">{title}</p>
          {summary && !isOpen && (
            <p className="text-xs text-gray-500 truncate mt-0.5">{summary}</p>
          )}
        </div>
        {isOpen ? (
          <FaChevronUp className="h-4 w-4 text-gray-500 flex-shrink-0" />
        ) : (
          <FaChevronDown className="h-4 w-4 text-gray-500 flex-shrink-0" />
        )}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-1 border-t border-white/10 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}

export default function EquipmentDetailsMobile({
  openSection,
  toggleMobileSection,
  equipmentSummary,
  identificationSummary,
  partsSummary,
  equipmentType,
  equipmentSubtype,
  manufacturer,
  modelNumber,
  serialNumber,
  versionNumber,
  isWallMounted,
  equipmentNotes,
  loading,
  error,
  successMessage,
  parts,
  showPartForm,
  showPartModal,
  selectedPart,
  currentPart,
  editingPartIndex,
  setEquipmentSubtype,
  setManufacturer,
  setModelNumber,
  setSerialNumber,
  setVersionNumber,
  setIsWallMounted,
  setEquipmentNotes,
  setShowPartForm,
  handleEquipmentTypeChange,
  saveEquipmentDetails,
  handlePartChange,
  addOrUpdatePart,
  resetPartForm,
  startEditPart,
  deletePart,
  openPartModal,
  closePartModal,
  updatePartStatus,
  generateSearchLink,
}) {
  const saveFeedback = (
    <>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {successMessage && <p className="text-green-400 text-sm">{successMessage}</p>}
    </>
  );

  const lookupTileClass = (enabled) =>
    `flex items-center justify-center rounded-lg border p-2 h-[4.25rem] transition-colors ${
      enabled
        ? 'border-white/15 bg-white/[0.04] active:bg-white/[0.08]'
        : 'border-white/5 bg-white/[0.02] opacity-40 cursor-not-allowed'
    }`;

  const renderLookupTile = (service) => {
    const enabled = Boolean(manufacturer && modelNumber);
    return (
      <a
        key={service}
        href={generateSearchLink(service)}
        target="_blank"
        rel="noopener noreferrer"
        className={lookupTileClass(enabled)}
        onClick={(e) => {
          if (!enabled) {
            e.preventDefault();
            alert('Please fill in manufacturer and model number to use this link');
          }
        }}
      >
        <span className="scale-75 origin-center">{PART_LOOKUP_LOGOS[service]}</span>
      </a>
    );
  };

  return (
    <div className="space-y-3 pb-4 min-w-0">
      {(error || successMessage) && <div className="px-0.5">{saveFeedback}</div>}

      <MobileAccordionSection
        id="equipment"
        title="Equipment"
        summary={equipmentSummary}
        isOpen={openSection === 'equipment'}
        onToggle={toggleMobileSection}
      >
        <SelectInput
          label="Equipment Type"
          value={equipmentType}
          onChange={handleEquipmentTypeChange}
          options={EQUIPMENT_TYPES}
          required={!equipmentType}
        />
        {equipmentType && (
          <SelectInput
            label={equipmentType === 'appliance' ? 'Appliance Type' : 'TV Size'}
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
      </MobileAccordionSection>

      <MobileAccordionSection
        id="identification"
        title="Identification"
        summary={identificationSummary}
        isOpen={openSection === 'identification'}
        onToggle={toggleMobileSection}
      >
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
      </MobileAccordionSection>

      <MobileAccordionSection
        id="notes"
        title="Notes"
        summary={equipmentNotes ? 'Has notes' : 'No notes'}
        isOpen={openSection === 'notes'}
        onToggle={toggleMobileSection}
      >
        <textarea
          value={equipmentNotes}
          onChange={(e) => setEquipmentNotes(e.target.value)}
          className="w-full h-28 p-3 border border-white/15 rounded-lg bg-[#0B1120] text-white text-sm"
          placeholder="Equipment notes…"
        />
        <Button onClick={saveEquipmentDetails} disabled={loading} color="blue" className="w-full h-9">
          {loading ? 'Saving…' : 'Save equipment'}
        </Button>
        {saveFeedback}
      </MobileAccordionSection>

      <MobileAccordionSection
        id="parts"
        title="Parts"
        summary={partsSummary}
        isOpen={openSection === 'parts'}
        onToggle={toggleMobileSection}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Parts lookup</p>
          {!equipmentType ? (
            <p className="text-sm text-gray-500">Select an equipment type to see lookup links.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {equipmentType === 'appliance' ? (
                <>
                  {renderLookupTile('google')}
                  {renderLookupTile('tribles')}
                  {renderLookupTile('sears')}
                </>
              ) : (
                <>
                  {renderLookupTile('google')}
                  {renderLookupTile('shopjimmy')}
                  {renderLookupTile('encompass')}
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Parts list</p>
          {!showPartForm && (
            <button
              type="button"
              onClick={() => setShowPartForm(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/35 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-cyan-300"
            >
              <FaPlus className="h-3 w-3" />
              Add
            </button>
          )}
        </div>

        {showPartForm && (
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 space-y-3">
            <h4 className="text-sm font-semibold text-white">
              {editingPartIndex !== null ? 'Edit part' : 'Add part'}
            </h4>
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
            <div className="grid grid-cols-2 gap-3">
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
            </div>
            <SelectInput
              label="Status"
              value={currentPart.status}
              onChange={(e) => handlePartChange('status', e.target.value)}
              options={PART_STATUSES.map((status) => ({ value: status.value, label: status.label }))}
            />
            <SelectInput
              label="Vendor"
              value={currentPart.vendor}
              onChange={(e) => handlePartChange('vendor', e.target.value)}
              options={PART_VENDORS}
            />
            <TextInput
              label="Tracking Number"
              value={currentPart.tracking_number}
              onChange={(e) => handlePartChange('tracking_number', e.target.value.toUpperCase())}
              placeholder="Enter tracking number"
            />
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Notes</label>
              <textarea
                value={currentPart.notes || ''}
                onChange={(e) => handlePartChange('notes', e.target.value)}
                className="w-full p-2 border border-white/15 rounded-lg bg-[#0B1120] text-white text-sm"
                placeholder="Part notes…"
                rows={2}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={addOrUpdatePart} color="blue" size="sm" className="flex-1">
                {editingPartIndex !== null ? 'Update' : 'Add'}
              </Button>
              <Button onClick={resetPartForm} color="gray" size="sm">
                Cancel
              </Button>
            </div>
          </div>
        )}

        {parts.length > 0 ? (
          <div className="space-y-2">
            {parts.map((part, index) => {
              const statusMeta = PART_STATUSES.find((s) => s.value === part.status);
              return (
                <div
                  key={part.id || part.temp_id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openPartModal(part)}
                  onKeyDown={(e) => e.key === 'Enter' && openPartModal(part)}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left w-full active:bg-white/[0.06]"
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-sm font-semibold text-white truncate">{part.number}</span>
                    <span
                      className={`shrink-0 px-2 py-0.5 text-[10px] font-semibold rounded-full ${statusMeta?.color || 'bg-gray-700 text-gray-200'}`}
                    >
                      {statusMeta?.label || 'Unknown'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">{part.description}</p>
                  <div className="flex items-center justify-between mt-2 gap-2">
                    <span className="text-sm font-medium text-cyan-300">${part.price}</span>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="text-blue-400 p-1" onClick={() => startEditPart(index)} title="Edit">
                        <FaEdit className="h-4 w-4" />
                      </button>
                      <button type="button" className="text-red-400 p-1" onClick={() => deletePart(index)} title="Delete">
                        <FaTrash className="h-4 w-4" />
                      </button>
                      <select
                        className="text-[10px] bg-[#0B1120] border border-white/15 rounded px-1.5 py-1 text-gray-300 max-w-[5.5rem]"
                        value={part.status}
                        onChange={(e) => updatePartStatus(index, e.target.value)}
                        title="Status"
                      >
                        {PART_STATUSES.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          !showPartForm && <p className="text-sm text-gray-500 text-center py-4">No parts yet.</p>
        )}
      </MobileAccordionSection>

      {showPartModal && selectedPart && (
        <div className="fixed inset-0 z-[1192] flex flex-col justify-end">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/60" onClick={closePartModal} />
          <div
            className="relative max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-white/10 bg-[#0f172a] px-4 py-4"
            style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-semibold text-white">Part details</h3>
              <button type="button" onClick={closePartModal} className="text-gray-400 p-2">
                <FaTimes className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-gray-500 text-xs">Part #</p>
                  <p className="text-white font-medium">{selectedPart.number}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Status</p>
                  <span
                    className={`inline-block mt-1 px-2 py-0.5 text-xs font-semibold rounded-full ${PART_STATUSES.find((s) => s.value === selectedPart.status)?.color}`}
                  >
                    {PART_STATUSES.find((s) => s.value === selectedPart.status)?.label}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Description</p>
                <p className="text-white">{selectedPart.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-gray-500 text-xs">Cost</p>
                  <p className="text-white">${selectedPart.cost}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Price</p>
                  <p className="text-white">${selectedPart.price}</p>
                </div>
              </div>
              {selectedPart.notes && (
                <div>
                  <p className="text-gray-500 text-xs">Notes</p>
                  <p className="text-white">{selectedPart.notes}</p>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                onClick={() => {
                  closePartModal();
                  startEditPart(parts.findIndex((p) => p.id === selectedPart.id));
                }}
                color="blue"
                size="sm"
                className="flex-1"
              >
                Edit
              </Button>
              <Button onClick={closePartModal} color="gray" size="sm">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
