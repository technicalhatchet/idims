import logging
import sys
import os
from logging.handlers import RotatingFileHandler, TimedRotatingFileHandler
from pathlib import Path
import json
from datetime import datetime

from app.config import settings

# Ensure log directory exists
log_dir = Path("logs")
log_dir.mkdir(exist_ok=True)

# Create formatters
verbose_formatter = logging.Formatter(
    fmt=settings.LOG_FORMAT,
    datefmt="%Y-%m-%d %H:%M:%S"
)

class JsonFormatter(logging.Formatter):
    """JSON formatter for structured logging"""
    def format(self, record):
        log_record = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "name": record.name,
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
            "message": record.getMessage(),
        }
        
        # Add exception info if present
        if record.exc_info:
            log_record["exception"] = self.formatException(record.exc_info)
        
        # Add any extra attributes
        for key, value in record.__dict__.items():
            if key not in ["args", "asctime", "created", "exc_info", "exc_text", 
                           "filename", "funcName", "id", "levelname", "levelno", 
                           "lineno", "module", "msecs", "message", "msg", "name", 
                           "pathname", "process", "processName", "relativeCreated", 
                           "stack_info", "thread", "threadName"]:
                log_record[key] = value
        
        return json.dumps(log_record)

def setup_logging():
    """Setup application logging"""
    # Get root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, settings.LOG_LEVEL.upper()))
    
    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(verbose_formatter)
    root_logger.addHandler(console_handler)
    
    # File handlers
    # Main log file - rotates by size
    main_handler = RotatingFileHandler(
        f"{log_dir}/app.log",
        maxBytes=10485760,  # 10MB
        backupCount=10,
        encoding="utf-8"
    )
    main_handler.setFormatter(verbose_formatter)
    root_logger.addHandler(main_handler)
    
    # Error log file - rotates by size
    error_handler = RotatingFileHandler(
        f"{log_dir}/error.log",
        maxBytes=10485760,  # 10MB
        backupCount=10,
        encoding="utf-8"
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(verbose_formatter)
    root_logger.addHandler(error_handler)
    
    # Daily log file - rotates by day
    daily_handler = TimedRotatingFileHandler(
        f"{log_dir}/daily.log",
        when="midnight",
        interval=1,
        backupCount=30,  # Keep logs for 30 days
        encoding="utf-8"
    )
    daily_handler.setFormatter(verbose_formatter)
    root_logger.addHandler(daily_handler)
    
    # JSON structured log - useful for log aggregation systems
    if settings.ENVIRONMENT == "production":
        json_handler = RotatingFileHandler(
            f"{log_dir}/json.log",
            maxBytes=10485760,  # 10MB
            backupCount=10,
            encoding="utf-8"
        )
        json_handler.setFormatter(JsonFormatter())
        root_logger.addHandler(json_handler)
    
    # Set SQLAlchemy logging
    if settings.DEBUG:
        logging.getLogger('sqlalchemy.engine').setLevel(logging.INFO)
    else:
        logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)
    
    # Set lower level for other libraries
    logging.getLogger('uvicorn').setLevel(logging.WARNING)
    logging.getLogger('uvicorn.access').setLevel(logging.WARNING)
    logging.getLogger('uvicorn.error').setLevel(logging.WARNING)
    
    # Return the root logger
    return root_logger

def get_request_logger(request_id):
    """Create a logger with request context"""
    logger = logging.getLogger(f"request.{request_id}")
    
    # Add request ID to all log records from this logger
    old_factory = logger.makeRecord
    
    def record_factory(*args, **kwargs):
        record = old_factory(*args, **kwargs)
        record.request_id = request_id
        return record
    
    logger.makeRecord = record_factory
    
    return logger