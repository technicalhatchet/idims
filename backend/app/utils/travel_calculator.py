import math
import logging
import requests
from typing import Dict, Any, Tuple, Optional, Union
from datetime import datetime, date, time
from sqlalchemy.orm import Session
from app.config import settings
from app.models.work_order import WorkOrderAppointment

logger = logging.getLogger(__name__)


def _calendar_day_bounds(day: Union[datetime, date]) -> Tuple[datetime, datetime]:
    """Bounds for filtering `scheduled_start` to one local calendar day (datetime or date)."""
    if isinstance(day, datetime):
        d = day.date()
    elif isinstance(day, date):
        d = day
    else:
        raise TypeError(f"Expected datetime.date or datetime.datetime, got {type(day)}")
    start = datetime.combine(d, time.min)
    end = datetime.combine(d, time(23, 59, 59, 999999))
    return start, end


# Approximate radius of the earth in miles
EARTH_RADIUS_MILES = 3959

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points
    on the earth (specified in decimal degrees).
    Returns distance in miles.
    """
    # Convert decimal degrees to radians
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])

    # Haversine formula
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    distance = EARTH_RADIUS_MILES * c
    
    return distance

def geocode_address(address: str) -> Optional[Dict[str, float]]:
    """
    Convert an address string to latitude and longitude.
    Returns a dictionary with 'lat' and 'lng' or None if geocoding fails.
    """
    try:
        if not settings.MAPS_API_KEY:
            logger.warning("No Maps API key found in settings, geocoding unavailable")
            return None
            
        # Note: This is a placeholder for whatever mapping API service you use
        # (Google Maps, Mapbox, etc.)
        api_url = f"https://maps.googleapis.com/maps/api/geocode/json"
        response = requests.get(api_url, params={
            "address": address,
            "key": settings.MAPS_API_KEY
        })
        
        data = response.json()
        
        if data["status"] == "OK" and data["results"]:
            location = data["results"][0]["geometry"]["location"]
            return {
                "lat": location["lat"],
                "lng": location["lng"]
            }
        else:
            logger.error(f"Geocoding failed for address: {address}. Status: {data['status']}")
            return None
            
    except Exception as e:
        logger.error(f"Error geocoding address: {str(e)}")
        return None

def get_travel_time_and_distance(origin: str, destination: str) -> Tuple[Optional[int], Optional[int]]:
    """
    Calculate travel time (in minutes) and distance (in miles) between two addresses.
    Returns a tuple of (travel_time, travel_distance) or (None, None) if calculation fails.
    
    First tries to use an external API service, then falls back to a direct distance calculation.
    """
    try:
        if settings.MAPS_API_KEY:
            # Try to use external API (e.g. Google Distance Matrix API)
            api_url = f"https://maps.googleapis.com/maps/api/distancematrix/json"
            params = {
                "origins": origin,
                "destinations": destination,
                "key": settings.MAPS_API_KEY,
                "units": "imperial"  # Use miles
            }
            logger.info(f"Making Google Maps Distance Matrix API request to {api_url} with params: {params}")
            response = requests.get(api_url, params=params)
            
            # Log raw response status and content
            logger.info(f"Google Maps API Response Status: {response.status_code}")
            try:
                data = response.json()
                logger.info(f"Google Maps API Response JSON: {data}")
            except Exception as json_e:
                logger.error(f"Failed to parse Google Maps API response JSON: {json_e}")
                logger.error(f"Raw Response Text: {response.text}")
                data = {"status": "JSON_PARSE_ERROR", "error_message": str(json_e)}
                
            # Check response status before accessing elements
            if data.get("status") == "OK":
                # Check row status
                if data.get("rows") and data["rows"][0].get("elements"):
                    element = data["rows"][0]["elements"][0]
                    # Check element status
                    if element.get("status") == "OK":
                        # Ensure duration and distance keys exist
                        if element.get("duration") and element.get("distance") and \
                           isinstance(element["duration"].get("value"), (int, float)) and \
                           isinstance(element["distance"].get("value"), (int, float)):
                               
                            # Convert seconds to minutes and round
                            travel_time = round(element["duration"]["value"] / 60)
                            # Distance is returned in miles (value is meters initially from Google)
                            # Convert meters to miles for calculation consistency here
                            travel_distance_meters = element["distance"]["value"]
                            travel_distance = round(travel_distance_meters / 1609.34, 1)
                            logger.info(f"Google API Success: Time={travel_time} min, Distance={travel_distance} mi")
                            return (travel_time, travel_distance)
                        else:
                             logger.warning(f"Google API OK, but duration/distance data missing or invalid format in element: {element}")
                    else:
                        # Log specific element error (e.g., ZERO_RESULTS)
                        element_status = element.get("status", "NO_ELEMENT_STATUS")
                        logger.warning(f"Google API OK, but element status is {element_status} for origin '{origin}' to dest '{destination}'.")
                else:
                    logger.warning(f"Google API OK, but rows/elements data missing in response: {data}")
            else:
                # Log specific API error (e.g., REQUEST_DENIED, OVER_QUERY_LIMIT)
                api_status = data.get("status", "NO_API_STATUS")
                error_message = data.get("error_message", "No error message.")
                logger.error(f"Google Maps API returned status {api_status}: {error_message}")
        
        # Fall back to direct distance calculation
        logger.warning("Falling back to Haversine distance calculation.")
        origin_coords = geocode_address(origin)
        destination_coords = geocode_address(destination)
        
        if origin_coords and destination_coords:
            distance = haversine_distance(
                origin_coords["lat"], origin_coords["lng"],
                destination_coords["lat"], destination_coords["lng"]
            )
            
            # Estimate travel time: assume average speed of 30 mph in urban areas
            travel_time = round(distance / 30 * 60)  # convert to minutes
            
            return (travel_time, distance)
            
        return (None, None)
        
    except Exception as e:
        logger.error(f"Error calculating travel time and distance: {str(e)}")
        return (None, None)

def get_formatted_address(service_location):
    """Helper function to format address from service_location JSONB data"""
    if not service_location:
        return None
        
    address_parts = []
    if 'address' in service_location:
        address_parts.append(service_location['address'])
    if 'city' in service_location:
        address_parts.append(service_location['city'])
    if 'state' in service_location:
        address_parts.append(service_location['state'])
    if 'zip' in service_location:
        address_parts.append(service_location['zip'])
    
    if not address_parts:
        return None
        
    return ', '.join(filter(None, address_parts))

def update_appointment_travel_info(db: Session, appointment_id: str) -> bool:
    """
    Update the travel time and distance fields for an appointment.
    Returns True if successful, False otherwise.
    """
    try:
        # Get the appointment
        appointment = db.query(WorkOrderAppointment).filter(
            WorkOrderAppointment.id == appointment_id
        ).first()
        
        if not appointment:
            logger.error(f"Appointment not found: {appointment_id}")
            return False
            
        # Get the work order to get the service address
        work_order = appointment.work_order
        if not work_order:
            logger.error(f"Work order not found for appointment: {appointment_id}")
            return False
            
        # Use the service_location JSONB field instead of individual address fields
        service_address = get_formatted_address(work_order.service_location)
        if not service_address:
            logger.error(f"No service address available for work order: {work_order.id}")
            return False
        
        # Get this technician's previous and next appointments
        if appointment.assigned_technician_id:
            # Get technician's appointments on the same day, ordered by time
            tech_appointments = db.query(WorkOrderAppointment).filter(
                WorkOrderAppointment.assigned_technician_id == appointment.assigned_technician_id,
                WorkOrderAppointment.id != appointment.id,
                WorkOrderAppointment.status != 'canceled'
            ).order_by(WorkOrderAppointment.scheduled_start).all()
            
            # Find previous appointment (before this one)
            prev_appointment = None
            for appt in tech_appointments:
                if appt.scheduled_start < appointment.scheduled_start:
                    prev_appointment = appt
                else:
                    break
                    
            # Find next appointment (after this one)
            next_appointment = None
            for appt in reversed(tech_appointments):
                if appt.scheduled_start > appointment.scheduled_start:
                    next_appointment = appt
                else:
                    break
                    
            # Update travel time before if there's a previous appointment
            if prev_appointment:
                prev_work_order = prev_appointment.work_order
                if prev_work_order:
                    prev_address = get_formatted_address(prev_work_order.service_location)
                    if prev_address:
                        travel_time, travel_distance = get_travel_time_and_distance(prev_address, service_address)
                        
                        appointment.travel_time_before = travel_time
                        appointment.travel_distance_before = travel_distance
                        
                        # Also update the previous appointment's "after" fields
                        prev_appointment.travel_time_after = travel_time
                        prev_appointment.travel_distance_after = travel_distance
                        db.add(prev_appointment)
            
            # Update travel time after if there's a next appointment
            if next_appointment:
                next_work_order = next_appointment.work_order
                if next_work_order:
                    next_address = get_formatted_address(next_work_order.service_location)
                    if next_address:
                        travel_time, travel_distance = get_travel_time_and_distance(service_address, next_address)
                        
                        appointment.travel_time_after = travel_time
                        appointment.travel_distance_after = travel_distance
                        
                        # Also update the next appointment's "before" fields
                        next_appointment.travel_time_before = travel_time
                        next_appointment.travel_distance_before = travel_distance
                        db.add(next_appointment)
        
        # Save the appointment with updated travel info (caller owns commit)
        db.add(appointment)
        db.flush()

        return True

    except Exception as e:
        logger.error(f"Error updating appointment travel info: {str(e)}")
        # Do not call db.rollback() here — this helper runs inside larger transactions
        # (e.g. create work order + initial appointment). Rolling back would detach all
        # objects and break the outer commit/refresh.
        return False

def update_technician_day_travel_info(db: Session, technician_id: str, day: Union[datetime, date]) -> bool:
    """
    Update travel information for all of a technician's appointments on a specific day.
    This ensures consistency across the entire schedule.
    `day` may be a datetime (e.g. appointment.scheduled_start) or a date (e.g. .date()).
    Returns True if successful, False otherwise.
    """
    try:
        day_start, day_end = _calendar_day_bounds(day)
        # Get all appointments for this technician on this day, ordered by time
        tech_appointments = db.query(WorkOrderAppointment).filter(
            WorkOrderAppointment.assigned_technician_id == technician_id,
            WorkOrderAppointment.status != 'canceled',
            WorkOrderAppointment.scheduled_start >= day_start,
            WorkOrderAppointment.scheduled_start <= day_end,
        ).order_by(WorkOrderAppointment.scheduled_start).all()
        
        # Skip if no appointments
        if not tech_appointments:
            return True
            
        # Process each adjacent pair of appointments
        for i in range(len(tech_appointments) - 1):
            current_appt = tech_appointments[i]
            next_appt = tech_appointments[i + 1]
            
            # Get work orders for the addresses
            current_wo = current_appt.work_order
            next_wo = next_appt.work_order
            
            if current_wo and next_wo:
                # Format addresses
                current_address = get_formatted_address(current_wo.service_location)
                next_address = get_formatted_address(next_wo.service_location)
                
                if current_address and next_address:
                    # Calculate travel time and distance
                    travel_time, travel_distance = get_travel_time_and_distance(current_address, next_address)
                    
                    # Update both appointments
                    current_appt.travel_time_after = travel_time
                    current_appt.travel_distance_after = travel_distance
                    next_appt.travel_time_before = travel_time
                    next_appt.travel_distance_before = travel_distance
                    
                    db.add(current_appt)
                    db.add(next_appt)

        db.flush()
        return True

    except Exception as e:
        logger.error(f"Error updating technician day travel info: {str(e)}")
        # Caller owns the transaction; avoid rolling back the whole session here.
        return False 