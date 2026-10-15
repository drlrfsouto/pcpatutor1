import { BookOpenText, ChevronDown, ExternalLink } from 'lucide-react';
import type { PcpaQuestion } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';

const CODE_PENAL_ARTICLE_21 = {
  title: 'Art. 21 · Código Penal',
  excerpt: 'O desconhecimento da lei é inescusável. O erro sobre a ilicitude do fato, se inevitável, isenta de pena; se evitável, poderá diminuí-la de um sexto a um terço.',
  source: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm',
};

export function cleanLegalCommentary(value: string) {
  return value
    .replace(/(?:⚠️\s*)?verificar lei seca\b[^.!?\n]*(?:[.!?]|$)/gi, '')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n[ \t]*\n[ \t]*\n/g, '\n\n')
    .trim();
}

function normalizeForMatch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function getVerifiedExcerpt(question: Pick<PcpaQuestion, 'subject' | 'topic' | 'prompt' | 'gabarito_comentado' | 'needs_verification'>) {
  const text = normalizeForMatch([question.subject, question.topic, question.prompt, question.gabarito_comentado].join(' '));
  const explicitArticle = /art(?:igo)?\.?\s*21\b/.test(text) && /codigo penal|\bcp\b/.test(text);
  const distinctiveConcept = /desconhecimento da lei/.test(text) && /erro sobre a ilicitude do fato/.test(text);
  if (explicitArticle || distinctiveConcept) return CODE_PENAL_ARTICLE_21;

  const citesSpecificLaw = /\bart(?:igo)?\.?\s*\d+\b/.test(text) || /\blei\s+(?:n[ºo.]?\s*)?\d+/i.test(text);
  return question.needs_verification && citesSpecificLaw ? { title: 'Referência legal', excerpt: null, source: null } : null;
}

interface LegalReferenceNoteProps {
  question: Pick<PcpaQuestion, 'subject' | 'topic' | 'prompt' | 'gabarito_comentado' | 'needs_verification'>;
  className?: string;
}

export function LegalReferenceNote({ question, className }: LegalReferenceNoteProps) {
  const reference = getVerifiedExcerpt(question);
  if (!reference) return null;

  return (
    <details className={cn('group mt-3 rounded-lg border border-white/[0.06] bg-white/[0.012] px-3 py-2', className)}>
      <summary className="flex cursor-pointer list-none items-center gap-2 text-[11px] text-slate-500 transition hover:text-slate-300 [&::-webkit-details-marker]:hidden">
        <BookOpenText className="h-3.5 w-3.5 shrink-0 text-cyan-200/70" />
        <span className="flex-1">Ver trecho legal · {reference.title}</span>
        <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
      </summary>
      {reference.excerpt ? <blockquote className="mt-2 border-l border-cyan-200/20 pl-3 text-xs leading-5 text-slate-400">“{reference.excerpt}”</blockquote> : <p className="mt-2 text-[11px] text-slate-500">Trecho oficial ainda não disponível para esta referência.</p>}
      {reference.source && <a
        href={reference.source}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-flex items-center gap-1 text-[10px] text-slate-500 transition hover:text-cyan-200"
      >
        Texto oficial no Planalto <ExternalLink className="h-3 w-3" />
      </a>}
    </details>
  );
}
