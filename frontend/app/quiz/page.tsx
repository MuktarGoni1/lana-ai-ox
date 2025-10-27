"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Check, X, ArrowLeft, RotateCcw } from "lucide-react";
import { Suspense } from "react";

/* ---------------- types ---------------- */
type Question = {
  q: string;
  options: string[];
  answer: string;
  explanation?: string; // supplied by backend
};

/* ---------------- helpers ---------------- */
const percentage = (num: number, total: number) =>
  total === 0 ? 0 : Math.round((num / total) * 100);

// Safely parse and validate quiz data from URL param
function parseQuizParam(raw: string | null): Question[] {
  if (!raw) return [];
  try {
    const decoded = decodeURIComponent(raw);
    const data = JSON.parse(decoded);
    if (!Array.isArray(data)) return [];

    // Validate structure and enforce sane limits
    const MAX_QUESTIONS = 50;
    const MAX_Q_LEN = 500;
    const MAX_OPT_LEN = 200;
    const MIN_OPTIONS = 2;
    const MAX_OPTIONS = 10;

    const cleaned: Question[] = [];
    for (const item of data.slice(0, MAX_QUESTIONS)) {
      if (!item || typeof item !== "object") continue;
      const q = typeof item.q === "string" ? item.q.trim().slice(0, MAX_Q_LEN) : null;
      const options = Array.isArray(item.options)
        ? item.options
            .filter((o: any) => typeof o === "string")
            .map((o: string) => o.trim().slice(0, MAX_OPT_LEN))
        : null;
      const answer = typeof item.answer === "string" ? item.answer.trim().slice(0, MAX_OPT_LEN) : null;
      const explanation = typeof item.explanation === "string" ? item.explanation.trim().slice(0, MAX_Q_LEN) : undefined;

      if (!q || !options || options.length < MIN_OPTIONS || options.length > MAX_OPTIONS || !answer) continue;
      if (!options.includes(answer)) continue;

      cleaned.push({ q, options, answer, explanation });
    }

    return cleaned;
  } catch {
    return [];
  }
}

