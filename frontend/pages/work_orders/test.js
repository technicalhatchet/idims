import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { format } from 'date-fns';
import StatusBadge from '../../components/ui/StatusBadge';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import { useWorkOrders } from '../../hooks/useWorkOrders';

const APPLIANCE_ICONS = {
  refrigerator:   { color: 'cyan',   svg: (<><rect x="6" y="2" width="12" height="20" rx="2"/><line x1="6" y1="10" x2="18" y2="10"/><line x1="10" y1="5" x2="10" y2="8"/><line x1="10" y1="13" x2="10" y2="16"/></>) },
  fridge:         { color: 'cyan',   svg: (<><rect x="6" y="2" width="12" height="20" rx="2"/><line x1="6" y1="10" x2="18" y2="10"/><line x1="10" y1="5" x2="10" y2="8"/><line x1="10" y1="13" x2="10" y2="16"/></>) },
  washingmachine: { color: 'cyan',   svg: (<><rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="13" r="5"/><circle cx="12" cy="13" r="2"/><circle cx="8" cy="6" r="1"/></>) },
  washer:         { color: 'cyan',   svg: (<><rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="13" r="5"/><circle cx="12" cy="13" r="2"/><circle cx="8" cy="6" r="1"/></>) },
  dryer:          { color: 'orange', svg: (<><rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="13" r="5"/><path d="M10 11a2 2 0 0 0 4 0"/><circle cx="8" cy="6" r="1"/></>) },
  dishwasher:     { color: 'cyan',   svg: (<><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="4" y1="8" x2="20" y2="8"/><line x1="9" y1="5" x2="15" y2="5"/></>) },
  oven:           { color: 'orange', svg: (<><rect x="4" y="2" width="16" height="20" rx="2"/><rect x="6" y="10" width="12" height="9" rx="1"/><line x1="7" y1="6" x2="7" y2="6"/><line x1="10" y1="6" x2="10" y2="6"/><line x1="13" y1="6" x2="13" y2="6"/><line x1="16" y1="6" x2="16" y2="6"/></>) },
  microwave:      { color: 'orange', svg: (<><rect x="2" y="6" width="20" height="12" rx="2"/><rect x="4" y="8" width="12" height="8"/><line x1="18" y1="10" x2="18" y2="10"/><line x1="18" y1="12" x2="18" y2="12"/><line x1="18" y1="14" x2="18" y2="14"/></>) },
  freezer:        { color: 'cyan',   svg: (<><rect x="3" y="6" width="18" height="14" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="6" x2="12" y2="10"/></>) },
  cooktop:        { color: 'orange', svg: (<><rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="8" cy="10" r="2"/><circle cx="16" cy="10" r="2"/><circle cx="8" cy="16" r="2"/><circle cx="16" cy="16" r="2"/></>) },
  rangehood:      { color: 'orange', svg: (<><path d="M6 3h12l2 7H4L6 3z"/><rect x="4" y="10" width="16" height="4" rx="1"/><line x1="8" y1="14" x2="8" y2="21"/><line x1="16" y1="14" x2="16" y2="21"/></>) },
  tv:             { color: 'orange', svg: (<><rect x="2" y="4" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="18" x2="12" y2="21"/></>) },
  default:        { color: 'cyan',   svg: (<><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></>) },
};

function ApplianceIcon({ equipmentType, equipmentSubtype }) {
  const raw = equipmentSubtype || equipmentType || '';
  const key = raw.toLowerCase().replace(/[^a-z]/g, '');
  console.log('ApplianceIcon key:', key, '| subtype:', equipmentSubtype, '| type:', equipmentType);
  const match = APPLIANCE_ICONS[key] || APPLIANCE_ICONS.default;
  const isCyan = match.color === 'cyan';
  return (
    <svg viewBox="0 0 24 24" className="w-10 h-10" style={{
      stroke: isCyan ? '#00D4FF' : '#FF7A00', strokeWidth: 1.5, fill: 'none',
      strokeLinecap: 'round', strokeLinejoin: 'round',
      filter: isCyan ? 'drop-shadow(0 0 6px rgba(0,212,255,0.6))' : 'drop-shadow(0 0 6px rgba(255,122,0,0.6))'
    }}>{match.svg}</svg>
  );
}

