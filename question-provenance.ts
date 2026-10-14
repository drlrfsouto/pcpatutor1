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
  if (metadata.reproduction_permission !== 'explicit' || !metadata.license_terms?.trim()) return false;
  const isOfficialUrl = (value?: string) => {
    if (!value?.trim()) return false;
    try {
      const url = new URL(value);
      return /^https?:$/.test(url.protocol) && isOfficialQuestionHost(url.hostname);
    } catch {
      return false;
    }
  };

  if (!isOfficialUrl(metadata.url_fonte) || !isOfficialUrl(metadata.url_gabarito)) return false;
  if (!isOfficialUrl(metadata.license_evidence_url)) return false;
  if (metadata.data_aplicacao && !isOfficialUrl(metadata.application_date_evidence_url)) return false;
  if (question.type === 'certo_errado') {
    if (question.options.length !== 2 || question.options[0].trim().toLowerCase() !== 'certo' || question.options[1].trim().toLowerCase() !== 'errado') return false;
  } else if (question.type === 'multipla_escolha') {
    if (question.options.length !== 5) return false;
  } else {
    return false;
  }
  return true;
}

export function filterVerifiedRealQuestions(questions: PcpaQuestion[]) {
  return questions.filter(isVerifiedRealQuestion);
}