/* ---------------- main component ---------------- */
function QuizContent() {
  const search = useSearchParams();
  const router = useRouter();

  /* ---------- load quiz ---------- */
  const quiz = useMemo<Question[]>(() => {
    const raw = search.get("data");
    return parseQuizParam(raw);
  }, [search]);

  /* ---------- state ---------- */
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const score = useMemo(
    () => quiz.reduce((acc, q, i) => (answers[i] === q.answer ? acc + 1 : acc), 0),
    [answers, quiz]
  );

  /* ---------- empty guard ---------- */
  if (!quiz.length)
    return (
      <div className="min-h-screen bg-zinc-900 text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <p>No quiz data.</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 rounded-lg bg-white text-black"
          >
            Go back
          </button>
        </div>
      </div>
    );

  /* ---------- handlers ---------- */
  const choose = (opt: string) => {
    if (submitted) return;
    setAnswers((a) => ({ ...a, [idx]: opt }));
  };

  /* ---------- components ---------- */
  const ProgressBar = () => (
    <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
      <motion.div
        className="h-full bg-gradient-to-r from-green-400 to-emerald-500"
        initial={{ width: 0 }}
        animate={{ width: `${percentage(idx + 1, quiz.length)}%` }}
        transition={{ type: "spring", stiffness: 120 }}
      />
    </div>
  );

  const ScoreCircle = ({ value, total }: { value: number; total: number }) => {
    const pct = percentage(value, total);
    const stroke = 2 * Math.PI * 45; // r=45
    const offset = stroke - (stroke * pct) / 100;
    return (
      <div className="relative w-40 h-40 mx-auto">
        <svg className="w-full h-full -rotate-90">
          <circle
            cx="50%"
            cy="50%"
            r="45"
            stroke="rgba(255,255,255,.1)"
            strokeWidth="10"
            fill="transparent"
          />
          <motion.circle
            cx="50%"
            cy="50%"
            r="45"
            stroke="url(#grad)"
            strokeWidth="10"
            fill="transparent"
            strokeDasharray={stroke}
            initial={{ strokeDashoffset: stroke }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
          <defs>
            <linearGradient id="grad">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-3xl font-bold">
          {pct}%
        </div>
      </div>
    );
  };

  /* ---------- finished screen ---------- */
  if (submitted)
    return (
      <div className="min-h-screen bg-zinc-900 text-white flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-3xl text-center space-y-8"
        >
          <ScoreCircle value={score} total={quiz.length} />

          <div>
            <h2 className="text-2xl font-bold">
              {score === quiz.length
                ? "Perfect score!"
                : score >= quiz.length / 2
                ? "Great job!"
                : "Keep practising!"}
            </h2>
            <p className="text-white/70 mt-1">
              You answered {score} out of {quiz.length} questions correctly.
            </p>
          </div>

          {/* detailed review */}
          <div className="space-y-6 text-left">
            {quiz.map((q, i) => {
              const user = answers[i];
              const correct = q.answer;
              const wrong = user !== correct;
              return (
                <div
                  key={i}
                  className={cn(
                    "p-4 rounded-xl border",
                    wrong ? "border-red-500/30 bg-red-500/5" : "border-green-500/30 bg-green-500/5"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <p className={cn("font-medium", wrong && "text-red-300")}>
                      {i + 1}. {q.q}
                    </p>
                    {wrong ? (
                      <X className="w-5 h-5 text-red-400" />
                    ) : (
                      <Check className="w-5 h-5 text-green-400" />
                    )}
                  </div>

                  {/* options */}
                  <div className="mt-3 space-y-2">
                    {q.options.map((opt) => (
                      <div
                        key={opt}
                        className={cn(
                          "px-3 py-2 rounded-lg border text-sm flex items-center justify-between",
                          opt === correct
                            ? "border-green-500 bg-green-500/10"
                            : opt === user
                            ? "border-red-500 bg-red-500/10"
                            : "border-white/20"
                        )}
                      >
                        <span>{opt}</span>
                        {opt === correct && <Check className="w-4 h-4 text-green-400" />}
                      </div>
                    ))}
                  </div>

                  {/* explanation (only if wrong and we have it) */}
                  {wrong && q.explanation && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mt-3 text-sm text-white/80 pl-2 border-l-2 border-red-400"
                    >
                      {q.explanation}
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => {
                setAnswers({});
                setIdx(0);
                setSubmitted(false);
              }}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" /> Restart
            </button>
            <button
              onClick={() => router.back()}
              className="px-4 py-2 rounded-lg bg-white text-black font-medium"
            >
              Back to lesson
            </button>
          </div>
        </motion.div>
      </div>
    );

  /* ---------- question screen ---------- */
  const current = quiz[idx];
  const isFirst = idx === 0;
  const isLast = idx === quiz.length - 1;

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* top bar */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-white/70 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <span className="text-sm text-white/60">
            {idx + 1} / {quiz.length}
          </span>
        </div>

        <ProgressBar />

        {/* question */}
        <motion.h2
          key={idx}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-xl font-semibold mt-8 mb-6"
        >
          {idx + 1}. {current.q}
        </motion.h2>

        {/* options */}
        <div className="space-y-3">
          {current.options.map((opt) => {
            const chosen = answers[idx] === opt;
            return (
              <motion.button
                key={opt}
                onClick={() => choose(opt)}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "w-full text-left px-4 py-3 rounded-lg border transition",
                  chosen
                    ? "border-white bg-white/10"
                    : "border-white/20 hover:border-white/40"
                )}
              >
                {opt}
              </motion.button>
            );
          })}
        </div>

        {/* nav buttons */}
        <div className="mt-8 flex items-center justify-between">
          <div>
            {!isFirst && (
              <button
                onClick={() => setIdx((i) => i - 1)}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20"
              >
                Previous
              </button>
            )}
          </div>

          <div>
            {isLast ? (
              <button
                onClick={() => setSubmitted(true)}
                disabled={Object.keys(answers).length !== quiz.length}
                className={cn(
                  "px-5 py-2 rounded-lg text-sm font-medium",
                  Object.keys(answers).length === quiz.length
                    ? "bg-white text-black"
                    : "bg-white/10 text-white/40 cursor-not-allowed"
                )}
              >
                Submit
              </button>
            ) : (
              <button
                onClick={() => setIdx((i) => i + 1)}
                disabled={!answers[idx]}
                className={cn(
                  "px-5 py-2 rounded-lg text-sm font-medium",
                  answers[idx]
                    ? "bg-white text-black"
                    : "bg-white/10 text-white/40 cursor-not-allowed"
                )}
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function QuizPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-900 text-white flex items-center justify-center">Loading quiz...</div>}>
      <QuizContent />
    </Suspense>
  );
}