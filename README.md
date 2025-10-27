# LANA AI Platform

AI-powered educational platform providing personalized, age-appropriate learning experiences for students with parental oversight.

## 🎯 Project Overview

LANA AI is a full-stack application consisting of:
- **Frontend**: Next.js 14 application with modern UI
- **Backend**: FastAPI service with AI integration

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- Python 3.10+
- npm or yarn
- Supabase account
- Groq API key
- Google AI API key

### Development Setup

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd lana-ai-ox
   ```

2. **Set up Frontend:**
   ```bash
   cd frontend
   npm install
   cp .env.example .env.local
   # Edit .env.local with your values
   npm run dev
   ```

3. **Set up Backend (in new terminal):**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   cp .env.example .env
   # Edit .env with your API keys
   python main.py
   ```

4. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

## 📂 Project Structure

```
lana-ai-ox/
├── frontend/           # Next.js application
│   ├── app/           # Pages (App Router)
│   ├── components/    # React components
│   ├── lib/           # Utilities
│   └── ...
├── backend/           # FastAPI service
│   ├── main.py       # Main application
│   └── ...
└── README.md         # This file
```

## 🎓 Core Features

- **AI Chat Interface** - Structured lesson generation
- **Quiz System** - Interactive quizzes with scoring
- **Term Planner** - Study organization
- **Text-to-Speech** - Audio learning
- **Parent Dashboard** - Progress monitoring
- **Age-Appropriate Content** - Personalized for ages 5-18+

## 🛠️ Technology Stack

### Frontend
- Next.js 14, TypeScript, Tailwind CSS
- Radix UI, Framer Motion
- Supabase Auth

### Backend
- FastAPI, Python
- Groq (Llama 3.1), Google Gemini
- Supabase, Redis

## 📖 Documentation

- [Frontend Documentation](./frontend/README.md)
- [Backend Documentation](./backend/README.md)

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines first.

## 📄 License

[Your License Here]
