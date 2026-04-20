# IDIMS: Service Business Management System

## Google Maps Integration for Scheduling

The system now includes Google Maps integration for scheduling appointments with travel time calculation. This feature allows for:

1. **Automatic travel time calculation** between locations
2. **Optimal scheduling** of appointments based on travel distances
3. **Visual travel information** in the appointment interface

### Setup Instructions

To enable Google Maps integration, you need to:

1. **Get a Google Maps API Key**:
   - Go to the [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable the following APIs:
     - Maps JavaScript API
     - Distance Matrix API
     - Geocoding API
   - Create an API key with appropriate restrictions

2. **Configure the environment variables**:
   - Open your `.env` and `.env.local` files
   - Set the following variables:
     ```
     NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key-here
     GOOGLE_MAPS_API_KEY=your-google-maps-api-key-here
     NEXT_PUBLIC_DEFAULT_SHOP_ADDRESS=123 Main Street, Anytown, USA 12345
     ```
   - Replace with your actual API key and shop address

3. **Restart the application** to apply the changes

### Using the Scheduling Features

Once configured, you can:

1. **View appointments with travel information** in the work order details page
2. **Auto-schedule appointments** with the new Auto Schedule tab
3. **See travel times and distances** for each appointment

### Troubleshooting

- If travel times show as estimates (30 min, 15 km), check your API key configuration
- Ensure your shop address is correctly formatted
- Check the browser console and server logs for any API-related errors

### Limitations

- The current implementation uses the Distance Matrix API with road travel only
- Travel times are estimated based on typical conditions and don't account for real-time traffic
- A maximum of 10 appointments can be scheduled at once with the optimization feature

For more information on the Google Maps API, visit the [Google Maps Platform documentation](https://developers.google.com/maps/documentation). 