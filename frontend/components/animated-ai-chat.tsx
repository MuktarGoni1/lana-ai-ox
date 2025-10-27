"use client";

import React, { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Paperclip,
  Command,
  SendIcon,
  XIcon,
  LoaderIcon,
  Sparkles,
  Play,
  Pause,
  Video,
  BookOpen,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import VideoLearningPage from "./video-learning-page";
import { useMotionValue } from "framer-motion";
import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import Logo from '@/components/logo';
import { saveSearch } from '@/lib/search'
import { supabase } from '@/lib/db';

// Centralized API base for both components in this file
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
/* ------------------------------------------------------------------ */
/* 1. wrapper                                                           */
/* ------------------------------------------------------------------ */
const styles = `
  .lesson-card h2 {
    font-weight: 700;
    text-decoration: none;
    color: white;
    letter-spacing: 0.3px;
  }
`;

// inject once with guard to avoid duplicates during HMR
if (typeof document !== "undefined") {
  const existing = document.getElementById("lana-inline-styles");
  if (!existing) {
    const style = document.createElement("style");
    style.id = "lana-inline-styles";
    style.innerHTML = styles;
    document.head.appendChild(style);
  }
}

export default function AnimatedChatWithVideo() {
  const [question, setQuestion] = useState("");
  const handleNavigate = (text: string) => setQuestion(text.trim());

  return question ? (
    <VideoLearningPage 
      question={question} 
      onBack={() => setQuestion("")}
    />
  ) : (
    <AnimatedAIChat
      onNavigateToVideoLearning={handleNavigate}
      onSend={() => {}}
    />
  );
}

/* ------------------------------------------------------------------ */
/* 2. textarea hook                                                     */
/* ------------------------------------------------------------------ */
interface UseAutoResizeTextareaProps {
  minHeight: number;
  maxHeight?: number;
}
function useAutoResizeTextarea({ minHeight, maxHeight }: UseAutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.style.height = `${minHeight}px`;
      if (!reset) {
        const newHeight = Math.max(
          minHeight,
          Math.min(textarea.scrollHeight, maxHeight ?? Infinity)
        );
        textarea.style.height = `${newHeight}px`;
      }
    },
    [minHeight, maxHeight]
  );
  useEffect(() => adjustHeight(true), [adjustHeight]);
  return { textareaRef, adjustHeight };
}

