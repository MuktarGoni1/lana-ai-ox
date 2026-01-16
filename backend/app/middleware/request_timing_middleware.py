import time
import threading
from typing import Dict, Any

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request


_lock = threading.Lock()
_metrics: Dict[str, Dict[str, Any]] = {}


def _record(path: str, duration_ms: float) -> None:
    with _lock:
        m = _metrics.setdefault(path, {"count": 0, "avg_ms": 0.0, "p95_ms": 0.0, "_samples": []})
        m["count"] += 1
        # Maintain small reservoir of last 100 samples for p95
        samples = m["_samples"]
        samples.append(duration_ms)
        if len(samples) > 100:
            del samples[0: len(samples) - 100]
        # Update average incrementally
        m["avg_ms"] = ((m["avg_ms"] * (m["count"] - 1)) + duration_ms) / m["count"]
        # Update p95 from reservoir
        sorted_samples = sorted(samples)
        if sorted_samples:
            idx = max(0, int(0.95 * (len(sorted_samples) - 1)))
            m["p95_ms"] = sorted_samples[idx]


class RequestTimingMiddleware(BaseHTTPMiddleware):
    """Middleware to record simple per-path request timing and add a response header."""

    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000.0
        try:
            response.headers["X-Response-Time-ms"] = f"{duration_ms:.1f}"
        except Exception:
            pass
        _record(request.url.path, duration_ms)
        return response


def get_metrics_snapshot() -> Dict[str, Dict[str, Any]]:
    """Return a copy of the collected metrics without internal fields."""
    with _lock:
        out: Dict[str, Dict[str, Any]] = {}
        for path, m in _metrics.items():
            out[path] = {"count": m["count"], "avg_ms": round(m["avg_ms"], 1), "p95_ms": round(m["p95_ms"], 1)}
        return out