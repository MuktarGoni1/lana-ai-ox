from fastapi import APIRouter
from app.settings import load_settings

router = APIRouter()


@router.get("/db")
async def db_health():
    """Check Supabase connectivity by performing a simple select.

    Returns a JSON object with connectivity status and any error.
    """
    settings = load_settings()
    url = (settings.supabase_url or "").strip()
    key = (settings.supabase_service_role_key or settings.supabase_anon_key or "").strip()

    if not url or not key:
        return {"status": "degraded", "service": "supabase", "error": "Missing SUPABASE_URL or KEY"}

    try:
        from supabase import create_client
        client = create_client(url, key)
        # Use a lightweight query against chat_messages if table exists; else a noop RPC
        # We avoid writes; select with limit 1 is cheap
        res = client.table("chat_messages").select("sid").limit(1).execute()
        ok = hasattr(res, "data")
        return {"status": "ok" if ok else "unknown", "service": "supabase", "count": len(getattr(res, "data", []) or [])}
    except Exception as e:
        return {"status": "error", "service": "supabase", "error": str(e)}