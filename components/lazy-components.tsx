// components/lazy-components.tsx
"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

// Lazy load UI components that are not immediately needed
export const LazyQuiz = dynamic(() => import("@/components/ui/quiz"), {
  loading: () => (
    <div className="space-y-4 p-4">
      <Skeleton className="h-8 w-3/4 bg-white/10" />
      <div className="space-y-2">
        <Skeleton className="h-6 w-full bg-white/10" />
        <Skeleton className="h-6 w-full bg-white/10" />
        <Skeleton className="h-6 w-full bg-white/10" />
        <Skeleton className="h-6 w-full bg-white/10" />
      </div>
      <Skeleton className="h-10 w-32 bg-white/10" />
    </div>
  ),
  ssr: false
})

export const LazyChart = dynamic(() => import("@/components/ui/chart"), {
  loading: () => (
    <div className="h-64 w-full bg-white/10 rounded-lg animate-pulse flex items-center justify-center">
      <div className="text-white/60">Loading Chart...</div>
    </div>
  ),
  ssr: false
})

export const LazyCalendar = dynamic(() => import("@/components/ui/calendar"), {
  loading: () => (
    <div className="p-4 space-y-2">
      <Skeleton className="h-8 w-full bg-white/10" />
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-8 bg-white/10" />
        ))}
      </div>
    </div>
  ),
  ssr: false
})

export const LazyCarousel = dynamic(() => import("@/components/ui/carousel"), {
  loading: () => (
    <div className="space-y-4">
      <Skeleton className="h-48 w-full bg-white/10 rounded-lg" />
      <div className="flex justify-center space-x-2">
        <Skeleton className="h-2 w-8 bg-white/10 rounded-full" />
        <Skeleton className="h-2 w-8 bg-white/10 rounded-full" />
        <Skeleton className="h-2 w-8 bg-white/10 rounded-full" />
      </div>
    </div>
  ),
  ssr: false
})

export const LazyDataTable = dynamic(() => import("@/components/ui/table"), {
  loading: () => (
    <div className="space-y-2">
      <Skeleton className="h-10 w-full bg-white/10" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-full bg-white/10" />
      ))}
    </div>
  ),
  ssr: false
})

// Lazy load form components
export const LazyFormComponents = {
  Select: dynamic(() => import("@/components/ui/select"), {
    loading: () => <Skeleton className="h-10 w-full bg-white/10" />,
    ssr: false
  }),
  
  DatePicker: dynamic(() => import("@/components/ui/calendar"), {
    loading: () => <Skeleton className="h-10 w-full bg-white/10" />,
    ssr: false
  }),
  
  Textarea: dynamic(() => import("@/components/ui/textarea"), {
    loading: () => <Skeleton className="h-24 w-full bg-white/10" />,
    ssr: false
  }),
  
  Slider: dynamic(() => import("@/components/ui/slider"), {
    loading: () => <Skeleton className="h-6 w-full bg-white/10" />,
    ssr: false
  })
}

// Lazy load dialog and modal components
export const LazyModalComponents = {
  AlertDialog: dynamic(() => import("@/components/ui/alert-dialog"), {
    loading: () => null, // No loading state for modals
    ssr: false
  }),
  
  Sheet: dynamic(() => import("@/components/ui/sheet"), {
    loading: () => null,
    ssr: false
  }),
  
  Drawer: dynamic(() => import("@/components/ui/drawer"), {
    loading: () => null,
    ssr: false
  }),
  
  Popover: dynamic(() => import("@/components/ui/popover"), {
    loading: () => null,
    ssr: false
  })
}