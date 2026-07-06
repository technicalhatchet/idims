import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { FaShieldAlt, FaChevronRight, FaBoxOpen, FaPlus, FaCalendarPlus } from 'react-icons/fa';
import DashboardLayout from '../../components/cxdashboard/DashboardLayout';
import ApplianceIcon from '../../components/cxdashboard/ApplianceIcon';
import ApplianceImportModal from '../../components/cxdashboard/ApplianceImportModal';
import ApplianceFormModal from '../../components/cxdashboard/ApplianceFormModal';
import { applianceDisplayName, getSchedulingMissing, isSchedulingReady, schedulingMissingLabels } from '../../constants/applianceEquipment';
import { getPortalSessionToken, portalFetch } from '../../utils/portalFetch';

function isSchedulingReadyLocal(appliance) {
  return isSchedulingReady(appliance);
}

function ApplianceScheduleActions({ appliance, selfSchedulingAllowed, scheduleHref, detailHref }) {
  if (!selfSchedulingAllowed) return null;

  if (appliance.active_repair) {
    return (
      <Link
        href={scheduleHref}
        style={{ color: '#22d3ee', fontSize: '0.8125rem', fontWeight: '600', textDecoration: 'none' }}
      >
        Active request — request an update →
      </Link>
    );
  }

  if (appliance.can_schedule) {
    return (
      <Link
        href={scheduleHref}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          background: '#22d3ee', color: '#0a0f1a', borderRadius: '8px',
          padding: '0.625rem 1rem', fontWeight: '700', fontSize: '0.8125rem', textDecoration: 'none',
        }}
      >
        <FaCalendarPlus /> Schedule Service
      </Link>
    );
  }

  if (!isSchedulingReadyLocal(appliance)) {
    const missing = schedulingMissingLabels(getSchedulingMissing(appliance));
    return (
      <Link
        href={detailHref}
        style={{ color: '#f59e0b', fontSize: '0.8125rem', fontWeight: '600', textDecoration: 'none' }}
      >
        {missing.length > 0
          ? `Missing: ${missing.join(', ')} — tap to edit →`
          : 'Complete appliance info to schedule →'}
      </Link>
    );
  }

  return null;
}

function ApplianceCard({ appliance, selfSchedulingAllowed }) {
  const displayName = applianceDisplayName(appliance);
  const detailId = appliance.id;
  const detailHref = `/cxdashboard/appliances/${encodeURIComponent(detailId)}`;
  const scheduleHref = `/cxdashboard/appliances/${encodeURIComponent(detailId)}/schedule`;

  return (
    <div
      style={{
        background: '#0D1525',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '12px',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      <Link href={detailHref} style={{ textDecoration: 'none', color: 'inherit' }}>
        <div
          style={{
            display: 'flex',
            gap: '1rem',
            alignItems: 'flex-start',
            cursor: 'pointer',
          }}
          className="hover:opacity-95"
        >
        <div style={{ background: 'rgba(0,212,255,0.08)', borderRadius: '10px', padding: '10px', flexShrink: 0 }}>
          <ApplianceIcon type={appliance.equipment_subtype || appliance.subtype || appliance.equipment_type || appliance.type} className="w-8 h-8" />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ color: '#fff', fontWeight: '600', margin: 0, textTransform: 'capitalize' }}>
                {displayName}
              </p>
              <p style={{ color: '#6b7280', fontSize: '0.8125rem', margin: '2px 0 0' }}>
                {appliance.model && <span>{appliance.model}</span>}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
              {appliance.warranty_active && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#22c55e', fontSize: '0.75rem', fontWeight: '600' }}>
                  <FaShieldAlt style={{ fontSize: '10px' }} />
                  Warranty
                </span>
              )}
              {appliance.active_repair && (
                <span style={{
                  background: 'rgba(245,158,11,0.1)', color: '#f59e0b',
                  border: '1px solid rgba(245,158,11,0.2)', borderRadius: '6px',
                  padding: '2px 8px', fontSize: '0.7rem', fontWeight: '600',
                }}
                >
                  Active
                </span>
              )}
              <FaChevronRight style={{ color: '#6b7280', fontSize: '12px' }} />
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.75rem', fontSize: '0.8125rem', color: '#9ca3af' }}>
            {appliance.serial && (
              <span style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '6px', padding: '4px 8px' }}>
                <span style={{ color: '#6b7280' }}>S/N:</span>{' '}
                <span style={{ color: '#d1d5db', fontFamily: 'monospace' }}>{appliance.serial}</span>
              </span>
            )}
            <span>
              <span style={{ color: '#22d3ee', fontWeight: '600' }}>{appliance.service_count || 0}</span> service{(appliance.service_count || 0) !== 1 ? 's' : ''}
            </span>
            {appliance.last_service_date && (
              <span>Last: {format(parseISO(appliance.last_service_date), 'MMM d, yyyy')}</span>
            )}
          </div>

          {appliance.property && (
            <p style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.5rem' }}>
              {appliance.property.address}{appliance.property.unit_number ? ` Unit ${appliance.property.unit_number}` : ''}
            </p>
          )}
        </div>
        </div>
      </Link>

      {selfSchedulingAllowed && (
        <div style={{ paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <ApplianceScheduleActions
            appliance={appliance}
            selfSchedulingAllowed={selfSchedulingAllowed}
            scheduleHref={scheduleHref}
            detailHref={detailHref}
          />
        </div>
      )}
    </div>
  );
}

