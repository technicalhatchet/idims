from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.config import settings
from app.utils.travel_calculator import update_appointment_travel_info

# Create database connection
engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

# Find an appointment ID
result = db.execute(text('SELECT id FROM work_order_appointments LIMIT 1')).fetchone()

if result:
    appointment_id = str(result[0])
    print(f'Found appointment ID: {appointment_id}')
    
    # Test the travel calculator
    print('Testing travel calculator...')
    update_result = update_appointment_travel_info(db, appointment_id)
    print(f'Update result: {update_result}')
    if update_result:
        db.commit()
        print('Committed session.')
else:
    print('No appointments found in the database') 