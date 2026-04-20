# Travel Time Fields in Appointments

## Overview

The appointment system includes fields to track travel time and distance for technicians traveling between appointments. These fields are stored in the database but are not directly editable in the user interface. Instead, they are calculated automatically by the system based on appointment locations and scheduling.

## Purpose

These fields serve several important purposes:

1. **Optimal Technician Scheduling**: By knowing travel times between appointment locations, the system can optimize technician assignments and scheduling to minimize travel time and maximize productive work hours.

2. **Buffer Time Between Appointments**: The travel time data ensures that sufficient gap time is maintained between appointments, preventing unrealistic scheduling that doesn't account for travel time.

3. **Mileage Tracking**: Travel distance information can be used for accurate mileage reimbursement and cost analysis.

4. **Reporting and Analytics**: Reports can use this data to analyze travel efficiency, travel costs, and geographical service coverage.

## Field Definitions

The appointment model includes four travel-related fields:

- `travel_time_before`: Time in minutes required to travel to this appointment from the previous one
- `travel_time_after`: Time in minutes required to travel from this appointment to the next one
- `travel_distance_before`: Distance in miles traveled to this appointment from the previous one
- `travel_distance_after`: Distance in miles traveled from this appointment to the next one

## Implementation Details

### Database Schema

These fields are added to the `work_order_appointments` table as nullable integer fields:
- `travel_time_before` (Integer, nullable)
- `travel_time_after` (Integer, nullable)
- `travel_distance_before` (Integer, nullable)
- `travel_distance_after` (Integer, nullable)

### Calculation Logic

The system calculates these values in the following scenarios:

1. **When a new appointment is created**: The system checks the technician's schedule to determine previous and next appointments, then calculates travel times and distances.

2. **When an appointment is updated**: If the location, time, or assigned technician changes, travel times are recalculated.

3. **When an appointment is deleted**: Travel times for adjacent appointments are recalculated.

### Distance Calculation

Travel distances are calculated using:
1. The service address of each appointment
2. A third-party mapping service API
3. Caching results to prevent excessive API calls

### Travel Time Calculation

Travel times are estimated based on:
1. The calculated travel distance
2. Average travel speeds based on route type (highway, urban, etc.)
3. Time of day (to account for traffic variations)

## Usage in Reporting

This data is available for reporting purposes. Some useful reports include:

1. **Technician Travel Analysis**: Total travel time and distance per technician
2. **Route Efficiency**: Identifying inefficient travel patterns
3. **Travel Cost Analysis**: Calculating fuel and time costs for travel

## API Access

The travel time and distance fields are included in appointment responses from the API and can be used by external systems.

## UI Display

While not directly editable in the UI, travel time information is displayed in the appointment details to help dispatchers and managers understand scheduling constraints.

## Future Enhancements

Planned enhancements include:
1. Real-time traffic-based travel estimations
2. Predictive scheduling based on historical travel patterns
3. Integration with navigation systems for technicians 