export default function AppliancesPage() {
  const [appliances, setAppliances] = useState([]);
  const [properties, setProperties] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [importCandidates, setImportCandidates] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    const token = await getPortalSessionToken();
    if (!token) throw new Error('Not signed in');

    const [applianceData, importData, propertyData, me] = await Promise.all([
      portalFetch('appliances', token),
      portalFetch('appliances/import/candidates', token),
      portalFetch('properties', token).catch(() => []),
      portalFetch('me', token).catch(() => null),
    ]);

    setAppliances(Array.isArray(applianceData) ? applianceData : []);
    setProperties(Array.isArray(propertyData) ? propertyData : []);
    setProfile(me);

    if (!importData.completed && (importData.candidates || []).length > 0) {
      setImportCandidates(importData.candidates);
    } else {
      setImportCandidates(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await loadData();
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadData]);

  const handleImportConfirm = async (selectedItems) => {
    setSubmitting(true);
    try {
      const token = await getPortalSessionToken();
      const payload = {
        appliances: selectedItems.map((item) => ({
          candidate_id: item.candidate_id,
          property_id: item.property?.id || null,
          nickname: item.nickname || null,
          equipment_type: item.equipment_type || 'appliance',
          equipment_subtype: item.equipment_subtype || null,
          make: item.make || null,
          model: item.model || null,
          serial: item.serial || null,
          equipment_version: item.equipment_version || null,
          is_wall_mounted: !!item.is_wall_mounted,
          work_order_ids: item.work_order_ids || [],
        })),
      };
      await portalFetch('appliances/import/confirm', token, { method: 'POST', body: JSON.stringify(payload) });
      setImportCandidates(null);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleImportSkip = async () => {
    setSubmitting(true);
    try {
      const token = await getPortalSessionToken();
      await portalFetch('appliances/import/skip', token, { method: 'POST', body: '{}' });
      setImportCandidates(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddAppliance = async (form) => {
    setSubmitting(true);
    try {
      const token = await getPortalSessionToken();
      await portalFetch('appliances', token, { method: 'POST', body: JSON.stringify(form) });
      setShowAdd(false);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head><title>My Appliances | Atomic Repair</title></Head>
      <div className="space-y-6">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: '700', margin: 0 }}>My Appliances</h1>
            <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Manage appliances at your properties and track service history
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              background: '#00D4FF', color: '#0A0F1E', border: 'none', borderRadius: '8px',
              padding: '0.625rem 1rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer',
            }}
          >
            <FaPlus /> Add appliance
          </button>
        </div>

        {error && (
          <div style={{ padding: '0.75rem 1rem', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', color: '#f87171', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#6b7280' }}>
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading appliances...
          </div>
        ) : appliances.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '4rem',
            background: '#0D1525', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.07)',
          }}
          >
            <FaBoxOpen style={{ fontSize: '2.5rem', color: '#6b7280', marginBottom: '1rem', opacity: 0.4 }} />
            <p style={{ color: '#9ca3af', marginBottom: '0.5rem' }}>No appliances yet</p>
            <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1rem' }}>
              Add your household appliances to keep model info and service history in one place.
            </p>
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              style={{ background: '#00D4FF', color: '#0A0F1E', border: 'none', borderRadius: '8px', padding: '0.625rem 1.25rem', fontWeight: 700 }}
            >
              Add your first appliance
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {appliances.map((a) => (
              <ApplianceCard
                key={a.id}
                appliance={a}
                selfSchedulingAllowed={!!profile?.self_scheduling_allowed}
              />
            ))}
          </div>
        )}
      </div>

      {importCandidates && (
        <ApplianceImportModal
          candidates={importCandidates}
          submitting={submitting}
          onConfirm={handleImportConfirm}
          onSkip={handleImportSkip}
        />
      )}

      {showAdd && (
        <ApplianceFormModal
          title="Add appliance"
          properties={properties}
          submitting={submitting}
          onClose={() => setShowAdd(false)}
          onSave={handleAddAppliance}
        />
      )}
    </>
  );
}

AppliancesPage.getLayout = function getLayout(page) {
  return <DashboardLayout title="My Appliances">{page}</DashboardLayout>;
};
