import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { apiClient } from '../../utils/api-client';
import { useFeature } from '../../context/FeatureFlagsContext';
import { useOfficeStaff } from '../../hooks/useOfficeStaff';
import { EQUIPMENT_SUBTYPES, EQUIPMENT_TYPES } from '../../constants/applianceEquipment';

const EMPTY_ROW = {
  equipment_type: 'appliance',
  equipment_subtype: '',
  name: '',
  interval_months: 6,
  kind: 'diy',
  how_to_text: '',
  parts_search_term: '',
  bookable_service_id: '',
  enabled: true,
  sort_order: 0,
};

function validateRow(row) {
  if (!row.name?.trim()) return 'Name is required';
  if (!row.equipment_type?.trim()) return 'Equipment type is required';
  const interval = Number(row.interval_months);
  if (interval < 1 || interval > 120) return 'Interval must be 1–120 months';
  if (!['diy', 'service'].includes(row.kind)) return 'Kind must be diy or service';
  return null;
}

export default function MaintenanceTasksSettingsPanel() {
  const flagOn = useFeature('maintenance_reminders');
  const isOffice = useOfficeStaff();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState({ ...EMPTY_ROW });

  const load = useCallback(async () => {
    if (!flagOn || !isOffice) return;
    setLoading(true);
    try {
      const data = await apiClient('/api/maintenance-tasks');
      setRows(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Failed to load maintenance tasks');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [flagOn, isOffice]);

  useEffect(() => {
    load();
  }, [load]);

  if (!flagOn || !isOffice) return null;

  const subtypeOptions = EQUIPMENT_SUBTYPES.appliance || [];

  const saveRow = async (row) => {
    const err = validateRow(row);
    if (err) {
      toast.error(err);
      return;
    }
    setSavingId(row.id);
    try {
      const body = {
        equipment_type: row.equipment_type.trim(),
        equipment_subtype: row.equipment_subtype?.trim() || null,
        name: row.name.trim(),
        interval_months: Number(row.interval_months),
        kind: row.kind,
        how_to_text: row.how_to_text?.trim() || null,
        parts_search_term: row.parts_search_term?.trim() || null,
        bookable_service_id: row.bookable_service_id?.trim() || null,
        enabled: Boolean(row.enabled),
        sort_order: Number(row.sort_order) || 0,
      };
      const updated = await apiClient(`/api/maintenance-tasks/${row.id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
      toast.success('Saved');
    } catch (e) {
      toast.error(e?.message || 'Save failed');
    } finally {
      setSavingId(null);
    }
  };

  const deleteRow = async (row) => {
    if (!window.confirm('Delete this maintenance task?')) return;
    try {
      await apiClient(`/api/maintenance-tasks/${row.id}`, { method: 'DELETE' });
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      toast.success('Deleted');
    } catch {
      toast.error('Delete failed');
    }
  };

  const addRow = async () => {
    const err = validateRow(newRow);
    if (err) {
      toast.error(err);
      return;
    }
    setAdding(true);
    try {
      const body = {
        equipment_type: newRow.equipment_type.trim(),
        equipment_subtype: newRow.equipment_subtype?.trim() || null,
        name: newRow.name.trim(),
        interval_months: Number(newRow.interval_months),
        kind: newRow.kind,
        how_to_text: newRow.how_to_text?.trim() || null,
        parts_search_term: newRow.parts_search_term?.trim() || null,
        bookable_service_id: newRow.bookable_service_id?.trim() || null,
        enabled: Boolean(newRow.enabled),
        sort_order: Number(newRow.sort_order) || 0,
      };
      const created = await apiClient('/api/maintenance-tasks', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setRows((prev) => [...prev, created]);
      setNewRow({ ...EMPTY_ROW });
      toast.success('Task added');
    } catch (e) {
      toast.error(e?.message || 'Add failed');
    } finally {
      setAdding(false);
    }
  };

  const resetDefaults = async () => {
    if (!window.confirm('Reset all maintenance tasks to factory defaults?')) return;
    try {
      await apiClient('/api/maintenance-tasks/reset-defaults', { method: 'POST' });
      await load();
      toast.success('Defaults restored');
    } catch {
      toast.error('Reset failed');
    }
  };

  const renderRowFields = (row, setRow) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <label className="text-sm text-gray-300">
        Type
        <select
          className="mt-1 w-full rounded bg-gray-900 border border-gray-700 px-2 py-1"
          value={row.equipment_type}
          onChange={(e) => setRow({ ...row, equipment_type: e.target.value })}
        >
          {EQUIPMENT_TYPES.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
      <label className="text-sm text-gray-300">
        Subtype
        <select
          className="mt-1 w-full rounded bg-gray-900 border border-gray-700 px-2 py-1"
          value={row.equipment_subtype || ''}
          onChange={(e) => setRow({ ...row, equipment_subtype: e.target.value })}
        >
          <option value="">Any</option>
          {subtypeOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
      <label className="text-sm text-gray-300 md:col-span-2">
        Name
        <input
          className="mt-1 w-full rounded bg-gray-900 border border-gray-700 px-2 py-1"
          value={row.name}
          onChange={(e) => setRow({ ...row, name: e.target.value })}
        />
      </label>
      <label className="text-sm text-gray-300">
        Interval (months)
        <input
          type="number"
          min={1}
          max={120}
          className="mt-1 w-full rounded bg-gray-900 border border-gray-700 px-2 py-1"
          value={row.interval_months}
          onChange={(e) => setRow({ ...row, interval_months: e.target.value })}
        />
      </label>
      <label className="text-sm text-gray-300">
        Kind
        <select
          className="mt-1 w-full rounded bg-gray-900 border border-gray-700 px-2 py-1"
          value={row.kind}
          onChange={(e) => setRow({ ...row, kind: e.target.value })}
        >
          <option value="diy">DIY</option>
          <option value="service">Bookable service</option>
        </select>
      </label>
      <label className="text-sm text-gray-300 md:col-span-2">
        How-to
        <textarea
          rows={2}
          className="mt-1 w-full rounded bg-gray-900 border border-gray-700 px-2 py-1"
          value={row.how_to_text || ''}
          onChange={(e) => setRow({ ...row, how_to_text: e.target.value })}
        />
      </label>
      <label className="text-sm text-gray-300">
        Parts search term
        <input
          className="mt-1 w-full rounded bg-gray-900 border border-gray-700 px-2 py-1"
          value={row.parts_search_term || ''}
          onChange={(e) => setRow({ ...row, parts_search_term: e.target.value })}
        />
      </label>
      <label className="text-sm text-gray-300">
        Bookable service ID
        <input
          className="mt-1 w-full rounded bg-gray-900 border border-gray-700 px-2 py-1"
          value={row.bookable_service_id || ''}
          onChange={(e) => setRow({ ...row, bookable_service_id: e.target.value })}
          placeholder="UUID (service kind)"
        />
      </label>
    </div>
  );

  return (
    <section
      className="rounded-lg border border-gray-700 bg-gray-800/50 p-4"
      data-settings-panel="maintenance-tasks"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Maintenance tasks</h3>
          <p className="text-sm text-gray-400">Catalog of DIY and bookable maintenance reminders by appliance type.</p>
        </div>
        <button
          type="button"
          onClick={resetDefaults}
          className="text-sm text-orange-400 hover:text-orange-300"
        >
          Reset defaults
        </button>
      </div>
      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <div key={row.id} className="border border-gray-700 rounded p-3 space-y-2">
              {renderRowFields(row, (next) => setRows((prev) => prev.map((r) => (r.id === row.id ? next : r))))}
              <div className="flex flex-wrap gap-2 items-center">
                <label className="text-sm text-gray-300 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(row.enabled)}
                    onChange={(e) => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, enabled: e.target.checked } : r)))}
                  />
                  Enabled
                </label>
                <button
                  type="button"
                  disabled={savingId === row.id}
                  onClick={() => saveRow(rows.find((r) => r.id === row.id))}
                  className="px-3 py-1 rounded bg-orange-600 text-white text-sm"
                >
                  Save
                </button>
                <button type="button" onClick={() => deleteRow(row)} className="px-3 py-1 rounded border border-gray-600 text-sm text-gray-300">
                  Delete
                </button>
              </div>
            </div>
          ))}
          <div className="border border-dashed border-gray-600 rounded p-3 space-y-2">
            <p className="text-sm text-gray-400">Add task</p>
            {renderRowFields(newRow, setNewRow)}
            <button
              type="button"
              disabled={adding}
              onClick={addRow}
              className="px-3 py-1 rounded bg-gray-700 text-white text-sm"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
