# LANA AI - Backend

FastAPI backend service providing AI-powered educational content generation.

## 🚀 Tech Stack

- **Framework**: FastAPI
- **Language**: Python 3.10+
- **AI Services**: Groq (Llama 3.1), Google Gemini
- **Database**: Supabase (PostgreSQL)
- **Caching**: Redis / In-Memory
- **Math Engine**: SymPy

## 📦 Installation

1. **Create virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` with your actual API keys.

4. **Run development server:**
   ```bash
   python main.py
   ```
   Or with uvicorn:
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

## 🏗️ API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/structured-lesson` | POST | Generate structured lesson |
| `/api/structured-lesson/stream` | POST | Stream lesson (SSE) |
| `/api/tts` | POST | Text-to-speech generation |
| `/api/solve-math` | POST | Solve math problems |
| `/history` | GET | Get search history |
| `/health` | GET | Health check |

## 🔐 Environment Variables

See `.env.example` for required environment variables.

## 🚀 Deployment

For production deployment:

1. Set `NODE_ENV=production`
2. Configure production CORS origins
3. Set up Redis for distributed caching
4. Use multiple workers: `uvicorn main:app --workers 4`

## 📊 Performance Features

- Multi-tier caching (Redis + in-memory)
- Rate limiting per endpoint
- Async database operations
- GZip compression
- Connection pooling

## 🔧 Development

The backend runs on port 8000 by default. Access the interactive API documentation at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
