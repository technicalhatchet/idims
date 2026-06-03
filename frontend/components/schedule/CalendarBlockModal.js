import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import Modal from '../ui/Modal';
import {
  CALENDAR_BLOCK_TYPES,
  calendarBlockTypeLabel,
  isCalendarBlockEvent,
} from '../../utils/calendarBlockTypes';
import {
  createCalendarBlock,
  updateCalendarBlock,
  deleteCalendarBlock,
  cancelCalendarBlock,
} from '../../services/api/calendarBlocksApi';

function toLocalDatetimeInputValue(isoOrDate) {
  if (!isoOrDate) return '';
  const d = typeof isoOrDate === 'string' ? parseISO(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDatetimeInputValue(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function eventRangeIso(event, which) {
  if (!event) return null;
  if (which === 'start') return event.start || event.start_at;
  return event.end || event.end_at;
}

export default function CalendarBlockModal({
  isOpen,
  onClose,
  mode = 'create',
  event = null,
  anchorDate,
  technicianId = '',
  technicians = [],
  onSaved,
}) {
  const isEdit = mode === 'edit' && event && isCalendarBlockEvent(event);
  const [blockType, setBlockType] = useState('lunch');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [techId, setTechId] = useState(technicianId || '');
  const [startLocal, setStartLocal] = useState('');
  const [endLocal, setEndLocal] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (isEdit) {
      setBlockType(event.block_type || 'other');
      setTitle(event.title || '');
      setNotes(event.notes || '');
      setTechId(event.technician_id || technicianId || '');
      setStartLocal(toLocalDatetimeInputValue(eventRangeIso(event, 'start')));
      setEndLocal(toLocalDatetimeInputValue(eventRangeIso(event, 'end')));
      return;
    }
    setBlockType('lunch');
    setTitle('');
    setNotes('');
    setTechId(technicianId || '');
    const base = anchorDate ? new Date(anchorDate) : new Date();
    base.setHours(12, 0, 0, 0);
    const end = new Date(base.getTime() + 60 * 60 * 1000);
    setStartLocal(toLocalDatetimeInputValue(base));
    setEndLocal(toLocalDatetimeInputValue(end));
  }, [isOpen, isEdit, event, anchorDate, technicianId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const start_at = fromLocalDatetimeInputValue(startLocal);
    const end_at = fromLocalDatetimeInputValue(endLocal);
    if (!techId) {
      setError('Select a technician.');
      return;
    }
    if (!start_at || !end_at) {
      setError('Start and end times are required.');
      return;
    }
    if (new Date(end_at) <= new Date(start_at)) {
      setError('End time must be after start time.');
      return;
    }
    setBusy(true);
    try {
      const body = {
        technician_id: techId,
        block_type: blockType,
        title: title.trim() || null,
        notes: notes.trim() || null,
        start_at,
        end_at,
      };
      if (isEdit) {
        await updateCalendarBlock(event.id, body);
      } else {
        await createCalendarBlock(body);
      }
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to save block.');
    } finally {
      setBusy(false);
    }
  };

  const handleCancelBlock = async () => {
    if (!event?.id) return;
    setBusy(true);
    setError(null);
    try {
      await cancelCalendarBlock(event.id);
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to cancel block.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!event?.id) return;
    if (!window.confirm('Delete this block permanently?')) return;
    setBusy(true);
    setError(null);
    try {
      await deleteCalendarBlock(event.id);
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to delete block.');
    } finally {
      setBusy(false);
    }
  };

  const modalTitle = isEdit
    ? `${calendarBlockTypeLabel(event?.block_type)} block`
    : 'Add calendar block';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle}>
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {isEdit && eventRangeIso(event, 'start') && (
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {format(parseISO(eventRangeIso(event, 'start')), 'EEE MMM d')} · {event.technician_name || 'Technician'}
          </p>
        )}

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-gray-400">
            Technician
          </label>
          <select
            value={techId}
            onChange={(e) => setTechId(e.target.value)}
            disabled={busy}
            className="w-full rounded-lg px-3 py-2 text-sm bg-gray-900 border border-gray-700 text-white"
          >
            <option value="">Select technician</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.user?.first_name} {t.user?.last_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-gray-400">
            Type
          </label>
          <select
            value={blockType}
            onChange={(e) => setBlockType(e.target.value)}
            disabled={busy}
            className="w-full rounded-lg px-3 py-2 text-sm bg-gray-900 border border-gray-700 text-white"
          >
            {CALENDAR_BLOCK_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-gray-400">
            Title (optional)
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder={calendarBlockTypeLabel(blockType)}
            className="w-full rounded-lg px-3 py-2 text-sm bg-gray-900 border border-gray-700 text-white"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-gray-400">
              Start
            </label>
            <input
              type="datetime-local"
              value={startLocal}
              onChange={(e) => setStartLocal(e.target.value)}
              disabled={busy}
              className="w-full rounded-lg px-3 py-2 text-sm bg-gray-900 border border-gray-700 text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-gray-400">
              End
            </label>
            <input
              type="datetime-local"
              value={endLocal}
              onChange={(e) => setEndLocal(e.target.value)}
              disabled={busy}
              className="w-full rounded-lg px-3 py-2 text-sm bg-gray-900 border border-gray-700 text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-gray-400">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-lg px-3 py-2 text-sm bg-gray-900 border border-gray-700 text-white"
          />
        </div>

        {error && (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-2 justify-end pt-2">
          {isEdit && (
            <>
              <button
                type="button"
                onClick={handleCancelBlock}
                disabled={busy}
                className="btn-secondary text-amber-300/90"
              >
                Cancel block
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy}
                className="btn-secondary text-red-400/90"
              >
                Delete
              </button>
            </>
          )}
          <button type="button" onClick={onClose} disabled={busy} className="btn-secondary">
            Close
          </button>
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Add block'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
