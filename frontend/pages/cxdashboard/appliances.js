import { useState, useEffect, useCallback, useMemo } from 'react';
import Head from 'next/head';
import { FaBoxOpen, FaPlus } from 'react-icons/fa';
import DashboardLayout from '../../components/cxdashboard/DashboardLayout';
import ApplianceImportModal from '../../components/cxdashboard/ApplianceImportModal';
import ApplianceFormModal from '../../components/cxdashboard/ApplianceFormModal';
import AppliancesSummaryCards from '../../components/cxdashboard/appliances/AppliancesSummaryCards';
import AppliancesToolbar from '../../components/cxdashboard/appliances/AppliancesToolbar';
import PropertyApplianceSection from '../../components/cxdashboard/appliances/PropertyApplianceSection';
import {
  computeSummary,
  filterAppliances,
  groupAppliancesByProperty,
  propertyKey,
  propertyLabel,
  sortAppliances,
} from '../../components/cxdashboard/appliances/appliancesPageUtils';
import { subtypeLabel } from '../../constants/applianceEquipment';
import { getPortalSessionToken, portalFetch } from '../../utils/portalFetch';

function applianceToForm(appliance) {
  if (!appliance) return null;
  return {
    property_id: appliance.property_id || appliance.property?.id || '',
    nickname: appliance.nickname || '',
    equipment_type: appliance.equipment_type || 'appliance',
    equipment_subtype: appliance.equipment_subtype || '',
    make: appliance.make || '',
    model: appliance.model || '',
    serial: appliance.serial || '',
    equipment_version: appliance.equipment_version || '',
    is_wall_mounted: !!appliance.is_wall_mounted,
    notes: appliance.notes || '',
  };
}

