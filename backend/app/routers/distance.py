from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.utils.travel_calculator import get_travel_time_and_distance
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

class DistanceRequest(BaseModel):
    origin: str
    destination: str

class DistanceResponse(BaseModel):
    travelTime: int   # seconds
    distance: float   # meters

@router.post("/calculate-distance", response_model=DistanceResponse)
async def calculate_distance(request: DistanceRequest):
    """
    Calculate travel time and distance between two addresses.
    Uses Google Maps Distance Matrix API with Haversine fallback.
    """
    if not request.origin or not request.destination:
        raise HTTPException(status_code=400, detail="Origin and destination are required")

    logger.info(f"Calculating distance from '{request.origin}' to '{request.destination}'")

    travel_time, travel_distance = get_travel_time_and_distance(request.origin, request.destination)

    if travel_time is None or travel_distance is None:
        logger.warning(f"Could not calculate distance, using defaults")
        # Return sensible defaults rather than failing — 30 min, 15 miles
        return DistanceResponse(travelTime=1800, distance=24140)

    # Google returns seconds and miles; convert miles to meters for frontend consistency
    travel_distance_meters = travel_distance * 1609.34

    logger.info(f"Distance result: {travel_time} sec, {travel_distance} mi ({travel_distance_meters:.0f} m)")
    return DistanceResponse(travelTime=travel_time, distance=travel_distance_meters)
