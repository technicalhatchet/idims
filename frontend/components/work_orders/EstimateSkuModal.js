import { useCallback, useEffect, useMemo, useState } from 'react';
import Select, { components } from 'react-select';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import LoadingSpinner from '../ui/LoadingSpinner';
import { getServices } from '../../services/api/servicesApi';
import { addWorkOrderEstimateLines } from '../../services/api/workOrdersApi';
import { serviceIdsMatch } from '../../utils/visitSku';
import { suggestRepairSkuForWorkOrder } from '../../utils/suggestRepairSku';

function formatSkuPickerOption(service) {
  return {
    value: service.id,
    label: `${service.name}${service.sku_code ? ` (${service.sku_code})` : ''} — ${service.duration_minutes || 0} min — $${Number(service.base_price || 0).toFixed(2)}`,
  };
}

const selectStyles = {
  control: (base, state) => ({
    ...base,
    backgroundColor: 'var(--color-bg-input, #1f2937)',
    borderColor: state.isFocused ? 'var(--color-ring-focus, #3b82f6)' : 'var(--color-border-input, #4b5563)',
    boxShadow: state.isFocused ? '0 0 0 1px var(--color-ring-focus, #3b82f6)' : 'none',
    '&:hover': {
      borderColor: 'var(--color-border-input-hover, #6b7280)',
    },
    borderRadius: '0.375rem',
    minHeight: '38px',
  }),
  menu: (base) => ({
    ...base,
    backgroundColor: 'var(--color-bg-menu, #1f2937)',
    zIndex: 20,
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 10050,
  }),
  menuList: (base) => ({
    ...base,
    maxHeight: 'min(52vh, 320px)',
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? 'var(--color-bg-option-selected, #3b82f6)'
      : state.isFocused
        ? 'var(--color-bg-option-focused, #374151)'
        : 'transparent',
    color: state.isSelected ? 'white' : 'var(--color-text-default, #d1d5db)',
    '&:hover': {
      backgroundColor: 'var(--color-bg-option-hover, #374151)',
    },
  }),
  placeholder: (base) => ({
    ...base,
    color: 'var(--color-text-placeholder, #9ca3af)',
  }),
  input: (base) => ({
    ...base,
    color: 'var(--color-text-input, #e5e7eb)',
  }),
  indicatorsContainer: (base) => ({
    ...base,
    cursor: 'pointer',
  }),
  indicatorSeparator: () => ({
    display: 'none',
  }),
};

const fullscreenSelectStyles = {
  ...selectStyles,
  menuList: (base) => ({
    ...base,
    maxHeight: 'min(58vh, 480px)',
  }),
};

/** Open/close menu from arrow without focusing the search input (avoids mobile scroll jump). */
const skuSelectComponents = {
  DropdownIndicator: (props) => {
    const toggleMenuWithoutFocus = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const { menuIsOpen, onMenuOpen, onMenuClose } = props.selectProps;
      if (menuIsOpen) onMenuClose();
      else onMenuOpen();
    };
    return (
      <components.DropdownIndicator
        {...props}
        innerProps={{
          ...props.innerProps,
          onMouseDown: toggleMenuWithoutFocus,
          onTouchStart: toggleMenuWithoutFocus,
        }}
      />
    );
  },
};

