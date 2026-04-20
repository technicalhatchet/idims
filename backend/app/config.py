import os
from pydantic import BaseModel, Field, ConfigDict, validator
from typing import List, Dict, Any, Optional, Set
from functools import lru_cache
import json
import logging
from datetime import timedelta
from pathlib import Path
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Load .env file explicitly
env_path = Path(__file__).parent.parent / '.env'
logger.info(f"Loading .env file from: {env_path.absolute()}")

# --- DEBUG --- #
print(f"--- DEBUG PRINT: Calculated .env path: {env_path.absolute()}")
print(f"--- DEBUG PRINT: Does .env file exist at path? {env_path.is_file()}")

# Load .env file and check return value
dotenv_loaded = load_dotenv(env_path)
print(f"--- DEBUG PRINT: load_dotenv returned: {dotenv_loaded}")

# Log the value immediately after loading .env
maps_key_from_env = os.getenv("MAPS_API_KEY")
# Use print instead of logger for early startup debug
print(f"--- DEBUG PRINT: Value of MAPS_API_KEY from os.getenv after load_dotenv: '{maps_key_from_env}' ---")
# --- END DEBUG --- #

# Ensure environment variables are loaded
os.environ.setdefault("AUTH0_DOMAIN", "dev-fqp1z1l3km7uj2gq.us.auth0.com")
os.environ.setdefault("AUTH0_CLIENT_ID", "WqHIDs5HEdNMr1gn5elMIUB93D1ASxSe")
os.environ.setdefault("AUTH0_CLIENT_SECRET", "r9GtdbyPcfJbz1wYMNeMRziJPXy1EcNZfXOiOLxY9UzftZIMZz218URNX98zxvLP")
os.environ.setdefault("AUTH0_API_AUDIENCE", "https://idimsapi")
os.environ.setdefault("DATABASE_URL", "postgresql://chee:chee@localhost/servicebusiness")

