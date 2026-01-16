"""
LLM Client Service.
Provides a centralized, secure way to access LLM clients (Groq, etc.).
"""
import logging
from typing import Optional

try:
    from groq import Groq, AsyncGroq
except ImportError:
    Groq = None
    AsyncGroq = None

try:
    from google import genai
except ImportError:
    genai = None

from app.config import GROQ_API_KEY, GOOGLE_API_KEY

logger = logging.getLogger(__name__)

class LLMClientFactory:
    _groq_client: Optional[Groq] = None
    _async_groq_client: Optional[AsyncGroq] = None
    _gemini_client: Optional[object] = None

    @classmethod
    def get_groq_client(cls) -> Optional[Groq]:
        """
        Get or create a synchronous Groq client.
        Returns None if Groq is not available or configured.
        """
        if not Groq:
            logger.warning("Groq library not installed.")
            return None
        
        if not GROQ_API_KEY:
            logger.warning("GROQ_API_KEY not configured.")
            return None

        if cls._groq_client is None:
            try:
                cls._groq_client = Groq(api_key=GROQ_API_KEY)
                logger.info("Initialized Groq client.")
            except Exception as e:
                logger.error(f"Failed to initialize Groq client: {e}")
                return None
        
        return cls._groq_client

    @classmethod
    def get_async_groq_client(cls) -> Optional[AsyncGroq]:
        """
        Get or create an asynchronous Groq client.
        Returns None if Groq is not available or configured.
        """
        if not AsyncGroq:
            logger.warning("Groq library not installed.")
            return None
        
        if not GROQ_API_KEY:
            logger.warning("GROQ_API_KEY not configured.")
            return None

        if cls._async_groq_client is None:
            try:
                cls._async_groq_client = AsyncGroq(api_key=GROQ_API_KEY)
                logger.info("Initialized AsyncGroq client.")
            except Exception as e:
                logger.error(f"Failed to initialize AsyncGroq client: {e}")
                return None
        
        return cls._async_groq_client

    @classmethod
    def get_gemini_client(cls) -> Optional[object]:
        """
        Get or create a Google GenAI (Gemini) client.
        Returns None if library is not installed or key is missing.
        """
        if not genai:
            logger.warning("Google GenAI library not installed.")
            return None

        if not GOOGLE_API_KEY:
            logger.warning("GOOGLE_API_KEY not configured.")
            return None
        
        if cls._gemini_client is None:
            try:
                cls._gemini_client = genai.Client(api_key=GOOGLE_API_KEY)
                logger.info("Initialized Gemini client.")
            except Exception as e:
                logger.error(f"Failed to initialize Gemini client: {e}")
                return None
        
        return cls._gemini_client

def get_groq_client() -> Optional[Groq]:
    """Helper function to get the sync Groq client."""
    return LLMClientFactory.get_groq_client()

def get_async_groq_client() -> Optional[AsyncGroq]:
    """Helper function to get the async Groq client."""
    return LLMClientFactory.get_async_groq_client()

def get_gemini_client() -> Optional[object]:
    """Helper function to get the Gemini client."""
    return LLMClientFactory.get_gemini_client()
