import { useEffect, useState } from 'react';
import {
  createWorkOrderExpense,
  deleteWorkOrderExpense,
  getDriveStorageStatus,
  getExpenseCategories,
  getExpenseVendors,
  getWorkOrderExpenses,
  getWorkOrderReceipts,
  openReceiptDownload,
  uploadWorkOrderReceipt,
} from '../../services/api/jobEconomicsApi';

const fmt = (n) => `$${Number(n || 0).toFixed(2)}`;

export default function WorkOrderExpensesPanel({ workOrderId, variant = 'mobile' }) {
  const isMobile = variant === 'mobile';
  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [driveStatus, setDriveStatus] = useState(null);
  const [form, setForm] = useState({
    category: 'misc',
    amount: '',
    vendor_id: '',
    vendor_name: '',
    description: '',
  });

  const load = async () => {
    if (!workOrderId) return;
    setLoading(true);
    setError(null);
    try {
      const [cat, ven, exp, rec] = await Promise.all([
        getExpenseCategories(),
        getExpenseVendors(),
        getWorkOrderExpenses(workOrderId),
        getWorkOrderReceipts(workOrderId),
      ]);
      setCategories(cat?.items || []);
      setVendors(ven?.items || []);
      setExpenses(exp?.items || []);
      setReceipts(rec?.items || []);
    } catch (err) {
      setError(err.message || 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    getDriveStorageStatus()
      .then(setDriveStatus)
      .catch(() => setDriveStatus(null));
  }, [workOrderId]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) return;
    setSaving(true);
    setError(null);
    try {
      await createWorkOrderExpense(workOrderId, {
        category: form.category,
        amount: Number(form.amount),
        vendor_id: form.vendor_id || undefined,
        vendor_name: form.vendor_name || undefined,
        description: form.description || undefined,
      });
      setForm((prev) => ({ ...prev, amount: '', description: '' }));
      await load();
    } catch (err) {
      setError(err.message || 'Failed to save expense');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (expenseId) => {
    if (!window.confirm('Delete this expense?')) return;
    try {
      await deleteWorkOrderExpense(expenseId);
      await load();
    } catch (err) {
      setError(err.message || 'Failed to delete');
    }
  };

  const handleOpenReceipt = async (receipt) => {
    if (receipt.drive_web_view_link) {
      window.open(receipt.drive_web_view_link, '_blank', 'noopener,noreferrer');
      return;
    }
    setError(null);
    try {
      await openReceiptDownload(receipt.id);
    } catch (err) {
      setError(err.message || 'Could not open receipt');
    }
  };

  const handleReceipt = async (e, expenseId, category, vendorName) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await uploadWorkOrderReceipt(workOrderId, file, { expenseId, category, vendorName });
      e.target.value = '';
      if (result?.storage_backend === 'drive') {
        setNotice('Receipt saved to Google Drive.');
      } else {
        setNotice(
          driveStatus?.message
            || 'Receipt saved on server only — not in Google Drive. Managers: check Drive status below.'
        );
      }
      await load();
    } catch (err) {
      setError(err.message || 'Receipt upload failed');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = isMobile
    ? 'w-full rounded-lg border border-cyan-500/20 bg-black/30 px-3 py-2 text-sm text-white'
    : 'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm';

  if (loading) {
    return <p className={`text-sm ${isMobile ? 'text-gray-400' : 'text-gray-500'}`}>Loading expenses…</p>;
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-400">{error}</p>}
      {notice && <p className="text-sm text-amber-300">{notice}</p>}
      {driveStatus && !driveStatus.ready && (
        <p className={`text-xs rounded-lg px-3 py-2 ${isMobile ? 'bg-amber-950/40 text-amber-200/90 border border-amber-500/20' : 'bg-amber-50 text-amber-900 border border-amber-200'}`}>
          <span className="font-medium">Google Drive: </span>
          {driveStatus.message}
        </p>
      )}

      <form onSubmit={handleAdd} className={`rounded-xl p-4 space-y-3 ${isMobile ? 'border border-cyan-500/20 bg-[#0D1525]' : 'border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900'}`}>
        <h3 className={`text-sm font-semibold ${isMobile ? 'text-cyan-300' : 'text-gray-900 dark:text-white'}`}>Add expense</h3>
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs text-gray-500 mb-1">Category</label>
            <select className={inputClass} value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs text-gray-500 mb-1">Amount</label>
            <input type="number" step="0.01" min="0" className={inputClass} value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} placeholder="0.00" required />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs text-gray-500 mb-1">Vendor</label>
            <select className={inputClass} value={form.vendor_id} onChange={(e) => setForm((p) => ({ ...p, vendor_id: e.target.value }))}>
              <option value="">— Optional —</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs text-gray-500 mb-1">Note</label>
            <input type="text" className={inputClass} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Parking meter, toll…" />
          </div>
        </div>
        <button type="submit" disabled={saving} className={`w-full py-2 rounded-lg text-sm font-medium ${isMobile ? 'bg-cyan-600 text-white' : 'bg-blue-600 text-white'} disabled:opacity-50`}>
          {saving ? 'Saving…' : 'Add expense'}
        </button>
      </form>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className={`text-sm font-semibold ${isMobile ? 'text-gray-300' : 'text-gray-900 dark:text-white'}`}>Job expenses</h3>
          <label className={`text-xs cursor-pointer ${isMobile ? 'text-cyan-400' : 'text-blue-600'}`}>
            + Receipt
            <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => handleReceipt(e, null, form.category, 'receipt')} />
          </label>
        </div>
        {expenses.length === 0 ? (
          <p className="text-xs text-gray-500">No expenses yet. Parts cost is tracked on the Parts tab.</p>
        ) : (
          <ul className="space-y-2">
            {expenses.map((exp) => (
              <li key={exp.id} className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${isMobile ? 'bg-black/20 border border-white/5' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'}`}>
                <div className="min-w-0">
                  <p className={`font-medium capitalize ${isMobile ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                    {exp.category.replace(/_/g, ' ')} · {fmt(exp.amount)}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {[exp.vendor?.name || exp.vendor_name, exp.description].filter(Boolean).join(' — ')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <label className="text-xs text-cyan-400 cursor-pointer">
                    📷
                    <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => handleReceipt(e, exp.id, exp.category, exp.vendor?.name || exp.vendor_name || 'vendor')} />
                  </label>
                  <button type="button" onClick={() => handleDelete(exp.id)} className="text-xs text-red-400">Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {receipts.length > 0 && (
        <div>
          <h3 className={`text-sm font-semibold mb-2 ${isMobile ? 'text-gray-300' : 'text-gray-900 dark:text-white'}`}>Receipts</h3>
          <p className="text-[10px] text-gray-500 mb-2">
            Attachments only — add an expense amount above for this to affect job economics / monthly report.
          </p>
          <ul className="space-y-1">
            {receipts.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => handleOpenReceipt(r)}
                  className="text-xs text-cyan-400 hover:underline text-left"
                >
                  {r.filename}
                  <span className="text-gray-500">
                    {r.storage_backend === 'drive' ? ' · Drive' : ' · server only'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export { fmt as formatMoney };
