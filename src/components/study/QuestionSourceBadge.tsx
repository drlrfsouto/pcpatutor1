import { Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { QuestionSource } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';

interface QuestionSourceBadgeProps {
  source: QuestionSource;
  className?: string;
}

export function QuestionSourceBadge({ source, className }: QuestionSourceBadgeProps) {
  if (source !== 'ai_generated') return null;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className={cn('cursor-help gap-1.5 border-violet-400/30 bg-violet-400/10 text-violet-200 hover:bg-violet-400/15', className)}>
            <Sparkles aria-hidden="true" className="h-3 w-3 shrink-0" />
            <span>IA · autoral · não é real</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          Item autoral de IA, orientado pelo edital e, quando disponíveis, por sinais agregados compatíveis. Não é questão real, não recebe referência oficial e não entra no banco ou nas estatísticas reais.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default QuestionSourceBadge;
