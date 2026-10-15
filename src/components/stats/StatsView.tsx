import {
  Award,
  BookOpenCheck,
  BrainCircuit,
  FileQuestion,
  CalendarDays,
  CheckCircle2,
  Flame,
  Goal,
  Medal,
  MessagesSquare,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { isSupabaseConfigured } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { useStudyStats } from '@/hooks/useStudyStats';
import { useAIStudyStats } from '@/hooks/useAIStudyStats';
import { getRoleSubject, getStudyRole, getSubjectsForRole, getPriorityLabel, type StudyRoleId } from '@/lib/constants/subjects';
import { cn } from '@/lib/utils';
import type { AppView } from '@/components/layout/Sidebar';

interface StatsViewProps { studyRoleId: StudyRoleId; userId?: string; onNavigate: (view: AppView) => void }

export function StatsView({ studyRoleId, userId, onNavigate }: StatsViewProps) {
  const { data } = useStudyStats(userId, studyRoleId);
  const aiStudyQuery = useAIStudyStats(userId, studyRoleId);
  const aiData = aiStudyQuery.data;
  const aiStatsUnavailable = aiStudyQuery.isLoading || aiStudyQuery.isError || !isSupabaseConfigured || !userId;
  const studyRole = getStudyRole(studyRoleId);
  const roleSubjects = getSubjectsForRole(studyRoleId);
  const attempts = data?.attempts ?? [];
  const total = attempts.length;
  const correct = attempts.filter((attempt) => attempt.is_correct).length;
  const accuracy = total ? Math.round(correct / total * 100) : 0;
  const xp = correct * 10 + (total - correct) * 3;
  const bySubject = roleSubjects.map((subject) => {
    const subjectAttempts = attempts.filter((attempt) => attempt.question?.subject === subject.name);
    const subjectCorrect = subjectAttempts.filter((attempt) => attempt.is_correct).length;
    return {
      ...subject,
      profile: getRoleSubject(studyRoleId, subject.name),
      total: subjectAttempts.length,
      correct: subjectCorrect,
      accuracy: subjectAttempts.length ? Math.round(subjectCorrect / subjectAttempts.length * 100) : 0,
    };
  });
  const maxSubject = Math.max(1, ...bySubject.map((item) => item.total));
  const now = new Date();
  const dailyCounts = Array.from({ length: 28 }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (27 - index));
    const totalForDay = attempts.filter((attempt) => new Date(attempt.created_at).toDateString() === date.toDateString()).length;
    return { date, count: totalForDay };
  });
  const activeDays = new Set(attempts.map((attempt) => new Date(attempt.created_at).toDateString())).size;
  const aiTotalAttempts = aiData?.attempts.length ?? 0;
  const aiSubjectStats = roleSubjects.map((subject) => ({
    ...subject,
    total: aiData?.bySubject[subject.name]?.attempts ?? 0,
    correct: aiData?.bySubject[subject.name]?.correct ?? 0,
  })).filter((subject) => subject.total > 0).sort((left, right) => right.total - left.total);

  return <div className="animate-float-in mx-auto max-w-6xl space-y-6">
    <div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-amber-200"><Trophy className="h-3.5 w-3.5" /> Acompanhamento · {studyRole?.label} · {studyRole?.notice}</div><h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Suas estatísticas</h1><p className="mt-2 text-xs text-slate-500">Histórico anterior · práticas de IA não incluídas</p></div>

    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <SummaryCard icon={BookOpenCheck} label="Histórico real respondido" value={total.toLocaleString('pt-BR')} accent="text-cyan-200 bg-cyan-300/10" />
      <SummaryCard icon={CheckCircle2} label="Respostas corretas" value={`${accuracy}%`} accent="text-mint bg-mint/10" />
      <SummaryCard icon={Flame} label="Sequência atual" value={`${data?.currentStreak ?? 0} dias`} accent="text-orange-200 bg-orange-300/10" />
      <SummaryCard icon={CalendarDays} label="Dias de estudo" value={`${data?.totalStudyDays ?? activeDays}`} accent="text-violet-200 bg-violet-300/10" />
    </section>

    <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
      <Card className="p-5 md:p-6"><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-slate-100">Consistência nas últimas 4 semanas</h2><p className="mt-1 text-xs text-slate-500">Registro histórico de questões reais; sessões de IA não são incluídas.</p></div><span className="text-xs font-semibold text-mint">{activeDays} dias ativos</span></div><div className="mt-6 grid grid-cols-7 gap-2">{dailyCounts.map((day) => { const intensity = day.count === 0 ? 0 : day.count < 3 ? 1 : day.count < 8 ? 2 : day.count < 15 ? 3 : 4; const colors = ['bg-white/[0.04]', 'bg-mint/20', 'bg-mint/40', 'bg-mint/65', 'bg-mint']; return <div key={day.date.toISOString()} title={`${day.date.toLocaleDateString('pt-BR')}: ${day.count} questões`} className={`aspect-square rounded-md ${colors[intensity]} ${day.count ? 'ring-1 ring-mint/10' : ''}`} />; })}</div><div className="mt-4 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[10px] text-slate-600"><span>4 semanas atrás</span><div className="flex items-center gap-1"><span>Menos</span>{['bg-white/[0.04]', 'bg-mint/20', 'bg-mint/40', 'bg-mint/65', 'bg-mint'].map((color, index) => <span key={index} className={`h-2.5 w-2.5 rounded-sm ${color}`} />)}<span>Mais</span></div><span>Hoje</span></div></Card>
      <Card className="p-5 md:p-6"><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold text-slate-100">Seu nível de estudo</h2><p className="mt-1 text-xs text-slate-500">XP do histórico de questões reais</p></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-300/10 text-amber-200"><Zap className="h-4 w-4" /></span></div><div className="mt-7 flex items-end justify-between"><div><p className="text-4xl font-semibold tracking-tight text-white">{xp}<span className="ml-1 text-sm font-medium text-slate-500">XP</span></p><p className="mt-1 text-xs text-slate-500">Nível {Math.floor(xp / 250) + 1} · {correct} acertos</p></div><div className="text-right"><p className="text-sm font-semibold text-amber-100">{250 - xp % 250} XP</p><p className="text-[10px] text-slate-500">até o próximo nível</p></div></div><Progress value={(xp % 250) / 2.5} className="mt-4" /><div className="mt-6 grid grid-cols-3 gap-2"><Milestone icon={Target} label="Início" active={total > 0} /><Milestone icon={Medal} label="10 acertos" active={correct >= 10} /><Milestone icon={ShieldCheck} label="80% de acerto" active={accuracy >= 80 && total >= 5} /></div></Card>
    </div>

    <Card className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-4 md:px-6 md:pt-6"><div><h2 className="text-sm font-semibold text-slate-100">Desempenho por matéria</h2><p className="mt-1 text-xs text-slate-500">Histórico por matéria</p></div><button onClick={() => onNavigate('practice')} className="text-xs font-semibold text-mint hover:text-white">Praticar questões <span aria-hidden="true">→</span></button></div><div className="divide-y divide-white/[0.045]">{bySubject.map((subject) => { const Icon = subject.icon; return <div key={subject.name} className="grid gap-2 px-5 py-3.5 sm:grid-cols-[minmax(180px,1fr)_1.2fr_50px] sm:items-center md:px-6"><div className="flex min-w-0 items-center gap-2.5"><span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', subject.bgColor, subject.color)}><Icon className="h-3.5 w-3.5" /></span><span className="min-w-0"><span className="block text-xs font-medium leading-4 text-slate-300">{subject.name}</span>{subject.profile && <span className="mt-0.5 block text-[9px] text-slate-600">Prioridade {getPriorityLabel(subject.profile.relative_priority)} · {subject.profile.points} pts oficiais</span>}</span></div><div className="flex items-center gap-3"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-mint" style={{ width: `${subject.total ? Math.max(5, subject.total / maxSubject * 100) : 0}%` }} /></div><span className="w-8 text-right text-[10px] tabular-nums text-slate-500">{subject.total}</span></div><span className={`text-right text-xs font-semibold ${subject.total ? subject.accuracy >= 70 ? 'text-mint' : 'text-amber-200' : 'text-slate-600'}`}>{subject.total ? `${subject.accuracy}%` : '—'}</span></div>; })}</div></Card>

    <section className="space-y-4">
      <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-300/10 text-violet-200"><BrainCircuit className="h-4 w-4" /></span><div><h2 className="text-sm font-semibold text-slate-100">Atividade autoral de IA</h2><p className="mt-1 text-xs leading-5 text-slate-500">Métricas privadas desta trilha. Não são somadas ao histórico de questões oficiais acima.</p></div></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard icon={Sparkles} label="Gerações registradas" value={aiStatsUnavailable ? '—' : `${aiData?.generationCalls ?? 0}`} accent="text-violet-200 bg-violet-300/10" />
        <SummaryCard icon={MessagesSquare} label="Respostas do Tutor" value={aiStatsUnavailable ? '—' : `${aiData?.tutorReplies ?? 0}`} accent="text-violet-200 bg-violet-300/10" />
        <SummaryCard icon={FileQuestion} label="Itens de IA salvos" value={aiStatsUnavailable ? '—' : `${aiData?.generatedQuestions ?? 0}`} accent="text-cyan-200 bg-cyan-300/10" />
        <SummaryCard icon={Target} label="Tentativas de IA" value={aiStatsUnavailable ? '—' : `${aiTotalAttempts}`} accent="text-mint bg-mint/10" />
        <SummaryCard icon={CheckCircle2} label="Aproveitamento de IA" value={aiStatsUnavailable ? '—' : `${aiData?.accuracy ?? 0}%`} accent="text-amber-200 bg-amber-300/10" />
        <SummaryCard icon={BrainCircuit} label="Revisões de flashcards" value={aiStatsUnavailable ? '—' : `${aiData?.flashcardReviews ?? 0}`} accent="text-violet-200 bg-violet-300/10" />
        <SummaryCard icon={BookOpenCheck} label="Itens no caderno de IA" value={aiStatsUnavailable ? '—' : `${aiData?.openWrongAnswers ?? 0}`} accent="text-rose-200 bg-rose-300/10" />
        <SummaryCard icon={Trophy} label="Simulados concluídos" value={aiStatsUnavailable ? '—' : `${aiData?.completedSimulados ?? 0}`} accent="text-cyan-200 bg-cyan-300/10" />
        <SummaryCard icon={ShieldCheck} label="Falhas de geração" value={aiStatsUnavailable ? '—' : `${aiData?.failedGenerations ?? 0}`} accent="text-slate-300 bg-white/[0.05]" />
      </div>
      {aiStudyQuery.isError && <p role="status" className="text-[11px] text-slate-500">Os dados de IA não puderam ser sincronizados nesta sessão.</p>}
      <div className="grid gap-4 xl:grid-cols-[1fr_auto]">
        <Card className="p-5 md:p-6"><div><h3 className="text-sm font-semibold text-slate-100">Tentativas de IA por matéria</h3><p className="mt-1 text-xs text-slate-500">Somente questões autorais da trilha {studyRole?.label}.</p></div>{aiStatsUnavailable ? <p className="mt-4 text-xs text-slate-500">{aiStudyQuery.isLoading ? 'Carregando…' : 'Estatísticas de IA indisponíveis nesta sessão.'}</p> : aiSubjectStats.length ? <div className="mt-4 space-y-3">{aiSubjectStats.map((subject) => { const Icon = subject.icon; const accuracyValue = subject.total ? Math.round(subject.correct / subject.total * 100) : 0; return <div key={subject.name} className="grid grid-cols-[minmax(130px,1fr)_1.2fr_52px] items-center gap-3"><span className="flex min-w-0 items-center gap-2 text-xs text-slate-300"><Icon className="h-3.5 w-3.5 shrink-0 text-violet-200" /><span className="truncate">{subject.name}</span></span><Progress value={accuracyValue} className="h-1.5" /><span className="text-right text-[10px] text-slate-500">{accuracyValue}% · {subject.total}</span></div>; })}</div> : <p className="mt-4 text-xs text-slate-500">As respostas às questões de IA aparecerão aqui.</p>}</Card>
        <Card className="flex flex-col justify-center gap-3 p-5 md:min-w-64 md:p-6"><div><p className="text-sm font-semibold text-slate-100">Continue sua revisão</p><p className="mt-1 text-xs leading-5 text-slate-500">Consulte materiais e erros de IA salvos para sua conta.</p></div><button onClick={() => onNavigate('wrong')} className="text-left text-xs font-semibold text-violet-200 hover:text-white">Abrir caderno de erros <span aria-hidden="true">→</span></button><button onClick={() => onNavigate('flashcards')} className="text-left text-xs font-semibold text-cyan-200 hover:text-white">Revisar flashcards <span aria-hidden="true">→</span></button></Card>
      </div>
    </section>

    {total === 0 && <Card className="flex flex-col gap-4 border-cyan-300/10 bg-cyan-300/[0.025] p-5 sm:flex-row sm:items-center sm:justify-between md:p-6"><div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyan-300/10 text-cyan-200"><Sparkles className="h-4 w-4" /></span><div><p className="text-sm font-semibold text-slate-100">Sem histórico real nesta trilha</p><p className="mt-1 text-xs leading-5 text-slate-500">Itens de IA não são incluídos nestas métricas.</p></div></div><button onClick={() => onNavigate('practice')} className="flex items-center gap-2 text-xs font-semibold text-cyan-200 hover:text-white"><Goal className="h-4 w-4" />Começar agora</button></Card>}
  </div>;
}

function SummaryCard({ icon: Icon, label, value, accent }: { icon: typeof Award; label: string; value: string; accent: string }) {
  return <Card className="p-4 md:p-5"><div className="flex items-start justify-between gap-2"><span className="text-[11px] leading-4 text-slate-500">{label}</span><span className={`grid h-8 w-8 place-items-center rounded-xl ${accent}`}><Icon className="h-4 w-4" /></span></div><p className="mt-3 text-2xl font-semibold tracking-tight text-white">{value}</p></Card>;
}
function Milestone({ icon: Icon, label, active }: { icon: typeof Target; label: string; active: boolean }) {
  return <div className={cn('flex flex-col items-center gap-1.5 rounded-xl border p-2 text-center', active ? 'border-mint/15 bg-mint/[0.04] text-mint' : 'border-white/[0.05] text-slate-600')}><Icon className="h-4 w-4" /><span className="text-[8px] font-medium leading-3">{label}</span></div>;
}
