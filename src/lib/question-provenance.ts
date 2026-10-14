import type { PcpaQuestion, QuestionMetadata } from '@/integrations/supabase/types';
import { answerLetter } from '@/lib/utils';

/**
 * Domains that can serve as primary sources for official exam questions.
 * Mirrors the allowlist in supabase/functions/pcpa-gerar-questoes/index.ts.
 */
export const OFFICIAL_QUESTION_HOSTS = [
  'cebraspe.org.br',
  'fadesp.org.br',
  'fgv.br',
  'institutoaocp.org.br',
  'vunesp.com.br',
  'concursosfcc.com.br',
  'cesgranrio.org.br',
  'ibfc.org.br',
  'quadrix.org.br',
  'idecan.org.br',
  'institutoconsulplan.org.br',
  'iades.com.br',
  'gov.br',
  'pa.gov.br',
];

export function isOfficialQuestionHost(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/^www\./, '');
  return OFFICIAL_QUESTION_HOSTS.some((host) => normalized === host || normalized.endsWith(`.${host}`));
}

export function isVerifiedRealQuestion(question: PcpaQuestion | null | undefined): question is PcpaQuestion {
  if (!question || question.source !== 'concurso_real') return false;
  const metadata = question.metadata as QuestionMetadata | null;
  if (!metadata) return false;

  const year = Number(metadata.ano);
  const requiredMetadata = [metadata.concurso, metadata.banca, metadata.cargo, metadata.numero_questao];
  if (requiredMetadata.some((value) => !value?.trim()) || !Number.isInteger(year) || year < 2000 || year > new Date().getFullYear()) return false;
  if (answerLetter(metadata.gabarito_oficial) !== answerLetter(question.answer)) return false;
  const isOfficialUrl = (value?: string) => {
    if (!value?.trim()) return false;
    try {
      const url = new URL(value);
      return /^https?:$/.test(url.protocol) && isOfficialQuestionHost(url.hostname);
    } catch {
      return false;
    }
  };

  if (!isOfficialUrl(metadata.url_fonte)) return false;
  if (metadata.url_gabarito && !isOfficialUrl(metadata.url_gabarito)) return false;
  return true;
}

export function filterVerifiedRealQuestions(questions: PcpaQuestion[]) {
  return questions.filter(isVerifiedRealQuestion);
}
