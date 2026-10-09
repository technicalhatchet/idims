#!/usr/bin/env node
/** Quick HTTP smoke for TechDeck route migration (no auth session required). */
const base = process.env.SMOKE_BASE || 'http://localhost:3001';

const canonical = [
  '/techboard',
  '/techboard/work-orders',
  '/techboard/ops',
  '/techboard/mission-queue',
  '/techboard/mass',
  '/techboard/partswait',
  '/techboard/route',
  '/techboard/performance',
  '/techboard/dma',
  '/techboard/dma/new',
  '/techboard/dma/codes',
  '/solomon',
  '/solomon/knowledge',
];

const legacy = [
  ['/work_orders/test', '/techboard/work-orders'],
  ['/work_orders/mass', '/techboard/mass'],
  ['/work_orders/partswait', '/techboard/partswait'],
  ['/techdashboard/route', '/techboard/route'],
  ['/techdashboard/performance', '/techboard/performance'],
  ['/techdashboard/dma', '/techboard/dma'],
  ['/techdashboard/dma/codes', '/techboard/dma/codes'],
  ['/techdashboard/opsboard', '/techboard/mission-queue'],
  ['/schedule-test', '/techboard/ops'],
  ['/work_orders/123/debriefing', '/techboard/work-orders/123/debriefing'],
];

async function compileCheck(path) {
  const buildId = 'development';
  const jsonPath =
    path === '/techboard'
      ? `/_next/data/${buildId}/techboard.json`
      : `/_next/data/${buildId}${path}.json`;
  const res = await fetch(base + jsonPath, {
    headers: { 'x-nextjs-data': '1' },
    redirect: 'manual',
  });
  const text = await res.text();
  const compileErr =
    text.includes('Module not found') || text.includes('"message":"Module not found');
  return { status: res.status, compileErr, snippet: compileErr ? text.slice(0, 400) : '' };
}

async function legacyCheck([from, to]) {
  const res = await fetch(base + from, { redirect: 'manual' });
  const loc = res.headers.get('location') || '';
  const ok = res.status >= 300 && res.status < 400 && (loc.includes(to) || loc.replace(/\/$/, '') === to);
  return { from, status: res.status, location: loc, expected: to, ok };
}

let fail = 0;

console.log('=== Legacy redirects ===');
for (const pair of legacy) {
  const r = await legacyCheck(pair);
  if (!r.ok) {
    fail++;
    console.log('FAIL', r);
  } else console.log('OK', r.from, '->', r.location);
}

console.log('\n=== Compile smoke (_next/data, no module-not-found) ===');
for (const p of canonical) {
  try {
    const r = await compileCheck(p);
    if (r.compileErr) {
      fail++;
      console.log('FAIL compile', p, r.snippet);
    } else if (r.status >= 500) {
      fail++;
      console.log('FAIL status', p, r.status);
    } else {
      console.log('OK', p, r.status);
    }
  } catch (e) {
    fail++;
    console.log('ERR', p, e.message);
  }
}

console.log('\nFailures:', fail);
process.exit(fail ? 1 : 0);
