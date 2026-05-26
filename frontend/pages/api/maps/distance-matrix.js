/**
 * Legacy Next.js proxy for travel time/distance.
 * Prefer POST /api/calculate-distance on the FastAPI backend (same Routes API).
 * Kept for backwards compatibility if any client still hits this route.
 */

import { withApiAuthRequired } from '@auth0/nextjs-auth0';

function parseRoutesDurationSeconds(durationValue) {
  if (durationValue == null) return null;
  if (typeof durationValue === 'number') return durationValue;
  if (typeof durationValue === 'object' && durationValue.seconds != null) {
    return Number(durationValue.seconds);
  }
  if (typeof durationValue === 'string' && durationValue.endsWith('s')) {
    return Math.round(parseFloat(durationValue.slice(0, -1)));
  }
  return null;
}

export default withApiAuthRequired(async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { origin, destination } = req.body;

    if (!origin || !destination) {
      return res.status(400).json({
        error: 'Origin and destination addresses are required',
      });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('Google Maps API key not configured in server environment');
      return res.status(500).json({
        error: 'Google Maps API is not properly configured',
      });
    }

    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters',
      },
      body: JSON.stringify({
        origin: { address: origin },
        destination: { address: destination },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_UNAWARE',
        computeAlternativeRoutes: false,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const message = data?.error?.message || response.statusText;
      console.error('Google Routes API error:', message, data);
      return res.status(500).json({ error: `Google Routes API error: ${message}` });
    }

    const route = data?.routes?.[0];
    const travelTime = parseRoutesDurationSeconds(route?.duration);
    const distance = route?.distanceMeters;

    if (travelTime == null || distance == null) {
      return res.status(500).json({ error: 'No route found between origin and destination' });
    }

    return res.status(200).json({ travelTime, distance });
  } catch (error) {
    console.error('Error in routes proxy API:', error);
    return res.status(500).json({
      error: `Internal server error: ${error.message}`,
    });
  }
});