function Card({ wo }) {
  const clientName = wo.client?.company_name || wo.client_name || `${wo.client?.first_name || ''} ${wo.client?.last_name || ''}`.trim() || 'No client';
  const schedDate = wo.scheduled_start ? format(new Date(wo.scheduled_start.endsWith('Z') ? wo.scheduled_start : wo.scheduled_start + 'Z'), 'MMM d, yyyy h:mm a') : 'Not scheduled';
  const equipLabel = [wo.equipment_make, wo.equipment_model].filter(Boolean).join(' ') || (wo.equipment_type || '').replace(/_/g, ' ') || 'Unknown appliance';

  return (
    <Link href={`/work_orders/${wo.id}`} className="flex items-center gap-4 px-4 py-3 rounded-lg bg-[#0D1525] border border-white/10 hover:border-cyan-500/30 transition-all">
      <div className="flex-shrink-0 w-14 h-14 rounded-lg border border-white/10 flex items-center justify-center" style={{ background: '#0e121b' }}>
        <ApplianceIcon equipmentType={wo.equipment_type} equipmentSubtype={wo.equipment_subtype} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start mb-0.5">
          <span className="text-sm font-bold text-cyan-400">{wo.order_number}</span>
          <StatusBadge status={wo.status} />
        </div>
        <p className="text-sm font-medium text-white truncate">{clientName}</p>
        <p className="text-xs text-gray-400 truncate">{equipLabel}</p>
        <p className="text-xs text-gray-500 mt-0.5">{schedDate}</p>
        {wo.description && <p className="text-xs text-gray-500 truncate mt-0.5">{wo.description}</p>}
      </div>
      <div className="flex-shrink-0 text-gray-600 text-xl">›</div>
    </Link>
  );
}

