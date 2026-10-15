import { useCallback, useEffect, useState } from 'react';
import { BookOpen, Check, CircleHelp, LoaderCircle, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { QuestionSourceBadge } from '@/components/study/QuestionSourceBadge';
import { cleanLegalCommentary, LegalReferenceNote } from '@/components/study/LegalReferenceNote';
import { SubjectBadge } from '@/components/ui/SubjectBadge';
import { isSupabaseConfigured } from '@/integrations/supabase/client';
import { getStudyRole, type StudyRoleId } from '@/lib/constants/subjects';
import { answerLetter, questionAnswerDisplay, questionOptionDetails } from '@/lib/utils';
import { loadAIWrongAnswers, markAIWrongAnswerMastered, type AIWrongAnswerRecord } from '@/lib/ai-study-data';

interface WrongAnswersNotebookProps {
  studyRoleId: StudyRoleId;
  userId?: string;
  onPractice?: (subject?: string) => void;
}

export function WrongAnswersNotebook({ studyRoleId, userId, onPractice }: WrongAnswersNotebookProps) {
  const studyRole = getStudyRole(studyRoleId);
  const [records, setRecords] = useState<AIWrongAnswerRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingError, setLoadingError] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || !userId) {
      setRecords([]);
      setLoadingError('');
      return;
    }
    setLoading(true);
    setLoadingError('');
    try {
      setRecords(await loadAIWrongAnswers(studyRoleId));
    } catch (error) {
      setLoadingError(error instanceof Error ? error.message : 'Não foi possível carregar o caderno.');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [studyRoleId, userId]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function markMastered(record: AIWrongAnswerRecord) {
    setUpdatingId(record.id);
    try {
      await markAIWrongAnswerMastered(record.id, studyRoleId);
      setRecords((current) => current.filter((item) => item.id !== record.id));
      toast.success('Item arquivado no caderno de erros.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar o caderno.');
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="animate-float-in mx-auto max-w-5xl space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-rose-300"><BookOpen className="h-3.5 w-3.5" /> Revisão · {studyRole?.label} · {studyRole?.notice}</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Caderno de erros</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Erros em questões autorais de IA, privados nesta conta e separados das estatísticas de questões oficiais.</p>
      </div>

      {!isSupabaseConfigured || !userId ? <Card className="grid min-h-64 place-items-center p-8 text-center"><div className="max-w-md">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.05] text-cyan-200"><ShieldCheck className="h-5 w-5" /></span>
        <h2 className="mt-4 text-base font-semibold text-white">Caderno sincronizado</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">{!isSupabaseConfigured ? 'Conecte o Supabase para salvar e consultar seus erros.' : 'Entre em uma conta aprovada para consultar seu caderno.'}</p>
      </div></Card> : loading ? <Card className="flex min-h-64 items-center justify-center gap-2 p-8 text-sm text-slate-400"><LoaderCircle className="h-4 w-4 animate-spin text-cyan-200" />Carregando seu caderno…</Card> : loadingError ? <Card className="grid min-h-64 place-items-center p-8 text-center"><div className="max-w-md"><h2 className="text-base font-semibold text-white">Não foi possível carregar</h2><p className="mt-2 text-sm leading-6 text-slate-500">{loadingError}</p><Button variant="secondary" className="mt-4" onClick={() => void refresh()}><RefreshCw className="h-4 w-4" />Tentar novamente</Button></div></Card> : records.length === 0 ? <Card className="grid min-h-64 place-items-center p-8 text-center">
        <div className="max-w-md">
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl border border-mint/15 bg-mint/[0.05] text-mint"><ShieldCheck className="h-5 w-5" /></span>
          <h2 className="mt-4 text-base font-semibold text-white">Seu caderno está em dia</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Respostas incorretas em questões de IA serão guardadas aqui para revisão.</p>
          {onPractice && <Button variant="secondary" className="mt-4" onClick={() => onPractice()}><Sparkles className="h-4 w-4" />Praticar</Button>}
        </div>
      </Card> : <>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.015] px-4 py-3">
          <p className="text-xs text-slate-400"><span className="font-semibold text-white">{records.length}</span> {records.length === 1 ? 'item para revisar' : 'itens para revisar'} · {studyRole?.label}</p>
          <Button size="sm" variant="ghost" onClick={() => void refresh()} disabled={loading}><RefreshCw className="h-3.5 w-3.5" />Atualizar</Button>
        </div>
        <div className="space-y-4">{records.map((record) => {
          const question = record.question;
          const wrongOption = question.options.map((option, index) => questionOptionDetails(question.type, option, index)).find((option) => option.value === answerLetter(record.wrong_answer));
          return <Card key={record.id} className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.055] px-5 py-3">
              <div className="flex flex-wrap items-center gap-2"><SubjectBadge subject={question.subject} /><QuestionSourceBadge source="ai_generated" /><span className="text-[10px] text-slate-500">{question.topic}</span></div>
              <span className="text-[10px] text-slate-500">{new Date(record.attempted_at).toLocaleDateString('pt-BR')}</span>
            </div>
            <div className="p-5 md:p-6">
              <h2 className="whitespace-pre-line text-sm font-medium leading-7 text-slate-100 md:text-base">{question.prompt}</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-rose-400/10 bg-rose-400/[0.035] p-3"><p className="text-[10px] font-semibold uppercase tracking-[.12em] text-rose-200/70">Sua resposta</p><p className="mt-1 text-sm text-slate-300">{wrongOption ? `${wrongOption.label}) ${wrongOption.text}` : record.wrong_answer}</p></div>
                <div className="rounded-xl border border-mint/10 bg-mint/[0.035] p-3"><p className="text-[10px] font-semibold uppercase tracking-[.12em] text-mint/70">Gabarito de IA</p><p className="mt-1 text-sm text-slate-300">{questionAnswerDisplay(question.type, question.answer)}</p></div>
              </div>
              <details className="mt-4 rounded-xl border border-white/[0.055] bg-white/[0.012] p-3">
                <summary className="cursor-pointer text-xs font-medium text-slate-400 hover:text-slate-200">Ver comentário didático</summary>
                <div className="mt-3"><p className="text-sm leading-6 text-slate-300">{cleanLegalCommentary(question.gabarito_comentado)}</p>{question.ponto_de_atencao && <p className="mt-2 text-xs leading-5 text-slate-500"><span className="font-medium text-slate-400">Ponto-chave:</span> {question.ponto_de_atencao}</p>}<LegalReferenceNote question={question} /></div>
              </details>
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.05] pt-4">
                <Button size="sm" onClick={() => void markMastered(record)} disabled={updatingId === record.id}>{updatingId === record.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}{updatingId === record.id ? 'Salvando…' : 'Marcar como dominado'}</Button>
                {onPractice && <Button size="sm" variant="secondary" onClick={() => onPractice(question.subject)}><CircleHelp className="h-3.5 w-3.5" />Praticar matéria</Button>}
              </div>
            </div>
          </Card>;
        })}</div>
      </>}
    </div>
  );
}