/* ------------------------------------------------------------------ */
/* 3. textarea component                                                */
/* ------------------------------------------------------------------ */
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  containerClassName?: string;
  showRing?: boolean;
}
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, containerClassName, showRing = true, ...props }, ref) => {
    const [focused, setFocused] = useState(false);
    return (
      <div className={cn("relative", containerClassName)}>
        <textarea
          className={cn(
            "flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
            "transition-all duration-200 ease-in-out placeholder:text-muted-foreground",
            "disabled:cursor-not-allowed disabled:opacity-50",
            showRing && "focus:outline-none",
            className
          )}
          ref={ref}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
        {showRing && focused && (
          <motion.span
            className="absolute inset-0 rounded-md pointer-events-none ring-2 ring-white/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        )}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

/* ------------------------------------------------------------------ */
/* NEW lesson card component (inline)                                 */
/* ------------------------------------------------------------------ */
const StructuredLessonCard = ({ lesson, isStreamingComplete }: { lesson: any; isStreamingComplete: boolean }) => {
  // Lightly sanitize markdown-like tokens and normalize bullets per line
  // Lightly sanitize markdown-like tokens and normalize bullets per line
  const sanitizeLine = (line: string) => {
    return line
      .replaceAll("**", "")
      .replace(/^\s*[-*]\s+/, "• ")
      .replace(/`{1,3}/g, "")
      .trim();
  };

  // Normalize common section titles to a clean, consistent name
  const normalizeTitle = (title: string) => {
    const t = title.trim();
    if (/^\s*(what\s+is)\b/i.test(t)) return "Overview";
    if (/^\s*(definition)\b/i.test(t)) return "Overview";
    if (/^\s*overview\b/i.test(t)) return "Overview";
    return t.replace(/^\s*#+\s*/, "").trim();
  };
  const router = useRouter();
  const handleTakeQuiz = () => {
    try {
      if (!lesson?.quiz || !Array.isArray(lesson.quiz) || lesson.quiz.length === 0) {
        return;
      }
      const data = encodeURIComponent(JSON.stringify(lesson.quiz));
      router.push(`/quiz?data=${data}`);
    } catch (err) {
      console.error("Failed to navigate to quiz:", err);
    }
  };

  // Removed verbose debug logging for production readiness.
  let blocks: { title?: string; content: string }[] = [];

  // TTS state and actions
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isTtsLoading, setIsTtsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioQueue, setAudioQueue] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentIndexRef = useRef(0);
  const [isQueuePreloading, setIsQueuePreloading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);

  const getFullLessonText = useCallback(() => {
    const lines: string[] = [];
    for (const b of blocks) {
      if (b.title) lines.push(`${b.title}`);
      lines.push(b.content);
    }
    return lines.join("\n\n");
  }, [blocks]);

  const objectUrlsRef = useRef<string[]>([]);
  const fetchTTSBlobUrl = useCallback(async (text: string) => {
    const res = await fetch(`${API_BASE}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`TTS error: ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    objectUrlsRef.current.push(url);
    return url;
  }, []);

  // Cleanup audio and revoke object URLs on unmount to prevent leaks
  useEffect(() => {
    return () => {
      try {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = "";
        }
        for (const u of objectUrlsRef.current) {
          URL.revokeObjectURL(u);
        }
        objectUrlsRef.current = [];
      } catch (e) {
        // Swallow cleanup errors
      }
    };
  }, []);

  const segments = useMemo(() => {
    const segs: string[] = [];
    // Build segments directly from lesson structure for speed
    if (typeof lesson?.introduction === "string") {
      const intro = lesson.introduction.trim();
      segs.push(intro.length > 600 ? intro.slice(0, 600) : intro);
    }
    if (Array.isArray(lesson?.sections)) {
      for (const section of lesson.sections) {
        if (section?.content) {
          const c = String(section.content).trim();
          if (c) segs.push(c.length > 900 ? c.slice(0, 900) : c);
        }
      }
    }
    return segs.length ? segs : [getFullLessonText()];
  }, [lesson, getFullLessonText]);

  const preloadTTS = useCallback(async () => {
    try {
      setIsTtsLoading(true);
      if (!segments.length) return;
      const firstUrl = await fetchTTSBlobUrl(segments[0]);
      setAudioUrl(firstUrl);
      setAudioQueue([firstUrl]);
      setCurrentIndex(0);
      // Preload the next segment in background if available
      if (segments.length > 1) {
        setIsQueuePreloading(true);
        fetchTTSBlobUrl(segments[1])
          .then((u) => setAudioQueue((q) => [...q, u]))
          .catch(console.error)
          .finally(() => setIsQueuePreloading(false));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsTtsLoading(false);
    }
  }, [segments, fetchTTSBlobUrl]);

  const playTTS = useCallback(() => {
    const src = audioQueue[currentIndexRef.current] || audioUrl;
    if (!src) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(src);
      audioRef.current.addEventListener("play", () => setIsPlaying(true));
      audioRef.current.addEventListener("pause", () => setIsPlaying(false));
      audioRef.current.addEventListener("ended", async () => {
        const prevIndex = currentIndexRef.current;
        const nextIndex = prevIndex + 1;
        if (segments[nextIndex] && !audioQueue[nextIndex]) {
          try {
            const u = await fetchTTSBlobUrl(segments[nextIndex]);
            setAudioQueue((q) => {
              const qq = q.slice();
              qq[nextIndex] = u;
              return qq;
            });
          } catch (e) {
            console.error(e);
          }
        }
        setCurrentIndex(nextIndex);
        currentIndexRef.current = nextIndex;
        const nextSrc = audioQueue[nextIndex];
        if (nextSrc) {
          if (audioRef.current) {
            audioRef.current.src = nextSrc;
            audioRef.current.play().catch(console.error);
          }
        } else {
          setIsPlaying(false);
        }
      });
    } else {
      audioRef.current.src = src;
    }
    audioRef.current.play().catch(console.error);
  }, [audioUrl, audioQueue, segments, fetchTTSBlobUrl]);

  const togglePlayPause = useCallback(async () => {
    if (isTtsLoading || isQueuePreloading) return;
    const hasPrepared = !!(audioUrl || audioQueue.length);
    if (!audioRef.current) {
      if (!hasPrepared) {
        await preloadTTS();
      }
      playTTS();
      return;
    }
    if (audioRef.current.paused) {
      audioRef.current.play().catch(() => {});
    } else {
      audioRef.current.pause();
    }
  }, [audioUrl, audioQueue, isTtsLoading, isQueuePreloading, preloadTTS, playTTS]);

  // Auto-preload audio once streaming completes to reduce wait time
  useEffect(() => {
    if (isStreamingComplete && !audioUrl && !isTtsLoading) {
      preloadTTS();
    }
  }, [isStreamingComplete, audioUrl, isTtsLoading, preloadTTS]);

  if (typeof lesson.introduction === "string" && lesson.introduction.startsWith("Hey dear!")) {
    blocks.push({ content: lesson.introduction });
  } else {
    if (lesson.introduction && typeof lesson.introduction === "string" && lesson.introduction.trim()) {
      blocks.push({
        title: "Introduction",
        content: lesson.introduction.trim(),
      });
    }

    if (
      Array.isArray(lesson.classifications) &&
      lesson.classifications.length > 0
    ) {
      const classificationContent = lesson.classifications
        .map((c: any) => {
          if (c?.type && c?.description) {
            return `• ${c.type}: ${c.description}`;
          }
          return null;
        })
        .filter(Boolean)
        .join("\n");

      if (classificationContent) {
        blocks.push({
          title: "Classifications / Types",
          content: classificationContent,
        });
      }
    }

    // Detailed sections (now after classifications)
    if (Array.isArray(lesson.sections)) {
      for (const section of lesson.sections) {
        if (section?.title && section?.content && section.title.trim() && section.content.trim()) {
          blocks.push({
            title: normalizeTitle(section.title.trim()),
            content: section.content.trim(),
          });
        }
      }
    }

    if (lesson.diagram && lesson.diagram.trim()) {
      blocks.push({
        title: "Diagram Description",
        content: lesson.diagram.trim(),
      });
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 max-w-3xl mx-auto"
    >
      <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 space-y-6">
        {blocks.map((block, idx) => (
          <div key={idx} className="space-y-2">
            {block.title && (
              <h3 className="font-bold text-white text-lg tracking-wide">
                {block.title}
              </h3>
            )}
            <div className="text-white/85 text-sm leading-relaxed whitespace-pre-wrap font-sans">
              {block.content.split("\n").map((line, i) => (
                <div key={i}>{sanitizeLine(line) || "\u00A0"}</div>
              ))}
            </div>
          </div>
        ))}

        {!blocks.length && (
          <p className="text-white/60 italic text-sm">No lesson content available.</p>
        )}
      </div>

      {/* ➤ ONLY SHOW LISTEN + QUIZ AFTER STREAMING COMPLETES */}
      {isStreamingComplete && (
        <div className="flex justify-end mt-6 gap-3">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={togglePlayPause}
            disabled={isTtsLoading || isQueuePreloading}
            aria-pressed={isPlaying}
            className="px-5 py-2 bg-white/10 text-white rounded-lg text-sm font-medium border border-white/20 hover:bg-white/20 transition-shadow flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isTtsLoading || isQueuePreloading ? (
              <LoaderIcon className="w-3.5 h-3.5 animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            {isTtsLoading || isQueuePreloading
              ? "Preparing audio…"
              : isPlaying
              ? "Pause"
              : audioUrl || audioQueue.length
              ? "Play"
              : "Prepare & Listen"}
          </motion.button>

          {lesson.quiz && lesson.quiz.length > 0 && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleTakeQuiz}
              className="px-5 py-2 bg-white text-black rounded-lg text-sm font-medium shadow-md hover:shadow-lg transition-shadow flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Take Quiz
            </motion.button>
          )}
        </div>
      )}
    </motion.div>
  );
};

/* ------------------------------------------------------------------ */
/* 4. chat                                                              */
/* ------------------------------------------------------------------ */
interface CommandSuggestion {
  icon: React.ReactNode;
  label: string;
  description: string;
  prefix: string;
}
interface AnimatedAIChatProps {
  onNavigateToVideoLearning: (title: string) => void
  sessionId?: string        
  onSend?: () => void
}

  export function AnimatedAIChat({ onNavigateToVideoLearning }: AnimatedAIChatProps) {
  /* --- state ------------------------------------------------------- */
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const [inputFocused, setInputFocused] = useState(false);
  const [showVideoButton, setShowVideoButton] = useState(false);
  const [storedLong, setStoredLong] = useState("");
  const [lessonJson, setLessonJson] = useState<any>(null);   // NEW
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [error, setError] = useState<string | null>(null); 
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [showSaveMessage, setShowSaveMessage] = useState(false);
  const [userAge, setUserAge] = useState<number | null>(null);
  const router = useRouter();
  
  const { textareaRef: autoRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 60,
    maxHeight: 200,
  });

  /* --- command palette data ---------------------------------------- */
  const commandSuggestions: CommandSuggestion[] = [
    { icon: <Video className="w-4 h-4" />, label: "Explain Mode", description: "Detailed video explanation", prefix: "/video" },
    { icon: <BookOpen className="w-4 h-4" />, label: "Step-by-Step", description: "Break complex topics down", prefix: "/steps" },
    { icon: <Play className="w-4 h-4" />, label: "Interactive Demo", description: "See it in action", prefix: "/demo" },
    { icon: <Sparkles className="w-4 h-4" />, label: "Quick Answer", description: "Concise explanation", prefix: "/quick" },
  ];


  const modeSuggestions = [
    {
      icon: <Video className="w-4 h-4" />,
      label: "Explanation Mode",
      description: "Comprehensive Ai explanations",
      action: () =>
        onNavigateToVideoLearning?.(
          value.trim() || "What would you like to learn?"
        ),
    },
    {
      icon: <Plus className="w-4 h-4" />, 
      label: "Add Term Plan",
      description: "Build a long-term study schedule",
      action: () => router.push("/term-plan"),
    },
  ];

  /* --- effects ----------------------------------------------------- */
  // Retrieve user age on component mount - ONLY for authenticated users
  useEffect(() => {
    const getUserAge = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        // Only proceed if user is properly authenticated
        if (session?.user) {
          // First try to get age from user metadata
          const age = session.user.user_metadata?.age;
          if (age) {
            setUserAge(age);
            return;
          }
          
          // If not in metadata, try to get from users table
          const { data: userData } = await supabase
            .from('users')
            .select('user_metadata')
            .eq('id', session.user.id)
            .single();
            
          if (userData?.user_metadata?.age) {
            setUserAge(userData.user_metadata.age);
          }
        }
        // Remove the else block - no age-based features for unauthenticated users
        // Age-based responses, term plans, and history are only for registered users
      } catch (error) {
        console.error('Error retrieving user age:', error);
      }
    };
    
    getUserAge();
  }, []);

  useEffect(() => {
    if (value.startsWith("/") && !value.includes(" ")) {
      setShowCommandPalette(true);
      const idx = commandSuggestions.findIndex((cmd) => cmd.prefix.startsWith(value));
      setActiveSuggestion(idx);
    } else {
      setShowCommandPalette(false);
    }
  }, [value]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove); 
    };
  }, [mouseX, mouseY]);

  /* --- handlers ---------------------------------------------------- */
  const handleSendMessage = async () => {
    const q = value.trim();
    if (!q) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setIsTyping(true);
    setStreamingText("");
    setStoredLong("");
    setShowVideoButton(false);
    setLessonJson(null);
    setError(null);

    // legacy video path
    if (q.startsWith("/video")) {
      const sid = localStorage.getItem("lana_sid") || "";
      const es = new EventSource(
        `${API_BASE}/ask/stream?q=${encodeURIComponent(q)}&sid=${encodeURIComponent(sid)}`,
        { withCredentials: false }
      );
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.error) {
            setError("Error: " + data.error);
            es.close();
            setIsTyping(false);
            return;
          }
          if (data.short !== undefined) setStreamingText(data.short);
          if (data.long) setStoredLong(data.long);
          if (data.done) {
            es.close();
            setIsTyping(false);
            setShowVideoButton(true);
          }
        } catch (e) {
          console.error('Error parsing EventSource data:', e);
          setError('Failed to parse response data');
          es.close();
          setIsTyping(false);
        }
      };
      es.onerror = (e) => {
        console.error('EventSource error:', e);
        setError("Connection failed");
        es.close();
        setIsTyping(false);
      };
      abortRef.current.signal.addEventListener("abort", () => es.close());
      return;
    }

    // ✅ OPTIMIZED structured-lesson STREAMING path — FAST MODE
    try {
      const response = await fetch(`${API_BASE}/api/structured-lesson/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: q, age: userAge }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      let buffer = "";
      let finalLesson: any = null;
      let isComplete = false;
      
      setIsTyping(true)
      
      // Start save search immediately (parallel processing)
      const savePromise = saveSearch(q.trim()).then(saveResult => {
        console.log('✅ saveSearch result:', saveResult)
        if (saveResult?.message) {
          setSaveMessage(saveResult.message)
          setShowSaveMessage(true)
          setTimeout(() => {
            setShowSaveMessage(false)
            setTimeout(() => setSaveMessage(null), 300)
          }, 5000)
        }
      }).catch(console.error);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const ln of lines) {
          if (!ln.startsWith("data:")) continue;
          try {
            const msg = JSON.parse(ln.slice(5).trim());

            switch (msg.type) {
              case "done":
                // ULTRA-FAST processing - instant response
                finalLesson = msg.lesson;
                isComplete = true;
                setLessonJson(finalLesson);
                setShowVideoButton(true);
                setIsTyping(false);
                
                // Ensure save completes
                await savePromise;
                return; 

              case "error":
                setError(msg.message);
                setIsTyping(false);
                return;
            }
          } catch (e) {
            // Skip malformed messages
          }
        }
      }
    } catch (e: any) {
      if (e.name === "AbortError") console.log("aborted");
      else setError(e.message || "Streaming failed");
      
      if (retryCount < MAX_RETRIES) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          handleSendMessage();
        }, 1000 * (retryCount + 1)); 
      }
    } finally {
      setIsTyping(false);
      setValue('')
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showCommandPalette) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveSuggestion((p) => (p < commandSuggestions.length - 1 ? p + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveSuggestion((p) => (p > 0 ? p - 1 : commandSuggestions.length - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (activeSuggestion >= 0) {
          const cmd = commandSuggestions[activeSuggestion];
          setValue(cmd.prefix + " ");
          setShowCommandPalette(false);
        }
      }
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleAttachFile = () =>
    setAttachments((prev) => [...prev, `file-${Math.random().toString(36).slice(2)}.pdf`]);

  const removeAttachment = (idx: number) =>
    setAttachments((prev) => prev.filter((_, i) => i !== idx));

  /* ------------------------------------------------------------------ */
  /* render                                                             */
  /* ------------------------------------------------------------------ */
  return (
    <div className="flex flex-col w-full items-center justify-center bg-transparent text-white p-6 relative overflow-hidden min-h-[calc(100vh-3rem)]">
      {/* animated blobs */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-[128px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gray-300/5 rounded-full blur-[128px] animate-pulse delay-700" />
        <div className="absolute top-1/4 right-1/3 w-64 h-64 bg-white/2 rounded-full blur-[96px] animate-pulse delay-1000" />
      </div>

      <div className="w-full max-w-2xl mx-auto relative">
        <motion.div
          className="relative z-10 space-y-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
        {/* Save message notification - positioned above logo */}
        <AnimatePresence>
          {saveMessage && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: showSaveMessage ? 1 : 0, y: showSaveMessage ? 0 : -10 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="mb-6"
            >
              <div className={cn(
                "border rounded-xl p-3 text-sm max-w-md mx-auto",
                saveMessage.includes('saved') || saveMessage.includes('history') 
                  ? "bg-green-500/10 border-green-500/20 text-green-200" 
                  : "bg-blue-500/10 border-blue-500/20 text-blue-200"
              )}>
                {saveMessage}
                {saveMessage.includes('consider registering') && (
                  <button 
                    onClick={() => router.push('/register')} 
                    className="ml-2 text-blue-300 hover:text-blue-100 underline"
                  >
                    Register
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hero section */}
        <div className="text-center space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="space-y-4"
          >
            {/* centred, bigger logo */}
            <div className="flex justify-center">
              <Logo
                width={160}
                height={100}
                className="object-contain"
              />
            </div>

            <motion.div
              className="h-px bg-gradient-to-r from-transparent via-white/30 to-transparent max-w-md mx-auto"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: "100%", opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.8 }}
            />

            <motion.p
              className="text-lg text-white/70 max-w-lg mx-auto leading-relaxed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.5 }}
            >
                Get simple and clear breakdowns—any time.
              </motion.p>
            </motion.div>
          </div>

          {/* chat card */}
          <motion.div
            className="relative backdrop-blur-2xl bg-white/5 rounded-2xl border border-white/10 shadow-2xl"
            initial={{ scale: 0.98 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            {/* command palette */}
            <AnimatePresence>
              {showCommandPalette && (
                <motion.div
                  className="absolute left-4 right-4 bottom-full mb-2 backdrop-blur-xl bg-black/90 rounded-lg z-50 shadow-lg border border-white/10 overflow-hidden"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  transition={{ duration: 0.15 }}
                >
                  {commandSuggestions.map((s, idx) => (
                    <motion.div
                      key={s.prefix}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 text-xs transition-colors cursor-pointer",
                        activeSuggestion === idx
                          ? "bg-white/10 text-white"
                          : "text-white/70 hover:bg-white/5"
                      )}
                      onClick={() => {
                        setValue(s.prefix + " ");
                        setShowCommandPalette(false);
                      }}
                    >
                      <div className="w-5 h-5 flex-center text-white/60">{s.icon}</div>
                      <div className="font-medium">{s.label}</div>
                      <div className="text-white/40 ml-1">{s.prefix}</div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* input area */}
            <div className="p-4">
              <Textarea
                ref={autoRef}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  adjustHeight();
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                placeholder="What would you like to learn today?"
                containerClassName="w-full"
                className="w-full px-4 py-3 resize-none bg-transparent border-none text-white/90 text-sm placeholder:text-white/30 min-h-[60px]"
                showRing={false}
              />
            </div>

            {/* AI response area — moved OUTSIDE input container */}
            {error && (
              <div className="px-4 pb-4">
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-200 text-sm"
                >
                  {error}
                  <button 
                    onClick={() => setError(null)} 
                    className="ml-2 text-red-300 hover:text-red-100"
                  >
                    ✕
                  </button>
                </motion.div>
              </div>
            )}

            {lessonJson && (
              <div className="px-4 pb-4">
                <StructuredLessonCard 
                  lesson={lessonJson} 
                  isStreamingComplete={!isTyping} 
                />
              </div>
            )}

            {/* attachments */}
            <AnimatePresence>
              {attachments.length > 0 && (
                <motion.div
                  className="px-4 pb-3 flex gap-2 flex-wrap"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  {attachments.map((file, idx) => (
                    <motion.div
                      key={idx}
                      className="flex items-center gap-2 text-xs bg-white/5 py-1.5 px-3 rounded-lg text-white/80 border border-white/10"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                    >
                      <span>{file}</span>
                      <button
                        onClick={() => removeAttachment(idx)}
                        className="text-white/50 hover:text-white"
                      >
                        <XIcon className="w-3 h-3" />
                      </button>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* bottom bar */}
            <div className="p-4 border-t border-white/10 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <motion.button
                  type="button"
                  onClick={handleAttachFile}
                  whileTap={{ scale: 0.94 }}
                  className="p-2 text-white/50 hover:text-white rounded-lg"
                >
                  <Paperclip className="w-4 h-4" />
                </motion.button>
                <motion.button
                  onClick={() => setShowCommandPalette((p) => !p)}
                  whileTap={{ scale: 0.94 }}
                  className="p-2 text-white/50 hover:text-white rounded-lg"
                >
                  <Command className="w-4 h-4" />
                </motion.button>
              </div>

              <motion.button
                onClick={handleSendMessage}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                disabled={!value.trim() || isTyping}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2",
                  value.trim() && !isTyping
                    ? "bg-white text-black shadow-lg shadow-white/20"
                    : "bg-white/10 text-white/50"
                )}
              >
                {isTyping ? (
                  <LoaderIcon className="w-4 h-4 animate-spin" />
                ) : (
                  <SendIcon className="w-4 h-4" />
                )}
                <span>Search</span>
              </motion.button>
            </div>

            {/* "Create video lesson" button */}
            {showVideoButton && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 border-t border-white/10"
              >
                <button
                  onClick={() => onNavigateToVideoLearning?.(
                    lessonJson?.introduction?.split('\n')[0] || value.trim() || "Generated Lesson"
                  )}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white"
                >
                  <Video className="w-4 h-4" />
                  <span>Create lesson</span>
                </button>
              </motion.div>
            )}
          </motion.div>

          {/* mode buttons */}
          <div className="w-full mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto">
            {modeSuggestions.map((mode, idx) => (
              <motion.button
                key={mode.label}
                onClick={mode.action}
                className="group flex items-center gap-3 px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-sm text-white/80 hover:text-white transition-all border border-white/10 hover:border-white/20 min-w-[180px]"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="text-white/70 group-hover:text-white transition-colors">
                  {mode.icon}
                </div>
                <div className="flex flex-col items-start">
                  <span className="font-medium">{mode.label}</span>
                  <span className="text-xs text-white/50 group-hover:text-white/80 transition-colors">
                    {mode.description}
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        </motion.div>
      </div>

      {/* mouse glow — optimized, no re-renders */}
      {inputFocused && !lessonJson && (
        <motion.div
          className="fixed w-[50rem] h-[50rem] rounded-full pointer-events-none z-0 opacity-5 bg-gradient-to-r from-white via-gray-200 to-white blur-2xl"
          style={{
            x: mouseX,
            y: mouseY,
            translateX: "-50%",
            translateY: "-50%",
          }}
          transition={{ type: "spring", damping: 25, stiffness: 150, mass: 0.5 }}
        />
      )}
    </div>
  );
}