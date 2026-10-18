import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { FaArrowLeft, FaExchangeAlt } from 'react-icons/fa';
import TechDashboardLayout from '../../../components/layouts/TechDashboardLayout';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorAlert from '../../../components/ui/ErrorAlert';
import { withPageAuthRequired } from '../../../utils/auth0-helpers';
import { useUserRole } from '../../../context/UserRoleContext';
import {
  clientToSelectOption,
  executeClientMerge,
  getClients,
  previewClientMerge,
} from '../../../services/api/clientsApi';
import { useClient } from '../../../hooks/useClients';

const FIELD_KEYS = ['name', 'email', 'mobile', 'phone'];

function ChoiceToggle({ label, value, onChange, leftLabel, rightLabel }) {
  return (
    <div className="py-3 border-b border-cyan-500/10">
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        {['keep', 'merge'].map((side) => (
          <button
            key={side}
            type="button"
            onClick={() => onChange(side)}
            className="py-2.5 rounded-md text-sm font-semibold transition-all"
            style={{
              background: value === side ? 'rgba(34, 211, 238, 0.2)' : 'rgba(0,0,0,0.3)',
              border: value === side ? '1px solid rgba(34, 211, 238, 0.5)' : '1px solid rgba(100,100,100,0.3)',
              color: value === side ? '#22D3EE' : '#9CA3AF',
            }}
          >
            {side === 'keep' ? leftLabel : rightLabel}
          </button>
        ))}
      </div>
    </div>
  );
}

