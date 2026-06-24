"""
Zone/Trip Charge Service

Determines service zones and trip charges based on:
1. Explicit zip code mappings
2. Distance fallback from shop address
"""

import logging
from typing import Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session

# Settings queried directly to avoid async/sync mismatch

logger = logging.getLogger(__name__)

# Default zone configuration
DEFAULT_ZONES = {
    "zones": {
        "local": {
            "name": "Local",
            "tripCharge": 0,
            "zipCodes": [],
            "color": "#22c55e"
        },
        "extended": {
            "name": "Extended", 
            "tripCharge": 29,
            "zipCodes": [],
            "color": "#eab308"
        },
        "far": {
            "name": "Far",
            "tripCharge": 50,
            "zipCodes": [],
            "color": "#f97316"
        },
        "custom": {
            "name": "Custom",
            "tripCharge": 0,
            "zipCodes": [],
            "color": "#ef4444"
        }
    },
    "driveTimeFallback": {
        "enabled": True,
        "shopAddress": None,
        "ranges": [
            {"maxMinutes": 20, "charge": 0, "zone": "local"},
            {"maxMinutes": 35, "charge": 29, "zone": "extended"},
            {"maxMinutes": 50, "charge": 50, "zone": "far"},
            {"maxMinutes": None, "charge": None, "zone": "custom"}
        ]
    },
    "defaultTripChargeSku": "TRIP-CHARGE"
}


