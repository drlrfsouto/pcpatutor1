import { BookOpen, ShieldCheck, Sparkles } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
      <div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-rose-300"><BookOpen className="h-3.5 w-3.5" /> Revisão · {studyRole?.label} · {studyRole?.notice}</div><h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Caderno de erros</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">O caderno não exibe enunciados de provas reais. Respostas a itens de IA permanecem fora do banco, do caderno oficial e das estatísticas reais.</p></div>

      <Card className="grid min-h-72 place-items-center p-8 text-center">
        <div className="max-w-xl">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.05] text-cyan-200"><ShieldCheck className="h-5 w-5" /></span>
          <h2 className="mt-4 text-lg font-semibold text-white">Revisão de questões reais pausada</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">A prática atual usa apenas itens autorais por IA. O histórico antigo não foi apagado, mas seus enunciados não são carregados nem exibidos nesta tela. O desempenho de IA é temporário e não é misturado aos registros reais.</p>
          {onPractice && <Button variant="secondary" className="mt-5" onClick={() => onPractice()}><Sparkles className="h-4 w-4" />Praticar questões de IA</Button>}
        </div>
      </Card>

      <Alert className="border-violet-300/15 bg-violet-300/[0.035]">
        <Sparkles className="h-4 w-4 text-violet-200" />
        <AlertTitle className="text-violet-100">Itens autorais, sem estatística real</AlertTitle>
        <AlertDescription>Questões geradas por IA continuam identificadas como não reais e não são adicionadas ao caderno oficial.</AlertDescription>
      </Alert>
    </div>
  );
}
