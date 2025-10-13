"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Video } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VideoLearningPageProps {
  question?: string;
  onBack?: () => void;
}

export default function VideoLearningPage({ question = "What's an API?", onBack }: VideoLearningPageProps) {
  // This component is currently in "coming soon" mode
  // All the complex state management and functionality has been simplified
  // The original functionality can be restored when the video learning feature is ready

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 w-full h-full overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/[0.02] rounded-full mix-blend-normal filter blur-[128px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gray-300/[0.03] rounded-full mix-blend-normal filter blur-[128px] animate-pulse delay-700" />
      </div>

      {/* Header */}
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

      {/* Coming Soon Content */}
      <div className="relative z-10 flex items-center justify-center min-h-[calc(100vh-80px)]">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-6 max-w-2xl mx-auto px-6"
        >
          {/* Icon */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="flex justify-center"
          >
            <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center border border-white/20">
              <Video className="w-10 h-10 text-white/80" />
            </div>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-4xl font-bold text-white"
          >
            Lana Avatar
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="text-xl text-white/60"
          >
            Coming Soon
          </motion.p>

          {/* Description */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="space-y-4"
          >
            <p className="text-white/70 leading-relaxed">
              Be first in line when Lana’s avatar goes live—book your seat now and we’ll notify you the moment personalised AI explanations drop.
            </p>
            
            <p className="text-white/50 text-sm">
              In the meantime, continue exploring our text-based explanations and interactive features!
            </p>
          </motion.div>

          {/* User Question Display (if provided) */}
          {question && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="relative backdrop-blur-2xl bg-white/[0.01] rounded-2xl border border-white/[0.05] shadow-xl p-4 mt-8"
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
          )}

          {/* Action Button */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.5 }}
            className="pt-4"
          >
            <Button
              onClick={onBack}
              className="px-8 py-3 bg-white text-black font-medium rounded-xl hover:bg-white/90 transition-all"
            >
              Continue with Text Mode
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
