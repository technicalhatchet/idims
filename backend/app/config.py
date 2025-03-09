import os
from pydantic import BaseSettings, validator
from typing import List, Dict, Any, Optional, Set
from functools import lru_cache
import json
import logging

class Settings(BaseSettings):
    # App settings
    APP_NAME: str = "Service Business API"
    API_VERSION: str = "0.1.0"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    
    # Server settings
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    WORKERS: int = int(os.getenv("WORKERS", "1"))
    
    # Database settings
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost/servicebusiness")
    DB_POOL_SIZE: int = int(os.getenv("DB_POOL_SIZE", "20"))
    DB_MAX_OVERFLOW: int = int(os.getenv("DB_MAX_OVERFLOW", "10"))
    DB_POOL_TIMEOUT: int = int(os.getenv("DB_POOL_TIMEOUT", "30"))
    
    # CORS settings
    CORS_ORIGINS: List[str] = []
    
    @validator("CORS_ORIGINS", pre=True)
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v
    
    # Auth settings
    AUTH0_DOMAIN: str = os.getenv("AUTH0_DOMAIN", "")
    AUTH0_API_AUDIENCE: str = os.getenv("AUTH0_API_AUDIENCE", "")
    AUTH0_CLIENT_ID: str = os.getenv("AUTH0_CLIENT_ID", "")
    AUTH0_CLIENT_SECRET: str = os.getenv("AUTH0_CLIENT_SECRET", "")
    
    # JWT settings
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "supersecretkey")
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
    
    # Redis settings (for Celery and caching)
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    REDIS_PASSWORD: Optional[str] = os.getenv("REDIS_PASSWORD")
    REDIS_TTL: int = int(os.getenv("REDIS_TTL", "3600"))  # Default cache TTL in seconds
    
    # Rate limiting
    RATE_LIMIT_MAX_REQUESTS: int = int(os.getenv("RATE_LIMIT_MAX_REQUESTS", "100"))
    RATE_LIMIT_WINDOW: int = int(os.getenv("RATE_LIMIT_WINDOW", "60"))  # In seconds
    RATE_LIMIT_EXCLUDE_PATHS: Set[str] = {"/api/health", "/api/docs", "/api/redoc"}
    
    @validator("RATE_LIMIT_EXCLUDE_PATHS", pre=True)
    def parse_rate_limit_paths(cls, v):
        if isinstance(v, str):
            return set(path.strip() for path in v.split(","))
        return v
    
    # Storage settings
    STORAGE_TYPE: str = os.getenv("STORAGE_TYPE", "local")  # 'local', 's3', 'do_spaces'
    STORAGE_BUCKET: str = os.getenv("STORAGE_BUCKET", "")
    AWS_ACCESS_KEY_ID: str = os.getenv("AWS_ACCESS_KEY_ID", "")
    AWS_SECRET_ACCESS_KEY: str = os.getenv("AWS_SECRET_ACCESS_KEY", "")
    AWS_REGION: str = os.getenv("AWS_REGION", "us-east-1")
    LOCAL_STORAGE_PATH: str = os.getenv("LOCAL_STORAGE_PATH", "storage")
    
    # Email settings
    EMAIL_PROVIDER: str = os.getenv("EMAIL_PROVIDER", "sendgrid")  # 'sendgrid', 'mailgun', 'ses'
    SENDGRID_API_KEY: str = os.getenv("SENDGRID_API_KEY", "")
    MAILGUN_API_KEY: str = os.getenv("MAILGUN_API_KEY", "")
    MAILGUN_DOMAIN: str = os.getenv("MAILGUN_DOMAIN", "")
    DEFAULT_FROM_EMAIL: str = os.getenv("DEFAULT_FROM_EMAIL", "noreply@yourdomain.com")
    
    # SMS settings
    SMS_PROVIDER: str = os.getenv("SMS_PROVIDER", "twilio")  # 'twilio', 'nexmo'
    TWILIO_ACCOUNT_SID: str = os.getenv("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN: str = os.getenv("TWILIO_AUTH_TOKEN", "")
    TWILIO_PHONE_NUMBER: str = os.getenv("TWILIO_PHONE_NUMBER", "")
    
    # Payment settings
    STRIPE_API_KEY: str = os.getenv("STRIPE_API_KEY", "")
    STRIPE_WEBHOOK_SECRET: str = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    PAYPAL_CLIENT_ID: str = os.getenv("PAYPAL_CLIENT_ID", "")
    PAYPAL_CLIENT_SECRET: str = os.getenv("PAYPAL_CLIENT_SECRET", "")
    
    # AI settings
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    CHATBOT_MODEL: str = os.getenv("CHATBOT_MODEL", "gpt-3.5-turbo")
    
    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_FORMAT: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    LOG_REQUEST_BODY: bool = os.getenv("LOG_REQUEST_BODY", "False").lower() == "true"
    
    # Security
    SECURE_COOKIES: bool = os.getenv("SECURE_COOKIES", "False").lower() == "true"
    SESSION_SECRET: str = os.getenv("SESSION_SECRET", "supersecretkey")
    PASSWORD_RESET_TOKEN_EXPIRE_HOURS: int = int(os.getenv("PASSWORD_RESET_TOKEN_EXPIRE_HOURS", "24"))
    
    # Feature flags
    FEATURE_CHAT_ENABLED: bool = os.getenv("FEATURE_CHAT_ENABLED", "True").lower() == "true"
    FEATURE_REPORTS_ENABLED: bool = os.getenv("FEATURE_REPORTS_ENABLED", "True").lower() == "true"
    FEATURE_MOBILE_SYNC_ENABLED: bool = os.getenv("FEATURE_MOBILE_SYNC_ENABLED", "True").lower() == "true"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True

    def get_database_connection_args(self):
        """Get SQLAlchemy connection arguments"""
        return {
            "pool_size": self.DB_POOL_SIZE,
            "max_overflow": self.DB_MAX_OVERFLOW,
            "pool_timeout": self.DB_POOL_TIMEOUT,
            "pool_pre_ping": True,
            "pool_recycle": 300,  # Recycle connections every 5 minutes
            "echo": self.DEBUG,
        }

@lru_cache()
def get_settings():
    """Cache settings to avoid reloading them for every request"""
    return Settings()

settings = get_settings()