export default function WorkOrdersTest() {
  const { data, isLoading, error } = useWorkOrders({ page: 1, limit: 100 });
  const [sortBy, setSortBy] = useState('newest');
  const [page, setPage] = useState(1);
  const PER_PAGE = 5;

  const sorted = [...(data?.items || [])].sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    if (sortBy === 'oldest') return new Date(a.created_at || 0) - new Date(b.created_at || 0);
    if (sortBy === 'status') return (a.status || '').localeCompare(b.status || '');
    return 0;
  });

  const totalPages = Math.ceil(sorted.length / PER_PAGE);
  const paginated = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const count = data?.total || sorted.length;

  const handleSort = (val) => {
    setSortBy(val);
    setPage(1);
  };

  return (
    <>
      <Head>
        <title>Work Orders Test | IDIMS</title>
        <style>{`
          header, nav, .header-bar, [class*='h-16'] {
            background-color: #0D1525 !important;
            border-bottom: 1px solid rgba(255,255,255,0.07) !important;
          }
        `}</style>
      </Head>
      <div className="min-h-screen" style={{ background: '#0A0F1E' }}>
      <div className="px-4 py-6 max-w-lg mx-auto">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-white">Work Orders <span className="text-xs text-orange-400 ml-2">[TEST]</span></h1>
          <Link href="/work_orders" className="text-xs text-gray-500 hover:text-gray-300">← Real page</Link>
        </div>

        {/* New Work Order button */}
        <Link href="/work_orders/new" className="relative block w-full py-3 mb-3 rounded-lg font-medium text-white text-center bg-[#0D1525] border border-cyan-400/60 shadow-[0_0_8px_rgba(0,212,255,0.3)] transition-all duration-300 active:scale-[0.97] hover:shadow-[0_0_12px_rgba(0,212,255,0.45)] overflow-hidden">
          <div className="absolute inset-0 rounded-xl" style={{ background: 'radial-gradient(ellipse at 0% 0%, rgba(0,212,255,0.18) 0%, transparent 50%), radial-gradient(ellipse at 100% 0%, rgba(0,212,255,0.18) 0%, transparent 50%), radial-gradient(ellipse at 0% 100%, rgba(0,212,255,0.18) 0%, transparent 50%), radial-gradient(ellipse at 100% 100%, rgba(0,212,255,0.18) 0%, transparent 50%), radial-gradient(ellipse at 50% 0%, rgba(0,212,255,0.08) 0%, transparent 55%), radial-gradient(ellipse at 50% 100%, rgba(0,212,255,0.08) 0%, transparent 55%)' }} />
          <span className="relative z-10 flex items-center justify-center gap-2" style={{ textShadow: '0 0 8px rgba(0,212,255,0.6), 0 0 20px rgba(0,212,255,0.3)' }}>
            <span className="text-xl font-bold" style={{ textShadow: '0 0 8px rgba(0,212,255,0.9), 0 0 20px rgba(0,212,255,0.6), 0 0 35px rgba(0,212,255,0.3)' }}>+</span>
            New Work Order
          </span>
        </Link>

        {/* Filter button */}
        <button className="w-full py-2.5 mb-4 rounded-lg flex items-center justify-center gap-2 text-sm font-medium text-white transition-all duration-200 active:scale-[0.97]" style={{ background: '#0A0F1E', border: '1px solid #FF7A00' }}>
          <svg viewBox="0 0 24 24" className="w-4 h-4" style={{ stroke: '#FF7A00', strokeWidth: 1.75, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
          </svg>
          Filters
        </button>

        {/* Cards container */}
        <div className="rounded-lg p-3" style={{ background: '#080C14', border: '1px solid rgba(255,255,255,0.07)' }}>
          {/* Container header */}
          <div className="flex justify-between items-center mb-3 px-1">
            <span className="text-sm font-medium text-gray-300">{count} Work Orders</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">Sort:</span>
              <select
                value={sortBy}
                onChange={e => handleSort(e.target.value)}
                className="text-xs font-medium text-cyan-400 bg-transparent border-none outline-none cursor-pointer"
              >
                <option value="newest" className="bg-gray-900 text-white">Date (Newest)</option>
                <option value="oldest" className="bg-gray-900 text-white">Date (Oldest)</option>
                <option value="status" className="bg-gray-900 text-white">Status</option>
              </select>
              <svg viewBox="0 0 24 24" className="w-3 h-3" style={{ stroke: '#22D3EE', strokeWidth: 2.5, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>
          </div>

          {isLoading && <p className="text-gray-400 text-sm px-1">Loading...</p>}
          {error && <p className="text-red-400 text-sm px-1">Error loading</p>}

          <div className="space-y-2">
            {paginated.map(wo => <Card key={wo.id} wo={wo} />)}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4 pt-3 border-t border-white/5">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 disabled:opacity-30 transition-all"
                style={{ background: '#0A0F1E' }}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" style={{ stroke: 'currentColor', strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className="w-8 h-8 rounded-lg text-xs font-medium transition-all"
                  style={{ background: page === n ? '#0D1525' : '#0A0F1E',
                    color: page === n ? '#22D3EE' : '#6B7280',
                    border: page === n ? '1px solid rgba(34,211,238,0.5)' : '1px solid rgba(255,255,255,0.05)'
                  }}
                >
                  {n}
                </button>
              ))}

              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 disabled:opacity-30 transition-all"
                style={{ background: '#0A0F1E' }}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" style={{ stroke: 'currentColor', strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </div>
          )}
        </div>

      </div>
      </div>
    </>
  );
}

WorkOrdersTest.getLayout = (page) => <DashboardLayout>{page}</DashboardLayout>;