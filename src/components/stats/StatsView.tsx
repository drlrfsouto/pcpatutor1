import {
  Award,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  Flame,
  Goal,
  Medal,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useStudyStats } from '@/hooks/useStudyStats';
import { PCPA_SUBJECTS } from '@/lib/constants/subjects';
import { cn } from '@/lib/utils';
import type { AppView } from '@/components/layout/Sidebar';

interface StatsViewProps { userId?: string; onNavigate: (view: AppView) => void }

export function StatsView({ userId, onNavigate }: StatsViewProps) {
  const { data } = useStudyStats(userId);
  const attempts = data?.attempts ?? [];
  const total = attempts.length;
  const correct = attempts.filter((attempt) => attempt.is_correct).length;
  const accuracy = total ? Math.round(correct / total * 100) : 0;
  const xp = correct * 10 + (total - correct) * 3;
  const bySubject = PCPA_SUBJECTS.map((subject) => {
    const subjectAttempts = attempts.filter((attempt) => attempt.question?.subject === subject.name);
    const subjectCorrect = subjectAttempts.filter((attempt) => attempt.is_correct).length;
    return { ...subject, total: subjectAttempts.length, correct: subjectCorrect, accuracy: subjectAttempts.length ? Math.round(subjectCorrect / subjectAttempts.length * 100) : 0 };
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

  return <div className="animate-float-in mx-auto max-w-6xl space-y-6">
    <div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-amber-200"><Trophy className="h-3.5 w-3.5" /> Acompanhamento</div><h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Suas estatísticas</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Veja a consistência, o aproveitamento por matéria e as conquistas construídas na sua rotina.</p></div>

    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <SummaryCard icon={BookOpenCheck} label="Questões respondidas" value={total.toLocaleString('pt-BR')} accent="text-cyan-200 bg-cyan-300/10" />
      <SummaryCard icon={CheckCircle2} label="Respostas corretas" value={`${accuracy}%`} accent="text-mint bg-mint/10" />
      <SummaryCard icon={Flame} label="Sequência atual" value={`${data?.currentStreak ?? 0} dias`} accent="text-orange-200 bg-orange-300/10" />
      <SummaryCard icon={CalendarDays} label="Dias de estudo" value={`${data?.totalStudyDays ?? activeDays}`} accent="text-violet-200 bg-violet-300/10" />
    </section>

    <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
      <Card className="p-5 md:p-6"><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-slate-100">Consistência nas últimas 4 semanas</h2><p className="mt-1 text-xs text-slate-500">Cada bloco representa um dia. Mais intensidade significa mais questões respondidas.</p></div><span className="text-xs font-semibold text-mint">{activeDays} dias ativos</span></div><div className="mt-6 grid grid-cols-7 gap-2">{dailyCounts.map((day) => { const intensity = day.count === 0 ? 0 : day.count < 3 ? 1 : day.count < 8 ? 2 : day.count < 15 ? 3 : 4; const colors = ['bg-white/[0.04]', 'bg-mint/20', 'bg-mint/40', 'bg-mint/65', 'bg-mint']; return <div key={day.date.toISOString()} title={`${day.date.toLocaleDateString('pt-BR')}: ${day.count} questões`} className={`aspect-square rounded-md ${colors[intensity]} ${day.count ? 'ring-1 ring-mint/10' : ''}`} />; })}</div><div className="mt-4 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[10px] text-slate-600"><span>4 semanas atrás</span><div className="flex items-center gap-1"><span>Menos</span>{['bg-white/[0.04]', 'bg-mint/20', 'bg-mint/40', 'bg-mint/65', 'bg-mint'].map((color, index) => <span key={index} className={`h-2.5 w-2.5 rounded-sm ${color}`} />)}<span>Mais</span></div><span>Hoje</span></div></Card>
      <Card className="p-5 md:p-6"><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold text-slate-100">Seu nível de estudo</h2><p className="mt-1 text-xs text-slate-500">XP acumulado por questões resolvidas</p></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-300/10 text-amber-200"><Zap className="h-4 w-4" /></span></div><div className="mt-7 flex items-end justify-between"><div><p className="text-4xl font-semibold tracking-tight text-white">{xp}<span className="ml-1 text-sm font-medium text-slate-500">XP</span></p><p className="mt-1 text-xs text-slate-500">Nível {Math.floor(xp / 250) + 1} · {correct} acertos</p></div><div className="text-right"><p className="text-sm font-semibold text-amber-100">{250 - xp % 250} XP</p><p className="text-[10px] text-slate-500">até o próximo nível</p></div></div><Progress value={(xp % 250) / 2.5} className="mt-4" /><div className="mt-6 grid grid-cols-3 gap-2"><Milestone icon={Target} label="Início" active={total > 0} /><Milestone icon={Medal} label="10 acertos" active={correct >= 10} /><Milestone icon={ShieldCheck} label="80% de acerto" active={accuracy >= 80 && total >= 5} /></div></Card>
    </div>

    <Card className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-4 md:px-6 md:pt-6"><div><h2 className="text-sm font-semibold text-slate-100">Desempenho por matéria</h2><p className="mt-1 text-xs text-slate-500">Identifique onde focar a próxima sessão.</p></div><button onClick={() => onNavigate('practice')} className="text-xs font-semibold text-mint hover:text-white">Praticar questões <span aria-hidden="true">→</span></button></div><div className="divide-y divide-white/[0.045]">{bySubject.map((subject) => { const Icon = subject.icon; return <div key={subject.name} className="grid gap-2 px-5 py-3.5 sm:grid-cols-[minmax(180px,1fr)_1.2fr_50px] sm:items-center md:px-6"><div className="flex min-w-0 items-center gap-2.5"><span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', subject.bgColor, subject.color)}><Icon className="h-3.5 w-3.5" /></span><span className="min-w-0 text-xs font-medium leading-4 text-slate-300">{subject.name}</span></div><div className="flex items-center gap-3"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-mint" style={{ width: `${subject.total ? Math.max(5, subject.total / maxSubject * 100) : 0}%` }} /></div><span className="w-8 text-right text-[10px] tabular-nums text-slate-500">{subject.total}</span></div><span className={`text-right text-xs font-semibold ${subject.total ? subject.accuracy >= 70 ? 'text-mint' : 'text-amber-200' : 'text-slate-600'}`}>{subject.total ? `${subject.accuracy}%` : '—'}</span></div>; })}</div></Card>

    {total === 0 && <Card className="flex flex-col gap-4 border-cyan-300/10 bg-cyan-300/[0.025] p-5 sm:flex-row sm:items-center sm:justify-between md:p-6"><div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyan-300/10 text-cyan-200"><Sparkles className="h-4 w-4" /></span><div><p className="text-sm font-semibold text-slate-100">Seu histórico começa na próxima questão.</p><p className="mt-1 text-xs leading-5 text-slate-500">Resolva uma questão para começar a visualizar seu ritmo e aproveitamento.</p></div></div><button onClick={() => onNavigate('practice')} className="flex items-center gap-2 text-xs font-semibold text-cyan-200 hover:text-white"><Goal className="h-4 w-4" />Começar agora</button></Card>}
  </div>;
}

function SummaryCard({ icon: Icon, label, value, accent }: { icon: typeof Award; label: string; value: string; accent: string }) {
  return <Card className="p-4 md:p-5"><div className="flex items-start justify-between gap-2"><span className="text-[11px] leading-4 text-slate-500">{label}</span><span className={`grid h-8 w-8 place-items-center rounded-xl ${accent}`}><Icon className="h-4 w-4" /></span></div><p className="mt-3 text-2xl font-semibold tracking-tight text-white">{value}</p></Card>;
}
function Milestone({ icon: Icon, label, active }: { icon: typeof Target; label: string; active: boolean }) {
  return <div className={cn('flex flex-col items-center gap-1.5 rounded-xl border p-2 text-center', active ? 'border-mint/15 bg-mint/[0.04] text-mint' : 'border-white/[0.05] text-slate-600')}><Icon className="h-4 w-4" /><span className="text-[8px] font-medium leading-3">{label}</span></div>;
}
