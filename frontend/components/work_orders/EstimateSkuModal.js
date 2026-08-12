import { useCallback, useEffect, useMemo, useState } from 'react';
import Select from 'react-select';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import LoadingSpinner from '../ui/LoadingSpinner';
import { getServices } from '../../services/api/servicesApi';
import { addWorkOrderEstimateLines } from '../../services/api/workOrdersApi';
import { serviceIdsMatch } from '../../utils/visitSku';

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
    zIndex: 10050,
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
  indicatorSeparator: () => ({
    display: 'none',
  }),
};

export default function EstimateSkuModal({
  isOpen,
  onClose,
  workOrderId,
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
      placement="center"
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
                  controlShouldRenderValue={false}
                  options={servicesForCategory.map(formatSkuPickerOption)}
                  value={servicesForCategory
                    .filter((s) => selectedServiceIds.some((id) => serviceIdsMatch(s.id, id)))
                    .map(formatSkuPickerOption)}
                  onChange={handleSkuChange}
                  placeholder="Add SKUs from this category…"
                  isDisabled={!selectedCategory || servicesForCategory.length === 0}
                  styles={selectStyles}
                  classNamePrefix="select"
                  menuPortalTarget={menuPortalTarget}
                  menuPosition="fixed"
                  menuPlacement="auto"
                  closeMenuOnScroll={false}
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
