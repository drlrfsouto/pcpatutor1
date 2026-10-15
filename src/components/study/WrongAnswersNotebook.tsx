import { BookOpen, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getStudyRole, type StudyRoleId } from '@/lib/constants/subjects';

interface WrongAnswersNotebookProps {
  studyRoleId: StudyRoleId;
  userId?: string;
  onPractice?: (subject?: string) => void;
}

export function WrongAnswersNotebook({ studyRoleId, onPractice }: WrongAnswersNotebookProps) {
  const studyRole = getStudyRole(studyRoleId);

  return (
    <div className="animate-float-in mx-auto max-w-5xl space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-rose-300"><BookOpen className="h-3.5 w-3.5" /> Revisão · {studyRole?.label} · {studyRole?.notice}</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Caderno de erros</h1>
        <p className="mt-2 text-sm text-slate-500">Histórico antigo preservado; enunciados ocultos.</p>
      </div>

      <Card className="grid min-h-64 place-items-center p-8 text-center">
        <div className="max-w-md">
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.05] text-cyan-200"><ShieldCheck className="h-5 w-5" /></span>
          <h2 className="mt-4 text-base font-semibold text-white">Revisão pausada</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Você pode continuar estudando com questões autorais de IA.</p>
          {onPractice && <Button variant="secondary" className="mt-4" onClick={() => onPractice()}><Sparkles className="h-4 w-4" />Praticar</Button>}
        </div>
      </Card>
    </div>
  );
}
