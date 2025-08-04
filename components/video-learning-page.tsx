"use client"

import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, MessageCircle, Plus, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"

interface VideoLearningPageProps {
  question?: string
  onBack?: () => void
}

export function VideoLearningPage({ question = "What's an API?", onBack }: VideoLearningPageProps) {
  const [textResponse, setTextResponse] = useState("")
  const [isTyping, setIsTyping] = useState(true)
  const [showVideo, setShowVideo] = useState(false)
  const [videoGenerated, setVideoGenerated] = useState(false)

  useEffect(() => {
    // Generate comprehensive response based on user's question
    const generateResponse = (userQuestion: string) => {
      // Create a detailed response based on the user's question
      const responses = {
        default: `Here's a comprehensive explanation of your question: "${userQuestion}"\n\nI'll break this down into clear, understandable concepts to help you learn effectively.\n\nKey points to understand:\n• Core concepts and definitions\n• Practical applications and examples\n• Step-by-step explanations where applicable\n• Real-world use cases and benefits\n\nThis explanation provides a solid foundation for understanding the topic, and the video below will offer visual demonstrations to reinforce these concepts.`,

        api: `Here's a comprehensive explanation of APIs:\n\nAn API (Application Programming Interface) is a set of rules and protocols that allows different software applications to communicate with each other. Think of it as a waiter in a restaurant - you (the client) give your order to the waiter (the API), who then communicates with the kitchen (the server) and brings back your food (the data).\n\nKey concepts:\n• APIs define how software components should interact\n• They enable data exchange between different systems\n• RESTful APIs are the most common type for web services\n• APIs can return data in formats like JSON or XML\n• They provide a standardized way to access functionality\n\nReal-world examples:\n• Social media platforms use APIs to share content\n• Payment systems like PayPal use APIs for transactions\n• Weather apps get data through weather service APIs\n• Maps and location services rely on mapping APIs\n\nThis explanation provides the foundation for understanding how modern web applications work together.`,

        javascript: `Here's a comprehensive explanation of JavaScript:\n\nJavaScript is a versatile programming language that powers the interactive elements of websites and web applications. Originally created for web browsers, it has evolved into a full-stack development language used both on the client-side (frontend) and server-side (backend).\n\nKey concepts:\n• Dynamic typing and flexible syntax\n• Event-driven programming model\n• Asynchronous programming with promises and async/await\n• Object-oriented and functional programming paradigms\n• DOM manipulation for interactive web pages\n\nCore features:\n• Variables and data types (strings, numbers, objects, arrays)\n• Functions and scope management\n• Control structures (loops, conditionals)\n• Error handling and debugging\n• Modern ES6+ features like arrow functions and destructuring\n\nThis explanation covers the fundamentals you need to start building dynamic web applications.`,

        react: `Here's a comprehensive explanation of React:\n\nReact is a popular JavaScript library for building user interfaces, particularly web applications. Developed by Facebook, it uses a component-based architecture that makes it easier to build and maintain complex UIs by breaking them down into reusable pieces.\n\nKey concepts:\n• Component-based architecture for reusable UI elements\n• Virtual DOM for efficient rendering and performance\n• JSX syntax that combines JavaScript and HTML-like markup\n• State management for dynamic data handling\n• Props for passing data between components\n\nCore features:\n• Functional and class components\n• Hooks for state and lifecycle management\n• Event handling and user interactions\n• Conditional rendering and list rendering\n• Component lifecycle and effects\n\nReal-world applications:\n• Single-page applications (SPAs)\n• Progressive web apps (PWAs)\n• Mobile apps with React Native\n• Desktop applications with Electron\n\nThis explanation provides the foundation for building modern, interactive web applications with React.`,
      }

      // Determine which response to use based on keywords in the question
      const lowerQuestion = userQuestion.toLowerCase()
      if (lowerQuestion.includes("api")) return responses.api
      if (lowerQuestion.includes("javascript") || lowerQuestion.includes("js")) return responses.javascript
      if (lowerQuestion.includes("react")) return responses.react

      return responses.default.replace("${userQuestion}", userQuestion)
    }

    const mockResponse = generateResponse(question)

    // Reset states
    setTextResponse("")
    setIsTyping(true)
    setShowVideo(false)
    setVideoGenerated(false)

    let currentIndex = 0
    const typeResponse = () => {
      if (currentIndex < mockResponse.length) {
        setTextResponse(mockResponse.slice(0, currentIndex + 1))
        currentIndex++
        setTimeout(typeResponse, 15) // Typing speed
      } else {
        setIsTyping(false)
        // Show video container after text is complete
        setTimeout(() => {
          setShowVideo(true)
          // Simulate video generation
          setTimeout(() => {
            setVideoGenerated(true)
          }, 2000)
        }, 500)
      }
    }

    // Start typing after a brief delay
    setTimeout(() => {
      typeResponse()
    }, 500)
  }, [question])

  const handleAskQuestion = () => {
    // Handle ask question functionality
    console.log("Ask question clicked")
  }

  const handleExtendExplanation = () => {
    // Handle extend explanation functionality
    console.log("Extend explanation clicked")
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 w-full h-full overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/[0.02] rounded-full mix-blend-normal filter blur-[128px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gray-300/[0.03] rounded-full mix-blend-normal filter blur-[128px] animate-pulse delay-700" />
      </div>

      {/* Header - Simplified without logo */}
      <header className="relative z-10 flex items-center justify-between p-6 border-b border-white/10">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-white/60 hover:text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Chat
          </Button>
          <div className="h-6 w-px bg-white/20" />
          <span className="font-semibold">LANA AI</span>
        </div>
        <div className="text-sm text-white/60">Learning Space</div>
      </header>

      {/* Main Content Area */}
      <div className="relative z-10 max-w-4xl mx-auto p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* User Question Display */}
          <motion.div
            className="relative backdrop-blur-2xl bg-white/[0.01] rounded-2xl border border-white/[0.05] shadow-xl p-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-white/[0.15] flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-medium text-white/90">You</span>
              </div>
              <div className="flex-1">
                <p className="text-white/80 text-sm">{question}</p>
              </div>
            </div>
          </motion.div>

          {/* Text Response Container - Positioned at top */}
          <motion.div
            className="relative backdrop-blur-2xl bg-white/[0.02] rounded-2xl border border-white/[0.08] shadow-2xl p-6"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-white/[0.08] flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-medium text-white/90">LANA</span>
              </div>
              <div className="flex-1">
                <div className="text-white/90 text-sm leading-relaxed whitespace-pre-wrap">
                  {textResponse}
                  {isTyping && (
                    <motion.span
                      className="inline-block w-2 h-4 bg-white/60 ml-1"
                      animate={{ opacity: [1, 0] }}
                      transition={{ duration: 0.8, repeat: Number.POSITIVE_INFINITY }}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons - Horizontal Layout */}
            {!isTyping && textResponse && (
              <motion.div
                className="flex justify-center gap-4 mt-6"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <motion.button
                  onClick={handleAskQuestion}
                  className="flex items-center gap-3 px-6 py-3 bg-white/[0.03] hover:bg-white/[0.08] rounded-xl text-sm text-white/80 hover:text-white/95 transition-all relative group border border-white/[0.08] hover:border-white/[0.20]"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <MessageCircle className="w-4 h-4 text-white/70 group-hover:text-white/90 transition-colors" />
                  <span className="font-medium">Ask Follow-up Question</span>
                  <motion.div
                    className="absolute inset-0 border border-white/[0.08] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                    initial={false}
                  />
                </motion.button>

                <motion.button
                  onClick={handleExtendExplanation}
                  className="flex items-center gap-3 px-6 py-3 bg-white/[0.03] hover:bg-white/[0.08] rounded-xl text-sm text-white/80 hover:text-white/95 transition-all relative group border border-white/[0.08] hover:border-white/[0.20]"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Plus className="w-4 h-4 text-white/70 group-hover:text-white/90 transition-colors" />
                  <span className="font-medium">Extend Explanation</span>
                  <motion.div
                    className="absolute inset-0 border border-white/[0.08] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                    initial={false}
                  />
                </motion.button>
              </motion.div>
            )}
          </motion.div>

          {/* Video Container - Positioned below text response */}
          <AnimatePresence>
            {showVideo && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="relative backdrop-blur-2xl bg-white/[0.02] rounded-2xl border border-white/[0.08] shadow-2xl p-6"
              >
                <div className="relative w-full h-80 bg-black/30 rounded-xl border-2 border-white/20 overflow-hidden backdrop-blur-sm">
                  {/* Video Content */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    {videoGenerated ? (
                      <div className="text-center space-y-4">
                        <div className="w-20 h-20 bg-gradient-to-br from-white/20 to-white/10 rounded-full flex items-center justify-center mx-auto border border-white/30 shadow-lg">
                          <Play className="w-8 h-8 text-white/90 ml-1" />
                        </div>
                        <div className="space-y-2">
                          <p className="text-white/90 font-medium">Interactive Video Explanation</p>
                          <p className="text-white/60 text-sm">Click to play visual learning content</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center space-y-4">
                        <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto border border-white/20">
                          <motion.div
                            className="w-6 h-6 border-2 border-white/60 border-t-white/20 rounded-full"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                          />
                        </div>
                        <div className="space-y-2">
                          <p className="text-white/70 font-medium">Generating Video Explanation</p>
                          <p className="text-white/50 text-sm">Creating visual content based on your question</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Subtle grid pattern overlay */}
                  <div className="absolute inset-0 opacity-[0.02]">
                    <div
                      className="w-full h-full"
                      style={{
                        backgroundImage: `
                        linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
                      `,
                        backgroundSize: "20px 20px",
                      }}
                    />
                  </div>

                  {/* Corner indicators */}
                  <div className="absolute top-2 left-2 w-3 h-3 border-l-2 border-t-2 border-white/30 rounded-tl-sm" />
                  <div className="absolute top-2 right-2 w-3 h-3 border-r-2 border-t-2 border-white/30 rounded-tr-sm" />
                  <div className="absolute bottom-2 left-2 w-3 h-3 border-l-2 border-b-2 border-white/30 rounded-bl-sm" />
                  <div className="absolute bottom-2 right-2 w-3 h-3 border-r-2 border-b-2 border-white/30 rounded-br-sm" />
                </div>

                {/* Video Container Label */}
                <div className="mt-4 text-center">
                  <p className="text-white/60 text-sm">
                    {videoGenerated
                      ? "Interactive video content based on the text explanation above"
                      : "Preparing personalized video content for your question"}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Typing Indicator - Only show when typing */}
      <AnimatePresence>
        {isTyping && (
          <motion.div
            className="fixed bottom-8 left-1/2 mx-auto transform -translate-x-1/2 backdrop-blur-2xl bg-white/[0.03] rounded-full px-4 py-2 shadow-lg border border-white/[0.08]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-7 rounded-full bg-white/[0.08] flex items-center justify-center text-center">
                <span className="text-xs font-medium text-white/90 mb-0.5">LANA</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-white/80">
                <span>Generating explanation</span>
                <TypingDots />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video Generation Indicator */}
      <AnimatePresence>
        {showVideo && !videoGenerated && (
          <motion.div
            className="fixed bottom-8 right-8 backdrop-blur-2xl bg-white/[0.03] rounded-full px-4 py-2 shadow-lg border border-white/[0.08]"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <div className="flex items-center gap-3">
              <motion.div
                className="w-4 h-4 border-2 border-white/60 border-t-white/20 rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
              />
              <span className="text-xs text-white/80">Generating video</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function TypingDots() {
  return (
    <div className="flex items-center ml-1">
      {[1, 2, 3].map((dot) => (
        <motion.div
          key={dot}
          className="w-1.5 h-1.5 bg-white/90 rounded-full mx-0.5"
          initial={{ opacity: 0.3 }}
          animate={{
            opacity: [0.3, 0.9, 0.3],
            scale: [0.85, 1.1, 0.85],
          }}
          transition={{
            duration: 1.2,
            repeat: Number.POSITIVE_INFINITY,
            delay: dot * 0.15,
            ease: "easeInOut",
          }}
          style={{
            boxShadow: "0 0 4px rgba(255, 255, 255, 0.3)",
          }}
        />
      ))}
    </div>
  )
}
