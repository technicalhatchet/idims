import math
import logging
import os
import re
import requests
from typing import Dict, Any, Tuple, Optional, Union
from datetime import datetime, date, time
from sqlalchemy.orm import Session
from app.config import settings
from app.models.work_order import WorkOrderAppointment

logger = logging.getLogger(__name__)

METERS_PER_MILE = 1609.34

# Fractional house numbers (e.g. "242 1/2") often fail Google geocoding — strip for routing only.
_FRACTION_IN_ADDRESS = re.compile(
    r"\s*-\s*\d+/\d+"  # 242-1/2
    r"|\s+\d+/\d+"     # 242 1/2
    r"|\s+[½¼¾]",      # unicode fractions
    re.IGNORECASE,
)


def sanitize_address_for_routing(address: Optional[str]) -> Optional[str]:
    """Remove fractional house numbers so Maps can route (display address unchanged elsewhere)."""
    if not address:
        return address
    original = str(address).strip()
    cleaned = _FRACTION_IN_ADDRESS.sub("", original)
    cleaned = re.sub(r"\s{2,}", " ", cleaned)
    cleaned = re.sub(r",\s*,", ",", cleaned).strip()
    if cleaned != original:
        logger.info("Sanitized address for routing: %r -> %r", original, cleaned)
    return cleaned or original


def get_default_shop_address() -> str:
    return (
        os.getenv("DEFAULT_SHOP_ADDRESS")
        or os.getenv("NEXT_PUBLIC_DEFAULT_SHOP_ADDRESS")
        or "641 Barclay Drive, Toledo, OH 43609, USA"
    )


def _travel_api_to_storage(
    travel_time_minutes: Optional[Union[int, float]],
    travel_distance_miles: Optional[Union[int, float]],
) -> Tuple[Optional[int], Optional[int]]:
    """Convert calculator output (minutes, miles) to DB units (seconds, meters)."""
    seconds = int(round(travel_time_minutes * 60)) if travel_time_minutes is not None else None
    meters = (
        int(round(float(travel_distance_miles) * METERS_PER_MILE))
        if travel_distance_miles is not None
        else None
    )
    return seconds, meters


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

def _parse_routes_duration_seconds(duration_value) -> Optional[int]:
    """Parse Routes API duration (JSON string like '123s' or dict with 'seconds')."""
    if duration_value is None:
        return None
    if isinstance(duration_value, (int, float)):
        return int(duration_value)
    if isinstance(duration_value, dict):
        seconds = duration_value.get("seconds")
        if seconds is not None:
            return int(seconds)
        return None
    if isinstance(duration_value, str):
        trimmed = duration_value.strip()
        if trimmed.endswith("s"):
            try:
                return int(float(trimmed[:-1]))
            except ValueError:
                return None
    return None


def _fetch_google_routes_travel(origin: str, destination: str) -> Tuple[Optional[int], Optional[float]]:
    """
    Call Google Routes API (computeRoutes) for traffic-unaware drive time/distance.
    Returns (travel_time_minutes, travel_distance_miles) or (None, None).
    """
    if not settings.MAPS_API_KEY:
        return (None, None)

    url = "https://routes.googleapis.com/directions/v2:computeRoutes"
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": settings.MAPS_API_KEY,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.routeLabels",
    }
    payload = {
        "origin": {"address": origin},
        "destination": {"address": destination},
        "travelMode": "DRIVE",
        "routingPreference": "TRAFFIC_UNAWARE",
        "computeAlternativeRoutes": False,
    }

    logger.info(
        "Making Google Routes API request for origin '%s' to destination '%s'",
        origin,
        destination,
    )
    response = requests.post(url, headers=headers, json=payload, timeout=15)
    logger.info("Google Routes API response status: %s", response.status_code)

    try:
        data = response.json()
    except Exception as json_e:
        logger.error("Failed to parse Google Routes API JSON: %s", json_e)
        logger.error("Raw response: %s", response.text[:500])
        return (None, None)

    if response.status_code != 200:
        error_message = data.get("error", {}).get("message") or response.text[:300]
        logger.error("Google Routes API HTTP %s: %s", response.status_code, error_message)
        return (None, None)

    routes = data.get("routes") or []
    if not routes:
        logger.warning(
            "Google Routes API returned no routes for origin '%s' to destination '%s'",
            origin,
            destination,
        )
        return (None, None)

    route = routes[0]
    duration_seconds = _parse_routes_duration_seconds(route.get("duration"))
    distance_meters = route.get("distanceMeters")

    if duration_seconds is None or not isinstance(distance_meters, (int, float)):
        logger.warning("Google Routes API missing duration/distance in route: %s", route)
        return (None, None)

    travel_time = round(duration_seconds / 60)
    travel_distance = round(float(distance_meters) / 1609.34, 1)
    logger.info(
        "Google Routes API success: time=%s min, distance=%s mi",
        travel_time,
        travel_distance,
    )
    return (travel_time, travel_distance)


def get_travel_time_and_distance(origin: str, destination: str) -> Tuple[Optional[int], Optional[int]]:
    """
    Calculate travel time (in minutes) and distance (in miles) between two addresses.
    Returns a tuple of (travel_time, travel_distance) or (None, None) if calculation fails.
    
    Uses Google Routes API (traffic-unaware), then falls back to Haversine + geocoding.
    """
    origin = sanitize_address_for_routing(origin) or origin
    destination = sanitize_address_for_routing(destination) or destination

    try:
        if settings.MAPS_API_KEY:
            travel_time, travel_distance = _fetch_google_routes_travel(origin, destination)
            if travel_time is not None and travel_distance is not None:
                return (travel_time, travel_distance)
        
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

