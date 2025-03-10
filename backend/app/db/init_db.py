import logging
from sqlalchemy.orm import Session
import bcrypt
import uuid
from datetime import datetime, timedelta

from app.db.database import Base, engine, SessionLocal
from app.models.user import User
from app.models.client import Client
from app.models.technician import Technician
from app.models.work_order import WorkOrder
from app.models.settings import Settings
from app.config import settings as app_settings

logger = logging.getLogger(__name__)

def create_tables():
    """Create database tables"""
    logger.info("Creating database tables")
    Base.metadata.create_all(bind=engine)

def hash_password(password: str) -> str:
    """Hash a password for storing"""
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')

def setup_initial_data():
    """Set up initial data in the database"""
    db = SessionLocal()
    try:
        # Check if admin user exists
        admin_exists = db.query(User).filter(User.email == "admin@example.com").first()
        if not admin_exists:
            logger.info("Creating admin user")
            admin_user = User(
                id=uuid.uuid4(),
                email="admin@example.com",
                first_name="Admin",
                last_name="User",
                hashed_password=hash_password("adminpassword"),  # Should read from env
                role="admin",
                is_active=True,
                email_verified=True
            )
            db.add(admin_user)
            db.flush()
            
            # Create a demo client
            demo_client = Client(
                id=uuid.uuid4(),
                company_name="Demo Company",
                first_name="Demo",
                last_name="Client",
                email="client@example.com",
                phone="555-123-4567",
                status="active",
                address={
                    "street1": "123 Main St",
                    "city": "Anytown",
                    "state": "CA",
                    "zip": "12345"
                },
                created_by=admin_user.id
            )
            db.add(demo_client)
            
            # Create a demo technician
            demo_tech_user = User(
                id=uuid.uuid4(),
                email="tech@example.com",
                first_name="Demo",
                last_name="Technician",
                hashed_password=hash_password("techpassword"),  # Should read from env
                role="technician",
                is_active=True,
                email_verified=True
            )
            db.add(demo_tech_user)
            db.flush()
            
            demo_tech = Technician(
                id=uuid.uuid4(),
                user_id=demo_tech_user.id,
                employee_id="T1001",
                skills=["HVAC", "Plumbing", "Electrical"],
                hourly_rate=75.0,
                status="active"
            )
            db.add(demo_tech)
            
            # Create initial app settings
            work_order_settings = Settings(
                key="work_order_settings",
                value={
                    "auto_number_prefix": "WO-",
                    "auto_number_start": 1001,
                    "default_terms": "Payment due upon completion of service."
                },
                description="Work order settings"
            )
            db.add(work_order_settings)
            
            invoice_settings = Settings(
                key="invoice_settings",
                value={
                    "auto_number_prefix": "INV-",
                    "auto_number_start": 1001,
                    "default_terms": "Payment due within 30 days of invoice date.",
                    "default_footer": "Thank you for your business!"
                },
                description="Invoice settings"
            )
            db.add(invoice_settings)
            
            company_settings = Settings(
                key="company_settings",
                value={
                    "name": "Service Business",
                    "address": {
                        "street1": "456 Business Ave",
                        "city": "Enterprise",
                        "state": "CA",
                        "zip": "54321"
                    },
                    "phone": "555-987-6543",
                    "email": "info@servicebusiness.com",
                    "website": "https://servicebusiness.com",
                    "tax_id": "12-3456789"
                },
                description="Company settings"
            )
            db.add(company_settings)
            
            notification_settings = Settings(
                key="notification_settings",
                value={
                    "email_templates": {
                        "invoice_new": {
                            "subject": "New Invoice {invoice_number}",
                            "body": "Dear {client_name},\n\nPlease find attached your invoice {invoice_number} for {total}.\n\nDue date: {due_date}\n\nThank you for your business!\n\nService Business Team"
                        },
                        "work_order_scheduled": {
                            "subject": "Work Order {order_number} Scheduled",
                            "body": "Dear {client_name},\n\nYour service has been scheduled for {scheduled_date} between {start_time} and {end_time}.\n\nService: {work_order_title}\n\nTechnician: {technician_name}\n\nThank you,\nService Business Team"
                        }
                    },
                    "sms_templates": {
                        "appointment_reminder": "Reminder: Your service appointment is scheduled for tomorrow at {time}. Reply CONFIRM to confirm or RESCHEDULE to reschedule."
                    }
                },
                description="Notification templates"
            )
            db.add(notification_settings)
            
            # Create demo work order
            demo_work_order = WorkOrder(
                id=uuid.uuid4(),
                order_number="WO-1001",
                client_id=demo_client.id,
                title="Initial System Setup",
                description="Perform initial inspection and setup of HVAC system",
                priority="medium",
                status="scheduled",
                service_location={
                    "address": "123 Main St, Anytown, CA 12345"
                },
                scheduled_start=datetime.utcnow() + timedelta(days=3),
                scheduled_end=datetime.utcnow() + timedelta(days=3, hours=2),
                estimated_duration=120,  # 2 hours
                assigned_technician_id=demo_tech.id,
                created_by=admin_user.id
            )
            db.add(demo_work_order)
            
            # Commit all changes
            db.commit()
            logger.info("Initial data setup complete")
        else:
            logger.info("Admin user already exists, skipping initial data setup")
    
    except Exception as e:
        db.rollback()
        logger.error(f"Error setting up initial data: {str(e)}")
    finally:
        db.close()

def init_db():
    """Initialize database with tables and initial data"""
    create_tables()
    if app_settings.ENVIRONMENT in ["development", "staging"]:
        setup_initial_data()

if __name__ == "__main__":
    init_db()