import os
from sqlalchemy import create_engine, text
import json
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from backend/.env
try:
    script_dir = Path(__file__).resolve().parent 
    env_path = script_dir.parent / '.env' 
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
        # print(f"Loaded .env from: {env_path}") # Debug line
    # else:
        # print(f".env file not found at: {env_path}") # Debug line
except Exception as e_dotenv:
    # print(f"Error loading .env file: {e_dotenv}") # Debug line
    pass

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/idims")
# print(f"Using DATABASE_URL: {DATABASE_URL}") # Debug line

def get_skus_from_db():
    engine = create_engine(DATABASE_URL)
    results_list = []
    try:
        with engine.connect() as connection:
            query = text("""
                SELECT 
                    sku_code, 
                    name, 
                    description, 
                    category, 
                    base_price, 
                    unit, 
                    service_type, 
                    equipment_type, 
                    skill_level, 
                    duration_minutes,
                    is_active,
                    prerequisites,
                    common_parts,
                    equipment_compatibility
                FROM services 
                ORDER BY equipment_type, service_type, name;
            """)
            result = connection.execute(query)
            rows = result.fetchall()
            if not rows:
                print("No SKUs found in the database.")
                return

            print(f"Found {len(rows)} SKUs in the database:")
            column_names = result.keys()
            for row_idx, row in enumerate(rows):
                row_dict = {}
                for i, col_name in enumerate(column_names):
                    val = row[i]
                    if hasattr(val, 'value'): # Handles SQLAlchemy enums
                        row_dict[col_name] = val.value
                    # psycopg2 might return JSON as dict/list already, ensure it's dumped to string for printing
                    elif isinstance(val, (dict, list)):
                         row_dict[col_name] = json.dumps(val) # Convert dict/list from JSON column to string
                    else:
                        row_dict[col_name] = val
                results_list.append(row_dict)
            
            for item in results_list:
                print("---")
                for key, value in item.items():
                    print(f"  {key}: {value}")
            print("---")
            print(f"Total SKUs fetched: {len(results_list)}")

    except Exception as e:
        print(f"Error connecting to the database or fetching SKUs: {e}")
        import traceback
        print(traceback.format_exc())

if __name__ == "__main__":
    get_skus_from_db() 