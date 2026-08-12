import { useCallback, useEffect, useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import LoadingSpinner from '../ui/LoadingSpinner';
import { getServices } from '../../services/api/servicesApi';
import { addWorkOrderEstimateLines } from '../../services/api/workOrdersApi';
import { serviceIdsMatch } from '../../utils/visitSku';
import { suggestRepairSkuForWorkOrder } from '../../utils/suggestRepairSku';

function formatSkuLine(service) {
  const code = service.sku_code ? ` (${service.sku_code})` : '';
  const duration = service.duration_minutes || 0;
  const price = Number(service.base_price || 0).toFixed(2);
  return `${service.name}${code} — ${duration} min — $${price}`;
}

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
  const [skuSearch, setSkuSearch] = useState('');
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

  const filteredSkus = useMemo(() => {
    const q = skuSearch.trim().toLowerCase();
    if (!q) return servicesForCategory;
    return servicesForCategory.filter((s) => {
      const haystack = `${s.name || ''} ${s.sku_code || ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [servicesForCategory, skuSearch]);

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

  const toggleSku = (id) => {
    setSelectedServiceIds((prev) =>
      prev.some((sid) => serviceIdsMatch(sid, id))
        ? prev.filter((sid) => !serviceIdsMatch(sid, id))
        : [...prev, id],
    );
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
    setSkuSearch('');
    setSelectedServiceIds([]);
    setError(null);
    loadCatalog();
  }, [isOpen, loadCatalog]);

  const handleCategoryChange = (e) => {
    setSelectedCategory(e.target.value);
    setSkuSearch('');
    setSelectedServiceIds([]);
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

  const fieldClass = isMobile
    ? 'block w-full rounded-lg border border-white/15 bg-[#0B1120] text-white px-3 py-2.5 text-sm focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30'
    : 'block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm sm:text-sm focus:ring-blue-500 focus:border-blue-500';

  const listShellClass = isMobile
    ? 'rounded-lg border border-white/15 bg-[#0B1120]'
    : 'rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/40';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add estimate SKU"
      actions={modalActions}
      size="md"
      placement="center"
      containScroll
    >
      <div className="flex flex-col gap-4 min-h-0 h-full max-h-[min(70vh,520px)]">
        <p className={`text-sm shrink-0 ${isMobile ? 'text-gray-400' : 'text-gray-600 dark:text-gray-400'}`}>
          Add SKUs without scheduling a visit. Unscheduled lines show on estimates until attached to a visit.
        </p>

        {loadingCatalog ? (
          <div className="flex justify-center py-6">
            <LoadingSpinner size="small" />
          </div>
        ) : (
          <>
            {smartSuggestion?.sku ? (
              <div
                className={`shrink-0 rounded-lg border px-3 py-3 ${
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

            <div className="shrink-0">
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
                className={fieldClass}
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

            <div className="flex flex-col min-h-0 flex-1 gap-2">
              <label
                htmlFor="estimate-sku-search"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 shrink-0"
              >
                SKUs
              </label>

              {!selectedCategory ? (
                <p className={`text-sm py-2 px-3 border rounded-md shrink-0 ${listShellClass} ${isMobile ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  Select a category first.
                </p>
              ) : servicesForCategory.length === 0 ? (
                <p className={`text-sm py-2 px-3 border rounded-md shrink-0 ${listShellClass} ${isMobile ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  {availableCatalog.length === 0 && catalogServices.length > 0
                    ? 'All SKUs from the catalog are already on this work order.'
                    : 'No services in this category.'}
                </p>
              ) : (
                <>
                  <input
                    id="estimate-sku-search"
                    type="search"
                    value={skuSearch}
                    onChange={(e) => setSkuSearch(e.target.value)}
                    placeholder="Search SKUs…"
                    className={fieldClass}
                    autoComplete="off"
                  />
                  <div
                    className={`min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y ${listShellClass}`}
                    style={{ WebkitOverflowScrolling: 'touch', maxHeight: 'min(42vh, 300px)' }}
                  >
                    {filteredSkus.length === 0 ? (
                      <p className={`text-sm px-3 py-3 ${isMobile ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'}`}>
                        No SKUs match your search.
                      </p>
                    ) : (
                      <ul className="divide-y divide-gray-200/80 dark:divide-white/10">
                        {filteredSkus.map((service) => {
                          const selected = selectedServiceIds.some((id) =>
                            serviceIdsMatch(id, service.id),
                          );
                          return (
                            <li key={service.id}>
                              <button
                                type="button"
                                onClick={() => toggleSku(service.id)}
                                className={`w-full text-left px-3 py-2.5 flex items-start gap-3 touch-manipulation active:opacity-90 ${
                                  selected
                                    ? isMobile
                                      ? 'bg-cyan-500/15'
                                      : 'bg-cyan-50 dark:bg-cyan-900/25'
                                    : isMobile
                                      ? 'hover:bg-white/5'
                                      : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                              >
                                <span
                                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                    selected
                                      ? 'border-cyan-500 bg-cyan-500 text-white'
                                      : isMobile
                                        ? 'border-white/25 bg-transparent'
                                        : 'border-gray-400 dark:border-gray-500'
                                  }`}
                                  aria-hidden
                                >
                                  {selected ? '✓' : ''}
                                </span>
                                <span
                                  className={`text-sm leading-snug ${
                                    isMobile ? 'text-gray-100' : 'text-gray-800 dark:text-gray-200'
                                  }`}
                                >
                                  {formatSkuLine(service)}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </>
              )}

              {selectedServiceIds.length > 0 && (
                <div className="shrink-0 flex flex-wrap gap-2 pt-1">
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
                          onClick={() => toggleSku(id)}
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
          <p className="text-sm text-red-600 dark:text-red-400 shrink-0">{error}</p>
        )}
      </div>
    </Modal>
  );
}
