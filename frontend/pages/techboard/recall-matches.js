import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import TechDashboardLayout from '../../components/layouts/TechDashboardLayout';
import { apiClient } from '../../utils/api-client';
import toast from 'react-hot-toast';
import Link from 'next/link';

function RecallMatchesPage() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = filter ? `?status=${filter}` : '';
      const data = await apiClient(`/api/recalls/matches${q}`);
      setRows(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Failed to load recall matches');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    const status = router.query?.status;
    if (status === 'pending' || status === 'confirmed' || status === 'dismissed') {
      setFilter(status);
    }
  }, [router.query?.status]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (id, action) => {
    try {
      await apiClient(`/api/recalls/matches/${id}/${action}`, { method: 'POST' });
      toast.success(action === 'confirm' ? 'Confirmed — customer notified' : 'Dismissed');
      load();
    } catch {
      toast.error(`Failed to ${action}`);
    }
  };

  return (
    <div className="min-h-screen p-4 sm:p-6" style={{ background: '#0B0F1A' }}>
      <div className="max-w-3xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Recall matches</h1>
          <p className="text-gray-400 text-sm mt-1">
            Review CPSC matches before customers see them. Needs review = pending only.
          </p>
        </div>

        <div className="flex gap-2">
          {['pending', 'confirmed', 'dismissed'].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm ${
                filter === s ? 'bg-cyan-500/20 text-cyan-300' : 'text-gray-400 hover:bg-white/5'
              }`}
            >
              {s === 'pending' ? 'Needs review' : s}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-gray-500 text-sm">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-gray-500 text-sm">No matches in this tab.</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => (
              <li
                key={row.id}
                className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-white font-semibold">{row.recall?.title}</p>
                    <p className="text-xs text-gray-500">
                      {row.appliance_make} {row.appliance_model} · matched {row.matched_on} (
                      {row.match_rule})
                    </p>
                  </div>
                  <span className="text-xs uppercase tracking-wide text-gray-400">{row.status}</span>
                </div>
                {row.recall?.hazard && (
                  <p className="text-sm text-amber-200/90"><strong>Hazard:</strong> {row.recall.hazard}</p>
                )}
                {row.recall?.remedy && (
                  <p className="text-sm text-gray-300"><strong>Remedy:</strong> {row.recall.remedy}</p>
                )}
                {row.recall?.url && (
                  <a
                    href={row.recall.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-cyan-400 hover:underline"
                  >
                    CPSC listing
                  </a>
                )}
                <div className="flex flex-wrap gap-2 pt-2">
                  {row.status === 'pending' && (
                    <>
                      <button
                        type="button"
                        onClick={() => act(row.id, 'confirm')}
                        className="px-3 py-1.5 text-sm rounded-lg bg-emerald-500/20 text-emerald-300"
                      >
                        Confirm & notify customer
                      </button>
                      <button
                        type="button"
                        onClick={() => act(row.id, 'dismiss')}
                        className="px-3 py-1.5 text-sm rounded-lg bg-white/10 text-gray-300"
                      >
                        Dismiss false positive
                      </button>
                    </>
                  )}
                  {row.client_id && (
                    <Link
                      href={`/clients/${row.client_id}/mobile`}
                      className="px-3 py-1.5 text-sm rounded-lg text-cyan-400"
                    >
                      Client
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

RecallMatchesPage.getLayout = function getLayout(page) {
  return <TechDashboardLayout>{page}</TechDashboardLayout>;
};

export default RecallMatchesPage;
