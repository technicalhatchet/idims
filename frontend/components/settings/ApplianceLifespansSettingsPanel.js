import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { apiClient } from '../../utils/api-client';
import { useFeature } from '../../context/FeatureFlagsContext';
import { useOfficeStaff } from '../../hooks/useOfficeStaff';

const EMPTY_ROW = {
  equipment_type: 'appliance',
  equipment_subtype: '',
  typical_min_years: 10,
  typical_max_years: 15,
  notes: '',
};

function validateRow(row) {
  const min = Number(row.typical_min_years);
  const max = Number(row.typical_max_years);
  if (!row.equipment_type?.trim()) return 'Appliance type is required';
  if (min < 1 || max > 40) return 'Years must be between 1 and 40';
  if (min > max) return 'Min years cannot exceed max years';
  return null;
}

export default function ApplianceLifespansSettingsPanel() {
  const flagOn = useFeature('appliance_age');
  const isOffice = useOfficeStaff();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState({ ...EMPTY_ROW });
  const [redecodeBusy, setRedecodeBusy] = useState(false);

  const load = useCallback(async () => {
    if (!flagOn || !isOffice) return;
    setLoading(true);
    try {
      const data = await apiClient('/api/appliance-lifespans');
      setRows(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Failed to load appliance lifespans');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [flagOn, isOffice]);

  useEffect(() => {
    load();
  }, [load]);

  if (!flagOn || !isOffice) return null;

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
        typical_min_years: Number(row.typical_min_years),
        typical_max_years: Number(row.typical_max_years),
        notes: row.notes?.trim() || null,
      };
      const updated = await apiClient(`/api/appliance-lifespans/${row.id}`, {
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
    if (!window.confirm('Delete this lifespan row?')) return;
    try {
      await apiClient(`/api/appliance-lifespans/${row.id}`, { method: 'DELETE' });
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
        typical_min_years: Number(newRow.typical_min_years),
        typical_max_years: Number(newRow.typical_max_years),
        notes: newRow.notes?.trim() || null,
      };
      const created = await apiClient('/api/appliance-lifespans', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setRows((prev) => [...prev, created]);
      setNewRow({ ...EMPTY_ROW });
      toast.success('Row added');
    } catch (e) {
      toast.error(e?.message || 'Add failed');
    } finally {
      setAdding(false);
    }
  };

  const resetDefaults = async () => {
    if (!window.confirm('Replace all lifespan rows with factory defaults?')) return;
    try {
      await apiClient('/api/appliance-lifespans/reset-defaults', { method: 'POST' });
      await load();
      toast.success('Defaults restored');
    } catch {
      toast.error('Reset failed');
    }
  };

  const redecodeAll = async () => {
    setRedecodeBusy(true);
    try {
      const result = await apiClient('/api/appliance-lifespans/redecode-all', { method: 'POST' });
      toast.success(
        `Re-checked ${result?.total ?? 0} appliances; ${result?.changed ?? 0} updated`,
      );
    } catch {
      toast.error('Re-check failed');
    } finally {
      setRedecodeBusy(false);
    }
  };

  const inputClass =
    'w-full min-w-0 rounded px-2 py-1 text-xs text-white bg-black/30 border border-white/10';

  return (
    <div
      className="space-y-4"
      style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1.5rem' }}
      data-settings-panel="appliance-lifespans"
    >
      <h3 className="text-white font-semibold">Appliance lifespans</h3>
      <p className="text-gray-500 text-xs m-0">
        Typical service life ranges shown with serial-based age on appliance pages.
      </p>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading lifespans…</p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-left text-xs text-gray-300 border-collapse">
            <thead>
              <tr className="text-gray-500 border-b border-white/10">
                <th className="py-2 pr-2">Type</th>
                <th className="py-2 pr-2">Subtype</th>
                <th className="py-2 pr-2 w-14">Min</th>
                <th className="py-2 pr-2 w-14">Max</th>
                <th className="py-2 pr-2">Notes</th>
                <th className="py-2 w-24" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-white/5 align-top">
                  <td className="py-2 pr-2">
                    <input
                      className={inputClass}
                      value={row.equipment_type}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((r) =>
                            r.id === row.id ? { ...r, equipment_type: e.target.value } : r,
                          ),
                        )
                      }
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      className={inputClass}
                      placeholder="(optional)"
                      value={row.equipment_subtype || ''}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((r) =>
                            r.id === row.id ? { ...r, equipment_subtype: e.target.value } : r,
                          ),
                        )
                      }
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min={1}
                      max={40}
                      className={inputClass}
                      value={row.typical_min_years}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((r) =>
                            r.id === row.id
                              ? { ...r, typical_min_years: e.target.value }
                              : r,
                          ),
                        )
                      }
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min={1}
                      max={40}
                      className={inputClass}
                      value={row.typical_max_years}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((r) =>
                            r.id === row.id
                              ? { ...r, typical_max_years: e.target.value }
                              : r,
                          ),
                        )
                      }
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      className={inputClass}
                      value={row.notes || ''}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((r) =>
                            r.id === row.id ? { ...r, notes: e.target.value } : r,
                          ),
                        )
                      }
                    />
                  </td>
                  <td className="py-2 space-x-1 whitespace-nowrap">
                    <button
                      type="button"
                      className="text-cyan-400 hover:text-cyan-300"
                      disabled={savingId === row.id}
                      onClick={() => saveRow(row)}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="text-red-400 hover:text-red-300"
                      onClick={() => deleteRow(row)}
                    >
                      Del
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-lg border border-white/10 p-3 space-y-2 bg-black/20">
        <p className="text-gray-400 text-xs font-medium m-0">Add row</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <input
            className={inputClass}
            placeholder="equipment_type"
            value={newRow.equipment_type}
            onChange={(e) => setNewRow((r) => ({ ...r, equipment_type: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder="subtype (optional)"
            value={newRow.equipment_subtype}
            onChange={(e) => setNewRow((r) => ({ ...r, equipment_subtype: e.target.value }))}
          />
          <input
            type="number"
            className={inputClass}
            placeholder="min"
            value={newRow.typical_min_years}
            onChange={(e) => setNewRow((r) => ({ ...r, typical_min_years: e.target.value }))}
          />
          <input
            type="number"
            className={inputClass}
            placeholder="max"
            value={newRow.typical_max_years}
            onChange={(e) => setNewRow((r) => ({ ...r, typical_max_years: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder="notes"
            value={newRow.notes}
            onChange={(e) => setNewRow((r) => ({ ...r, notes: e.target.value }))}
          />
        </div>
        <button
          type="button"
          disabled={adding}
          onClick={addRow}
          className="text-sm text-cyan-400 hover:text-cyan-300 disabled:opacity-50"
        >
          {adding ? 'Adding…' : 'Add lifespan row'}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={resetDefaults}
          className="px-3 py-1.5 text-sm font-medium rounded-lg text-gray-300 border border-white/10 hover:bg-white/5"
        >
          Reset to defaults
        </button>
        <button
          type="button"
          onClick={redecodeAll}
          disabled={redecodeBusy}
          className="px-3 py-1.5 text-sm font-medium rounded-lg disabled:opacity-50"
          style={{
            background: 'rgba(34, 211, 238, 0.15)',
            color: '#22D3EE',
            border: '1px solid rgba(34, 211, 238, 0.3)',
          }}
        >
          {redecodeBusy ? 'Re-checking…' : 'Re-check all appliance ages'}
        </button>
      </div>
    </div>
  );
}
