import type { PcpaQuestion } from '@/integrations/supabase/types';
import { answerLetter } from '@/lib/utils';

const ATTEMPTS_KEY = 'tutor-pcpa:demo-attempts';
const WRONG_KEY = 'tutor-pcpa:demo-wrong-answers';
const FLASHCARDS_KEY = 'tutor-pcpa:demo-flashcards';

export interface DemoAttempt {
  id: string;
  question_id: string;
  selected_answer: string;
  is_correct: boolean;
  time_spent_seconds: number;
  created_at: string;
  question: PcpaQuestion;
}

export interface DemoWrongAnswer {
  id: string;
  question_id: string;
  wrong_answer: string;
  attempted_at: string;
  reviewed: boolean;
  mastered: boolean;
  review_count: number;
  last_reviewed_at: string | null;
  question: PcpaQuestion;
}

export interface FlashcardProgress {
  question_id: string;
  repetitions: number;
  ease_factor: number;
  interval_days: number;
  next_review_date: string;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window !== 'undefined') window.localStorage.setItem(key, JSON.stringify(value));
}

export function getDemoAttempts() {
  return readJson<DemoAttempt[]>(ATTEMPTS_KEY, []);
}

export function saveDemoAttempt(question: PcpaQuestion, selectedAnswer: string, elapsedSeconds = 0) {
  const attempt: DemoAttempt = {
    id: `demo-attempt-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
    question_id: question.id,
    selected_answer: answerLetter(selectedAnswer),
    is_correct: answerLetter(selectedAnswer) === answerLetter(question.answer),
    time_spent_seconds: elapsedSeconds,
    created_at: new Date().toISOString(),
    question,
  };
  writeJson(ATTEMPTS_KEY, [attempt, ...getDemoAttempts()].slice(0, 500));
  return attempt;
}

export function getDemoWrongAnswers() {
  return readJson<DemoWrongAnswer[]>(WRONG_KEY, []);
}

export function saveDemoWrongAnswer(question: PcpaQuestion, wrongAnswer: string) {
  const existing = getDemoWrongAnswers();
  const now = new Date().toISOString();
  const previous = existing.find((item) => item.question_id === question.id);
  const record: DemoWrongAnswer = {
    id: previous?.id ?? `demo-wrong-${question.id}`,
    question_id: question.id,
    wrong_answer: answerLetter(wrongAnswer),
    attempted_at: now,
    reviewed: false,
    mastered: false,
    review_count: previous?.review_count ?? 0,
    last_reviewed_at: previous?.last_reviewed_at ?? null,
    question,
  };
  writeJson(WRONG_KEY, [record, ...existing.filter((item) => item.question_id !== question.id)]);
  return record;
}

export function updateDemoWrongAnswer(id: string, patch: Partial<DemoWrongAnswer>) {
  const updated = getDemoWrongAnswers().map((item) => item.id === id ? { ...item, ...patch } : item);
  writeJson(WRONG_KEY, updated);
  return updated;
}

export function removeMasteredDemoWrongAnswers() {
  const remaining = getDemoWrongAnswers().filter((item) => !item.mastered);
  writeJson(WRONG_KEY, remaining);
  return remaining;
}

export function getFlashcardProgress() {
  return readJson<Record<string, FlashcardProgress>>(FLASHCARDS_KEY, {});
}

export function saveFlashcardProgress(progress: FlashcardProgress) {
  writeJson(FLASHCARDS_KEY, { ...getFlashcardProgress(), [progress.question_id]: progress });
}
