/** Today's route drive time: shop → stops → shop (seconds). */

import { calculateTravelTime, DEFAULT_SHOP_ADDRESS } from './google-maps-service';

const AVG_MPH = 35;

function appointmentStartMs(appt) {
  const raw = appt?.scheduled_start || appt?.start;
  if (!raw) return NaN;
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : NaN;
}

export function sortAppointmentsByTime(appointments = []) {
  return [...appointments].sort((a, b) => {
    const ta = appointmentStartMs(a);
    const tb = appointmentStartMs(b);
    const aOk = Number.isFinite(ta);
    const bOk = Number.isFinite(tb);
    if (aOk && bOk && ta !== tb) return ta - tb;
    if (aOk && !bOk) return -1;
    if (!aOk && bOk) return 1;
    const ida = String(a.work_order_id || a.id || '');
    const idb = String(b.work_order_id || b.id || '');
    return ida.localeCompare(idb);
  });
}

function getStopAddress(appt) {
  const addr = (appt?.service_address || appt?.client_address || '').trim();
  return addr || null;
}

function legFromStored(timeSec, distM) {
  const time = timeSec != null ? Number(timeSec) : null;
  const dist = distM != null ? Number(distM) : null;

  if (time > 0) {
    return { seconds: time, isEstimate: false };
  }
  if (dist > 0) {
    return { seconds: (dist / 1609.34 / AVG_MPH) * 3600, isEstimate: true };
  }
  return null;
}

/**
 * Sum between-stop legs from stored appointment fields only (no API).
 * Shop→first and last→shop are filled by estimateRouteDriveTime when online.
 */
export function sumDriveTimeBetweenStops(appointments = []) {
  const sorted = sortAppointmentsByTime(appointments);
  if (!sorted.length) {
    return { totalSeconds: 0, hasEstimate: false, legCount: 0, stopCount: 0 };
  }

  let totalSeconds = 0;
  let hasEstimate = false;
  let legCount = 0;

  const addLeg = (stored) => {
    if (!stored) return;
    totalSeconds += stored.seconds;
    legCount += 1;
    if (stored.isEstimate) hasEstimate = true;
  };

  for (let i = 1; i < sorted.length; i += 1) {
    const appt = sorted[i];
    addLeg(legFromStored(appt.travel_time_before, appt.travel_distance_before));
  }

  return {
    totalSeconds,
    hasEstimate,
    legCount,
    stopCount: sorted.length,
  };
}

/**
 * Full route drive time including shop out/back; fetches missing legs via distance API.
 */
export async function estimateRouteDriveTime(
  appointments = [],
  shopAddress = DEFAULT_SHOP_ADDRESS
) {
  const sorted = sortAppointmentsByTime(appointments);
  const addresses = sorted.map(getStopAddress);

  if (!sorted.length) {
    return { totalSeconds: 0, hasEstimate: false, legCount: 0, stopCount: 0 };
  }

  let totalSeconds = 0;
  let hasEstimate = false;
  let legCount = 0;

  const addLeg = async (storedTime, storedDist, origin, destination) => {
    const stored = legFromStored(storedTime, storedDist);
    if (stored) {
      totalSeconds += stored.seconds;
      legCount += 1;
      if (stored.isEstimate) hasEstimate = true;
      return;
    }
    if (!origin || !destination) return;

    const { travelTime, distance } = await calculateTravelTime(origin, destination);
    const fromApi = legFromStored(travelTime, distance);
    if (fromApi) {
      totalSeconds += fromApi.seconds;
      legCount += 1;
      if (fromApi.isEstimate) hasEstimate = true;
    }
  };

  const shop = shopAddress || DEFAULT_SHOP_ADDRESS;
  const firstAddr = addresses[0];
  const lastAddr = addresses[addresses.length - 1];

  // Shop out — do not use first.travel_time_before (often the prior job, not the shop).
  await addLeg(null, null, shop, firstAddr);

  for (let i = 1; i < sorted.length; i += 1) {
    const appt = sorted[i];
    await addLeg(
      appt.travel_time_before,
      appt.travel_distance_before,
      addresses[i - 1],
      addresses[i]
    );
  }

  // Return to shop — do not use last.travel_time_after (often the next job, not the shop).
  await addLeg(null, null, lastAddr, shop);

  return {
    totalSeconds,
    hasEstimate,
    legCount,
    stopCount: sorted.length,
  };
}

export function formatDriveDuration(totalSeconds) {
  if (!totalSeconds || totalSeconds <= 0) return '0 min';

  const minutes = Math.round(totalSeconds / 60);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} hr`;
  return `${hours} hr ${mins} min`;
}
