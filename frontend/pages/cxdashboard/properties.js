import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import { FaHome, FaPlus, FaEdit, FaTrash } from 'react-icons/fa';
import DashboardLayout from '../../components/cxdashboard/DashboardLayout';
import PropertyFormModal, { propertyToForm } from '../../components/cxdashboard/PropertyFormModal';
import { getPortalSessionToken, portalFetch } from '../../utils/portalFetch';
import {
  isPortalPreviewActive,
  isPortalPreviewUnlocked,
} from '../../utils/portalPreview';
import {
  formatPropertyAddress,
  propertyPrimaryTitle,
  propertySecondaryLine,
} from '../../utils/propertyDisplay';

function PropertyCard({ property, onEdit, onDelete, readOnly }) {
  const subtitle = propertySecondaryLine(property);
  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#0D1525] p-4 flex gap-3">
      <div className="w-10 h-10 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0">
        <FaHome className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white m-0 truncate">{propertyPrimaryTitle(property)}</p>
        {subtitle ? (
          <p className="text-xs text-gray-500 mt-0.5 m-0 truncate">{subtitle}</p>
        ) : null}
        {!subtitle && property.unit_number ? (
          <p className="text-xs text-gray-500 mt-0.5 m-0">Unit {property.unit_number}</p>
        ) : null}
        <div className="flex flex-wrap gap-2 mt-2 text-[11px] text-gray-400">
          <span className="capitalize">{property.property_type || 'residential'}</span>
          {property.stats?.total_repairs > 0 ? (
            <span>{property.stats.total_repairs} service visit{property.stats.total_repairs === 1 ? '' : 's'}</span>
          ) : null}
          {property.appliance_count > 0 ? (
            <span>{property.appliance_count} appliance{property.appliance_count === 1 ? '' : 's'}</span>
          ) : null}
        </div>
      </div>
      <div className="flex flex-col gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onEdit(property)}
          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
          aria-label="Edit property"
        >
          <FaEdit />
        </button>
        {!readOnly && property.stats?.total_repairs === 0 && !property.appliance_count ? (
          <button
            type="button"
            onClick={() => onDelete(property)}
            className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10"
            aria-label="Delete property"
          >
            <FaTrash />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function PortalPropertiesPage() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const previewLocked = isPortalPreviewActive() && !isPortalPreviewUnlocked();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getPortalSessionToken();
      const data = await portalFetch('properties', token);
      setProperties(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (payload) => {
    setSubmitting(true);
    setError(null);
    try {
      const token = await getPortalSessionToken();
      if (editing?.id) {
        await portalFetch(`properties/${editing.id}`, token, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await portalFetch('properties', token, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setShowAdd(false);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (property) => {
    const label = formatPropertyAddress(property) || 'this property';
    if (!window.confirm(`Remove ${label}?`)) return;
    setSubmitting(true);
    setError(null);
    try {
      const token = await getPortalSessionToken();
      await portalFetch(`properties/${property.id}`, token, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const modalOpen = showAdd || editing;

  return (
    <>
      <Head><title>My Properties | Atomic Repair</title></Head>
      <div className="space-y-5">
        <div className="flex justify-between items-start gap-4 flex-wrap">
          <div>
            <h1 className="text-white text-2xl font-bold m-0">My Properties</h1>
            <p className="text-gray-500 text-sm mt-1">
              Service addresses on your account. Scheduling and invoices always use the street address below.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setShowAdd(true);
            }}
            disabled={previewLocked}
            className="inline-flex items-center gap-2 rounded-lg bg-[#00D4FF] text-[#0A0F1E] border-0 px-4 py-2.5 text-sm font-bold cursor-pointer shrink-0 disabled:opacity-50"
          >
            <FaPlus /> Add property
          </button>
        </div>

        {error ? (
          <div className="px-4 py-3 rounded-lg bg-red-500/10 text-red-400 text-sm border border-red-500/20">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="text-center py-16 text-gray-500">
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading properties…
          </div>
        ) : properties.length === 0 ? (
          <div className="text-center py-16 rounded-xl border border-white/[0.07] bg-[#0D1525]">
            <FaHome className="text-4xl text-gray-600 mx-auto mb-4 opacity-40" />
            <p className="text-gray-400 mb-1">No properties yet</p>
            <p className="text-gray-500 text-sm mb-4 max-w-sm mx-auto">
              Add your home or rental address so we can schedule service and attach appliances.
            </p>
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              disabled={previewLocked}
              className="rounded-lg bg-[#00D4FF] text-[#0A0F1E] border-0 px-5 py-2.5 font-bold disabled:opacity-50"
            >
              Add your first property
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {properties.map((p) => (
              <PropertyCard
                key={p.id}
                property={p}
                readOnly={previewLocked}
                onEdit={(prop) => {
                  setShowAdd(false);
                  setEditing(prop);
                }}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {modalOpen ? (
        <PropertyFormModal
          title={editing ? 'Edit property' : 'Add property'}
          initial={propertyToForm(editing)}
          editingProperty={editing}
          submitting={submitting}
          readOnly={previewLocked}
          onClose={() => {
            setShowAdd(false);
            setEditing(null);
          }}
          onSave={handleSave}
        />
      ) : null}
    </>
  );
}

PortalPropertiesPage.getLayout = function getLayout(page) {
  return <DashboardLayout title="My Properties">{page}</DashboardLayout>;
};