def get_shop_to_property_drive_time(db: Session, property_obj) -> Optional[float]:
    """
    Calculate drive time from shop to a property (in minutes).
    Used for trip charge zone determination.
    
    Args:
        db: Database session
        property_obj: Property model object with address fields
        
    Returns:
        Drive time in minutes, or None if calculation fails
    """
    try:
        shop_address = get_default_shop_address()
        
        # Build property address
        if hasattr(property_obj, 'formatted_address') and property_obj.formatted_address:
            property_address = property_obj.formatted_address
        else:
            # Build from individual fields
            address_parts = []
            if hasattr(property_obj, 'street_address') and property_obj.street_address:
                address_parts.append(property_obj.street_address)
            if hasattr(property_obj, 'city') and property_obj.city:
                address_parts.append(property_obj.city)
            if hasattr(property_obj, 'state') and property_obj.state:
                address_parts.append(property_obj.state)
            if hasattr(property_obj, 'zip_code') and property_obj.zip_code:
                address_parts.append(property_obj.zip_code)
            
            if not address_parts:
                logger.warning("No address available for property")
                return None
            
            property_address = ', '.join(address_parts)
        
        logger.info(f"Calculating shop-to-property drive time: {shop_address} -> {property_address}")
        
        travel_time, travel_distance = get_travel_time_and_distance(shop_address, property_address)
        
        if travel_time is not None:
            logger.info(f"Shop-to-property drive time: {travel_time} minutes")
            return float(travel_time)
        
        return None
        
    except Exception as e:
        logger.error(f"Error calculating shop-to-property drive time: {str(e)}")
        return None


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
            day_start, day_end = _calendar_day_bounds(appointment.scheduled_start)
            # Same calendar day only — avoid chaining travel from a prior day's last stop
            tech_appointments = db.query(WorkOrderAppointment).filter(
                WorkOrderAppointment.assigned_technician_id == appointment.assigned_technician_id,
                WorkOrderAppointment.id != appointment.id,
                WorkOrderAppointment.status != 'canceled',
                WorkOrderAppointment.scheduled_start >= day_start,
                WorkOrderAppointment.scheduled_start <= day_end,
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
                    
            # Travel to this stop: from previous job or from shop when first stop of the day
            if prev_appointment:
                prev_work_order = prev_appointment.work_order
                if prev_work_order:
                    prev_address = get_formatted_address(prev_work_order.service_location)
                    if prev_address:
                        travel_time, travel_distance = get_travel_time_and_distance(prev_address, service_address)
                        travel_secs, travel_meters = _travel_api_to_storage(travel_time, travel_distance)
                        appointment.travel_time_before = travel_secs
                        appointment.travel_distance_before = travel_meters
                        prev_appointment.travel_time_after = travel_secs
                        prev_appointment.travel_distance_after = travel_meters
                        db.add(prev_appointment)
            else:
                shop_address = get_default_shop_address()
                travel_time, travel_distance = get_travel_time_and_distance(shop_address, service_address)
                travel_secs, travel_meters = _travel_api_to_storage(travel_time, travel_distance)
                if travel_secs is not None:
                    appointment.travel_time_before = travel_secs
                    appointment.travel_distance_before = travel_meters

            # Update travel time after if there's a next appointment
            if next_appointment:
                next_work_order = next_appointment.work_order
                if next_work_order:
                    next_address = get_formatted_address(next_work_order.service_location)
                    if next_address:
                        travel_time, travel_distance = get_travel_time_and_distance(service_address, next_address)
                        travel_secs, travel_meters = _travel_api_to_storage(travel_time, travel_distance)
                        appointment.travel_time_after = travel_secs
                        appointment.travel_distance_after = travel_meters
                        next_appointment.travel_time_before = travel_secs
                        next_appointment.travel_distance_before = travel_meters
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

        # First stop of the day: travel from shop
        first_appt = tech_appointments[0]
        first_wo = first_appt.work_order
        if first_wo:
            first_address = get_formatted_address(first_wo.service_location)
            if first_address:
                shop_address = get_default_shop_address()
                travel_time, travel_distance = get_travel_time_and_distance(shop_address, first_address)
                travel_secs, travel_meters = _travel_api_to_storage(travel_time, travel_distance)
                if travel_secs is not None:
                    first_appt.travel_time_before = travel_secs
                    first_appt.travel_distance_before = travel_meters
                    db.add(first_appt)

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
                    travel_time, travel_distance = get_travel_time_and_distance(current_address, next_address)
                    travel_secs, travel_meters = _travel_api_to_storage(travel_time, travel_distance)
                    current_appt.travel_time_after = travel_secs
                    current_appt.travel_distance_after = travel_meters
                    next_appt.travel_time_before = travel_secs
                    next_appt.travel_distance_before = travel_meters
                    
                    db.add(current_appt)
                    db.add(next_appt)

        db.flush()
        return True

    except Exception as e:
        logger.error(f"Error updating technician day travel info: {str(e)}")
        # Caller owns the transaction; avoid rolling back the whole session here.
        return False 