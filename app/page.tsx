"use client"

import dynamic from "next/dynamic"
import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"

// Lazy load the main chat component with loading fallback
const ChatWithSidebar = dynamic(() => import("@/components/chat-with-sidebar"), {
  loading: () => (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="space-y-4 w-full max-w-md mx-auto p-6">
        <Skeleton className="h-12 w-full bg-white/10" />
        <Skeleton className="h-8 w-3/4 bg-white/10" />
        <Skeleton className="h-8 w-1/2 bg-white/10" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full bg-white/10" />
          <Skeleton className="h-4 w-5/6 bg-white/10" />
          <Skeleton className="h-4 w-4/6 bg-white/10" />
        </div>
      </div>
    </div>
  ),
  ssr: false // Disable SSR for better performance on client-side interactions
})

export default function Home() {
  return (
    <main className="min-h-screen">
      <Suspense fallback={
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="animate-pulse text-white">Loading LANA AI...</div>
        </div>
      }>
        <ChatWithSidebar />
      </Suspense>
    </main>
  )
}