class Settings(BaseModel):
    """Application settings"""
    model_config = ConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="allow",
        json_schema_extra={
            "example": {
                "APP_NAME": "IDIMS",
                "API_VERSION": "1.0.0",
                "DEBUG": True,
                "ENVIRONMENT": "development"
            }
        },
        from_attributes=True
    )

    # Application settings
    APP_NAME: str = "IDIMS"
    API_VERSION: str = "1.0.0"
    DEBUG: bool = True
    ENVIRONMENT: str = "development"
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    WORKERS: int = 1
    
    # Database settings
    DATABASE_URL: str = Field(default=os.getenv("DATABASE_URL", "postgresql://chee:chee@localhost/servicebusiness"))
    
    # JWT settings
    SECRET_KEY: str = "your-secret-key-here"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Auth0 settings
    AUTH0_DOMAIN: str = Field(default="dev-fqp1z1l3km7uj2gq.us.auth0.com")
    AUTH0_CLIENT_ID: str = Field(default="WqHIDs5HEdNMr1gn5elMIUB93D1ASxSe")
    AUTH0_CLIENT_SECRET: str = Field(default="r9GtdbyPcfJbz1wYMNeMRziJPXy1EcNZfXOiOLxY9UzftZIMZz218URNX98zxvLP")
    AUTH0_API_AUDIENCE: str = Field(default="https://idimsapi")
    AUTH0_ISSUER: Optional[str] = None
    AUTH0_ALGORITHMS: List[str] = ["RS256"]
    
    # CORS settings
    CORS_ORIGINS: List[str] = ["*"]
    
    # File upload settings
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB
    ALLOWED_EXTENSIONS: List[str] = ["pdf", "doc", "docx", "xls", "xlsx", "jpg", "jpeg", "png"]
    
    # Email settings
    MAIL_SERVER: str = "smtp.zoho.com"
    MAIL_PORT: int = 465
    MAIL_USE_TLS: bool = False
    MAIL_USE_SSL: bool = True
    MAIL_USERNAME: str = "chester@chettechpro.com"
    MAIL_PASSWORD: str = "zbSC KdLi Gmtd"
    MAIL_FROM: str = "chester@chettechpro.com"
    MAIL_FROM_NAME: str = "Chettech Pro"
    
    # Redis settings
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: str = ""
    
    # Cache settings
    CACHE_TTL: int = 300  # 5 minutes
    
    # Logging settings
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    
    # API settings
    API_V1_PREFIX: str = "/api/v1"
    PROJECT_NAME: str = "IDIMS"
    VERSION: str = "1.0.0"
    DESCRIPTION: str = "Integrated Document and Invoice Management System"
    
    # Maps API settings
    MAPS_API_KEY: Optional[str] = Field(default=os.getenv("MAPS_API_KEY", ""))
    MAPS_PROVIDER: str = "google"  # google, mapbox, here, etc.
    MAPS_CACHE_TTL: int = 86400  # 24 hours in seconds
    
    # Security settings
    PASSWORD_HASH_ALGORITHM: str = "bcrypt"
    PASSWORD_SALT_ROUNDS: int = 12
    
    # Payment settings
    STRIPE_API_KEY: Optional[str] = Field(default=os.getenv("STRIPE_API_KEY", ""))
    STRIPE_WEBHOOK_SECRET: Optional[str] = Field(default=os.getenv("STRIPE_WEBHOOK_SECRET", ""))
    STRIPE_PUBLISHABLE_KEY: Optional[str] = Field(default=os.getenv("STRIPE_PUBLISHABLE_KEY", ""))
    PAYPAL_CLIENT_ID: Optional[str] = None
    PAYPAL_CLIENT_SECRET: Optional[str] = None
    
    # Rate limiting
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_PERIOD: int = 60  # seconds
    
    # Session settings
    SESSION_COOKIE_NAME: str = "idims_session"
    SESSION_COOKIE_SECURE: bool = True
    SESSION_COOKIE_HTTPONLY: bool = True
    SESSION_COOKIE_SAMESITE: str = "Lax"
    
    # File storage settings
    STORAGE_TYPE: str = "local"  # local, s3, azure
    STORAGE_BUCKET: str = "idims-files"
    STORAGE_REGION: str = "us-east-1"
    STORAGE_ACCESS_KEY: str = ""
    STORAGE_SECRET_KEY: str = ""
    LOCAL_STORAGE_PATH: str = "storage"  # Local storage directory for files
    
    # Notification settings
    NOTIFICATION_EMAIL_ENABLED: bool = True
    NOTIFICATION_SMS_ENABLED: bool = False
    NOTIFICATION_PUSH_ENABLED: bool = False
    
    # PDF generation settings
    PDF_FONT_PATH: str = "fonts/DejaVuSans.ttf"
    PDF_TEMPLATE_DIR: str = "templates/pdf"
    
    # Workflow settings
    WORKFLOW_AUTO_APPROVE: bool = False
    WORKFLOW_REQUIRE_APPROVAL: bool = True
    WORKFLOW_MAX_APPROVERS: int = 3
    
    # Audit settings
    AUDIT_LOG_ENABLED: bool = True
    AUDIT_LOG_RETENTION_DAYS: int = 90
    
    # Backup settings
    BACKUP_ENABLED: bool = True
    BACKUP_RETENTION_DAYS: int = 30
    BACKUP_SCHEDULE: str = "0 0 * * *"  # Daily at midnight
    
    # System settings
    SYSTEM_TIMEZONE: str = "UTC"
    SYSTEM_DATE_FORMAT: str = "%Y-%m-%d"
    SYSTEM_DATETIME_FORMAT: str = "%Y-%m-%d %H:%M:%S"
    SYSTEM_CURRENCY: str = "USD"
    SYSTEM_LANGUAGE: str = "en"
    
    # Feature flags
    FEATURE_QUOTES: bool = True
    FEATURE_INVOICES: bool = True
    FEATURE_WORK_ORDERS: bool = True
    FEATURE_INVENTORY: bool = True
    FEATURE_CHAT: bool = True
    FEATURE_NOTIFICATIONS: bool = True
    FEATURE_AUDIT: bool = True
    FEATURE_BACKUP: bool = True
    
    # Email provider settings
    EMAIL_PROVIDER: str = "zoho"  # sendgrid, mailgun, ses, zoho
    SENDGRID_API_KEY: str = ""
    MAILGUN_API_KEY: str = ""
    MAILGUN_DOMAIN: str = ""
    
    # Company/Site Information for emails
    SITE_NAME: str = "Quantum Repairs"
    CONTACT_EMAIL: str = "support@chettechpro.com"
    LOGO_URL: str = "https://imgur.com/a/ou9RtjZ"
    DEFAULT_FROM_EMAIL: str = "chester@chettechpro.com"
    
    # URL settings
    FRONTEND_URL: str = "http://localhost:3000"
    BACKEND_URL: str = "http://localhost:8000"
    
    # SMS provider settings
    SMS_PROVIDER: str = "twilio"  # twilio, nexmo, none
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_PHONE_NUMBER: str = ""
    
    @validator("AUTH0_ISSUER", pre=True)
    def set_auth0_issuer(cls, v: Optional[str], values: Dict[str, Any]) -> str:
        """Set Auth0 issuer URL if not provided"""
        if not v and "AUTH0_DOMAIN" in values and values["AUTH0_DOMAIN"]:
            return f"https://{values['AUTH0_DOMAIN']}/"
        return v

    @validator("UPLOAD_DIR")
    def create_directory(cls, v: str) -> str:
        """Create directory if it doesn't exist"""
        os.makedirs(v, exist_ok=True)
        return v

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        print("Initializing Settings")
        print(f"Current working directory: {os.getcwd()}")
        print(f"AUTH0_DOMAIN from env: {os.getenv('AUTH0_DOMAIN')}")
        print(f"AUTH0_DOMAIN from settings: {self.AUTH0_DOMAIN}")
        print(f"AUTH0_API_AUDIENCE from env: {os.getenv('AUTH0_API_AUDIENCE')}")
        print(f"AUTH0_API_AUDIENCE from settings: {self.AUTH0_API_AUDIENCE}")

@lru_cache()
def get_settings():
    """Cache settings to avoid reloading them for every request"""
    return Settings()

# Initialize settings
settings = get_settings()