#!/usr/bin/env python
"""
Script to initialize the SKU system with the service data.
Run this script after applying the database migrations.
"""

import asyncio
import sys
import os
from datetime import datetime
import logging
from typing import Dict, Any, List, Optional
from sqlalchemy import create_engine, text, Table, MetaData
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

# Add the parent directory to the path so we can import the app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.models.service import Service, ServiceType, EquipmentType, ServiceSkillLevel
from app.services.service_service import ServiceService

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Database URL - for local development
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/idims")

# Helper functions to convert enum values
def get_service_type_enum(value: str) -> ServiceType:
    """Convert a string to ServiceType enum"""
    if not value:
        return None
    
    try:
        # Convert to uppercase for enum matching
        upper_value = value.upper()
        return ServiceType[upper_value]
    except (KeyError, ValueError):
        logger.warning(f"Invalid service_type value: {value}")
        return None

def get_equipment_type_enum(value: str) -> EquipmentType:
    """Convert a string to EquipmentType enum"""
    if not value:
        return None
    
    try:
        # Convert to uppercase for enum matching
        upper_value = value.upper()
        return EquipmentType[upper_value]
    except (KeyError, ValueError):
        logger.warning(f"Invalid equipment_type value: {value}")
        return None

def get_skill_level_enum(value: str) -> ServiceSkillLevel:
    """Convert a string to ServiceSkillLevel enum"""
    if not value:
        return None
    
    try:
        # Convert to uppercase for enum matching
        upper_value = value.upper()
        return ServiceSkillLevel[upper_value]
    except (KeyError, ValueError):
        logger.warning(f"Invalid skill_level value: {value}")
        return None