export default function EstimateSkuModal({
  isOpen,
  onClose,
  workOrderId,
  workOrder = null,
  existingWorkOrderServices = [],
  onSuccess,
  variant = 'desktop',
}) {
  const isMobile = variant === 'mobile';
  const [catalogServices, setCatalogServices] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const existingCatalogIds = useMemo(
    () => new Set((existingWorkOrderServices || []).map((row) => String(row.service_id))),
    [existingWorkOrderServices],
  );

  const availableCatalog = useMemo(
    () => catalogServices.filter((s) => !existingCatalogIds.has(String(s.id))),
    [catalogServices, existingCatalogIds],
  );

  const serviceCategories = useMemo(() => {
    const cats = [
      ...new Set(availableCatalog.map((s) => s.service_type || 'other').filter(Boolean)),
    ];
    return cats.sort();
  }, [availableCatalog]);

  const servicesForCategory = useMemo(() => {
    if (!selectedCategory) return [];
    return availableCatalog.filter(
      (s) => (s.service_type || 'other') === selectedCategory,
    );
  }, [availableCatalog, selectedCategory]);

  const smartSuggestion = useMemo(() => {
    if (!workOrder || !catalogServices.length) return null;
    return suggestRepairSkuForWorkOrder(
      workOrder,
      availableCatalog,
      existingWorkOrderServices.map((row) => row.service_id),
    );
  }, [workOrder, catalogServices, availableCatalog, existingWorkOrderServices]);

  const applySmartSuggestion = () => {
    if (!smartSuggestion?.sku) return;
    const id = smartSuggestion.sku.id;
    setSelectedCategory('repair');
    setSelectedServiceIds((prev) =>
      prev.some((sid) => serviceIdsMatch(sid, id)) ? prev : [...prev, id],
    );
    setError(null);
  };

  const loadCatalog = useCallback(async () => {
    setLoadingCatalog(true);
    setError(null);
    try {
      const response = await getServices({ limit: 500, is_active: true });
      setCatalogServices(response.items || []);
    } catch (err) {
      setError(err.message || 'Failed to load SKUs');
      setCatalogServices([]);
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedCategory('');
    setSelectedServiceIds([]);
    setError(null);
    loadCatalog();
  }, [isOpen, loadCatalog]);

  const handleCategoryChange = (e) => {
    setSelectedCategory(e.target.value);
    setSelectedServiceIds([]);
  };

  const handleSkuChange = (selected) => {
    const ids = (selected || []).map((opt) => opt.value);
    setSelectedServiceIds(ids);
  };

  const handleSubmit = async () => {
    if (!selectedServiceIds.length) {
      setError('Select at least one SKU.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await addWorkOrderEstimateLines(workOrderId, selectedServiceIds);
      const skipped = result?.skipped || [];
      if (skipped.length && !(result?.created?.length)) {
        setError('All selected SKUs are already on this work order.');
        return;
      }
      onSuccess?.(result);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to add estimate lines');
    } finally {
      setSubmitting(false);
    }
  };

  const modalActions = (
    <div className={`flex gap-2 ${isMobile ? 'w-full' : ''}`}>
      <Button variant="secondary" onClick={onClose} disabled={submitting} className={isMobile ? 'flex-1' : ''}>
        Cancel
      </Button>
      <Button
        onClick={handleSubmit}
        disabled={submitting || !selectedServiceIds.length}
        className={isMobile ? 'flex-1' : ''}
      >
        {submitting ? 'Adding…' : 'Add to estimate'}
      </Button>
    </div>
  );

  const menuPortalTarget = typeof document !== 'undefined' ? document.body : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add estimate SKU"
      actions={modalActions}
      size="md"
      placement={isMobile ? 'fullscreen' : 'center'}
    >
      <div className="space-y-4">
        <p className={`text-sm ${isMobile ? 'text-gray-400' : 'text-gray-600 dark:text-gray-400'}`}>
          Add SKUs to this work order without scheduling a visit. They appear on estimates as unscheduled lines until attached to a visit.
        </p>

        {loadingCatalog ? (
          <div className="flex justify-center py-6">
            <LoadingSpinner size="small" />
          </div>
        ) : (
          <>
            {smartSuggestion?.sku ? (
              <div
                className={`rounded-lg border px-3 py-3 ${
                  isMobile
                    ? 'border-cyan-500/30 bg-cyan-500/10'
                    : 'border-cyan-200 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-900/20'
                }`}
              >
                <p
                  className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
                    isMobile ? 'text-cyan-300' : 'text-cyan-700 dark:text-cyan-300'
                  }`}
                >
                  Smart add
                </p>
                <p className={`text-sm ${isMobile ? 'text-gray-200' : 'text-gray-800 dark:text-gray-200'}`}>
                  {smartSuggestion.sku.name}
                  {smartSuggestion.sku.sku_code ? ` (${smartSuggestion.sku.sku_code})` : ''}
                  {' — '}
                  ${Number(smartSuggestion.sku.base_price || 0).toFixed(2)}
                </p>
                <p className={`text-xs mt-1 ${isMobile ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  {smartSuggestion.reason}
                </p>
                <button
                  type="button"
                  disabled={
                    selectedServiceIds.some((id) => serviceIdsMatch(id, smartSuggestion.sku.id))
                  }
                  onClick={applySmartSuggestion}
                  className={`mt-2 text-xs font-semibold ${
                    isMobile
                      ? 'text-cyan-300 hover:text-cyan-100 disabled:text-gray-500'
                      : 'text-cyan-700 dark:text-cyan-300 hover:text-cyan-900 dark:hover:text-cyan-100 disabled:text-gray-400'
                  }`}
                >
                  {selectedServiceIds.some((id) => serviceIdsMatch(id, smartSuggestion.sku.id))
                    ? 'Added to selection'
                    : 'Add suggested repair SKU'}
                </button>
              </div>
            ) : null}

            <div>
              <label
                htmlFor="estimate-sku-category"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Service category
              </label>
              <select
                id="estimate-sku-category"
                value={selectedCategory}
                onChange={handleCategoryChange}
                className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm sm:text-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select category…</option>
                {serviceCategories.map((category) => (
                  <option key={category} value={category}>
                    {category === 'other'
                      ? 'Other'
                      : `${category.charAt(0).toUpperCase()}${category.slice(1).toLowerCase()}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                SKUs
              </label>
              {!selectedCategory ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 py-2 px-3 border border-gray-300 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800">
                  Select a category first.
                </p>
              ) : servicesForCategory.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 py-2 px-3 border border-gray-300 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800">
                  {availableCatalog.length === 0 && catalogServices.length > 0
                    ? 'All SKUs from the catalog are already on this work order.'
                    : 'No services in this category.'}
                </p>
              ) : (
                <Select
                  isMulti
                  isSearchable
                  controlShouldRenderValue={false}
                  options={servicesForCategory.map(formatSkuPickerOption)}
                  value={servicesForCategory
                    .filter((s) => selectedServiceIds.some((id) => serviceIdsMatch(s.id, id)))
                    .map(formatSkuPickerOption)}
                  onChange={handleSkuChange}
                  placeholder="Search or pick SKUs…"
                  isDisabled={!selectedCategory || servicesForCategory.length === 0}
                  styles={isMobile ? fullscreenSelectStyles : selectStyles}
                  classNamePrefix="select"
                  components={skuSelectComponents}
                  menuPortalTarget={menuPortalTarget}
                  menuPosition="fixed"
                  menuPlacement="auto"
                  closeMenuOnScroll={false}
                  blurInputOnSelect
                />
              )}

              {selectedServiceIds.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedServiceIds.map((id) => {
                    const service = catalogServices.find((s) => serviceIdsMatch(s.id, id));
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                      >
                        {service?.name || id}
                        <button
                          type="button"
                          className="text-cyan-200/80 hover:text-white"
                          onClick={() =>
                            setSelectedServiceIds((prev) =>
                              prev.filter((sid) => !serviceIdsMatch(sid, id)),
                            )
                          }
                          aria-label="Remove"
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    </Modal>
  );
}
