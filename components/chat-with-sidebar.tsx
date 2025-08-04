"use client"

import { useState } from "react"
import { AnimatedAIChat } from "@/components/animated-ai-chat"
import { VideoLearningPage } from "@/components/video-learning-page"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { MessageSquare, History, Library, Plus, Clock, Trash2, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface ChatHistory {
  id: string
  title: string
  timestamp: string
  preview: string
}

function LANALogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-white"
      >
        <defs>
          <linearGradient id="lana-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id="inner-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#000000" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.7" />
          </linearGradient>
        </defs>

        {/* Outer ring */}
        <circle cx="16" cy="16" r="15" fill="url(#lana-gradient)" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />

        {/* Neural network inspired design */}
        <g fill="url(#inner-gradient)">
          {/* Central core */}
          <circle cx="16" cy="16" r="3" fill="url(#inner-gradient)" />

          {/* Neural nodes */}
          <circle cx="16" cy="8" r="2" />
          <circle cx="24" cy="16" r="2" />
          <circle cx="16" cy="24" r="2" />
          <circle cx="8" cy="16" r="2" />

          {/* Smaller connecting nodes */}
          <circle cx="11" cy="11" r="1.5" />
          <circle cx="21" cy="11" r="1.5" />
          <circle cx="21" cy="21" r="1.5" />
          <circle cx="11" cy="21" r="1.5" />
        </g>

        {/* Connection lines with gradient */}
        <g stroke="rgba(0,0,0,0.6)" strokeWidth="1.5" fill="none">
          {/* Primary connections */}
          <line x1="16" y1="16" x2="16" y2="8" />
          <line x1="16" y1="16" x2="24" y2="16" />
          <line x1="16" y1="16" x2="16" y2="24" />
          <line x1="16" y1="16" x2="8" y2="16" />

          {/* Secondary connections */}
          <line x1="16" y1="16" x2="11" y2="11" opacity="0.7" />
          <line x1="16" y1="16" x2="21" y2="11" opacity="0.7" />
          <line x1="16" y1="16" x2="21" y2="21" opacity="0.7" />
          <line x1="16" y1="16" x2="11" y2="21" opacity="0.7" />
        </g>

        {/* Subtle glow effect */}
        <circle cx="16" cy="16" r="14" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
      </svg>
    </div>
  )
}

export function ChatWithSidebar() {
  const [currentView, setCurrentView] = useState<"chat" | "video-learning">("chat")
  const [currentQuestion, setCurrentQuestion] = useState<string>("")
  const [activeSection, setActiveSection] = useState<"chat" | "history" | "library">("chat")

  // Mock data for demonstration
  const chatHistory: ChatHistory[] = [
    {
      id: "1",
      title: "What's an API?",
      timestamp: "2 hours ago",
      preview: "Explain what an API is and how it works...",
    },
    {
      id: "2",
      title: "Explain quantum physics",
      timestamp: "Yesterday",
      preview: "Help me understand the basics of quantum physics...",
    },
    {
      id: "3",
      title: "How does machine learning work?",
      timestamp: "3 days ago",
      preview: "Break down machine learning concepts for beginners...",
    },
  ]

  const handleNewChat = () => {
    setCurrentView("chat")
    setActiveSection("chat")
  }

  const handleChatSelect = (chatId: string) => {
    setCurrentView("chat")
    setActiveSection("chat")
  }

  const handleNavigateToVideoLearning = (question: string) => {
    setCurrentQuestion(question)
    setCurrentView("video-learning")
  }

  const handleBackToChat = () => {
    setCurrentView("chat")
  }

  if (currentView === "video-learning") {
    return <VideoLearningPage question={currentQuestion} onBack={handleBackToChat} />
  }

  return (
    <SidebarProvider>
      <Sidebar className="border-r border-white/10">
        <SidebarHeader className="border-b border-white/10">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <LANALogo className="flex-shrink-0" />
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold text-white">LANA AI</span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent className="gap-0">
          {/* New Chat Section */}
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={handleNewChat}
                    className="w-full justify-start gap-3 bg-white/5 hover:bg-white/10 text-white border border-white/10"
                  >
                    <Plus className="size-4" />
                    <span>New Chat</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* History Section */}
          <SidebarGroup>
            <SidebarGroupLabel className="text-white/70 flex items-center gap-2">
              <History className="size-4" />
              Recent Chats
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {chatHistory.map((chat) => (
                  <SidebarMenuItem key={chat.id}>
                    <SidebarMenuButton
                      onClick={() => handleChatSelect(chat.id)}
                      className="flex-col items-start gap-1 h-auto py-2 text-white/80 hover:text-white hover:bg-white/5"
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-medium text-sm truncate">{chat.title}</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-white/40 hover:text-white/80"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="size-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-black/90 border-white/10">
                            <DropdownMenuItem className="text-white/80 hover:text-white">
                              <Trash2 className="size-3 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="flex items-center gap-2 w-full">
                        <Clock className="size-3 text-white/40" />
                        <span className="text-xs text-white/40">{chat.timestamp}</span>
                      </div>
                      <p className="text-xs text-white/50 line-clamp-2 text-left">{chat.preview}</p>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Library Section - Empty */}
          <SidebarGroup>
            <SidebarGroupLabel className="text-white/70 flex items-center gap-2">
              <Library className="size-4" />
              Library
            </SidebarGroupLabel>
            <SidebarGroupContent>{/* Empty - ready for future content */}</SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t border-white/10">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton className="text-white/60 hover:text-white/80">
                <MessageSquare className="size-4" />
                <span className="text-sm">Feedback</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="bg-black">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-white/10 px-4">
          <SidebarTrigger className="text-white/60 hover:text-white" />
          <div className="flex items-center gap-2 text-sm text-white/60">
            <LANALogo className="w-6 h-6" />
            <span>LANA AI</span>
          </div>
        </header>
        <div className="flex-1">
          <AnimatedAIChat onNavigateToVideoLearning={handleNavigateToVideoLearning} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