export default function AppliancesPage() {
  const [appliances, setAppliances] = useState([]);
  const [properties, setProperties] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [importCandidates, setImportCandidates] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editingAppliance, setEditingAppliance] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [search, setSearch] = useState('');
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('property');
  const [viewMode, setViewMode] = useState('list');
  const [expandedProperties, setExpandedProperties] = useState(new Set());

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

  const filteredAppliances = useMemo(
    () => sortAppliances(
      filterAppliances(appliances, { search, propertyFilter, statusFilter, typeFilter }),
      sortBy,
    ),
    [appliances, search, propertyFilter, statusFilter, typeFilter, sortBy],
  );

  const propertyGroups = useMemo(
    () => groupAppliancesByProperty(filteredAppliances),
    [filteredAppliances],
  );

  const summary = useMemo(
    () => computeSummary(appliances, groupAppliancesByProperty(appliances)),
    [appliances],
  );

  const propertyOptions = useMemo(() => {
    const seen = new Map();
    appliances.forEach((appliance) => {
      const key = propertyKey(appliance);
      if (!seen.has(key)) {
        seen.set(key, propertyLabel(appliance));
      }
    });
    return Array.from(seen.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [appliances]);

  const typeOptions = useMemo(() => {
    const seen = new Map();
    appliances.forEach((appliance) => {
      const value = appliance.equipment_subtype || appliance.subtype;
      if (!value) return;
      const label = subtypeLabel(appliance.equipment_type || appliance.type, value) || value;
      if (!seen.has(value)) seen.set(value, label);
    });
    return Array.from(seen.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [appliances]);

  useEffect(() => {
    if (!propertyGroups.length) {
      setExpandedProperties(new Set());
      return;
    }
    if (propertyGroups.length === 1) {
      setExpandedProperties(new Set([propertyGroups[0].key]));
      return;
    }
    setExpandedProperties((prev) => {
      if (prev.size > 0) return prev;
      return new Set([propertyGroups[0].key]);
    });
  }, [propertyGroups]);

  const toggleProperty = (key) => {
    setExpandedProperties((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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

  const handleUpdateAppliance = async (form) => {
    if (!editingAppliance?.id) return;
    setSubmitting(true);
    try {
      const token = await getPortalSessionToken();
      await portalFetch(`appliances/${editingAppliance.id}`, token, {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      setEditingAppliance(null);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveAppliance = async (appliance) => {
    const name = appliance.nickname || [appliance.make, appliance.model].filter(Boolean).join(' ') || 'this appliance';
    if (!window.confirm(`Remove ${name} from your account?`)) return;

    setSubmitting(true);
    try {
      const token = await getPortalSessionToken();
      await portalFetch(`appliances/${appliance.id}`, token, { method: 'DELETE' });
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const singlePropertyMode = propertyGroups.length === 1;
  const selfSchedulingAllowed = !!profile?.self_scheduling_allowed;

  return (
    <>
      <Head><title>My Appliances | Atomic Repair</title></Head>
      <div className="space-y-5">
        <div className="flex justify-between items-start gap-4 flex-wrap">
          <div>
            <h1 className="text-white text-2xl font-bold m-0">My Appliances</h1>
            <p className="text-gray-500 text-sm mt-1">
              Manage appliances at your properties and track service history.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#00D4FF] text-[#0A0F1E] border-0 px-4 py-2.5 text-sm font-bold cursor-pointer shrink-0"
          >
            <FaPlus /> Add Appliance
          </button>
        </div>

        {error ? (
          <div className="px-4 py-3 rounded-lg bg-red-500/10 text-red-400 text-sm border border-red-500/20">
            {error}
          </div>
        ) : null}

        {!loading && appliances.length > 0 ? (
          <>
            <AppliancesSummaryCards summary={summary} />
            <AppliancesToolbar
              search={search}
              onSearchChange={setSearch}
              propertyFilter={propertyFilter}
              onPropertyFilterChange={setPropertyFilter}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              typeFilter={typeFilter}
              onTypeFilterChange={setTypeFilter}
              sortBy={sortBy}
              onSortChange={setSortBy}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              propertyOptions={propertyOptions}
              typeOptions={typeOptions}
            />
          </>
        ) : null}

        {loading ? (
          <div className="text-center py-16 text-gray-500">
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading appliances...
          </div>
        ) : appliances.length === 0 ? (
          <div className="text-center py-16 rounded-xl border border-white/[0.07] bg-[#0D1525]">
            <FaBoxOpen className="text-4xl text-gray-600 mx-auto mb-4 opacity-40" />
            <p className="text-gray-400 mb-1">No appliances yet</p>
            <p className="text-gray-500 text-sm mb-4">
              Add your household appliances to keep model info and service history in one place.
            </p>
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="rounded-lg bg-[#00D4FF] text-[#0A0F1E] border-0 px-5 py-2.5 font-bold"
            >
              Add your first appliance
            </button>
          </div>
        ) : filteredAppliances.length === 0 ? (
          <div className="text-center py-12 rounded-xl border border-white/[0.07] bg-[#0D1525] text-gray-400 text-sm">
            No appliances match your filters.
          </div>
        ) : (
          <div className="space-y-3">
            {propertyGroups.map((group) => (
              <PropertyApplianceSection
                key={group.key}
                group={group}
                expanded={expandedProperties.has(group.key)}
                onToggle={() => toggleProperty(group.key)}
                selfSchedulingAllowed={selfSchedulingAllowed}
                onEdit={setEditingAppliance}
                onRemove={handleRemoveAppliance}
                viewMode={viewMode}
                showHeader={!singlePropertyMode}
              />
            ))}
          </div>
        )}
      </div>

      {importCandidates ? (
        <ApplianceImportModal
          candidates={importCandidates}
          submitting={submitting}
          onConfirm={handleImportConfirm}
          onSkip={handleImportSkip}
        />
      ) : null}

      {showAdd ? (
        <ApplianceFormModal
          title="Add appliance"
          properties={properties}
          submitting={submitting}
          onClose={() => setShowAdd(false)}
          onSave={handleAddAppliance}
        />
      ) : null}

      {editingAppliance ? (
        <ApplianceFormModal
          title="Edit appliance"
          initial={applianceToForm(editingAppliance)}
          properties={properties}
          submitting={submitting}
          onClose={() => setEditingAppliance(null)}
          onSave={handleUpdateAppliance}
        />
      ) : null}
    </>
  );
}

AppliancesPage.getLayout = function getLayout(page) {
  return <DashboardLayout title="My Appliances">{page}</DashboardLayout>;
};
