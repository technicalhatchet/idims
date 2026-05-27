import { useEffect, useState } from 'react';
import { apiClient } from '../../utils/api-client';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'credit_card', label: 'Card (in person)' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'bank_transfer', label: 'Bank transfer / Zelle' },
  { value: 'other', label: 'Other' },
];

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export default function RecordPaymentSheet({
  open,
  onClose,
  workOrderId,
  dueToday = 0,
  suggestedTax = 0,
  onSuccess,
  variant = 'mobile',
}) {
  const [amount, setAmount] = useState('');
  const [taxAmount, setTaxAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setAmount(dueToday > 0 ? dueToday.toFixed(2) : '');
    setTaxAmount(suggestedTax > 0 ? suggestedTax.toFixed(2) : '0');
    setPaymentMethod('cash');
    setReferenceNumber('');
    setNotes('');
    setError(null);
  }, [open, dueToday, suggestedTax]);

  if (!open) return null;

  const total = parseFloat(amount) || 0;
  const tax = parseFloat(taxAmount) || 0;
  const subtotal = round2(Math.max(0, total - tax));

  const inputClass =
    variant === 'mobile'
      ? 'w-full rounded-lg border border-white/10 bg-[#0A0F1E] px-3 py-2.5 text-sm text-white'
      : 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 dark:text-white text-sm';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!total || total <= 0) {
      setError('Enter a valid payment amount.');
      return;
    }
    setIsSaving(true);
    try {
      await apiClient(`work-orders/${workOrderId}/record-payment`, {
        method: 'POST',
        body: JSON.stringify({
          amount: round2(total),
          subtotal_amount: subtotal,
          tax_amount: round2(tax),
          payment_method: paymentMethod,
          reference_number: referenceNumber.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to record payment');
    } finally {
      setIsSaving(false);
    }
  };

  const shellClass =
    variant === 'mobile'
      ? 'fixed inset-0 z-[1200] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4'
      : 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4';

  const panelClass =
    variant === 'mobile'
      ? 'w-full max-w-lg rounded-t-2xl sm:rounded-2xl border border-white/10 bg-[#0D1525] p-4 pb-6 max-h-[90vh] overflow-y-auto'
      : 'w-full max-w-md rounded-lg bg-white dark:bg-gray-800 p-6 shadow-xl';

  return (
    <div className={shellClass} onClick={onClose}>
      <div className={panelClass} onClick={(e) => e.stopPropagation()}>
        <h3 className={`text-lg font-semibold mb-1 ${variant === 'mobile' ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
          Record Payment
        </h3>
        <p className={`text-sm mb-4 ${variant === 'mobile' ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'}`}>
          Cash, check, or other non-Stripe payment. Marks billable services paid and completes any appointments pending payment.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Total received</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inputClass}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Tax portion</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={taxAmount}
                onChange={(e) => setTaxAmount(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Subtotal</label>
              <div className={`${inputClass} opacity-80`}>${subtotal.toFixed(2)}</div>
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Payment method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className={inputClass}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Reference # (optional)</label>
            <input
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="Check number, last 4, etc."
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={inputClass}
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 rounded-xl border border-white/15 text-sm font-medium text-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 h-11 rounded-xl bg-gradient-to-br from-amber-600 to-amber-700 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isSaving ? 'Saving…' : 'Record payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export { PAYMENT_METHODS };
