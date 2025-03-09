import json
import logging
from typing import Any, Optional, Union, Dict
import redis.asyncio as redis
from app.config import settings

logger = logging.getLogger(__name__)

class CacheService:
    """Service for handling caching operations"""
    
    def __init__(self):
        self.redis_client = None
        self.default_ttl = settings.REDIS_TTL
        
        # Initialize Redis connection
        if settings.REDIS_URL:
            try:
                self.redis_client = redis.from_url(
                    settings.REDIS_URL,
                    password=settings.REDIS_PASSWORD,
                    decode_responses=True  # Auto-decode Redis responses to strings
                )
                logger.info("Redis cache client initialized")
            except Exception as e:
                logger.error(f"Failed to initialize Redis cache: {str(e)}")
    
    async def get(self, key: str) -> Any:
        """Get a value from cache"""
        if not self.redis_client:
            return None
        
        try:
            value = await self.redis_client.get(key)
            if value:
                try:
                    return json.loads(value)
                except json.JSONDecodeError:
                    return value
            return None
        except Exception as e:
            logger.error(f"Cache get error: {str(e)}")
            return None
    
    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Set a value in cache with TTL"""
        if not self.redis_client:
            return False
        
        try:
            # Convert non-string values to JSON
            if not isinstance(value, str):
                value = json.dumps(value)
            
            # Use default TTL if not specified
            ttl = ttl or self.default_ttl
            
            await self.redis_client.set(key, value, ex=ttl)
            return True
        except Exception as e:
            logger.error(f"Cache set error: {str(e)}")
            return False
    
    async def delete(self, key: str) -> bool:
        """Delete a value from cache"""
        if not self.redis_client:
            return False
        
        try:
            await self.redis_client.delete(key)
            return True
        except Exception as e:
            logger.error(f"Cache delete error: {str(e)}")
            return False
    
    async def clear_pattern(self, pattern: str) -> bool:
        """Clear all keys matching a pattern"""
        if not self.redis_client:
            return False
        
        try:
            cursor = 0
            while True:
                cursor, keys = await self.redis_client.scan(cursor, match=pattern, count=100)
                if keys:
                    await self.redis_client.delete(*keys)
                if cursor == 0:
                    break
            return True
        except Exception as e:
            logger.error(f"Cache clear pattern error: {str(e)}")
            return False
    
    async def increment(self, key: str, amount: int = 1) -> Optional[int]:
        """Increment a counter in cache"""
        if not self.redis_client:
            return None
        
        try:
            return await self.redis_client.incrby(key, amount)
        except Exception as e:
            logger.error(f"Cache increment error: {str(e)}")
            return None
    
    async def health_check(self) -> bool:
        """Check if cache is healthy"""
        if not self.redis_client:
            return False
        
        try:
            await self.redis_client.ping()
            return True
        except Exception as e:
            logger.error(f"Cache health check error: {str(e)}")
            return False

# Create a singleton instance
cache_service = CacheService()