# SKU data for services
SKU_DATA = [
    {
        "name": "TV Diagnostic",
        "description": "Basic diagnostic service for televisions",
        "category": "Diagnostics",
        "service_type": "DIAGNOSTIC",
        "equipment_type": "TV",
        "skill_level": "BASIC",
        "base_price": 75.00,
        "unit": "flat",
        "duration_minutes": 60,
        "is_active": True,
        "is_bundle": False,
        "is_custom_price": False,
        "requires_diagnostic": False,
        "prerequisites": None,
        "common_parts": None,
        "equipment_compatibility": ["Sony", "Samsung", "LG", "Vizio", "TCL"]
    },
    {
        "name": "TV Repair",
        "description": "Standard television repair service",
        "category": "Repairs",
        "service_type": "REPAIR",
        "equipment_type": "TV",
        "skill_level": "INTERMEDIATE",
        "base_price": 150.00,
        "unit": "flat",
        "duration_minutes": 120,
        "is_active": True,
        "is_bundle": False,
        "is_custom_price": False,
        "requires_diagnostic": True,
        "prerequisites": ["TV Diagnostic"],
        "common_parts": ["Power board", "Main board", "T-Con board", "LED strips"],
        "equipment_compatibility": ["Sony", "Samsung", "LG", "Vizio", "TCL"]
    },
    {
        "name": "Refrigerator Diagnostic",
        "description": "Basic diagnostic service for refrigerators",
        "category": "Diagnostics",
        "service_type": "DIAGNOSTIC",
        "equipment_type": "REFRIGERATOR",
        "skill_level": "BASIC",
        "base_price": 85.00,
        "unit": "flat",
        "duration_minutes": 60,
        "is_active": True,
        "is_bundle": False,
        "is_custom_price": False,
        "requires_diagnostic": False,
        "prerequisites": None,
        "common_parts": None,
        "equipment_compatibility": ["Whirlpool", "GE", "Samsung", "LG", "Frigidaire"]
    },
    {
        "name": "Refrigerator Repair",
        "description": "Standard refrigerator repair service",
        "category": "Repairs",
        "service_type": "REPAIR",
        "equipment_type": "REFRIGERATOR",
        "skill_level": "INTERMEDIATE",
        "base_price": 175.00,
        "unit": "flat",
        "duration_minutes": 120,
        "is_active": True,
        "is_bundle": False,
        "is_custom_price": False,
        "requires_diagnostic": True,
        "prerequisites": ["Refrigerator Diagnostic"],
        "common_parts": ["Compressor", "Thermostat", "Defrost timer", "Fan motor"],
        "equipment_compatibility": ["Whirlpool", "GE", "Samsung", "LG", "Frigidaire"]
    },
    {
        "name": "Washer Diagnostic",
        "description": "Basic diagnostic service for washing machines",
        "category": "Diagnostics",
        "service_type": "DIAGNOSTIC",
        "equipment_type": "WASHER",
        "skill_level": "BASIC",
        "base_price": 80.00,
        "unit": "flat",
        "duration_minutes": 60,
        "is_active": True,
        "is_bundle": False,
        "is_custom_price": False,
        "requires_diagnostic": False,
        "prerequisites": None,
        "common_parts": None,
        "equipment_compatibility": ["Whirlpool", "GE", "Samsung", "LG", "Maytag"]
    },
    {
        "name": "Washer Repair",
        "description": "Standard washing machine repair service",
        "category": "Repairs",
        "service_type": "REPAIR",
        "equipment_type": "WASHER",
        "skill_level": "INTERMEDIATE",
        "base_price": 165.00,
        "unit": "flat",
        "duration_minutes": 120,
        "is_active": True,
        "is_bundle": False,
        "is_custom_price": False,
        "requires_diagnostic": True,
        "prerequisites": ["Washer Diagnostic"],
        "common_parts": ["Water pump", "Drive belt", "Agitator", "Control board"],
        "equipment_compatibility": ["Whirlpool", "GE", "Samsung", "LG", "Maytag"]
    },
    {
        "name": "Dryer Diagnostic",
        "description": "Basic diagnostic service for clothes dryers",
        "category": "Diagnostics",
        "service_type": "DIAGNOSTIC",
        "equipment_type": "DRYER",
        "skill_level": "BASIC",
        "base_price": 80.00,
        "unit": "flat",
        "duration_minutes": 60,
        "is_active": True,
        "is_bundle": False,
        "is_custom_price": False,
        "requires_diagnostic": False,
        "prerequisites": None,
        "common_parts": None,
        "equipment_compatibility": ["Whirlpool", "GE", "Samsung", "LG", "Maytag"]
    },
    {
        "name": "Dryer Repair",
        "description": "Standard clothes dryer repair service",
        "category": "Repairs",
        "service_type": "REPAIR",
        "equipment_type": "DRYER",
        "skill_level": "INTERMEDIATE",
        "base_price": 160.00,
        "unit": "flat",
        "duration_minutes": 120,
        "is_active": True,
        "is_bundle": False,
        "is_custom_price": False,
        "requires_diagnostic": True,
        "prerequisites": ["Dryer Diagnostic"],
        "common_parts": ["Heating element", "Thermostat", "Belt", "Drum roller"],
        "equipment_compatibility": ["Whirlpool", "GE", "Samsung", "LG", "Maytag"]
    },
    {
        "name": "Dishwasher Diagnostic",
        "description": "Basic diagnostic service for dishwashers",
        "category": "Diagnostics",
        "service_type": "DIAGNOSTIC",
        "equipment_type": "DISHWASHER",
        "skill_level": "BASIC",
        "base_price": 75.00,
        "unit": "flat",
        "duration_minutes": 60,
        "is_active": True,
        "is_bundle": False,
        "is_custom_price": False,
        "requires_diagnostic": False,
        "prerequisites": None,
        "common_parts": None,
        "equipment_compatibility": ["Whirlpool", "GE", "Bosch", "KitchenAid", "Maytag"]
    },
    {
        "name": "Dishwasher Repair",
        "description": "Standard dishwasher repair service",
        "category": "Repairs",
        "service_type": "REPAIR",
        "equipment_type": "DISHWASHER",
        "skill_level": "INTERMEDIATE",
        "base_price": 155.00,
        "unit": "flat",
        "duration_minutes": 120,
        "is_active": True,
        "is_bundle": False,
        "is_custom_price": False,
        "requires_diagnostic": True,
        "prerequisites": ["Dishwasher Diagnostic"],
        "common_parts": ["Water inlet valve", "Pump", "Spray arm", "Control board"],
        "equipment_compatibility": ["Whirlpool", "GE", "Bosch", "KitchenAid", "Maytag"]
    },
    {
        "name": "Range/Oven Diagnostic",
        "description": "Basic diagnostic service for ranges and ovens",
        "category": "Diagnostics",
        "service_type": "DIAGNOSTIC",
        "equipment_type": "RANGE",
        "skill_level": "BASIC",
        "base_price": 85.00,
        "unit": "flat",
        "duration_minutes": 60,
        "is_active": True,
        "is_bundle": False,
        "is_custom_price": False,
        "requires_diagnostic": False,
        "prerequisites": None,
        "common_parts": None,
        "equipment_compatibility": ["Whirlpool", "GE", "Samsung", "LG", "Frigidaire"]
    },
    {
        "name": "Range/Oven Repair",
        "description": "Standard range or oven repair service",
        "category": "Repairs",
        "service_type": "REPAIR",
        "equipment_type": "RANGE",
        "skill_level": "INTERMEDIATE",
        "base_price": 170.00,
        "unit": "flat",
        "duration_minutes": 120,
        "is_active": True,
        "is_bundle": False,
        "is_custom_price": False,
        "requires_diagnostic": True,
        "prerequisites": ["Range/Oven Diagnostic"],
        "common_parts": ["Heating element", "Thermostat", "Igniter", "Control board"],
        "equipment_compatibility": ["Whirlpool", "GE", "Samsung", "LG", "Frigidaire"]
    },
    {
        "name": "Appliance Installation",
        "description": "Standard installation service for household appliances",
        "category": "Installations",
        "service_type": "INSTALLATION",
        "equipment_type": "OTHER",
        "skill_level": "INTERMEDIATE",
        "base_price": 125.00,
        "unit": "flat",
        "duration_minutes": 90,
        "is_active": True,
        "is_bundle": False,
        "is_custom_price": False,
        "requires_diagnostic": False,
        "prerequisites": None,
        "common_parts": ["Installation kit", "Hoses", "Venting material"],
        "equipment_compatibility": ["All major brands"]
    },
    {
        "name": "TV Mounting",
        "description": "Professional TV wall mounting service",
        "category": "Installations",
        "service_type": "INSTALLATION",
        "equipment_type": "TV",
        "skill_level": "INTERMEDIATE",
        "base_price": 130.00,
        "unit": "flat",
        "duration_minutes": 90,
        "is_active": True,
        "is_bundle": False,
        "is_custom_price": False,
        "requires_diagnostic": False,
        "prerequisites": None,
        "common_parts": ["Mounting bracket", "HDMI cables", "Cable concealment kit"],
        "equipment_compatibility": ["All TV brands"]
    },
    {
        "name": "Custom Repair",
        "description": "Custom repair service for unique situations",
        "category": "Custom Services",
        "service_type": "CUSTOM",
        "equipment_type": "OTHER",
        "skill_level": "ADVANCED",
        "base_price": 200.00,
        "unit": "hourly",
        "duration_minutes": 60,
        "is_active": True,
        "is_bundle": False,
        "is_custom_price": True,
        "requires_diagnostic": True,
        "prerequisites": None,
        "common_parts": None,
        "equipment_compatibility": ["All brands"]
    },
    {
        "name": "Additional Service Time",
        "description": "Additional labor time for complex repairs",
        "category": "Labor",
        "service_type": "REPAIR", # Changed from ADDITIONAL_TIME to REPAIR
        "equipment_type": "OTHER",
        "skill_level": "INTERMEDIATE",
        "base_price": 75.00,
        "unit": "hourly",
        "duration_minutes": 60,
        "is_active": True,
        "is_bundle": False,
        "is_custom_price": False,
        "requires_diagnostic": False,
        "prerequisites": None,
        "common_parts": None,
        "equipment_compatibility": ["All brands"]
    },
    {
        "name": "Remote Diagnostic",
        "description": "Remote diagnostic service via video call",
        "category": "Remote Services",
        "service_type": "DIAGNOSTIC", # Changed from REMOTE to DIAGNOSTIC
        "equipment_type": "OTHER",
        "skill_level": "INTERMEDIATE",
        "base_price": 50.00,
        "unit": "flat",
        "duration_minutes": 30,
        "is_active": True,
        "is_bundle": False,
        "is_custom_price": False,
        "requires_diagnostic": False,
        "prerequisites": None,
        "common_parts": None,
        "equipment_compatibility": ["All brands"]
    }
]

