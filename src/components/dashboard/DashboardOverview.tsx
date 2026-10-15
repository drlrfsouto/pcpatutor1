import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Award,
  BookOpen,
  BrainCircuit,
  Check,
  ChevronRight,
  Flame,
  Gauge,
  Goal,
  Layers3,
  NotebookTabs,
  Sparkles,
  Target,
  Timer,
  Trophy,
  Zap,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { isSupabaseConfigured } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { getRoleSubject, getStudyRole, getSubjectsForRole, getPriorityLabel, type StudyRoleId, type SubjectName } from '@/lib/constants/subjects';
import { useStudyStats } from '@/hooks/useStudyStats';
import { cn, formatDate } from '@/lib/utils';
import type { AppView } from '@/components/layout/Sidebar';

interface DashboardOverviewProps {
  studyRoleId: StudyRoleId;
  userId?: string;
  onNavigate: (view: AppView) => void;
  onPractice: (subject?: SubjectName) => void;
}

export function DashboardOverview({ studyRoleId, userId, onNavigate, onPractice }: DashboardOverviewProps) {
  const { data, isLoading } = useStudyStats(userId, studyRoleId);
  const studyRole = getStudyRole(studyRoleId);
  const roleSubjects = getSubjectsForRole(studyRoleId);
  const attempts = data?.attempts ?? [];
  const total = attempts.length;
  const correct = attempts.filter((attempt) => attempt.is_correct).length;
  const accuracy = total ? Math.round((correct / total) * 100) : 0;
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - 6);
  startOfWeek.setHours(0, 0, 0, 0);
  const recent = attempts.filter((attempt) => new Date(attempt.created_at) >= startOfWeek);
  const weekBuckets = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(startOfWeek);
    day.setDate(startOfWeek.getDate() + index);
    const dayAttempts = recent.filter((attempt) => new Date(attempt.created_at).toDateString() === day.toDateString());
    return { day, value: dayAttempts.length, correct: dayAttempts.filter((attempt) => attempt.is_correct).length };
  });
  const maxWeekValue = Math.max(3, ...weekBuckets.map((item) => item.value));
  const subjectStats = roleSubjects.map((subject) => {
    const subjectAttempts = attempts.filter((attempt) => attempt.question?.subject === subject.name);
    const subjectCorrect = subjectAttempts.filter((attempt) => attempt.is_correct).length;
    return {
      ...subject,
      profile: getRoleSubject(studyRoleId, subject.name),
      count: subjectAttempts.length,
      accuracy: subjectAttempts.length ? Math.round(subjectCorrect / subjectAttempts.length * 100) : 0,
    };
  }).sort((a, b) => a.count - b.count);
  const todayLabel = formatDate(today, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="animate-float-in space-y-6 md:space-y-7">
      <section className="relative isolate overflow-hidden rounded-[28px] border border-mint/15 bg-[#0d1d2c] px-5 py-6 md:px-8 md:py-8">
        <div className="absolute -right-12 -top-24 -z-10 h-72 w-72 rounded-full bg-cyan-400/[0.09] blur-xl md:blur-3xl" />
        <div className="absolute bottom-[-120px] right-[26%] -z-10 h-60 w-60 rounded-full bg-mint/[0.07] blur-xl md:blur-3xl" />
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-mint/20 bg-mint/[0.08] px-3 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-mint"><Sparkles className="h-3 w-3" /> {studyRole?.label} · {studyRole?.notice}</span>
          <span className="text-xs capitalize text-slate-500">{todayLabel}</span>
        </div>
        <div className="mt-5 grid items-end gap-7 lg:grid-cols-[1fr_auto]">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-slate-400">Seu próximo passo começa agora</p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">Constância hoje.<br className="hidden sm:block" /> Confiança no dia da prova.</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">Organize seus estudos, pratique com intenção e transforme cada erro em um ponto forte na preparação para a Polícia Civil do Pará.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="lg" onClick={() => onPractice()}><Target className="h-4 w-4" />Começar a estudar<ArrowRight className="h-4 w-4" /></Button>
              <Button size="lg" variant="secondary" onClick={() => onNavigate('simulados')}><Timer className="h-4 w-4" />Fazer um simulado</Button>
            </div>
          </div>
          <div className="hidden min-w-48 rounded-2xl border border-white/[0.08] bg-[#07131f]/55 p-4 lg:block">
            <div className="flex items-center justify-between text-xs text-slate-400"><span>Matérias oficiais</span><Layers3 className="h-4 w-4 text-cyan-300" /></div>
            <p className="mt-2 text-4xl font-semibold tracking-tight text-white">{roleSubjects.length}<span className="ml-1 text-lg font-medium text-slate-500">/ {roleSubjects.length}</span></p>
            <div className="mt-3 h-1.5 rounded-full bg-white/10"><div className="h-full w-full rounded-full bg-gradient-to-r from-mint to-cyan-300" /></div>
            <p className="mt-2 text-[11px] text-slate-500">Conteúdo alinhado ao edital</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4" aria-label="Resumo de desempenho">
        <StatCard title="Histórico de questões" value={isLoading ? '—' : total.toLocaleString('pt-BR')} detail={total ? `${recent.length} nos últimos 7 dias · IA não incluída` : 'Sem histórico anterior registrado'} icon={BookOpen} iconColor="text-cyan-300" iconBg="bg-cyan-400/10" trend={recent.length ? 'up' : undefined} />
        <StatCard title="Aproveitamento histórico" value={isLoading ? '—' : `${accuracy}%`} detail={total ? `${correct} acertos em ${total} tentativas antigas` : 'Sem tentativas históricas'} icon={Gauge} iconColor="text-mint" iconBg="bg-mint/10" progress={accuracy} />
        <StatCard title="Sequência atual" value={`${data?.currentStreak ?? 0} ${data?.currentStreak === 1 ? 'dia' : 'dias'}`} detail={`${data?.longestStreak ?? 0} dias é sua melhor sequência`} icon={Flame} iconColor="text-orange-300" iconBg="bg-orange-400/10" />
        <StatCard title="Erros históricos" value={`${data?.wrongAnswerCount ?? 0}`} detail="Registros antigos; enunciados ocultos" icon={NotebookTabs} iconColor="text-rose-300" iconBg="bg-rose-400/10" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3 p-5 pb-0 md:p-6 md:pb-0">
            <div><p className="text-sm font-semibold text-slate-100">Ritmo histórico</p><p className="mt-1 text-xs text-slate-500">Registros anteriores; sessões de IA não incluídas</p></div>
            <div className="flex items-center gap-2 rounded-full border border-line bg-white/[0.025] px-2.5 py-1 text-[10px] text-slate-400"><span className="h-2 w-2 rounded-full bg-mint" /> Acertos <span className="ml-1 h-2 w-2 rounded-full bg-slate-600" /> Total</div>
          </div>
          <CardContent className="pt-5 md:px-6">
            <div className="flex h-40 items-end gap-2 sm:gap-3">
              {weekBuckets.map((bucket) => {
                const height = bucket.value ? Math.max(12, bucket.value / maxWeekValue * 100) : 5;
                const correctHeight = bucket.value ? height * bucket.correct / bucket.value : 0;
                const isToday = bucket.day.toDateString() === today.toDateString();
                return <div key={bucket.day.toISOString()} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                  <span className="text-[10px] text-slate-600">{bucket.value || ''}</span>
                  <div className={cn('relative flex w-full max-w-12 items-end overflow-hidden rounded-t-lg bg-white/[0.045]', isToday ? 'ring-1 ring-mint/25' : '')} style={{ height: `${height}%`, minHeight: bucket.value ? 12 : 5 }}>
                    {bucket.value > 0 && <div className="absolute inset-x-0 bottom-0 bg-slate-600/80" style={{ height: '100%' }} />}
                    {bucket.value > 0 && <div className="absolute inset-x-0 bottom-0 rounded-t-md bg-gradient-to-t from-mint/75 to-mint" style={{ height: `${Math.max(5, correctHeight / height * 100)}%` }} />}
                  </div>
                  <span className={cn('text-[10px] capitalize', isToday ? 'font-semibold text-mint' : 'text-slate-500')}>{new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(bucket.day).replace('.', '')}</span>
                </div>;
              })}
            </div>
            {total === 0 && <p className="mt-3 border-t border-white/[0.05] pt-3 text-xs text-slate-500">Quando responder questões, seu ritmo aparecerá aqui.</p>}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between p-5 pb-3 md:px-6 md:pt-6">
            <div><p className="text-sm font-semibold text-slate-100">Plano rápido</p><p className="mt-1 text-xs text-slate-500">Um bloco de estudo já faz diferença</p></div>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-400/10 text-amber-200"><Goal className="h-4 w-4" /></span>
          </div>
          <div className="space-y-1 px-3 pb-3">
            <QuickAction icon={BookOpen} number="01" title="Praticar questões de IA" subtitle="Itens autorais por matéria" onClick={() => onPractice()} />
            <QuickAction icon={BrainCircuit} number="02" title="Revisar flashcards" subtitle="Fixe conceitos com repetição espaçada" onClick={() => onNavigate('flashcards')} />
            <QuickAction icon={NotebookTabs} number="03" title="Caderno de erros" subtitle="Histórico antigo preservado, sem enunciados" onClick={() => onNavigate('wrong')} />
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <Card>
          <div className="flex items-start justify-between gap-4 p-5 pb-4 md:px-6 md:pt-6">
            <div><p className="text-sm font-semibold text-slate-100">Matérias de {studyRole?.label}</p><p className="mt-1 text-xs text-slate-500">Prioridade relativa pelo edital · métricas refletem apenas o histórico anterior, não sessões de IA</p></div>
            <span className="hidden rounded-full border border-line px-2.5 py-1 text-[10px] text-slate-500 sm:inline-flex">{roleSubjects.length} matérias · {studyRole?.notice}</span>
          </div>
          <div className="grid gap-2 px-4 pb-4 sm:grid-cols-2 md:px-5 md:pb-5">
            {subjectStats.map((subject) => {
              const Icon = subject.icon;
              return <button key={subject.name} onClick={() => onPractice(subject.name)} className="group flex min-w-0 items-center gap-3 rounded-xl border border-white/[0.055] bg-white/[0.018] p-3 text-left transition-all hover:border-white/[0.12] hover:bg-white/[0.04]">
                <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', subject.bgColor, subject.color)}><Icon className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1"><span className="block text-xs font-medium leading-4 text-slate-200">{subject.name}</span><span className="mt-1 block text-[10px] text-slate-500">{subject.profile ? `Prioridade ${getPriorityLabel(subject.profile.relative_priority)} · ${subject.profile.question_count} questões / ${subject.profile.points} pts · ` : ''}{subject.count ? `${subject.count} tentativas · ${subject.accuracy}% de acerto` : 'Comece a praticar'}</span></span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-300" />
              </button>;
            })}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5 md:p-6">
            <div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-slate-100">XP do histórico anterior</p><p className="mt-1 text-xs text-slate-500">Itens de IA não alteram esta métrica</p></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-400/10 text-violet-300"><Zap className="h-4 w-4" /></span></div>
            <div className="mt-5 flex items-end justify-between"><p className="text-3xl font-semibold text-white">{correct * 10 + Math.max(0, total - correct) * 3}<span className="ml-1 text-xs font-medium text-slate-500">XP</span></p><span className="text-[10px] text-slate-500">Próximo marco: 250 XP</span></div>
            <Progress value={(correct * 10 + Math.max(0, total - correct) * 3) % 250 / 2.5} className="mt-3" />
          </Card>
          <Card className="p-5 md:p-6">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-400/10 text-amber-200"><Trophy className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-100">Conquistas</p><p className="mt-1 text-xs text-slate-500">O progresso também merece ser celebrado.</p></div>
              <button onClick={() => onNavigate('stats')} className="text-xs font-medium text-mint hover:text-white">Ver todas</button>
            </div>
            <div className="mt-4 flex gap-2">
              <Achievement icon={Target} label="Primeiro passo" unlocked={total > 0} />
              <Achievement icon={Award} label="10 acertos" unlocked={correct >= 10} />
              <Achievement icon={Flame} label="7 dias" unlocked={(data?.currentStreak ?? 0) >= 7} />
            </div>
          </Card>
        </div>
      </section>

      {!isSupabaseConfigured && <div className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.018] px-4 py-3"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-cyan-400/10 text-cyan-300"><Sparkles className="h-4 w-4" /></div><p className="text-xs leading-5 text-slate-400">Versão de demonstração: o progresso fica salvo neste dispositivo. A geração de itens de IA, o Tutor e a sincronização dependem da conexão com o Supabase.</p></div>}
    </div>
  );
}

