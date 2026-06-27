import { useEffect, useState } from 'react';
import { FaEnvelope, FaFilePdf } from 'react-icons/fa';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { useTheme } from '../../context/ThemeContext';
import { emailWorkOrderDocument, openWorkOrderPdf, DOCUMENT_LINE_PRESETS } from '../../utils/workOrderPdf';

const DOC_TYPES = [
  { id: 'invoice', label: 'Invoice' },
  { id: 'estimate', label: 'Estimate' },
];

function CheckboxRow({ checked, onChange, label, description, variant = 'mobile' }) {
  const isMobile = variant === 'mobile';
  return (
    <label
      className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer ${
        isMobile
          ? 'border-white/10 bg-white/[0.03]'
          : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/40'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={`mt-0.5 h-4 w-4 rounded focus:ring-cyan-500/40 ${
          isMobile
            ? 'border-white/20 bg-[#0A0F1E] text-cyan-500'
            : 'border-gray-300 dark:border-gray-500 text-cyan-600'
        }`}
      />
      <span className="min-w-0">
        <span
          className={`block text-sm font-medium ${
            isMobile ? 'text-white' : 'text-gray-900 dark:text-white'
          }`}
        >
          {label}
        </span>
        {description ? (
          <span
            className={`block text-xs mt-0.5 ${
              isMobile ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}

function SegmentButton({ active, onClick, children, variant = 'mobile', accent = 'cyan' }) {
  const isMobile = variant === 'mobile';
  const activeClasses =
    accent === 'violet'
      ? isMobile
        ? 'border-violet-500/50 bg-violet-500/10 text-violet-200'
        : 'border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-200'
      : isMobile
        ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-200'
        : 'border-cyan-500 bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-200';
  const idleClasses = isMobile
    ? 'border-white/10 bg-white/[0.03] text-gray-300 hover:border-white/20'
    : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${
        active ? activeClasses : idleClasses
      }`}
    >
      {children}
    </button>
  );
}

export default function WorkOrderDocumentPdfSheet({
  open,
  onClose,
  workOrderId,
  orderNumber,
  clientEmail = '',
  hasPayments = false,
  isPaidInFull = false,
  variant = 'mobile',
}) {
  const isMobile = variant === 'mobile';
  const { theme } = useTheme();
  const [docType, setDocType] = useState('invoice');
  const [linePreset, setLinePreset] = useState('full');
  const [pdfVariant, setPdfVariant] = useState('light');
  const [showPayments, setShowPayments] = useState(true);
  const [showPaymentMessage, setShowPaymentMessage] = useState(true);
  const [showTechnician, setShowTechnician] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEmailing, setIsEmailing] = useState(false);
  const [error, setError] = useState(null);
  const [emailStatus, setEmailStatus] = useState(null);

  const pdfOptions = () => ({
    docType,
    linePreset: docType === 'invoice' ? 'full' : linePreset,
    variant: pdfVariant,
    showPayments,
    showPaymentMessage,
    showTechnician,
  });

  useEffect(() => {
    if (!open) return;
    setDocType('invoice');
    setLinePreset('full');
    setPdfVariant(theme?.mode === 'dark' ? 'dark' : 'light');
    setShowPayments(hasPayments);
    setShowPaymentMessage(true);
    setShowTechnician(true);
    setError(null);
    setEmailStatus(null);
  }, [open, theme?.mode, hasPayments]);

  if (!open) return null;

  const headerPreview = isPaidInFull ? 'PAID IN FULL' : 'DUE ON RECEIPT';
  const isBusy = isGenerating || isEmailing;
  const emailTarget = clientEmail || 'the client on file';

  const handleGenerate = async () => {
    setError(null);
    setEmailStatus(null);
    setIsGenerating(true);
    try {
      const opts = pdfOptions();
      await openWorkOrderPdf(workOrderId, orderNumber, `${opts.docType}-v2.pdf`, {
        variant: opts.variant,
        line_preset: opts.linePreset,
        show_payments: String(opts.showPayments),
        show_payment_message: String(opts.showPaymentMessage),
        show_technician: String(opts.showTechnician),
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to generate PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEmail = async () => {
    setError(null);
    setEmailStatus(null);
    setIsEmailing(true);
    try {
      const result = await emailWorkOrderDocument(workOrderId, pdfOptions());
      setEmailStatus({ ok: true, message: result.message || `Emailed to ${result.email || emailTarget}` });
    } catch (err) {
      setError(err.message || 'Failed to send email');
    } finally {
      setIsEmailing(false);
    }
  };

  const sectionLabelClass = isMobile
    ? 'text-xs uppercase tracking-wide text-gray-400 mb-2'
    : 'text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2';

  const body = (
    <div className="space-y-4">
      <p className={`text-sm ${isMobile ? 'text-gray-400' : 'text-gray-600 dark:text-gray-400'}`}>
        Header shows{' '}
        <span className={isMobile ? 'text-cyan-300 font-medium' : 'text-cyan-600 dark:text-cyan-400 font-medium'}>
          {headerPreview}
        </span>{' '}
        based on current balance.
      </p>

      <div>
        <p className={sectionLabelClass}>Document</p>
        <div className="grid grid-cols-2 gap-2">
              {DOC_TYPES.map((type) => (
                <SegmentButton
                  key={type.id}
                  active={docType === type.id}
                  onClick={() => {
                    setDocType(type.id);
                    if (type.id === 'invoice') setLinePreset('full');
                  }}
                  variant={variant}
                >
                  {type.label}
                </SegmentButton>
              ))}
            </div>
          </div>

          {docType === 'estimate' ? (
            <div>
              <p className={sectionLabelClass}>Line items</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {DOCUMENT_LINE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setLinePreset(preset.id)}
                    className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      linePreset === preset.id
                        ? isMobile
                          ? 'border-orange-500/50 bg-orange-500/10'
                          : 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                        : isMobile
                          ? 'border-white/10 bg-white/[0.03] hover:border-white/20'
                          : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <span
                      className={`block text-sm font-semibold ${
                        linePreset === preset.id
                          ? isMobile
                            ? 'text-orange-200'
                            : 'text-orange-700 dark:text-orange-200'
                          : isMobile
                            ? 'text-gray-200'
                            : 'text-gray-900 dark:text-white'
                      }`}
                    >
                      {preset.label}
                    </span>
                    <span
                      className={`block text-xs mt-1 ${
                        isMobile ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {preset.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className={`text-sm ${isMobile ? 'text-gray-400' : 'text-gray-600 dark:text-gray-400'}`}>
              Invoices always include all billable services and parts.
            </p>
          )}

          <div>
        <p className={sectionLabelClass}>Theme</p>
        <div className="grid grid-cols-2 gap-2">
          {['light', 'dark'].map((v) => (
            <SegmentButton
              key={v}
              active={pdfVariant === v}
              onClick={() => setPdfVariant(v)}
              variant={variant}
              accent="violet"
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </SegmentButton>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className={`${sectionLabelClass} mb-1`}>Include on PDF</p>
        <CheckboxRow
          checked={showTechnician}
          onChange={setShowTechnician}
          label="Technician"
          description="Name, phone, and email between Bill To and Equipment"
          variant={variant}
        />
        <CheckboxRow
          checked={showPayments}
          onChange={setShowPayments}
          label="Payment ledger"
          description="List of recorded payments (when any exist)"
          variant={variant}
        />
        <CheckboxRow
          checked={showPaymentMessage}
          onChange={setShowPaymentMessage}
          label="Payment message"
          description={
            docType === 'invoice'
              ? 'Footer panel with payment terms and instructions'
              : 'Footer panel with estimate validity terms'
          }
          variant={variant}
        />
      </div>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-3 py-2">
          {error}
        </p>
      ) : null}

      {emailStatus?.ok ? (
        <p className="text-sm text-green-700 dark:text-green-400 rounded-lg border border-green-200 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10 px-3 py-2">
          {emailStatus.message}
        </p>
      ) : null}

      <p className={`text-xs ${isMobile ? 'text-gray-500' : 'text-gray-500 dark:text-gray-400'}`}>
        Email sends to {clientEmail || 'the client email on file'} with your selected options.
      </p>
    </div>
  );

  const footer = isMobile ? (
    <div className="flex gap-2 pt-1">
      <button
        type="button"
        onClick={onClose}
        disabled={isBusy}
        className="rounded-lg border border-white/15 px-4 py-2.5 text-sm font-semibold text-gray-300 hover:bg-white/5 disabled:opacity-60"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={handleEmail}
        disabled={isBusy}
        title={`Email PDF to ${emailTarget}`}
        className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-gray-200 hover:bg-white/[0.08] disabled:opacity-60"
      >
        <FaEnvelope />
        {isEmailing ? 'Sending…' : 'Email'}
      </button>
      <button
        type="button"
        onClick={handleGenerate}
        disabled={isBusy}
        className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-60"
      >
        <FaFilePdf />
        {isGenerating ? 'Opening…' : 'Open PDF'}
      </button>
    </div>
  ) : (
    <>
      <Button type="button" variant="outline" onClick={onClose} disabled={isBusy}>
        Cancel
      </Button>
      <Button
        type="button"
        variant="secondary"
        onClick={handleEmail}
        disabled={isBusy}
        Icon={FaEnvelope}
        title={`Email PDF to ${emailTarget}`}
      >
        {isEmailing ? 'Sending…' : 'Email'}
      </Button>
      <Button type="button" variant="primary" onClick={handleGenerate} disabled={isBusy} Icon={FaFilePdf}>
        {isGenerating ? 'Opening…' : 'Open PDF'}
      </Button>
    </>
  );

  if (isMobile) {
    return (
      <div
        className="fixed inset-0 z-[1200] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl border border-white/10 bg-[#0D1525] p-4 pb-6 max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-lg font-semibold text-white mb-4">Generate PDF</h3>
          {body}
          {footer}
        </div>
      </div>
    );
  }

  return (
    <Modal isOpen={open} onClose={onClose} title="Generate PDF" size="sm" actions={footer}>
      {body}
    </Modal>
  );
}
