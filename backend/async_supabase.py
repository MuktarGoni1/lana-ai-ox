"""
Async Supabase client implementation for better performance
"""
import asyncio
import asyncpg
import aiohttp
import orjson  # Faster JSON processing
from typing import List, Dict, Any, Optional
import os
from datetime import datetime
from contextlib import asynccontextmanager
import time

class AsyncSupabaseClient:
    def __init__(self, url: str, key: str):
        self.url = url
        self.key = key
        self.headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }
        self._session: Optional[aiohttp.ClientSession] = None
        self._connection_pool: Optional[asyncpg.Pool] = None
        self._last_health_check = 0
        self._health_check_interval = 300  # 5 minutes
    
    async def get_connection_pool(self) -> Optional[asyncpg.Pool]:
        """Get or create PostgreSQL connection pool for direct database access"""
        if self._connection_pool is None:
            try:
                # Use separate database credentials from environment
                db_url = os.getenv("DATABASE_URL")
                if not db_url:
                    print("⚠️ DATABASE_URL not set, skipping PostgreSQL connection pool")
                    return None
                
                self._connection_pool = await asyncpg.create_pool(
                    db_url,
                    min_size=5,
                    max_size=20,
                    command_timeout=10,
                    server_settings={
                        'application_name': 'lana_ai_backend',
                        'tcp_keepalives_idle': '600',
                        'tcp_keepalives_interval': '30',
                        'tcp_keepalives_count': '3',
                    }
                )
                print("✅ PostgreSQL connection pool created successfully")
            except Exception as e:
                print(f"⚠️ Failed to create PostgreSQL connection pool: {e}")
                return None
        return self._connection_pool
    
    async def health_check(self) -> bool:
        """Perform periodic health check on connections"""
        current_time = time.time()
        if current_time - self._last_health_check < self._health_check_interval:
            return True
            
        try:
            # Check HTTP session
            if self._session and not self._session.closed:
                async with self._session.get(f"{self.url}/rest/v1/", timeout=aiohttp.ClientTimeout(total=5)) as response:
                    if response.status != 200:
                        await self._session.close()
                        self._session = None
            
            # Check PostgreSQL pool
            if self._connection_pool:
                async with self._connection_pool.acquire() as conn:
                    await conn.execute("SELECT 1")
            
            self._last_health_check = current_time
            return True
        except Exception as e:
            print(f"⚠️ Health check failed: {e}")
            return False
        
    async def get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session with connection pooling"""
        if self._session is None or self._session.closed:
            connector = aiohttp.TCPConnector(
                limit=100,  # Total connection pool size
                limit_per_host=30,  # Per host connection limit
                ttl_dns_cache=300,  # DNS cache TTL
                use_dns_cache=True,
                keepalive_timeout=30,
                enable_cleanup_closed=True
            )
            timeout = aiohttp.ClientTimeout(total=10, connect=5)
            self._session = aiohttp.ClientSession(
                connector=connector,
                timeout=timeout,
                headers=self.headers
            )
        return self._session
    
    async def close(self):
        """Close all connections"""
        if self._session and not self._session.closed:
            await self._session.close()
        if self._connection_pool:
            await self._connection_pool.close()
    
    @asynccontextmanager
    async def get_db_connection(self):
        """Context manager for database connections with automatic cleanup"""
        pool = await self.get_connection_pool()
        if pool:
            async with pool.acquire() as conn:
                yield conn
        else:
            yield None
    
    async def batch_insert_searches(self, records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Batch insert multiple search records for better performance"""
        if not records:
            return []
            
        # Try direct PostgreSQL connection first for better performance
        async with self.get_db_connection() as conn:
            if conn:
                try:
                    # Use prepared statement for batch insert
                    query = """
                        INSERT INTO searches (uid, title, created_at) 
                        VALUES ($1, $2, $3) 
                        RETURNING id, uid, title, created_at
                    """
                    results = []
                    async with conn.transaction():
                        for record in records:
                            result = await conn.fetchrow(
                                query, 
                                record['uid'], 
                                record['title'], 
                                record.get('created_at', datetime.utcnow())
                            )
                            results.append(dict(result))
                    return results
                except Exception as e:
                    print(f"⚠️ Batch insert via PostgreSQL failed: {e}")
        
        # Fallback to REST API
        session = await self.get_session()
        url = f"{self.url}/rest/v1/searches"
        
        try:
            async with session.post(url, json=records, timeout=aiohttp.ClientTimeout(total=15)) as response:
                if response.status in [200, 201]:
                    return await response.json()
                else:
                    error_text = await response.text()
                    print(f"⚠️ Batch insert via REST failed: {response.status} - {error_text}")
                    return records
        except Exception as e:
            print(f"⚠️ Batch insert failed: {e}")
            return records
    
    async def select_searches(self, uid: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Select searches for a user with optimized database queries"""
        # Try direct PostgreSQL connection first for better performance
        async with self.get_db_connection() as conn:
            if conn:
                try:
                    # Use prepared statement with index optimization
                    query = """
                        SELECT id, title, created_at 
                        FROM searches 
                        WHERE uid = $1 
                        ORDER BY created_at DESC 
                        LIMIT $2
                    """
                    rows = await conn.fetch(query, uid, limit)
                    return [dict(row) for row in rows]
                except Exception as e:
                    print(f"⚠️ Direct PostgreSQL query failed: {e}")
        
        # Fallback to REST API with retry logic
        session = await self.get_session()
        
        # Build query parameters
        params = {
            "select": "id,title,created_at",
            "uid": f"eq.{uid}",
            "order": "created_at.desc",
            "limit": str(limit)
        }
        
        url = f"{self.url}/rest/v1/searches"
        
        # Retry logic with exponential backoff
        max_retries = 3
        base_delay = 1
        
        for attempt in range(max_retries):
            try:
                # Use shorter timeout for individual requests
                timeout = aiohttp.ClientTimeout(total=10, connect=5)
                async with session.get(url, params=params, timeout=timeout) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data
                    else:
                        error_text = await response.text()
                        raise Exception(f"Supabase query failed: {response.status} - {error_text}")
            except (aiohttp.ClientError, asyncio.TimeoutError) as e:
                if attempt == max_retries - 1:
                    # Last attempt failed, return empty list instead of crashing
                    print(f"⚠️ Supabase connection failed after {max_retries} attempts: {str(e)}")
                    return []
                
                # Wait before retry with exponential backoff
                delay = base_delay * (2 ** attempt)
                print(f"🔄 Supabase connection attempt {attempt + 1} failed, retrying in {delay}s...")
                await asyncio.sleep(delay)
            except Exception as e:
                # For other errors, return empty list
                print(f"⚠️ Unexpected database error: {str(e)}")
                return []
    
    async def insert_search(self, uid: str, title: str) -> Dict[str, Any]:
        """Insert new search record with optimized database operations"""
        data = {
            "uid": uid,
            "title": title,
            "created_at": datetime.utcnow().isoformat()
        }
        
        # Try direct PostgreSQL connection first for better performance
        async with self.get_db_connection() as conn:
            if conn:
                try:
                    # Use prepared statement for better performance
                    query = """
                        INSERT INTO searches (uid, title, created_at) 
                        VALUES ($1, $2, $3) 
                        RETURNING id, uid, title, created_at
                    """
                    result = await conn.fetchrow(query, uid, title, datetime.utcnow())
                    return dict(result)
                except Exception as e:
                    print(f"⚠️ Direct PostgreSQL insert failed: {e}")
        
        # Fallback to REST API with retry logic
        session = await self.get_session()
        url = f"{self.url}/rest/v1/searches"
        
        # Retry logic with exponential backoff
        max_retries = 3
        base_delay = 1
        
        for attempt in range(max_retries):
            try:
                # Use shorter timeout for individual requests
                timeout = aiohttp.ClientTimeout(total=10, connect=5)
                async with session.post(url, json=data, timeout=timeout) as response:
                    if response.status in [200, 201]:
                        result = await response.json()
                        return result[0] if result else data
                    else:
                        error_text = await response.text()
                        raise Exception(f"Supabase insert failed: {response.status} - {error_text}")
            except (aiohttp.ClientError, asyncio.TimeoutError) as e:
                if attempt == max_retries - 1:
                    # Last attempt failed, return the data we tried to insert
                    print(f"⚠️ Supabase insert failed after {max_retries} attempts: {str(e)}")
                    return data
                
                # Wait before retry with exponential backoff
                delay = base_delay * (2 ** attempt)
                print(f"🔄 Supabase insert attempt {attempt + 1} failed, retrying in {delay}s...")
                await asyncio.sleep(delay)
            except Exception as e:
                # For other errors, return the data we tried to insert
                print(f"⚠️ Unexpected database insert error: {str(e)}")
                return data

# Global async client instance
async_supabase_client: Optional[AsyncSupabaseClient] = None

async def get_async_supabase() -> AsyncSupabaseClient:
    """Get or create async Supabase client"""
    global async_supabase_client
    
    if async_supabase_client is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
        
        if not url or not key:
            raise RuntimeError("Missing Supabase configuration")
            
        async_supabase_client = AsyncSupabaseClient(url, key)
    
    return async_supabase_client

async def cleanup_async_supabase():
    """Cleanup async client on shutdown"""
    global async_supabase_client
    if async_supabase_client:
        await async_supabase_client.close()
        async_supabase_client = None