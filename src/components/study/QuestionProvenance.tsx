import { Building2, CalendarDays, ExternalLink, FileQuestion, ShieldCheck } from 'lucide-react';
import type { PcpaQuestion } from '@/integrations/supabase/types';
import { isVerifiedRealQuestion } from '@/lib/question-provenance';

interface QuestionProvenanceProps {
  question: PcpaQuestion;
  showOfficialAnswer?: boolean;
  className?: string;
}

function formatExamDate(value?: string) {
  if (!value) return 'Data exata não confirmada na fonte';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

export function QuestionProvenance({ question, showOfficialAnswer = false, className = '' }: QuestionProvenanceProps) {
  if (!isVerifiedRealQuestion(question)) return null;

  const metadata = question.metadata!;
  const sourceUrl = metadata.url_fonte!;
  const items = [
    { label: 'Concurso', value: metadata.concurso },
    { label: 'Banca organizadora', value: metadata.banca },
    { label: 'Cargo', value: metadata.cargo },
    { label: 'Data da prova', value: formatExamDate(metadata.data_aplicacao) },
    { label: 'Ano', value: String(metadata.ano) },
    { label: 'Identificação', value: `Questão ${metadata.numero_questao}${metadata.caderno ? ` · ${metadata.caderno}` : ''}` },
  ];

  return (
    <section className={`rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.035] p-4 ${className}`} aria-label="Origem da questão">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.12em] text-emerald-200">
        <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" /> Origem oficial verificada
      </div>
      <div className="mt-3 grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-[.1em] text-slate-500">{item.label}</p>
            <p className="mt-0.5 break-words text-xs leading-5 text-slate-200">{item.value || 'Não informado pela fonte'}</p>
          </div>
        ))}
      </div>
      {showOfficialAnswer && metadata.gabarito_oficial && (
        <p className="mt-3 flex items-center gap-2 border-t border-white/[0.06] pt-3 text-xs text-emerald-100">
          <FileQuestion aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          Gabarito oficial identificado: <strong>{metadata.gabarito_oficial}</strong>
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
        <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-500">
          <Building2 aria-hidden="true" className="h-3 w-3" />
          {metadata.nome_fonte || 'Documento oficial da prova ou do gabarito'}
        </span>
        <a href={sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-cyan-300 hover:text-cyan-200 hover:underline">
          Abrir fonte original <ExternalLink aria-hidden="true" className="h-3 w-3" />
        </a>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[9px] leading-4 text-slate-500">
        <CalendarDays aria-hidden="true" className="h-3 w-3 shrink-0" />
        O enunciado e o gabarito são vinculados à fonte. O comentário explicativo pode usar IA; confira o documento original.
      </p>
    </section>
  );
}
