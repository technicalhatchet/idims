import { useEffect, useState } from 'react';
import { FaFilePdf } from 'react-icons/fa';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { useTheme } from '../../context/ThemeContext';
import { openDiagnosticPdf } from '../../utils/workOrderPdf';

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

export default function DiagnosticPdfSheet({
  open,
  onClose,
  workOrderId,
  orderNumber,
  noteId = null,
  variant = 'mobile',
}) {
  const isMobile = variant === 'mobile';
  const { theme } = useTheme();
  const [pdfVariant, setPdfVariant] = useState('light');
  const [showTechnician, setShowTechnician] = useState(true);
  const [showPhotos, setShowPhotos] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setPdfVariant(theme?.mode === 'dark' ? 'dark' : 'light');
    setShowTechnician(true);
    setShowPhotos(false);
    setError(null);
  }, [open, theme?.mode]);

  if (!open) return null;

  const sectionLabelClass = isMobile
    ? 'text-xs uppercase tracking-wide text-gray-400 mb-2'
    : 'text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2';

  const handleGenerate = async () => {
    setError(null);
    setIsGenerating(true);
    try {
      await openDiagnosticPdf(workOrderId, orderNumber, {
        variant: pdfVariant,
        showTechnician,
        showPhotos,
        noteId,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to generate PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  const body = (
    <div className="space-y-4">
      <p className={`text-sm ${isMobile ? 'text-gray-400' : 'text-gray-600 dark:text-gray-400'}`}>
        Client-facing diagnostic report with findings, checklist, and evidence snapshot. Timeline is not included.
      </p>

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
          checked={showPhotos}
          onChange={setShowPhotos}
          label="Field photos"
          description="Work-order photos from the Notes tab (can make the file large)"
          variant={variant}
        />
      </div>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-3 py-2">
          {error}
        </p>
      ) : null}
    </div>
  );

  const footer = isMobile ? (
    <div className="flex gap-2 pt-1">
      <button
        type="button"
        onClick={onClose}
        disabled={isGenerating}
        className="rounded-lg border border-white/15 px-4 py-2.5 text-sm font-semibold text-gray-300 hover:bg-white/5 disabled:opacity-60"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={handleGenerate}
        disabled={isGenerating}
        className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-60"
      >
        <FaFilePdf />
        {isGenerating ? 'Opening…' : 'Open PDF'}
      </button>
    </div>
  ) : (
    <>
      <Button type="button" variant="outline" onClick={onClose} disabled={isGenerating}>
        Cancel
      </Button>
      <Button type="button" variant="primary" onClick={handleGenerate} disabled={isGenerating} Icon={FaFilePdf}>
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
          <h3 className="text-lg font-semibold text-white mb-4">Diagnostic report PDF</h3>
          {body}
          {footer}
        </div>
      </div>
    );
  }

  return (
    <Modal isOpen={open} onClose={onClose} title="Diagnostic report PDF" size="sm" actions={footer}>
      {body}
    </Modal>
  );
}
