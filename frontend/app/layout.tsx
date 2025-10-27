import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'
import DarkProvider from './dark-provider'
import AuthWrapper from '@/components/auth-wrapper' // ← new
import ErrorBoundary from '../components/error-boundary'
import { Toaster } from "@/components/ui/toaster"

export const metadata: Metadata = {
  title: 'LANA AI - Learn Anything, Anytime',
  description: 'An AI-powered educational platform that provides personalized learning experiences for students of all ages',
  keywords: ['AI', 'education', 'learning', 'personalized learning', 'AI tutor'],
  authors: [{ name: 'LANA AI Team' }],
  viewport: 'width=device-width, initial-scale=1',
  themeColor: '#000000',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <ErrorBoundary>
          <DarkProvider>
            <AuthWrapper>{children}</AuthWrapper>
          </DarkProvider>
        </ErrorBoundary>
        <Toaster />
      </body>
    </html>
  )
}
