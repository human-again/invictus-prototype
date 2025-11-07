"""
Caching service with Redis support and in-memory fallback
"""
import json
import hashlib
import time
from typing import Optional, Any
import os

try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

# In-memory cache fallback
_memory_cache: dict = {}
_memory_cache_timestamps: dict = {}


class CacheService:
    """Unified caching service with Redis and in-memory fallback"""
    
    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None
        self.use_redis = False
        
        # Try to connect to Redis
        redis_url = os.getenv("REDIS_URL")
        if redis_url and REDIS_AVAILABLE:
            try:
                self.redis_client = redis.from_url(redis_url, decode_responses=True)
                self.redis_client.ping()
                self.use_redis = True
                print("✓ Redis cache connected")
            except Exception as e:
                print(f"Redis connection failed, using in-memory cache: {e}")
                self.use_redis = False
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        if self.use_redis and self.redis_client:
            try:
                value = self.redis_client.get(key)
                if value:
                    return json.loads(value)
            except Exception as e:
                print(f"Redis get error: {e}")
        
        # Fallback to in-memory
        if key in _memory_cache:
            timestamp = _memory_cache_timestamps.get(key, 0)
            if time.time() < timestamp:
                return _memory_cache[key]
            else:
                # Expired
                del _memory_cache[key]
                del _memory_cache_timestamps[key]
        
        return None
    
    def set(self, key: str, value: Any, ttl: int = 3600):
        """Set value in cache with TTL (seconds)"""
        if self.use_redis and self.redis_client:
            try:
                self.redis_client.setex(
                    key,
                    ttl,
                    json.dumps(value)
                )
                return
            except Exception as e:
                print(f"Redis set error: {e}")
        
        # Fallback to in-memory
        _memory_cache[key] = value
        _memory_cache_timestamps[key] = time.time() + ttl
    
    def delete(self, key: str):
        """Delete key from cache"""
        if self.use_redis and self.redis_client:
            try:
                self.redis_client.delete(key)
            except Exception as e:
                print(f"Redis delete error: {e}")
        
        # Fallback to in-memory
        if key in _memory_cache:
            del _memory_cache[key]
        if key in _memory_cache_timestamps:
            del _memory_cache_timestamps[key]
    
    def clear(self):
        """Clear all cache"""
        if self.use_redis and self.redis_client:
            try:
                self.redis_client.flushdb()
            except Exception as e:
                print(f"Redis clear error: {e}")
        
        # Fallback to in-memory
        _memory_cache.clear()
        _memory_cache_timestamps.clear()
    
    def generate_key(self, prefix: str, *args) -> str:
        """Generate cache key from prefix and arguments"""
        key_parts = [prefix] + [str(arg) for arg in args]
        key_string = ":".join(key_parts)
        return hashlib.md5(key_string.encode()).hexdigest()


# Global cache instance
_cache_service: Optional[CacheService] = None


def get_cache() -> CacheService:
    """Get global cache service instance"""
    global _cache_service
    if _cache_service is None:
        _cache_service = CacheService()
    return _cache_service


# Cache key prefixes
CACHE_KEYS = {
    "publication": "pub",
    "models": "models",
    "model_result": "model_result",
    "comparison": "comp"
}

