import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { format, isToday, isFuture, parseISO } from 'date-fns';
import { useUser } from '@auth0/nextjs-auth0/client';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import StatusBadge from '../../components/ui/StatusBadge';
import { apiClient } from '../../utils/api-client';

// ── Appliance Icons (same as work orders test) ────────────────────────────
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
  tv:             { color: 'orange', svg: (<><rect x="2" y="4" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="18" x2="12" y2="21"/></>) },
  default:        { color: 'cyan',   svg: (<><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></>) },
};

function ApplianceIcon({ equipmentType, equipmentSubtype, size = 'md' }) {
  const raw = equipmentSubtype || equipmentType || '';
  const key = raw.toLowerCase().replace(/[^a-z]/g, '');
  const match = APPLIANCE_ICONS[key] || APPLIANCE_ICONS.default;
  const isCyan = match.color === 'cyan';
  const sz = size === 'lg' ? 'w-12 h-12' : 'w-9 h-9';
  return (
    <svg viewBox="0 0 24 24" className={sz} style={{
      stroke: isCyan ? '#00D4FF' : '#FF7A00', strokeWidth: 1.5, fill: 'none',
      strokeLinecap: 'round', strokeLinejoin: 'round',
      filter: isCyan ? 'drop-shadow(0 0 6px rgba(0,212,255,0.6))' : 'drop-shadow(0 0 6px rgba(255,122,0,0.6))'
    }}>{match.svg}</svg>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, subColor = '#22D3EE', borderColor = 'rgba(34,211,238,0.3)', href }) {
  const inner = (
    <div className="flex items-center gap-3 p-4 rounded-lg h-full" style={{ background: '#0D1525', border: `1px solid ${borderColor}` }}>
      <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#080C14' }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400 mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
        {sub && <p className="text-xs mt-0.5" style={{ color: subColor }}>{sub}</p>}
      </div>
      <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0 text-gray-600" style={{ stroke: 'currentColor', strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </div>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : <div>{inner}</div>;
}

// ── Today Job Row ─────────────────────────────────────────────────────────
function TodayJobRow({ appt }) {
  const start = appt.scheduled_start
    ? new Date((appt.scheduled_start.endsWith('Z') ? appt.scheduled_start : appt.scheduled_start + 'Z'))
    : null;
  const timeStr = start ? format(start, 'h:mm') : '--:--';
  const ampm = start ? format(start, 'a') : '';
  const client = appt.client_name || 'Unknown Client';
  const equip = [appt.equipment_make, appt.equipment_model].filter(Boolean).join(' ') || appt.equipment_type || 'Appliance';
  const address = appt.service_address || appt.client_address || '';

  return (
    <Link href={`/work_orders/${appt.work_order_id}`} className="flex items-start gap-3 py-3 border-b border-white/5 last:border-0">
      {/* Time block */}
      <div className="flex-shrink-0 w-12 text-right">
        <p className="text-sm font-bold text-cyan-400">{timeStr}</p>
        <p className="text-xs text-gray-500">{ampm}</p>
      </div>
      {/* Divider */}
      <div className="flex-shrink-0 w-px self-stretch bg-cyan-500/30 mx-1" />
      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{client}</p>
        <p className="text-xs text-gray-400 truncate">{equip}</p>
        {address && (
          <div className="flex items-center gap-1 mt-0.5">
            <svg viewBox="0 0 24 24" className="w-3 h-3 flex-shrink-0" style={{ stroke: '#6B7280', strokeWidth: 1.5, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            <p className="text-xs text-gray-500 truncate">{address}</p>
          </div>
        )}
      </div>
      {/* Status */}
      <div className="flex-shrink-0">
        <StatusBadge status={appt.status} />
      </div>
    </Link>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function TechDashboardTest() {
  const { user } = useUser();
  const [schedule, setSchedule] = useState([]);
  const [workOrderStats, setWorkOrderStats] = useState({ total: 0, today: 0, completed_today: 0, partsWaiting: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const nextWeekStr = format(new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');

  useEffect(() => {
    async function load() {
      try {
        const [schedData, woData, woItems] = await Promise.all([
          apiClient(`scheduling/schedule/combined?start_date=${todayStr}&end_date=${nextWeekStr}&view_type=day`),
          apiClient(`work-orders?page=1&limit=1`),
          apiClient(`work-orders?page=1&limit=200`),
        ]);
        const appts = schedData?.appointments || schedData?.schedule || schedData?.data || [];
        setSchedule(Array.isArray(appts) ? appts : []);
        const allItems = woItems?.items || [];
        const todayItems = allItems.filter(w => {
          if (!w.scheduled_start) return false;
          const d = new Date(w.scheduled_start.endsWith('Z') ? w.scheduled_start : w.scheduled_start + 'Z');
          return isToday(d);
        });
        const partsWaiting = allItems.filter(w =>
          w.parts && w.parts.some(p => ['ordered', 'needed'].includes(p.status))
        ).length;
        setWorkOrderStats({
          total: woData?.total || 0,
          today: todayItems.length,
          completed_today: todayItems.filter(w => w.status === 'completed').length,
          partsWaiting,
        });
      } catch (e) {
        console.error('Dashboard load error:', e);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [todayStr, nextWeekStr]);

  const todayAppts = schedule.filter(a => {
    if (!a.scheduled_start) return false;
    const d = new Date(a.scheduled_start.endsWith('Z') ? a.scheduled_start : a.scheduled_start + 'Z');
    return isToday(d);
  }).sort((a, b) => new Date(a.scheduled_start) - new Date(b.scheduled_start));

  const upcomingAppts = schedule.filter(a => {
    if (!a.scheduled_start) return false;
    const d = new Date(a.scheduled_start.endsWith('Z') ? a.scheduled_start : a.scheduled_start + 'Z');
    return isFuture(d) && !isToday(d);
  }).sort((a, b) => new Date(a.scheduled_start) - new Date(b.scheduled_start));

  const nextJob = todayAppts.find(a => {
    const d = new Date(a.scheduled_start.endsWith('Z') ? a.scheduled_start : a.scheduled_start + 'Z');
    return d >= new Date();
  }) || todayAppts[0];

  const firstName = user?.given_name || user?.name?.split(' ')[0] || 'Tech';

  return (
    <>
      <Head>
        <title>Tech Dashboard Test | IDIMS</title>
        <style>{`
          header, nav, .header-bar, [class*='h-16'] {
            background-color: #0D1525 !important;
            border-bottom: 1px solid rgba(255,255,255,0.07) !important;
            z-index: 50 !important;
          }
        `}</style>
      </Head>

      <div className="min-h-screen pb-24" style={{ background: '#0A0F1E' }}>
        <div className="px-4 py-5 max-w-lg mx-auto">

          {/* Page Header */}
          <div className="mb-5">
            <p className="text-sm text-gray-500">Good {getGreeting()},</p>
            <h1 className="text-2xl font-bold text-white">{firstName}</h1>
            <p className="text-xs text-gray-500 mt-0.5">{format(today, 'EEEE, MMMM d, yyyy')}</p>
          </div>

          {/* ── NEXT JOB CARD ── */}
          {nextJob ? (
            <div className="rounded-lg p-4 mb-4" style={{ background: '#0D1525', border: '1px solid rgba(34,211,238,0.35)' }}>
              <div className="flex justify-between items-start mb-3">
                <p className="text-xs font-medium text-cyan-400 tracking-wider uppercase">Next Job</p>
                <StatusBadge status={nextJob.status} />
              </div>
              <div className="flex gap-4">
                <div className="w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#080C14' }}>
                  <ApplianceIcon
                    equipmentType={nextJob.equipment_type}
                    equipmentSubtype={nextJob.equipment_subtype}
                    size="lg"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-bold text-white">
                    Today at {nextJob.scheduled_start
                      ? format(new Date(nextJob.scheduled_start.endsWith('Z') ? nextJob.scheduled_start : nextJob.scheduled_start + 'Z'), 'h:mm a')
                      : 'TBD'}
                  </p>
                  <p className="text-sm font-medium text-white mt-0.5">{nextJob.client_name || 'Unknown Client'}</p>
                  <p className="text-xs text-gray-400">{[nextJob.equipment_make, nextJob.equipment_model].filter(Boolean).join(' ') || 'Appliance'}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <svg viewBox="0 0 24 24" className="w-3 h-3 flex-shrink-0" style={{ stroke: '#6B7280', strokeWidth: 1.5, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                    <p className="text-xs text-gray-500 truncate">{nextJob.service_address || nextJob.client_address || 'Address on file'}</p>
                  </div>
                </div>
              </div>

              {/* Call Customer button */}
              {nextJob.client_phone && (
                <a
                  href={`tel:${nextJob.client_phone}`}
                  className="mt-3 flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-medium transition-all"
                  style={{ background: '#080C14', border: '1px solid rgba(34,211,238,0.3)', color: '#22D3EE' }}
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" style={{ stroke: '#22D3EE', strokeWidth: 1.75, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.86a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                  Call Customer
                </a>
              )}
            </div>
          ) : (
            <div className="rounded-lg p-4 mb-4 text-center" style={{ background: '#0D1525', border: '1px solid rgba(34,211,238,0.2)' }}>
              <p className="text-sm text-gray-400">No upcoming jobs today</p>
            </div>
          )}

          {/* ── STAT CARDS ── */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <StatCard
              label="Jobs Completed"
              value={workOrderStats.completed_today}
              sub={`${todayAppts.length} scheduled today`}
              borderColor="rgba(34,211,238,0.25)"
              href="/work_orders"
              icon={
                <svg viewBox="0 0 24 24" className="w-6 h-6" style={{ stroke: '#22D3EE', strokeWidth: 1.5, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', filter: 'drop-shadow(0 0 4px rgba(0,212,255,0.7))' }}>
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              }
            />
            <StatCard
              label="Work Orders"
              value={workOrderStats.total}
              sub={`+${workOrderStats.today} today`}
              borderColor="rgba(255,122,0,0.25)"
              href="/work_orders"
              icon={
                <svg viewBox="0 0 24 24" className="w-6 h-6" style={{ stroke: '#FF7A00', strokeWidth: 1.5, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', filter: 'drop-shadow(0 0 4px rgba(255,122,0,0.7))' }}>
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                </svg>
              }
            />
            <StatCard
              label="Parts Waiting"
              value={workOrderStats.partsWaiting}
              sub={workOrderStats.partsWaiting > 0 ? 'orders on hold' : 'all parts in'}
              subColor={workOrderStats.partsWaiting > 0 ? '#FF7A00' : '#22D3EE'}
              borderColor={workOrderStats.partsWaiting > 0 ? 'rgba(255,122,0,0.4)' : 'rgba(34,211,238,0.2)'}
              href="/work_orders"
              icon={
                <svg viewBox="0 0 24 24" className="w-6 h-6" style={{ stroke: workOrderStats.partsWaiting > 0 ? '#FF7A00' : '#22D3EE', strokeWidth: 1.5, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', filter: workOrderStats.partsWaiting > 0 ? 'drop-shadow(0 0 4px rgba(255,122,0,0.7))' : 'drop-shadow(0 0 4px rgba(0,212,255,0.5))' }}>
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
                </svg>
              }
            />
            <StatCard
              label="Today's Jobs"
              value={todayAppts.length}
              sub={nextJob?.scheduled_start ? `next at ${format(new Date(nextJob.scheduled_start.endsWith('Z') ? nextJob.scheduled_start : nextJob.scheduled_start + 'Z'), 'h:mm a')}` : 'none remaining'}
              borderColor="rgba(34,211,238,0.25)"
              href="/schedule"
              icon={
                <svg viewBox="0 0 24 24" className="w-6 h-6" style={{ stroke: '#22D3EE', strokeWidth: 1.5, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', filter: 'drop-shadow(0 0 4px rgba(0,212,255,0.7))' }}>
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              }
            />
          </div>

          {/* ── TODAY'S JOBS ── */}
          <div className="rounded-lg p-4 mb-4" style={{ background: '#0D1525', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-base font-bold text-white">Today's Jobs</h2>
              <Link href="/schedule" className="text-xs text-cyan-400 flex items-center gap-1">
                View all
                <svg viewBox="0 0 24 24" className="w-3 h-3" style={{ stroke: 'currentColor', strokeWidth: 2.5, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}><polyline points="9 18 15 12 9 6"/></svg>
              </Link>
            </div>
            {todayAppts.length === 0 ? (
              <div className="py-6 text-center">
                <svg viewBox="0 0 24 24" className="w-10 h-10 mx-auto mb-2" style={{ stroke: '#374151', strokeWidth: 1.5, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <p className="text-sm text-gray-500">No jobs scheduled today</p>
              </div>
            ) : (
              todayAppts.map((a, i) => <TodayJobRow key={a.id || i} appt={a} />)
            )}
          </div>

          {/* ── UPCOMING APPOINTMENTS ── */}
          <div className="rounded-lg p-4 mb-4" style={{ background: '#0D1525', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-base font-bold text-white">Upcoming Appointments</h2>
              <Link href="/schedule" className="text-xs text-cyan-400 flex items-center gap-1">
                View all
                <svg viewBox="0 0 24 24" className="w-3 h-3" style={{ stroke: 'currentColor', strokeWidth: 2.5, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}><polyline points="9 18 15 12 9 6"/></svg>
              </Link>
            </div>
            {upcomingAppts.length === 0 ? (
              <div className="py-6 text-center">
                <svg viewBox="0 0 24 24" className="w-10 h-10 mx-auto mb-2" style={{ stroke: '#374151', strokeWidth: 1.5, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <p className="text-sm text-gray-500">No upcoming appointments</p>
              </div>
            ) : (
              upcomingAppts.slice(0, 3).map((a, i) => <TodayJobRow key={a.id || i} appt={a} />)
            )}
          </div>

        </div>

        {/* ── BOTTOM ACTION BUTTONS ── */}
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-4 pt-3 max-w-lg mx-auto" style={{ background: '#0A0F1E', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="grid grid-cols-3 gap-2">
            {/* New Work Order */}
            <Link href="/work_orders/new" className="relative flex flex-col items-center justify-center gap-1 py-3 rounded-lg text-xs font-medium text-white overflow-hidden active:scale-95 transition-transform" style={{ background: '#0D1525', border: '1px solid rgba(34,211,238,0.5)', boxShadow: '0 0 10px rgba(0,212,255,0.15)' }}>
              <div className="absolute inset-0 rounded-lg" style={{ background: 'radial-gradient(ellipse at 0% 0%, rgba(0,212,255,0.12) 0%, transparent 55%), radial-gradient(ellipse at 100% 0%, rgba(0,212,255,0.12) 0%, transparent 55%), radial-gradient(ellipse at 0% 100%, rgba(0,212,255,0.12) 0%, transparent 55%), radial-gradient(ellipse at 100% 100%, rgba(0,212,255,0.12) 0%, transparent 55%)' }} />
              <svg viewBox="0 0 24 24" className="relative z-10 w-5 h-5" style={{ stroke: '#00D4FF', strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', filter: 'drop-shadow(0 0 5px rgba(0,212,255,0.9))' }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span className="relative z-10" style={{ textShadow: '0 0 8px rgba(0,212,255,0.6)' }}>New WO</span>
            </Link>

            {/* Scan Model/Serial */}
            <button className="relative flex flex-col items-center justify-center gap-1 py-3 rounded-lg text-xs font-medium text-white overflow-hidden active:scale-95 transition-transform" style={{ background: '#0D1525', border: '1px solid rgba(255,122,0,0.5)', boxShadow: '0 0 10px rgba(255,122,0,0.15)' }}>
              <div className="absolute inset-0 rounded-lg" style={{ background: 'radial-gradient(ellipse at 0% 0%, rgba(255,122,0,0.12) 0%, transparent 55%), radial-gradient(ellipse at 100% 0%, rgba(255,122,0,0.12) 0%, transparent 55%), radial-gradient(ellipse at 0% 100%, rgba(255,122,0,0.12) 0%, transparent 55%), radial-gradient(ellipse at 100% 100%, rgba(255,122,0,0.12) 0%, transparent 55%)' }} />
              <svg viewBox="0 0 24 24" className="relative z-10 w-5 h-5" style={{ stroke: '#FF7A00', strokeWidth: 1.75, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', filter: 'drop-shadow(0 0 5px rgba(255,122,0,0.9))' }}>
                <path d="M3 9V6a1 1 0 0 1 1-1h3M3 15v3a1 1 0 0 0 1 1h3M21 9V6a1 1 0 0 0-1-1h-3M21 15v3a1 1 0 0 1-1 1h-3"/>
                <line x1="7" y1="12" x2="7" y2="12"/><line x1="10" y1="8" x2="10" y2="16"/><line x1="13" y1="10" x2="13" y2="14"/><line x1="16" y1="12" x2="16" y2="12"/>
              </svg>
              <span className="relative z-10" style={{ textShadow: '0 0 8px rgba(255,122,0,0.6)' }}>Scan</span>
            </button>

            {/* Call Next Client */}
            {nextJob?.client_phone ? (
              <a href={`tel:${nextJob.client_phone}`} className="relative flex flex-col items-center justify-center gap-1 py-3 rounded-lg text-xs font-medium text-white overflow-hidden active:scale-95 transition-transform" style={{ background: '#0D1525', border: '1px solid rgba(34,211,238,0.5)', boxShadow: '0 0 10px rgba(0,212,255,0.15)' }}>
                <div className="absolute inset-0 rounded-lg" style={{ background: 'radial-gradient(ellipse at 0% 0%, rgba(0,212,255,0.12) 0%, transparent 55%), radial-gradient(ellipse at 100% 0%, rgba(0,212,255,0.12) 0%, transparent 55%), radial-gradient(ellipse at 0% 100%, rgba(0,212,255,0.12) 0%, transparent 55%), radial-gradient(ellipse at 100% 100%, rgba(0,212,255,0.12) 0%, transparent 55%)' }} />
                <svg viewBox="0 0 24 24" className="relative z-10 w-5 h-5" style={{ stroke: '#00D4FF', strokeWidth: 1.75, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', filter: 'drop-shadow(0 0 5px rgba(0,212,255,0.9))' }}>
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.86a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                <span className="relative z-10" style={{ textShadow: '0 0 8px rgba(0,212,255,0.6)' }}>Call Next</span>
              </a>
            ) : (
              <button disabled className="flex flex-col items-center justify-center gap-1 py-3 rounded-lg text-xs font-medium text-gray-600" style={{ background: '#0D1525', border: '1px solid rgba(255,255,255,0.05)' }}>
                <svg viewBox="0 0 24 24" className="w-5 h-5" style={{ stroke: '#4B5563', strokeWidth: 1.75, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.86a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                Call Next
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

TechDashboardTest.getLayout = (page) => <DashboardLayout>{page}</DashboardLayout>;