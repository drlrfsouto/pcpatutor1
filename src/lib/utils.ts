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

export function questionAnswerDisplay(type: string, answer: string | null | undefined) {
  const letter = answerLetter(answer);
  if (type === 'certo_errado') return letter === 'C' ? 'Certo' : letter === 'E' ? 'Errado' : letter;
  return letter;
}

export function questionOptionDetails(type: string, option: string, index: number) {
  if (type === 'certo_errado') {
    const text = option.replace(/^\s*[CE]\s*[).:-]\s*/i, '').trim();
    const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const value = normalized.startsWith('certo') ? 'C' : normalized.startsWith('errado') ? 'E' : index === 0 ? 'C' : 'E';
    return { value, label: value, text: text || (value === 'C' ? 'Certo' : 'Errado') };
  }
  const match = option.match(/^\s*([A-E])\s*[).:-]\s*/i);
  const value = match?.[1]?.toUpperCase() ?? String.fromCharCode(65 + index);
  return { value, label: value, text: match ? option.slice(match[0].length) : option };
}

export function questionExplanationLabel(metadata?: { explanation_type?: string } | null) {
  return metadata?.explanation_type === 'official' ? 'Justificativa oficial' : 'Comentário didático assistido por IA';
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('pt-BR', options ?? { day: '2-digit', month: 'short' }).format(new Date(date));
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
