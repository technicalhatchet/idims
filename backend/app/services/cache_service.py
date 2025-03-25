from typing import Any, Optional, Dict
from datetime import datetime, timedelta
import logging
from functools import wraps
import json

logger = logging.getLogger(__name__)

class InMemoryCache:
    """Simple in-memory cache implementation"""
    def __init__(self):
        self._cache: Dict[str, Dict[str, Any]] = {}
        self.default_ttl = 3600  # 1 hour default TTL

    async def get(self, key: str) -> Optional[Any]:
        """Get a value from cache"""
        if key not in self._cache:
            return None
        
        item = self._cache[key]
        if item["expires_at"] < datetime.utcnow():
            del self._cache[key]
            return None
        
        return item["value"]

    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set a value in cache"""
        expires_at = datetime.utcnow() + timedelta(seconds=ttl or self.default_ttl)
        self._cache[key] = {
            "value": value,
            "expires_at": expires_at
        }

    async def delete(self, key: str) -> None:
        """Delete a value from cache"""
        if key in self._cache:
            del self._cache[key]

    async def exists(self, key: str) -> bool:
        """Check if a key exists in cache"""
        if key not in self._cache:
            return False
        
        item = self._cache[key]
        if item["expires_at"] < datetime.utcnow():
            del self._cache[key]
            return False
        
        return True

    async def clear(self) -> None:
        """Clear all cache entries"""
        self._cache.clear()

class CacheService:
    """Cache service for managing application caching"""
    def __init__(self):
        self.cache = InMemoryCache()
        self.default_ttl = 3600  # 1 hour default TTL

    async def get(self, key: str) -> Optional[Any]:
        """Get a value from cache"""
        try:
            return await self.cache.get(key)
        except Exception as e:
            logger.error(f"Error getting value from cache: {str(e)}")
            return None

    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set a value in cache"""
        try:
            await self.cache.set(key, value, ttl or self.default_ttl)
        except Exception as e:
            logger.error(f"Error setting value in cache: {str(e)}")

    async def delete(self, key: str) -> None:
        """Delete a value from cache"""
        try:
            await self.cache.delete(key)
        except Exception as e:
            logger.error(f"Error deleting value from cache: {str(e)}")

    async def exists(self, key: str) -> bool:
        """Check if a key exists in cache"""
        try:
            return await self.cache.exists(key)
        except Exception as e:
            logger.error(f"Error checking cache key existence: {str(e)}")
            return False

    async def clear(self) -> None:
        """Clear all cache entries"""
        try:
            await self.cache.clear()
        except Exception as e:
            logger.error(f"Error clearing cache: {str(e)}")

def cache(ttl: Optional[int] = None):
    """Decorator for caching function results"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key from function name and arguments
            key_parts = [func.__name__]
            key_parts.extend(str(arg) for arg in args)
            key_parts.extend(f"{k}:{v}" for k, v in sorted(kwargs.items()))
            cache_key = ":".join(key_parts)

            # Try to get from cache first
            cached_value = await cache_service.get(cache_key)
            if cached_value is not None:
                return cached_value

            # If not in cache, execute function and cache result
            result = await func(*args, **kwargs)
            await cache_service.set(cache_key, result, ttl)
            return result

        return wrapper
    return decorator

# Initialize cache service
cache_service = CacheService()