function StatCard({ title, value, detail, icon: Icon, iconColor, iconBg, progress, trend, action }: {
  title: string; value: string; detail: string; icon: typeof BookOpen; iconColor: string; iconBg: string; progress?: number; trend?: 'up'; action?: () => void;
}) {
  return <Card className="relative min-w-0 p-4 transition-colors hover:border-white/[0.12] md:p-5">
    <div className="flex items-start justify-between gap-2"><p className="min-h-8 text-[11px] font-medium leading-4 text-slate-500">{title}</p><span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-xl', iconBg, iconColor)}><Icon className="h-4 w-4" /></span></div>
    <div className="mt-2 flex items-center gap-2"><p className="text-2xl font-semibold tracking-tight text-white sm:text-[27px]">{value}</p>{trend && <ArrowUpRight className="h-4 w-4 text-mint" />}{progress !== undefined && progress >= 80 && <ArrowUpRight className="h-4 w-4 text-mint" />}</div>
    <p className="mt-1 truncate text-[10px] text-slate-500">{detail}</p>
    {progress !== undefined && <Progress value={progress} className="mt-3 h-1" />}
    {action && <button className="absolute inset-0 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-mint" onClick={action} aria-label={`Abrir ${title}`} />}
  </Card>;
}

function QuickAction({ icon: Icon, number, title, subtitle, onClick }: { icon: typeof BookOpen; number: string; title: string; subtitle: string; onClick: () => void }) {
  return <button onClick={onClick} className="group flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-white/[0.035]">
    <span className="w-6 text-[10px] font-semibold text-slate-600">{number}</span><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.035] text-slate-300 transition group-hover:border-mint/20 group-hover:text-mint"><Icon className="h-4 w-4" /></span>
    <span className="min-w-0 flex-1"><span className="block text-xs font-medium text-slate-200">{title}</span><span className="mt-0.5 block truncate text-[10px] text-slate-500">{subtitle}</span></span><ChevronRight className="h-4 w-4 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-mint" />
  </button>;
}

function Achievement({ icon: Icon, label, unlocked }: { icon: typeof Target; label: string; unlocked: boolean }) {
  return <div title={unlocked ? `${label} desbloqueada` : `${label} — em progresso`} className={cn('flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-xl border px-2 py-2 text-center', unlocked ? 'border-amber-300/20 bg-amber-300/[0.06] text-amber-200' : 'border-white/[0.05] bg-white/[0.015] text-slate-600')}><span className="grid h-7 w-7 place-items-center rounded-lg bg-white/[0.04]"><Icon className="h-3.5 w-3.5" /></span><span className="truncate text-[9px] font-medium">{label}</span><span>{unlocked ? <Check className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}</span></div>;
}
