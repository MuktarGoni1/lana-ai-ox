from typing import Any, Dict, Optional
import time
from cachetools import TTLCache

from app.repositories.interfaces import ICacheRepository

class MemoryCacheRepository(ICacheRepository):
    """Simple in-memory cache repository using TTLCache per namespace.

    - No external dependencies; safe for local/dev use
    - Namespaced caches with configurable TTLs via constructor
    """

    def __init__(self, default_ttl: int = 3600, maxsize: int = 1000):
        self._caches: Dict[str, TTLCache] = {}
        self._default_ttl = default_ttl
        self._default_maxsize = maxsize
        self._stats = {"hits": 0, "misses": 0, "errors": 0, "last_reset": time.time()}

    def _get_cache(self, namespace: str) -> TTLCache:
        if namespace not in self._caches:
            self._caches[namespace] = TTLCache(maxsize=self._default_maxsize, ttl=self._default_ttl)
        return self._caches[namespace]

    async def get(self, key: str, namespace: str = "default") -> Optional[Any]:
        try:
            cache = self._get_cache(namespace)
            val = cache.get(key)
            if val is None:
                self._stats["misses"] += 1
            else:
                self._stats["hits"] += 1
            return val
        except Exception:
            self._stats["errors"] += 1
            return None

    async def set(self, key: str, value: Any, ttl: Optional[int] = None, namespace: str = "default") -> bool:
        try:
            cache = self._get_cache(namespace)
            if ttl and ttl > 0:
                temp = TTLCache(maxsize=cache.maxsize, ttl=ttl)
                # Move existing items over to temp not necessary; set directly with ttl superseding
                temp[key] = value
                self._caches[namespace] = temp
            else:
                cache[key] = value
            return True
        except Exception:
            self._stats["errors"] += 1
            return False

    async def delete(self, key: str, namespace: str = "default") -> bool:
        try:
            cache = self._get_cache(namespace)
            if key in cache:
                del cache[key]
            return True
        except Exception:
            self._stats["errors"] += 1
            return False

    async def exists(self, key: str, namespace: str = "default") -> bool:
        try:
            cache = self._get_cache(namespace)
            return key in cache
        except Exception:
            self._stats["errors"] += 1
            return False

    async def get_stats(self) -> Dict[str, Any]:
        return dict(self._stats)