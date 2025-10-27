// Shared TypeScript types for the LANA AI application

export interface QuizQuestion {
  q: string;
  options: string[];
  answer: string;
}

export interface ClassificationItem {
  type: string;
  description: string;
}

export interface SectionItem {
  title: string;
  content: string;
}

export interface StructuredLesson {
  introduction: string | null;
  classifications: ClassificationItem[];
  sections: SectionItem[];
  diagram: string;
  quiz: QuizQuestion[];
}

export interface ChatHistory {
  id: string;
  title: string;
  timestamp: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface StreamEvent {
  type: 'chunk' | 'done' | 'error';
  lesson?: StructuredLesson;
  message?: string;
}

export interface TTSRequest {
  text: string;
  sid?: string;
}

export interface MathStep {
  explanation: string;
  expression?: string;
  result?: string;
}

export interface MathSolution {
  final_answer: string;
  steps: MathStep[];
}

export interface User {
  id: string;
  email: string;
  age?: number;
  name?: string;
}

export interface LessonRequest {
  topic: string;
  age?: number;
}
