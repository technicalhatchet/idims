/**
 * API endpoint to proxy Google Maps Distance Matrix API requests
 * This avoids exposing the API key in the frontend
 */

import { withApiAuthRequired } from '@auth0/nextjs-auth0';

// Main API handler
export default withApiAuthRequired(async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { origin, destination } = req.body;

    // Validate request data
    if (!origin || !destination) {
      return res.status(400).json({ 
        error: 'Origin and destination addresses are required' 
      });
    }

    // Get API key from environment variables
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('Google Maps API key not configured in server environment');
      return res.status(500).json({ 
        error: 'Google Maps API is not properly configured' 
      });
    }

    // Encode parameters
    const encodedOrigin = encodeURIComponent(origin);
    const encodedDestination = encodeURIComponent(destination);

    // Build URL for Google Maps Distance Matrix API
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodedOrigin}&destinations=${encodedDestination}&units=imperial&key=${apiKey}`;

    // Make request to Google Maps API
    const response = await fetch(url);
    const data = await response.json();

    // Check for API errors
    if (data.status !== 'OK') {
      console.error('Google Maps API error:', data);
      return res.status(500).json({ 
        error: `Google Maps API error: ${data.status}` 
      });
    }

    // Return the data
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error in distance matrix API:', error);
    return res.status(500).json({ 
      error: `Internal server error: ${error.message}` 
    });
  }
}); 