import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { format, isToday, isFuture } from 'date-fns';
import { useUser } from '@auth0/nextjs-auth0/client';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import StatusBadge from '../../components/ui/StatusBadge';
import { apiClient } from '../../utils/api-client';

// ── Appliance Icons ─────────────────────────────────────────
const APPLIANCE_ICONS = {
  washer: { color: 'cyan', svg: (<><rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="13" r="5"/></>) },
  dryer: { color: 'orange', svg: (<><rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="13" r="5"/></>) },
  default: { color: 'cyan', svg: (<><circle cx="12" cy="12" r="8"/></>) },
};

function ApplianceIcon({ equipmentType }) {
  const key = (equipmentType || '').toLowerCase();
  const match = APPLIANCE_ICONS[key] || APPLIANCE_ICONS.default;
  const isCyan = match.color === 'cyan';

  return (
    <svg viewBox="0 0 24 24" className="w-12 h-12"
      style={{
        stroke: isCyan ? '#00D4FF' : '#FF7A00',
        strokeWidth: 1.5,
        fill: 'none',
        filter: `drop-shadow(0 0 6px ${isCyan ? 'rgba(0,212,255,0.6)' : 'rgba(255,122,0,0.6)'})`
      }}>
      {match.svg}
    </svg>
  );
}

// ── Stat Card ───────────────────────────────────────────────
function StatCard({ label, value, sub, icon, borderColor }) {
  return (
    <div className="p-4 rounded-lg"
      style={{ background: '#0D1525', border: `1px solid ${borderColor}` }}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 flex items-center justify-center rounded bg-[#080C14]">
          {icon}
        </div>
        <div>
          <p className="text-xs text-gray-400">{label}</p>
          <p className="text-xl font-bold text-white">{value}</p>
          {sub && <p className="text-xs text-cyan-400">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────
export default function TechDashboardTest() {
  const { user } = useUser();

  const [schedule, setSchedule] = useState([]);
  const [workOrderStats, setWorkOrderStats] = useState({
    total: 0,
    today: 0,
    completed_today: 0
  });

  const [jobStatus, setJobStatus] = useState('scheduled');

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  useEffect(() => {
    async function load() {
      const schedData = await apiClient(
        `scheduling/schedule/combined?start_date=${todayStr}&end_date=${todayStr}`
      );
      const appts = schedData?.appointments || [];
      setSchedule(appts);

      const todayWo = await apiClient(`work-orders?scheduled_date=${todayStr}`);
      const completed = (todayWo?.items || []).filter(w => w.status === 'completed').length;

      setWorkOrderStats({
        total: todayWo?.total || 0,
        today: todayWo?.total || 0,
        completed_today: completed
      });
    }
    load();
  }, []);

  const todayAppts = schedule.filter(a =>
    a.scheduled_start && isToday(new Date(a.scheduled_start))
  );

  const nextJob = todayAppts[0];

  const progress = todayAppts.length
    ? (workOrderStats.completed_today / todayAppts.length) * 100
    : 0;

  function handleEnRoute() {
    setJobStatus('en_route');
  }

  function handleStartJob() {
    setJobStatus('in_progress');
  }

  function handleCompleteJob() {
    setJobStatus('completed');
  }

  return (
    <>
      <Head>
        <title>Tech Dashboard</title>
      </Head>

      <div className="min-h-screen px-4 py-5" style={{ background: '#0A0F1E' }}>

        {/* HEADER */}
        <div className="mb-4">
          <h1 className="text-xl text-white font-bold">
            {user?.given_name || 'Tech'}
          </h1>
          <p className="text-xs text-gray-500">
            {format(today, 'EEEE, MMM d')}
          </p>
        </div>

        {/* PROGRESS */}
        <div className="mb-5">
          <p className="text-xs text-gray-400 mb-1">
            {workOrderStats.completed_today} / {todayAppts.length} jobs completed
          </p>
          <div className="w-full h-2 bg-white/5 rounded">
            <div
              className="h-full rounded"
              style={{
                width: `${progress}%`,
                background: '#22D3EE'
              }}
            />
          </div>
        </div>

        {/* NEXT JOB */}
        {nextJob && (
          <div className="p-4 rounded-lg mb-5"
            style={{ background: '#0D1525', border: '1px solid rgba(34,211,238,0.4)' }}>

            <p className="text-xs text-cyan-400 mb-2">NEXT JOB</p>

            <div className="flex gap-3">
              <ApplianceIcon equipmentType={nextJob.equipment_type} />
              <div>
                <p className="text-white font-bold">
                  {format(new Date(nextJob.scheduled_start), 'h:mm a')}
                </p>
                <p className="text-sm text-white">{nextJob.client_name}</p>
              </div>
            </div>

            {/* ACTIONS */}
            <div className="grid grid-cols-2 gap-2 mt-3">

              {jobStatus === 'scheduled' && (
                <>
                  <button onClick={handleEnRoute}
                    className="py-2 rounded border border-cyan-400 text-cyan-400">
                    En Route
                  </button>

                  <button onClick={handleStartJob}
                    className="py-2 rounded bg-orange-500 text-white">
                    Start Job
                  </button>
                </>
              )}

              {jobStatus === 'in_progress' && (
                <button onClick={handleCompleteJob}
                  className="col-span-2 py-2 rounded bg-cyan-400 text-black">
                  Complete Job
                </button>
              )}

            </div>
          </div>
        )}

        {/* STATS */}
        <div className="grid grid-cols-2 gap-3 mb-5">

          <StatCard
            label="Jobs Completed"
            value={workOrderStats.completed_today}
            sub="today"
            borderColor="rgba(34,211,238,0.3)"
            icon={<span>✔</span>}
          />

          <StatCard
            label="Parts"
            value="3"
            sub="waiting"
            borderColor="rgba(255,122,0,0.3)"
            icon={<span>📦</span>}
          />

        </div>

        {/* BOTTOM BAR */}
        <div className="fixed bottom-0 left-0 right-0 p-3 bg-[#0A0F1E] border-t border-white/10">
          <div className="grid grid-cols-3 gap-2">

            <Link href="/work_orders/new" className="btn-secondary text-center">
              + New
            </Link>

            {jobStatus === 'in_progress' ? (
              <button onClick={handleCompleteJob} className="btn-primary">
                Complete
              </button>
            ) : (
              <button onClick={handleStartJob} className="btn-primary">
                Start
              </button>
            )}

            <button className="btn-secondary-orange">
              Scan
            </button>

          </div>
        </div>

      </div>
    </>
  );
}

TechDashboardTest.getLayout = (page) => <DashboardLayout>{page}</DashboardLayout>;