function ClientMergePage() {
  const router = useRouter();
  const { id: routeClientId } = router.query;
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { data: anchorClient, isLoading: anchorLoading } = useClient(routeClientId);

  const [step, setStep] = useState(1);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [otherClient, setOtherClient] = useState(null);
  const [survivorSide, setSurvivorSide] = useState('anchor');
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [fieldChoices, setFieldChoices] = useState({
    name: 'keep',
    email: 'keep',
    mobile: 'keep',
    phone: 'keep',
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const keepId = useMemo(() => {
    if (!anchorClient || !otherClient) return null;
    return survivorSide === 'anchor' ? anchorClient.id : otherClient.id;
  }, [anchorClient, otherClient, survivorSide]);

  const mergeId = useMemo(() => {
    if (!anchorClient || !otherClient) return null;
    return survivorSide === 'anchor' ? otherClient.id : anchorClient.id;
  }, [anchorClient, otherClient, survivorSide]);

  const runSearch = useCallback(async () => {
    if (!search.trim()) return;
    setSearchLoading(true);
    setError(null);
    try {
      const res = await getClients({ search: search.trim(), limit: 20, page: 1 });
      const items = (res.items || []).filter((c) => c.id !== routeClientId);
      setSearchResults(items);
    } catch (e) {
      setError(e.message || 'Search failed');
    } finally {
      setSearchLoading(false);
    }
  }, [search, routeClientId]);

  const loadPreview = useCallback(async () => {
    if (!keepId || !mergeId) return;
    setPreviewLoading(true);
    setError(null);
    try {
      const data = await previewClientMerge(keepId, mergeId);
      setPreview(data);
      setStep(3);
    } catch (e) {
      setError(e.message || 'Preview failed');
    } finally {
      setPreviewLoading(false);
    }
  }, [keepId, mergeId]);

  useEffect(() => {
    if (step === 3 && keepId && mergeId && !preview && !previewLoading) {
      loadPreview();
    }
  }, [step, keepId, mergeId, preview, previewLoading, loadPreview]);

  const handleConfirm = async () => {
    if (!preview?.can_merge || !keepId || !mergeId) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await executeClientMerge({
        keep_client_id: keepId,
        merge_client_id: mergeId,
        field_choices: fieldChoices,
      });
      sessionStorage.setItem(
        `merge_cleanup_warnings_${keepId}`,
        JSON.stringify(result.warnings || []),
      );
      router.push(`/clients/${keepId}/mobile`);
    } catch (e) {
      setError(e.message || 'Merge failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (roleLoading || anchorLoading) {
    return (
      <TechDashboardLayout>
        <LoadingSpinner />
      </TechDashboardLayout>
    );
  }

  if (!isAdmin) {
    return (
      <TechDashboardLayout>
        <div className="p-4">
          <ErrorAlert message="Admin access required to merge clients." />
        </div>
      </TechDashboardLayout>
    );
  }

  return (
    <TechDashboardLayout>
      <Head>
        <title>Merge duplicate client</title>
      </Head>
      <div className="px-4 pb-8" style={{ paddingTop: 'calc(64px + env(safe-area-inset-top) + 1rem)' }}>
        <div className="flex items-center gap-3 mb-4">
          <Link href={`/clients/${routeClientId}/mobile`} className="text-cyan-400 p-2">
            <FaArrowLeft />
          </Link>
          <h1 className="text-lg font-bold text-white">Merge duplicate</h1>
        </div>

        {error && <ErrorAlert message={error} className="mb-4" />}

        {step === 1 && anchorClient && (
          <div className="space-y-4">
            <p className="text-sm text-gray-300">
              Merging from <span className="text-cyan-400">{anchorClient.first_name} {anchorClient.last_name}</span>.
              Search for the other record.
            </p>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or email"
              className="w-full px-3 py-3 rounded-md text-white text-sm"
              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(34,211,238,0.2)' }}
            />
            <button
              type="button"
              onClick={runSearch}
              disabled={searchLoading}
              className="w-full py-3 rounded-md font-bold text-cyan-400"
              style={{ border: '1px solid rgba(34,211,238,0.4)', background: 'rgba(34,211,238,0.1)' }}
            >
              {searchLoading ? 'Searching…' : 'Search clients'}
            </button>
            <ul className="space-y-2">
              {searchResults.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setOtherClient(c);
                      setStep(2);
                    }}
                    className="w-full text-left p-3 rounded-md text-white text-sm"
                    style={{ background: 'rgba(13,21,37,0.85)', border: '1px solid rgba(34,211,238,0.2)' }}
                  >
                    {clientToSelectOption(c).label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {step === 2 && anchorClient && otherClient && (
          <div className="space-y-4">
            <p className="text-sm text-gray-300">Which record should survive?</p>
            <button
              type="button"
              onClick={() => setSurvivorSide('anchor')}
              className="w-full p-4 rounded-lg text-left"
              style={{
                border: survivorSide === 'anchor' ? '2px solid #22D3EE' : '1px solid rgba(34,211,238,0.2)',
                background: 'rgba(13,21,37,0.85)',
              }}
            >
              <p className="text-white font-semibold">Keep this client (opened from profile)</p>
              <p className="text-sm text-gray-400">{anchorClient.email || 'No email'}</p>
            </button>
            <button
              type="button"
              onClick={() => setSurvivorSide('other')}
              className="w-full p-4 rounded-lg text-left"
              style={{
                border: survivorSide === 'other' ? '2px solid #22D3EE' : '1px solid rgba(34,211,238,0.2)',
                background: 'rgba(13,21,37,0.85)',
              }}
            >
              <p className="text-white font-semibold">Keep other client</p>
              <p className="text-sm text-gray-400">{otherClient.email || 'No email'}</p>
            </button>
            <button
              type="button"
              onClick={() => {
                setPreview(null);
                loadPreview();
              }}
              disabled={previewLoading}
              className="w-full py-3 rounded-md font-bold text-white"
              style={{ background: 'linear-gradient(135deg, rgba(34,211,238,0.3), rgba(34,211,238,0.15))' }}
            >
              {previewLoading ? 'Loading preview…' : 'Preview merge'}
            </button>
          </div>
        )}

        {step === 3 && preview && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-md" style={{ background: 'rgba(0,0,0,0.3)' }}>
                <p className="text-cyan-400 font-bold mb-1">Keep</p>
                <p className="text-white">{preview.keep?.first_name} {preview.keep?.last_name}</p>
                <p className="text-gray-400">{preview.keep?.email}</p>
              </div>
              <div className="p-3 rounded-md" style={{ background: 'rgba(0,0,0,0.3)' }}>
                <p className="text-amber-400 font-bold mb-1">Merge in</p>
                <p className="text-white">{preview.merge?.first_name} {preview.merge?.last_name}</p>
                <p className="text-gray-400">{preview.merge?.email}</p>
              </div>
            </div>

            {preview.blockers?.length > 0 && (
              <ul className="space-y-2">
                {preview.blockers.map((b) => (
                  <li key={b.code} className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded p-2">
                    {b.message}
                  </li>
                ))}
              </ul>
            )}
            {preview.warnings?.length > 0 && (
              <ul className="space-y-2">
                {preview.warnings.map((w) => (
                  <li key={w.code + w.message} className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded p-2">
                    {w.message}
                  </li>
                ))}
              </ul>
            )}

            <div className="rounded-lg p-3" style={{ background: 'rgba(13,21,37,0.85)', border: '1px solid rgba(34,211,238,0.2)' }}>
              <p className="text-xs text-gray-400 uppercase mb-2">Rows moving to survivor</p>
              <ul className="text-sm text-gray-200 space-y-1">
                {Object.entries(preview.row_counts || {}).map(([table, count]) => (
                  <li key={table}>{table}: {count}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg p-3" style={{ background: 'rgba(13,21,37,0.85)', border: '1px solid rgba(34,211,238,0.2)' }}>
              <p className="text-xs text-gray-400 uppercase mb-2">Contact fields</p>
              <ChoiceToggle
                label="Name"
                value={fieldChoices.name}
                onChange={(v) => setFieldChoices((f) => ({ ...f, name: v }))}
                leftLabel="Keep record"
                rightLabel="Other record"
              />
              {FIELD_KEYS.filter((k) => k !== 'name').map((key) => (
                <ChoiceToggle
                  key={key}
                  label={key}
                  value={fieldChoices[key]}
                  onChange={(v) => setFieldChoices((f) => ({ ...f, [key]: v }))}
                  leftLabel="Keep"
                  rightLabel="Merge"
                />
              ))}
            </div>

            <button
              type="button"
              disabled={!preview.can_merge || submitting}
              onClick={handleConfirm}
              className="w-full py-3 rounded-md font-bold flex items-center justify-center gap-2 disabled:opacity-40"
              style={{
                background: preview.can_merge ? 'rgba(34,197,94,0.25)' : 'rgba(100,100,100,0.2)',
                border: '1px solid rgba(34,197,94,0.4)',
                color: '#86EFAC',
              }}
            >
              <FaExchangeAlt />
              {submitting ? 'Merging…' : 'Confirm merge'}
            </button>
          </div>
        )}
      </div>
    </TechDashboardLayout>
  );
}

export default withPageAuthRequired(ClientMergePage);