def generate_sku_code(service_type: str, equipment_type: str, name: str) -> str:
    """Generate a unique SKU code based on service type, equipment type, and name."""
    # Extract prefix from service type
    if service_type == "DIAGNOSTIC":
        # Special case for Remote Diagnostic
        if name == "Remote Diagnostic":
            prefix = "REM"
        else:
            prefix = "DIAG"
    elif service_type == "REPAIR":
        # Special case for Additional Service Time
        if name == "Additional Service Time":
            prefix = "ADD"
        else:
            prefix = "REP"
    elif service_type == "INSTALLATION":
        prefix = "INST"
    elif service_type == "CUSTOM":
        prefix = "CUST"
    else:
        prefix = "SRV"
    
    # Extract equipment code
    if equipment_type == "TV":
        equip_code = "TV"
    elif equipment_type == "REFRIGERATOR":
        equip_code = "REF"
    elif equipment_type == "WASHER":
        equip_code = "WSH"
    elif equipment_type == "DRYER":
        equip_code = "DRY"
    elif equipment_type == "DISHWASHER":
        equip_code = "DSH"
    elif equipment_type == "RANGE":
        equip_code = "RNG"
    else:
        equip_code = "OTH"
    
    # Generate a suffix from the name (first letter of each word)
    words = name.split()
    suffix = "".join([word[0] for word in words if word])[:3].upper()
    
    # Combine to form SKU code
    sku_code = f"{prefix}-{equip_code}-{suffix}"
    
    return sku_code

