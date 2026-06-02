/** Estimate total drive time between today's route stops (seconds). */

const AVG_MPH = 35;

export function sumDriveTimeBetweenStops(appointments = []) {
  let totalSeconds = 0;
  let hasEstimate = false;
  let legCount = 0;

  for (const appt of appointments) {
    const timeSec = appt.travel_time_before != null ? Number(appt.travel_time_before) : null;
    const distM = appt.travel_distance_before != null ? Number(appt.travel_distance_before) : null;

    if (timeSec > 0) {
      totalSeconds += timeSec;
      legCount += 1;
    } else if (distM > 0) {
      totalSeconds += (distM / 1609.34 / AVG_MPH) * 3600;
      hasEstimate = true;
      legCount += 1;
    }
  }

  return { totalSeconds, hasEstimate, legCount, stopCount: appointments.length };
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