class ZoneService:
    """Service for determining service zones and trip charges"""
    
    def __init__(self, db: Session):
        self.db = db
        self._zone_config = None
    
    def _get_zone_config(self) -> Dict[str, Any]:
        """Load zone configuration from settings (cached per request)"""
        if self._zone_config is not None:
            return self._zone_config
            
        try:
            # Query settings directly since SettingsService uses async methods
            from sqlalchemy import text
            query = text("SELECT value FROM settings WHERE key = :key")
            result = self.db.execute(query, {"key": "trip_zones"}).fetchone()
            
            if result and result[0]:
                self._zone_config = result[0]
            else:
                self._zone_config = DEFAULT_ZONES
        except Exception as e:
            logger.warning(f"Could not load trip_zones setting: {e}")
            self._zone_config = DEFAULT_ZONES
            
        return self._zone_config
    
    def get_zone_by_zip(self, zip_code: str) -> Optional[Tuple[str, Dict[str, Any]]]:
        """
        Look up zone by zip code from explicit mappings.
        
        Returns:
            Tuple of (zone_key, zone_config) or None if not found
        """
        if not zip_code:
            return None
            
        config = self._get_zone_config()
        zones = config.get("zones", {})
        
        # Clean the zip code (first 5 digits)
        clean_zip = zip_code.strip()[:5]
        
        for zone_key, zone_data in zones.items():
            if clean_zip in zone_data.get("zipCodes", []):
                return (zone_key, zone_data)
        
        return None
    
    def get_zone_by_drive_time(self, drive_time_minutes: float) -> Optional[Tuple[str, Dict[str, Any], float]]:
        """
        Determine zone by drive time from shop.
        
        Args:
            drive_time_minutes: Drive time from shop in minutes
            
        Returns:
            Tuple of (zone_key, zone_config, trip_charge) or None
        """
        config = self._get_zone_config()
        fallback = config.get("driveTimeFallback", config.get("distanceFallback", {}))
        
        if not fallback.get("enabled", True):
            return None
            
        ranges = fallback.get("ranges", [])
        zones = config.get("zones", {})
        
        for range_config in ranges:
            max_minutes = range_config.get("maxMinutes", range_config.get("maxMiles"))
            
            # None means unlimited (catch-all for custom)
            if max_minutes is None or drive_time_minutes <= max_minutes:
                zone_key = range_config.get("zone")
                charge = range_config.get("charge")
                zone_data = zones.get(zone_key, {})
                
                # Use range charge if specified, otherwise use zone default
                final_charge = charge if charge is not None else zone_data.get("tripCharge", 0)
                
                return (zone_key, zone_data, final_charge)
        
        return None
    
    def determine_zone(
        self, 
        zip_code: Optional[str] = None, 
        drive_time_minutes: Optional[float] = None,
        address: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Determine the service zone for a location.
        
        Priority:
        1. Explicit zip code mapping
        2. Drive time-based fallback
        3. Default to "custom" zone
        
        Args:
            zip_code: Property zip code
            drive_time_minutes: Pre-calculated drive time from shop in minutes (optional)
            address: Full address (for future drive time calculation)
            
        Returns:
            Dict with zone info: {
                "zoneKey": "local",
                "zoneName": "Local",
                "tripCharge": 0,
                "method": "zip_code" | "drive_time" | "default",
                "color": "#22c55e"
            }
        """
        config = self._get_zone_config()
        zones = config.get("zones", {})
        
        # 1. Try explicit zip code mapping
        if zip_code:
            result = self.get_zone_by_zip(zip_code)
            if result:
                zone_key, zone_data = result
                return {
                    "zoneKey": zone_key,
                    "zoneName": zone_data.get("name", zone_key.title()),
                    "tripCharge": zone_data.get("tripCharge", 0),
                    "method": "zip_code",
                    "color": zone_data.get("color"),
                    "isCustom": zone_key == "custom"
                }
        
        # 2. Try drive time-based fallback
        if drive_time_minutes is not None:
            result = self.get_zone_by_drive_time(drive_time_minutes)
            if result:
                zone_key, zone_data, charge = result
                return {
                    "zoneKey": zone_key,
                    "zoneName": zone_data.get("name", zone_key.title()),
                    "tripCharge": charge,
                    "method": "drive_time",
                    "driveTimeMinutes": drive_time_minutes,
                    "color": zone_data.get("color"),
                    "isCustom": zone_key == "custom"
                }
        
        # 3. Default to custom zone (requires manual entry)
        custom_zone = zones.get("custom", {})
        return {
            "zoneKey": "custom",
            "zoneName": custom_zone.get("name", "Custom"),
            "tripCharge": None,  # Must be set manually
            "method": "default",
            "color": custom_zone.get("color", "#ef4444"),
            "isCustom": True
        }
    
    def get_trip_charge_sku(self) -> Optional[str]:
        """Get the configured trip charge SKU code"""
        config = self._get_zone_config()
        return config.get("defaultTripChargeSku")
    
    def get_all_zones(self) -> Dict[str, Any]:
        """Get all zone configurations"""
        return self._get_zone_config()


    def add_trip_charge_to_work_order(
        self,
        work_order_id,
        zone_key: str,
        trip_charge: float,
        appointment_id = None,
    ) -> Optional[Any]:
        """
        Add a trip charge service to a work order based on zone.
        
        Args:
            work_order_id: The work order ID
            zone_key: Zone key (local, extended, far, custom)
            trip_charge: The trip charge amount
            appointment_id: Optional appointment to link the service to
            
        Returns:
            The created WorkOrderService record or None
        """
        from app.models.work_order import WorkOrderService as WorkOrderServiceModel
        from app.models.service import Service
        
        # Map zone to SKU code
        sku_map = {
            'local': 'TRIP-LOCAL',
            'extended': 'TRIP-EXTENDED',
            'far': 'TRIP-FAR',
            'custom': 'TRIP-CUSTOM',
        }
        
        sku_code = sku_map.get(zone_key, 'TRIP-CUSTOM')
        
        # Find the service
        service = self.db.query(Service).filter(Service.sku_code == sku_code).first()
        if not service:
            logger.warning(f"Trip charge service {sku_code} not found in database")
            return None
        
        # Check if trip charge already exists for this work order
        existing = self.db.query(WorkOrderServiceModel).filter(
            WorkOrderServiceModel.work_order_id == work_order_id,
            WorkOrderServiceModel.service_id == service.id
        ).first()
        
        if existing:
            logger.info(f"Trip charge already exists for work order {work_order_id}")
            # Update the price if it's different (for custom zones)
            if existing.price != trip_charge:
                existing.price = trip_charge
                existing.unit_price = trip_charge
            return existing
        
        # Create new trip charge entry
        work_order_service = WorkOrderServiceModel(
            work_order_id=work_order_id,
            service_id=service.id,
            appointment_id=appointment_id,
            name=service.name,
            quantity=1,
            unit_price=trip_charge,
            price=trip_charge,
            billing_status='billable' if trip_charge > 0 else 'not_billable',
        )
        
        self.db.add(work_order_service)
        logger.info(f"Added trip charge ${trip_charge} ({zone_key}) to work order {work_order_id}")
        
        return work_order_service


def get_zone_service(db: Session) -> ZoneService:
    """Dependency injection helper"""
    return ZoneService(db)
