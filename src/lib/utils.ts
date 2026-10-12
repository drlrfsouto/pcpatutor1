import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function answerLetter(answer: string | null | undefined) {
  if (!answer) return '';
  const match = answer.trim().match(/^([A-E])/i);
  return match?.[1]?.toUpperCase() ?? answer.trim().toUpperCase();
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('pt-BR', options ?? { day: '2-digit', month: 'short' }).format(new Date(date));
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
