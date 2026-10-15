import type { PcpaQuestion } from '@/integrations/supabase/types';
import type { StudyRoleId } from '@/lib/constants/subjects';
import { answerLetter } from '@/lib/utils';

const ATTEMPTS_KEY = 'tutor-pcpa:demo-attempts';
const WRONG_KEY = 'tutor-pcpa:demo-wrong-answers';
const FLASHCARDS_KEY = 'tutor-pcpa:demo-flashcards';
const AI_FLASHCARD_DECKS_KEY = 'tutor-pcpa:ai-flashcard-decks';

export interface DemoAttempt {
  id: string;
  question_id: string;
  selected_answer: string;
  is_correct: boolean;
  time_spent_seconds: number;
  created_at: string;
  study_role_id?: StudyRoleId;
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
  study_role_id?: StudyRoleId;
  question: PcpaQuestion;
}

export interface FlashcardProgress {
  question_id: string;
  study_role_id?: StudyRoleId;
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

export function saveDemoAttempt(question: PcpaQuestion, selectedAnswer: string, elapsedSeconds = 0, studyRoleId?: StudyRoleId) {
  const attempt: DemoAttempt = {
    id: `demo-attempt-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
    question_id: question.id,
    selected_answer: answerLetter(selectedAnswer),
    is_correct: answerLetter(selectedAnswer) === answerLetter(question.answer),
    time_spent_seconds: elapsedSeconds,
    created_at: new Date().toISOString(),
    study_role_id: studyRoleId,
    question,
  };
  writeJson(ATTEMPTS_KEY, [attempt, ...getDemoAttempts()].slice(0, 500));
  return attempt;
}

export function getDemoWrongAnswers() {
  return readJson<DemoWrongAnswer[]>(WRONG_KEY, []);
}

export function saveDemoWrongAnswer(question: PcpaQuestion, wrongAnswer: string, studyRoleId?: StudyRoleId) {
  const existing = getDemoWrongAnswers();
  const now = new Date().toISOString();
  const previous = existing.find((item) => item.question_id === question.id && (item.study_role_id ?? studyRoleId) === studyRoleId);
  const record: DemoWrongAnswer = {
    id: previous?.id ?? `demo-wrong-${question.id}-${studyRoleId ?? 'legacy'}`, 
    question_id: question.id,
    wrong_answer: answerLetter(wrongAnswer),
    attempted_at: now,
    reviewed: false,
    mastered: false,
    review_count: previous?.review_count ?? 0,
    last_reviewed_at: previous?.last_reviewed_at ?? null,
    study_role_id: studyRoleId,
    question,
  };
  writeJson(WRONG_KEY, [record, ...existing.filter((item) => item.question_id !== question.id || (item.study_role_id ?? studyRoleId) !== studyRoleId)]);
  return record;
}

export function updateDemoWrongAnswer(id: string, patch: Partial<DemoWrongAnswer>) {
  const updated = getDemoWrongAnswers().map((item) => item.id === id ? { ...item, ...patch } : item);
  writeJson(WRONG_KEY, updated);
  return updated;
}

export function removeMasteredDemoWrongAnswers(subjectNames?: string[], studyRoleId?: StudyRoleId) {
  const remaining = getDemoWrongAnswers().filter((item) => {
    const outsideRole = studyRoleId && item.study_role_id && item.study_role_id !== studyRoleId;
    const outsideSubjects = subjectNames && !subjectNames.includes(item.question.subject);
    return !item.mastered || Boolean(outsideRole || outsideSubjects);
  });
  writeJson(WRONG_KEY, remaining);
  return remaining;
}

export function getFlashcardProgress(studyRoleId?: StudyRoleId) {
  const allProgress = readJson<Record<string, FlashcardProgress>>(FLASHCARDS_KEY, {});
  if (!studyRoleId) return allProgress;
  return Object.values(allProgress).reduce<Record<string, FlashcardProgress>>((filtered, progress) => {
    if (!progress.study_role_id || progress.study_role_id === studyRoleId) {
      const existing = filtered[progress.question_id];
      if (!existing || progress.study_role_id === studyRoleId) filtered[progress.question_id] = progress;
    }
    return filtered;
  }, {});
}

export function saveFlashcardProgress(progress: FlashcardProgress, studyRoleId?: StudyRoleId) {
  const allProgress = readJson<Record<string, FlashcardProgress>>(FLASHCARDS_KEY, {});
  const scopedProgress = { ...progress, study_role_id: studyRoleId };
  const storageKey = studyRoleId ? `${studyRoleId}:${progress.question_id}` : progress.question_id;
  writeJson(FLASHCARDS_KEY, { ...allProgress, [storageKey]: scopedProgress });
}

export function getAIGeneratedFlashcardDeck(studyRoleId: StudyRoleId, subject: string) {
  const key = `${studyRoleId}:${subject}`;
  const decks = readJson<Record<string, PcpaQuestion[]>>(AI_FLASHCARD_DECKS_KEY, {});
  return decks[key] ?? [];
}

export function saveAIGeneratedFlashcardDeck(studyRoleId: StudyRoleId, subject: string, questions: PcpaQuestion[]) {
  const key = `${studyRoleId}:${subject}`;
  const decks = readJson<Record<string, PcpaQuestion[]>>(AI_FLASHCARD_DECKS_KEY, {});
  writeJson(AI_FLASHCARD_DECKS_KEY, { ...decks, [key]: questions });
}
