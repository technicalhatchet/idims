import { useCallback, useEffect, useState } from 'react';
import { FaChevronDown, FaChevronUp, FaPlus, FaTools } from 'react-icons/fa';
import { apiClient } from '../../utils/api-client';
import ApplianceFormModal from '../cxdashboard/ApplianceFormModal';
import { applianceDisplayName } from '../../constants/applianceEquipment';
import { applianceNeedsStaffVerification } from '../../constants/applianceSourceLabel';
import ApplianceSourceSubtitle from '../cxdashboard/appliances/ApplianceSourceSubtitle';
import RecallBadge from '../recalls/RecallBadge';
import ApplianceAgeTile, { ApplianceAgeChip, ManufactureDateOverrideForm } from '../appliances/ApplianceAgeTile';
import { useFeature } from '../../context/FeatureFlagsContext';

export default function ClientAppliancesPanel({ clientId, properties = [] }) {
  const [expanded, setExpanded] = useState(false);
  const [appliances, setAppliances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [verifyingId, setVerifyingId] = useState(null);
  const [overrideSavingId, setOverrideSavingId] = useState(null);
  const applianceAgeEnabled = useFeature('appliance_age');

  const loadAppliances = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const data = await apiClient(`clients/${clientId}/appliances`);
      setAppliances(Array.isArray(data) ? data.filter((a) => a.is_active !== false) : []);
    } catch (err) {
      setError(err.message || 'Failed to load appliances');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (expanded) loadAppliances();
  }, [expanded, loadAppliances]);

  const handleManufactureOverride = async (applianceId, body) => {
    setOverrideSavingId(applianceId);
    setError(null);
    try {
      await apiClient(`clients/${clientId}/appliances/${applianceId}/manufacture-date`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      await loadAppliances();
    } catch (err) {
      setError(err.message || 'Failed to save manufacture date');
    } finally {
      setOverrideSavingId(null);
    }
  };

  const handleVerify = async (applianceId) => {
    setVerifyingId(applianceId);
    setError(null);
    try {
      await apiClient(`clients/${clientId}/appliances/${applianceId}/verify`, {
        method: 'POST',
      });
      await loadAppliances();
    } catch (err) {
      setError(err.message || 'Failed to verify appliance');
    } finally {
      setVerifyingId(null);
    }
  };

  const handleSave = async (form) => {
    setSubmitting(true);
    setError(null);
    try {
      await apiClient(`clients/${clientId}/appliances`, {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setShowAdd(false);
      await loadAppliances();
    } catch (err) {
      setError(err.message || 'Failed to save appliance');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
    <div
      className="rounded-lg overflow-hidden"
      style={{
        background: 'rgba(13, 21, 37, 0.85)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(34, 211, 238, 0.2)',
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <FaTools className="text-cyan-400" />
          <span className="text-white font-bold uppercase tracking-wide">Household Appliances</span>
          <span className="text-xs text-gray-500">({appliances.length || '—'})</span>
        </div>
        {expanded ? <FaChevronUp className="text-gray-400" /> : <FaChevronDown className="text-gray-400" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-cyan-500/10">
          {error && (
            <p className="text-sm text-red-400 mb-3">{error}</p>
          )}

          {loading ? (
            <p className="text-sm text-gray-500 py-4 text-center">Loading appliances...</p>
          ) : appliances.length === 0 ? (
            <p className="text-sm text-gray-500 py-3">No appliances on file for this client.</p>
          ) : (
            <div className="space-y-2 py-3">
              {appliances.map((a) => (
                <div
                  key={a.id}
                  className="rounded-md px-3 py-2"
                  style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-white text-sm font-semibold capitalize flex items-center gap-2 flex-wrap">
                        {applianceDisplayName(a)}
                        <RecallBadge recalls={a.recalls} staffView />
                        <ApplianceAgeChip applianceAge={a.appliance_age} />
                      </p>
                      <ApplianceSourceSubtitle
                        appliance={a}
                        extraParts={[a.serial ? `S/N ${a.serial}` : null, a.property?.address]}
                      />
                      {applianceAgeEnabled && a.appliance_age ? (
                        <div className="mt-2 max-w-sm">
                          <ApplianceAgeTile
                            applianceAge={a.appliance_age}
                            variant="staff"
                            staffOverride={
                              <ManufactureDateOverrideForm
                                saving={overrideSavingId === a.id}
                                initialYear={a.appliance_age.manufacture_year}
                                initialMonth={a.appliance_age.manufacture_month}
                                onSave={(body) => handleManufactureOverride(a.id, body)}
                              />
                            }
                          />
                        </div>
                      ) : applianceAgeEnabled && a.serial ? (
                        <ManufactureDateOverrideForm
                          saving={overrideSavingId === a.id}
                          onSave={(body) => handleManufactureOverride(a.id, body)}
                        />
                      ) : null}
                    </div>
                    {applianceNeedsStaffVerification(a) ? (
                      <button
                        type="button"
                        onClick={() => handleVerify(a.id)}
                        disabled={verifyingId === a.id}
                        className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-50"
                      >
                        {verifyingId === a.id ? '…' : 'Verify'}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-bold uppercase tracking-wide"
            style={{
              background: 'rgba(0, 212, 255, 0.12)',
              border: '1px solid rgba(0, 212, 255, 0.35)',
              color: '#22d3ee',
            }}
          >
            <FaPlus /> Add appliance
          </button>
        </div>
      )}

    </div>

    {showAdd && (
      <ApplianceFormModal
        title="Add client appliance"
        properties={properties}
        submitting={submitting}
        onClose={() => setShowAdd(false)}
        onSave={handleSave}
      />
    )}
    </>
  );
}
