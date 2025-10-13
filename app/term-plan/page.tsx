"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Calendar, BookOpen, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Logo from '@/components/logo';
import { supabase } from '@/lib/db';

/* ---------- Types ---------- */
interface Topic {
  id: string;
  name: string;
  dateAdded: string;
}

interface Subject {
  id: string;
  name: string;
  topics: Topic[];
  dateAdded: string;
  isExpanded: boolean;
}

/* ---------- main page ---------- */
export default function TermPlanPage() {
  const router = useRouter();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectInput, setSubjectInput] = useState("");
  const [topicInputs, setTopicInputs] = useState<{ [key: string]: string }>({});

  // Authentication check - term plans are only for registered users
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
      }
    };
    checkAuth();
  }, [router]);

  const addSubject = () => {
    if (!subjectInput.trim()) return;
    
    const newSubject: Subject = {
      id: Date.now().toString(),
      name: subjectInput.trim(),
      topics: [],
      dateAdded: new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      }),
      isExpanded: true
    };
    
    setSubjects([...subjects, newSubject]);
    setSubjectInput("");
  };

  const addTopic = (subjectId: string) => {
    const topicInput = topicInputs[subjectId];
    if (!topicInput?.trim()) return;

    const newTopic: Topic = {
      id: Date.now().toString(),
      name: topicInput.trim(),
      dateAdded: new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      })
    };

    setSubjects(subjects.map(subject => 
      subject.id === subjectId 
        ? { ...subject, topics: [...subject.topics, newTopic] }
        : subject
    ));
    
    setTopicInputs({ ...topicInputs, [subjectId]: "" });
  };

  const toggleSubject = (subjectId: string) => {
    setSubjects(subjects.map(subject =>
      subject.id === subjectId
        ? { ...subject, isExpanded: !subject.isExpanded }
        : subject
    ));
  };

  const deleteSubject = (subjectId: string) => {
    setSubjects(subjects.filter(subject => subject.id !== subjectId));
  };

  const deleteTopic = (subjectId: string, topicId: string) => {
    setSubjects(subjects.map(subject =>
      subject.id === subjectId
        ? { ...subject, topics: subject.topics.filter(topic => topic.id !== topicId) }
        : subject
    ));
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* header with logo */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo className="w-10 h-10 md:w-12 md:h-12" />
          <h1 className="text-xl font-semibold">Term Planner</h1>
        </div>
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* body */}
      <main className="max-w-4xl mx-auto p-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">Build Your Study Plan</h2>
            <p className="text-white/70">
              Organize your subjects and topics for the term
            </p>
          </div>

          {/* Add Subject Input */}
          <div className="flex gap-2">
            <input
              value={subjectInput}
              onChange={(e) => setSubjectInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSubject()}
              placeholder="Enter subject name (e.g., Mathematics, Physics)"
              className="flex-1 px-4 py-3 rounded-lg bg-white/5 border border-white/10 
                       focus:outline-none focus:ring-2 focus:ring-white/20 
                       placeholder:text-white/40 transition-all"
            />
            <button
              onClick={addSubject}
              className="px-6 py-3 bg-white text-black rounded-lg font-medium 
                       flex items-center gap-2 hover:bg-white/90 transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Subject
            </button>
          </div>

          {/* Subjects List */}
          <AnimatePresence>
            <div className="space-y-4">
              {subjects.map((subject) => (
                <motion.div
                  key={subject.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="border border-white/10 rounded-lg overflow-hidden"
                >
                  {/* Subject Header */}
                  <div className="p-4 bg-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <button
                        onClick={() => toggleSubject(subject.id)}
                        className="p-1 hover:bg-white/10 rounded transition-colors"
                      >
                        {subject.isExpanded ? (
                          <ChevronDown className="w-5 h-5" />
                        ) : (
                          <ChevronUp className="w-5 h-5" />
                        )}
                      </button>
                      <BookOpen className="w-5 h-5 text-white/60" />
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{subject.name}</h3>
                        <p className="text-sm text-white/50">
                          Added on {subject.dateAdded} • {subject.topics.length} topics
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteSubject(subject.id)}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-white/50 hover:text-white/80" />
                    </button>
                  </div>

                  {/* Topics Section */}
                  <AnimatePresence>
                    {subject.isExpanded && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: "auto" }}
                        exit={{ height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 space-y-3 bg-black/20">
                          {/* Add Topic Input */}
                          <div className="flex gap-2">
                            <input
                              value={topicInputs[subject.id] || ""}
                              onChange={(e) => setTopicInputs({
                                ...topicInputs,
                                [subject.id]: e.target.value
                              })}
                              onKeyDown={(e) => e.key === "Enter" && addTopic(subject.id)}
                              placeholder="Add a topic (e.g., Limits & Continuity)"
                              className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 
                                       focus:outline-none focus:ring-2 focus:ring-white/20 
                                       placeholder:text-white/40 text-sm transition-all"
                            />
                            <button
                              onClick={() => addTopic(subject.id)}
                              className="px-4 py-2 bg-white/10 text-white rounded-lg 
                                       flex items-center gap-2 hover:bg-white/20 transition-all text-sm"
                            >
                              <Plus className="w-3 h-3" />
                              Add
                            </button>
                          </div>

                          {/* Topics List */}
                          <div className="space-y-2">
                            {subject.topics.map((topic) => (
                              <motion.div
                                key={topic.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="flex items-center justify-between p-3 rounded-lg 
                                         bg-white/5 border border-white/10 group cursor-pointer hover:bg-white/10 transition-all"
                                onClick={() => router.push(`/?topic=${encodeURIComponent(topic.name)}`)}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-2 h-2 rounded-full bg-white/40" />
                                  <span className="text-sm">{topic.name}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-xs text-white/40">
                                    {topic.dateAdded}
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteTopic(subject.id, topic.id);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-1 
                                             hover:bg-white/10 rounded transition-all"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              </motion.div>
                            ))}
                          </div>

                          {subject.topics.length === 0 && (
                            <p className="text-center text-white/30 text-sm py-4">
                              No topics added yet
                            </p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          </AnimatePresence>

          {subjects.length === 0 && (
            <div className="text-center py-12 text-white/30">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No subjects added yet</p>
              <p className="text-sm mt-1">Start by adding your first subject above</p>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}