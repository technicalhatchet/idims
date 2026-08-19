import { useState } from 'react';
import Head from 'next/head';
import { FaBoxes, FaPlus, FaMinus, FaExclamationTriangle } from 'react-icons/fa';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorAlert from '../../components/ui/ErrorAlert';
import Pagination from '../../components/ui/Pagination';
import {
  useInventoryCategories,
  useInventoryItems,
  useLowStockItems,
  useCreateInventoryItem,
  useAdjustInventoryStock,
} from '../../services/api/inventoryApi';

function StockBadge({ item }) {
  if (item.is_low_stock) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded">
        <FaExclamationTriangle className="w-3 h-3" />
        Low
      </span>
    );
  }
  return (
    <span className="text-xs font-medium text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded">
      OK
    </span>
  );
}

function AddItemModal({ open, onClose, categories, onCreate }) {
  const [form, setForm] = useState({
    name: '',
    sku: '',
    location: '',
    quantity_in_stock: 0,
    reorder_threshold: 5,
    cost_price: 0,
    unit_price: 0,
    category_id: '',
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onCreate({
        name: form.name.trim(),
        sku: form.sku.trim() || undefined,
        location: form.location.trim() || undefined,
        quantity_in_stock: Number(form.quantity_in_stock) || 0,
        reorder_threshold: Number(form.reorder_threshold) || 0,
        cost_price: Number(form.cost_price) || 0,
        unit_price: Number(form.unit_price) || 0,
        category_id: form.category_id || undefined,
      });
      onClose();
      setForm({
        name: '',
        sku: '',
        location: '',
        quantity_in_stock: 0,
        reorder_threshold: 5,
        cost_price: 0,
        unit_price: 0,
        category_id: '',
      });
    } catch (err) {
      setError(err.message || 'Failed to add item');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-lg rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl p-6">
        <h2 className="text-lg font-bold mb-4">Add inventory item</h2>
        {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
        <form onSubmit={submit} className="space-y-3">
          <input
            required
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border rounded px-3 py-2 dark:bg-gray-800 dark:border-gray-600"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="SKU / part #"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              className="border rounded px-3 py-2 dark:bg-gray-800 dark:border-gray-600"
            />
            <input
              placeholder="Bin / location"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="border rounded px-3 py-2 dark:bg-gray-800 dark:border-gray-600"
            />
          </div>
          <select
            value={form.category_id}
            onChange={(e) => setForm({ ...form, category_id: e.target.value })}
            className="w-full border rounded px-3 py-2 dark:bg-gray-800 dark:border-gray-600"
          >
            <option value="">No category</option>
            {(categories || []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              min="0"
              placeholder="Qty on hand"
              value={form.quantity_in_stock}
              onChange={(e) => setForm({ ...form, quantity_in_stock: e.target.value })}
              className="border rounded px-3 py-2 dark:bg-gray-800 dark:border-gray-600"
            />
            <input
              type="number"
              min="0"
              placeholder="Reorder at"
              value={form.reorder_threshold}
              onChange={(e) => setForm({ ...form, reorder_threshold: e.target.value })}
              className="border rounded px-3 py-2 dark:bg-gray-800 dark:border-gray-600"
            />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded border dark:border-gray-600">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm rounded bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Add item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function InventoryPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const limit = 25;

  const { data: categories } = useInventoryCategories();
  const { data, isLoading, error, refetch } = useInventoryItems({
    page,
    limit,
    search: search.trim() || undefined,
    low_stock_only: lowStockOnly,
  });
  const { data: lowStock } = useLowStockItems();
  const createItem = useCreateInventoryItem();
  const adjustStock = useAdjustInventoryStock();

  const items = data?.items || [];
  const totalPages = Math.max(1, Math.ceil((data?.total || 0) / limit));

  const handleAdjust = async (item, delta) => {
    try {
      await adjustStock.mutateAsync({
        id: item.id,
        quantity_delta: delta,
        notes: delta > 0 ? 'Manual add' : 'Manual remove',
        reference_type: 'adjustment',
      });
    } catch (err) {
      alert(err.message || 'Stock adjustment failed');
    }
  };

  return (
    <>
      <Head>
        <title>Shop Inventory | IDIMS</title>
      </Head>
      <div className="px-4 py-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FaBoxes className="text-cyan-600" />
              Shop Inventory
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Van and shop stock — qty on hand, bin location, reorder alerts.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-500"
          >
            <FaPlus className="w-4 h-4" />
            Add item
          </button>
        </div>

        {lowStock?.length > 0 && (
          <div className="mb-4 p-4 rounded-lg border border-amber-300/40 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700/40">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              {lowStock.length} item{lowStock.length === 1 ? '' : 's'} at or below reorder level
            </p>
            <p className="text-xs text-amber-700/80 dark:text-amber-300/80 mt-1">
              {lowStock.slice(0, 5).map((i) => i.name).join(' · ')}
              {lowStock.length > 5 ? ' …' : ''}
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-4">
          <input
            type="search"
            placeholder="Search name, SKU, location…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="border rounded px-3 py-2 text-sm min-w-[200px] dark:bg-gray-800 dark:border-gray-600"
          />
          <label className="inline-flex items-center gap-2 text-sm px-3 py-2 border rounded dark:border-gray-600">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => {
                setLowStockOnly(e.target.checked);
                setPage(1);
              }}
            />
            Low stock only
          </label>
        </div>

        {isLoading ? (
          <LoadingSpinner />
        ) : error ? (
          <ErrorAlert message={error.message} onRetry={refetch} />
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <FaBoxes className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No inventory items yet. Add your first part or consumable.</p>
          </div>
        ) : (
          <div className="overflow-x-auto border rounded-lg dark:border-gray-700">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/80 text-left">
                <tr>
                  <th className="px-4 py-3 font-semibold">Item</th>
                  <th className="px-4 py-3 font-semibold">SKU</th>
                  <th className="px-4 py-3 font-semibold">Location</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold text-center">On hand</th>
                  <th className="px-4 py-3 font-semibold text-center">Reorder</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Adjust</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-700">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                    <td className="px-4 py-3 font-medium">{item.name}</td>
                    <td className="px-4 py-3 text-gray-500">{item.sku || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{item.location || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{item.category_name || '—'}</td>
                    <td className="px-4 py-3 text-center font-mono">{item.quantity_in_stock}</td>
                    <td className="px-4 py-3 text-center text-gray-500">{item.reorder_threshold}</td>
                    <td className="px-4 py-3"><StockBadge item={item} /></td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          type="button"
                          title="Remove 1"
                          onClick={() => handleAdjust(item, -1)}
                          className="p-2 rounded border dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          <FaMinus className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          title="Add 1"
                          onClick={() => handleAdjust(item, 1)}
                          className="p-2 rounded border dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          <FaPlus className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-4">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </div>

      <AddItemModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        categories={categories}
        onCreate={(payload) => createItem.mutateAsync(payload)}
      />
    </>
  );
}

InventoryPage.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};
