# LANA AI - Frontend

Modern, AI-powered educational platform built with Next.js 14 and TypeScript.

## 🚀 Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI (shadcn/ui)
- **Animation**: Framer Motion
- **Authentication**: Supabase Auth
- **State Management**: React Hooks + Local Storage

## 📦 Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   Then edit `.env.local` with your actual values.

3. **Run development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🏗️ Project Structure

```
frontend/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page (chat)
│   ├── login/             # Authentication
│   ├── register/          # User registration
│   ├── quiz/              # Quiz interface
│   ├── term-plan/         # Study planner
│   └── ...
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── animated-ai-chat.tsx
│   ├── video-learning-page.tsx
│   └── ...
├── lib/
│   ├── api-client.ts      # HTTP client with caching
│   ├── db.ts              # Supabase client
│   ├── env.ts             # Environment validation
│   └── utils.ts           # Utilities
└── hooks/                 # Custom React hooks
```

## 🛠️ Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## 🔐 Environment Variables

See `.env.example` for required environment variables.

## 📚 Key Features

- **AI Chat Interface** - Intelligent lesson generation
- **Quiz System** - Auto-generated quizzes with scoring
- **Term Planner** - Organize subjects and topics
- **Text-to-Speech** - Audio learning support
- **Parent Dashboard** - Monitor child's progress

## 🤝 Contributing

Please ensure all code follows the project's coding standards and passes linting before submitting.