def load_services_with_raw_sql():
    """Load services using raw SQL to avoid SQLAlchemy enum validation issues."""
    conn = None
    try:
        # Create the database engine
        engine = create_engine(DATABASE_URL)
        conn = engine.connect()
        
        # Get existing services to check for duplicates
        result = conn.execute(text("SELECT sku_code FROM services"))
        existing_sku_codes = set([row[0] for row in result])
        logger.info(f"Found {len(existing_sku_codes)} existing services")
        
        # Process each service in SKU_DATA
        services_created = 0
        services_updated = 0
        import uuid
        from datetime import datetime
        
        for service_data in SKU_DATA:
            try:
                sku_code = generate_sku_code(service_data["service_type"], service_data["equipment_type"], service_data["name"])
                
                # Convert JSON fields to PostgreSQL JSON
                prerequisites = "null" if service_data["prerequisites"] is None else "'" + str(service_data["prerequisites"]).replace("'", "").replace('"', "") + "'"
                common_parts = "null" if service_data["common_parts"] is None else "'" + str(service_data["common_parts"]).replace("'", "").replace('"', "") + "'"
                equipment_compatibility = "null" if service_data["equipment_compatibility"] is None else "'" + str(service_data["equipment_compatibility"]).replace("'", "").replace('"', "") + "'"
                
                # Set service type value (lowercase for database storage)
                service_type_value = service_data["service_type"].lower()
                equipment_type_value = service_data["equipment_type"].lower()
                skill_level_value = service_data["skill_level"].lower()
                
                # Check if service exists
                if sku_code in existing_sku_codes:
                    # Update existing service
                    update_sql = text(f"""
                        UPDATE services
                        SET 
                            name = :name,
                            description = :description,
                            category = :category,
                            base_price = :base_price,
                            unit = :unit,
                            is_active = :is_active,
                            duration_minutes = :duration_minutes,
                            is_bundle = :is_bundle,
                            is_custom_price = :is_custom_price,
                            requires_diagnostic = :requires_diagnostic,
                            updated_at = :updated_at
                        WHERE sku_code = :sku_code
                    """)
                    
                    conn.execute(update_sql, {
                        "name": service_data["name"],
                        "description": service_data["description"],
                        "category": service_data["category"],
                        "base_price": service_data["base_price"],
                        "unit": service_data["unit"],
                        "is_active": service_data["is_active"],
                        "duration_minutes": service_data["duration_minutes"],
                        "is_bundle": service_data["is_bundle"],
                        "is_custom_price": service_data["is_custom_price"],
                        "requires_diagnostic": service_data["requires_diagnostic"],
                        "updated_at": datetime.utcnow(),
                        "sku_code": sku_code
                    })
                    
                    services_updated += 1
                    logger.info(f"Updated service: {sku_code}")
                else:
                    # Create new service
                    insert_sql = text("""
                        INSERT INTO services (
                            id, sku_code, name, description, category, base_price, unit, is_active, 
                            service_type, equipment_type, skill_level, duration_minutes, 
                            is_bundle, is_custom_price, requires_diagnostic, 
                            prerequisites, common_parts, equipment_compatibility, 
                            created_at, updated_at
                        ) VALUES (
                            :id, :sku_code, :name, :description, :category, :base_price, :unit, :is_active, 
                            :service_type, :equipment_type, :skill_level, :duration_minutes, 
                            :is_bundle, :is_custom_price, :requires_diagnostic, 
                            :prerequisites, :common_parts, :equipment_compatibility, 
                            :created_at, :updated_at
                        )
                    """)
                    
                    # Convert the JSON data to strings for Postgres
                    import json
                    prerequisites_json = json.dumps(service_data["prerequisites"]) if service_data["prerequisites"] else None
                    common_parts_json = json.dumps(service_data["common_parts"]) if service_data["common_parts"] else None
                    equipment_compatibility_json = json.dumps(service_data["equipment_compatibility"]) if service_data["equipment_compatibility"] else None
                    
                    # Use execute_values or prepared statement to properly handle JSON data
                    conn.execute(
                        text("SET LOCAL TIME ZONE 'UTC';")
                    )
                    
                    conn.execute(insert_sql, {
                        "id": str(uuid.uuid4()),
                        "sku_code": sku_code,
                        "name": service_data["name"],
                        "description": service_data["description"],
                        "category": service_data["category"],
                        "base_price": service_data["base_price"],
                        "unit": service_data["unit"],
                        "is_active": service_data["is_active"],
                        "service_type": service_type_value,
                        "equipment_type": equipment_type_value,
                        "skill_level": skill_level_value,
                        "duration_minutes": service_data["duration_minutes"],
                        "is_bundle": service_data["is_bundle"],
                        "is_custom_price": service_data["is_custom_price"],
                        "requires_diagnostic": service_data["requires_diagnostic"],
                        "prerequisites": prerequisites_json,
                        "common_parts": common_parts_json,
                        "equipment_compatibility": equipment_compatibility_json,
                        "created_at": datetime.utcnow(),
                        "updated_at": datetime.utcnow()
                    })
                    
                    services_created += 1
                    logger.info(f"Created service: {sku_code}")
            except Exception as e:
                logger.error(f"Error processing service {service_data['name']}: {e}")
                continue
        
        # Commit all changes
        conn.execute(text("COMMIT"))
        logger.info(f"Services created: {services_created}, updated: {services_updated}")
        
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        if conn:
            conn.execute(text("ROLLBACK"))
    except Exception as e:
        logger.error(f"Error loading SKU data: {e}")
        if conn:
            conn.execute(text("ROLLBACK"))
    finally:
        if conn:
            conn.close()

def main():
    """Main function to load all SKU data."""
    logger.info("Starting SKU data load")
    
    try:
        # Load services using raw SQL
        load_services_with_raw_sql()
        
        logger.info("SKU data load complete")
    except Exception as e:
        logger.error(f"Error loading SKU data: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 