import { ExternalLink, FileCheck2, PencilLine, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { QuestionMetadata, QuestionSource } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';

interface QuestionSourceBadgeProps {
  source: QuestionSource;
  metadata?: QuestionMetadata | Record<string, never> | null;
  className?: string;
}

export function QuestionSourceBadge({ source, metadata, className }: QuestionSourceBadgeProps) {
  const data = metadata as QuestionMetadata | undefined;
  const config = {
    concurso_real: {
      icon: FileCheck2,
      label: 'Questão real',
      className: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/15',
      description: data?.concurso ? `${data.concurso}${data.banca ? ` · ${data.banca}` : ''}${data.data_aplicacao ? ` · prova em ${data.data_aplicacao}` : data.ano ? ` · ${data.ano}` : ''}` : 'Questão de fonte oficial com permissão expressa de reprodução e gabarito validado.',
    },
    ai_generated: {
      icon: Sparkles,
      label: 'IA · não é real',
      className: 'border-violet-400/30 bg-violet-400/10 text-violet-200 hover:bg-violet-400/15',
      description: 'Item autoral solicitado à IA sobre um tópico geral; não é questão real de concurso. O modelo é instruído a não copiar nem adaptar questões específicas.',
    },
    manual: {
      icon: PencilLine,
      label: 'Material demonstrativo',
      className: 'border-slate-500/35 bg-slate-400/10 text-slate-300 hover:bg-slate-400/15',
      description: 'Questão cadastrada manualmente para demonstração ou estudo.',
    },
  }[source];
  const Icon = config.icon;
  const safeUrl = data?.url_fonte && /^https?:\/\//i.test(data.url_fonte) ? data.url_fonte : undefined;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className={cn('cursor-help gap-1.5 transition-colors', config.className, className)}>
            <Icon aria-hidden="true" className="h-3 w-3 shrink-0" />
            <span>{config.label}</span>
            {safeUrl && <ExternalLink aria-hidden="true" className="h-3 w-3 shrink-0" />}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-2">
            <p className="font-medium">{config.description}</p>
            {source === 'concurso_real' && data && (
              <div className="space-y-1 border-t border-line pt-2 text-xs text-slate-400">
                {data.cargo && <p>Cargo: {data.cargo}</p>}
                {data.data_aplicacao && <p>Data da prova: {data.data_aplicacao}</p>}
                {data.numero_questao && <p>Questão nº {data.numero_questao}</p>}
                {data.nome_fonte && <p>Documento: {data.nome_fonte}</p>}
              </div>
            )}
            {safeUrl && <a href={safeUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-cyan-300 hover:underline">Ver fonte original <ExternalLink className="h-3 w-3" /></a>}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default QuestionSourceBadge;
