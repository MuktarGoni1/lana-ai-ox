# 🚀 LANA AI - Quick Start Guide

This guide will help you get LANA AI up and running on your local machine.

## ✅ Prerequisites Checklist

Before you begin, ensure you have the following installed:

- [ ] **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- [ ] **Python** (v3.10 or higher) - [Download](https://www.python.org/)
- [ ] **npm** or **yarn** (comes with Node.js)
- [ ] **Git** - [Download](https://git-scm.com/)

You'll also need accounts and API keys for:

- [ ] **Supabase** - [Sign up](https://supabase.com/)
- [ ] **Groq API** - [Get API key](https://console.groq.com/)
- [ ] **Google AI (Gemini)** - [Get API key](https://makersuite.google.com/app/apikey)

---

## 📦 Installation Steps

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd lana-ai-ox
```

### 2. Set Up Frontend

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local

# Edit .env.local with your actual values
# You can use: notepad .env.local (Windows) or nano .env.local (Mac/Linux)
```

**Edit `.env.local` with your values:**

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_API_BASE=http://localhost:8000
NODE_ENV=development
```

### 3. Set Up Backend

**Open a NEW terminal** and run:

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create environment file
cp .env.example .env

# Edit .env with your actual values
# Windows: notepad .env
# Mac/Linux: nano .env
```

**Edit `.env` with your values:**

```bash
GROQ_API_KEY=your-groq-api-key-here
GOOGLE_API_KEY=your-google-api-key-here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
NODE_ENV=development
LOG_LEVEL=INFO
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
GOOGLE_TTS_VOICE=Leda
```

---

## 🎯 Running the Application

### Start Backend (Terminal 1)

```bash
cd backend
# Make sure virtual environment is activated
python main.py
```

You should see:
```
INFO:     Started server process
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### Start Frontend (Terminal 2)

```bash
cd frontend
npm run dev
```

You should see:
```
▲ Next.js 14.x.x
- Local:        http://localhost:3000
- Ready in Xs
```

---

## 🌐 Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

---

## 🧪 Testing the Setup

1. **Open your browser** to http://localhost:3000
2. **You should see** the LANA AI chat interface
3. **Try asking** a question like "What is photosynthesis?"
4. **Check** if you get a structured lesson response

---

## 🐛 Troubleshooting

### Frontend Issues

**Port 3000 already in use:**
```bash
# Kill the process using port 3000
# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux:
lsof -ti:3000 | xargs kill -9
```

**Dependencies not installing:**
```bash
# Clear npm cache
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Backend Issues

**Port 8000 already in use:**
```bash
# Windows:
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Mac/Linux:
lsof -ti:8000 | xargs kill -9
```

**Python dependencies failing:**
```bash
# Upgrade pip
python -m pip install --upgrade pip

# Reinstall requirements
pip install -r requirements.txt --force-reinstall
```

**Module not found errors:**
```bash
# Make sure virtual environment is activated
# You should see (venv) in your terminal prompt
```

### API Connection Issues

**CORS errors:**
- Check that `NEXT_PUBLIC_API_BASE` in frontend/.env.local matches your backend URL
- Ensure `ALLOWED_ORIGINS` in backend/.env includes your frontend URL

**Supabase connection errors:**
- Verify your Supabase URL and keys are correct
- Check that your Supabase project is active

---

## 📚 Next Steps

Once everything is running:

1. **Create an account** - Try the registration flow
2. **Explore features**:
   - Chat interface with AI lessons
   - Quiz system
   - Term planner
   - Text-to-speech
3. **Read the documentation**:
   - [Frontend README](./frontend/README.md)
   - [Backend README](./backend/README.md)

---

## 💡 Development Tips

### Hot Reload

Both frontend and backend support hot reload:
- **Frontend**: Saves in code automatically refresh the browser
- **Backend**: Use `uvicorn main:app --reload` for auto-restart on changes

### Viewing Logs

- **Frontend**: Check browser console (F12)
- **Backend**: Check terminal output

### Code Quality

```bash
# Frontend - Run linter
cd frontend
npm run lint

# Frontend - Type checking
npm run type-check

# Frontend - Format code
npm run format
```

---

## 🆘 Getting Help

If you encounter issues:

1. Check the troubleshooting section above
2. Review the error messages carefully
3. Check the documentation in frontend/README.md and backend/README.md
4. Ensure all environment variables are set correctly

---

## 🎉 Success!

If you can see the LANA AI interface and interact with it, congratulations! You're all set up and ready to develop.

Happy coding! 🚀
