import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'
import DarkProvider from './dark-provider'
import AuthWrapper from '@/components/auth-wrapper' // ← new
import ErrorBoundary from '../components/error-boundary'
import { Toaster } from "@/components/ui/toaster"

export const metadata: Metadata = {
  title: 'v0 App',
  description: 'Created with v0',
  generator: 'v0.dev',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <head>
        <style>{`html{font-family:${GeistSans.style.fontFamily};--font-sans:${GeistSans.variable};--font-mono:${GeistMono.variable};}`}</style>
      </head>
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
