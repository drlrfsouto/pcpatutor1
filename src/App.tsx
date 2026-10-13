import { lazy, Suspense, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  Activity,
  ChevronDown,
  CircleUserRound,
  Cloud,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { AccessPending } from '@/components/auth/AccessPending';
import { AuthDialog } from '@/components/auth/AuthDialog';
import { Sidebar, type AppView } from '@/components/layout/Sidebar';

const DashboardOverview = lazy(() => import('@/components/dashboard/DashboardOverview').then((module) => ({ default: module.DashboardOverview })));
const QuestionPractice = lazy(() => import('@/components/study/QuestionPractice').then((module) => ({ default: module.QuestionPractice })));
const SimuladoSession = lazy(() => import('@/components/study/SimuladoSession').then((module) => ({ default: module.SimuladoSession })));
const FlashcardSession = lazy(() => import('@/components/study/FlashcardSession').then((module) => ({ default: module.FlashcardSession })));
const WrongAnswersNotebook = lazy(() => import('@/components/study/WrongAnswersNotebook').then((module) => ({ default: module.WrongAnswersNotebook })));
const TutorChat = lazy(() => import('@/components/chat/TutorChat').then((module) => ({ default: module.TutorChat })));
const StatsView = lazy(() => import('@/components/stats/StatsView').then((module) => ({ default: module.StatsView })));
import { Button } from '@/components/ui/button';
import { isSupabaseConfigured, supabase } from '@/integrations/supabase/client';
import type { PcpaQuestion } from '@/integrations/supabase/types';
import { useStudyStats } from '@/hooks/useStudyStats';
import { isOfficialSubject, type SubjectName } from '@/lib/constants/subjects';

type AccessStatus = 'signed-out' | 'checking' | 'pending' | 'approved' | 'error';

const VIEW_TITLES: Record<AppView, string> = {
  overview: 'Visão geral',
  practice: 'Questões',
  simulados: 'Simulados',
  flashcards: 'Flashcards',
  wrong: 'Caderno de erros',
  tutor: 'Tutor IA',
  stats: 'Estatísticas',
};

function PageLoading() {
  return <div className="grid min-h-72 place-items-center"><div className="flex items-center gap-3 text-sm text-slate-400"><span className="h-4 w-4 animate-spin rounded-full border-2 border-mint/20 border-t-mint" />Preparando sua área de estudo…</div></div>;
}

function App() {
  const [activeView, setActiveView] = useState<AppView>('overview');
  const [session, setSession] = useState<Session | null>(null);
  const [accessStatus, setAccessStatus] = useState<AccessStatus>('signed-out');
  const [authOpen, setAuthOpen] = useState(false);
  const [questionContext, setQuestionContext] = useState<PcpaQuestion | null>(null);
  const [practiceSubject, setPracticeSubject] = useState<SubjectName | undefined>();
  const [signingOut, setSigningOut] = useState(false);
  const { data: stats } = useStudyStats(accessStatus === 'approved' ? session?.user.id : undefined);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => { if (mounted) setSession(data.session); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) setAuthOpen(false);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    const userId = session?.user.id;
    if (!isSupabaseConfigured || !userId) {
      setAccessStatus('signed-out');
      return;
    }

    let current = true;
    setAccessStatus('checking');
    void (async () => {
      const { data, error } = await supabase
        .from('pcpa_access_requests')
        .select('approved_at')
        .eq('user_id', userId)
        .maybeSingle();
      if (!current) return;
      if (error) throw error;
      setAccessStatus(data?.approved_at ? 'approved' : 'pending');
    })().catch(() => {
      if (current) setAccessStatus('error');
    });

    return () => { current = false; };
  }, [session?.user.id]);

  function navigate(view: AppView) {
    if (view === 'practice') setPracticeSubject(undefined);
    setActiveView(view);
  }

  function openPractice(subject?: string) {
    setPracticeSubject(subject && isOfficialSubject(subject) ? subject : undefined);
    setActiveView('practice');
  }

  function askTutor(question: PcpaQuestion) {
    setQuestionContext(question);
    setActiveView('tutor');
  }

  async function signOut() {
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) toast.error('Não foi possível sair', { description: 'Tente novamente em instantes.' });
      else toast.success('Sessão encerrada');
    } catch {
      toast.error('Não foi possível sair', { description: 'Tente novamente em instantes.' });
    } finally {
      setSigningOut(false);
    }
  }

  async function refreshAccessStatus() {
    const userId = session?.user.id;
    if (!userId) return;
    setAccessStatus('checking');
    try {
      const { data, error } = await supabase
        .from('pcpa_access_requests')
        .select('approved_at')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      if (data?.approved_at) {
        setAccessStatus('approved');
        toast.success('Acesso liberado', { description: 'Sua conta já pode sincronizar seu progresso.' });
      } else {
        setAccessStatus('pending');
        toast.message('A aprovação ainda está pendente');
      }
    } catch {
      setAccessStatus('error');
      toast.error('Não foi possível verificar sua aprovação', { description: 'Tente novamente em instantes.' });
    }
  }

  const hasUnapprovedSession = Boolean(session?.user) && accessStatus !== 'approved';
  const showSidebar = !hasUnapprovedSession;
  const pageTitle = hasUnapprovedSession ? 'Acesso' : VIEW_TITLES[activeView];
  const accessBadge = !isSupabaseConfigured
    ? 'Modo demonstração'
    : !session?.user || accessStatus === 'approved'
      ? 'Sincronização pronta'
      : accessStatus === 'pending'
        ? 'Aguardando aprovação'
        : accessStatus === 'checking'
          ? 'Verificando acesso'
          : 'Acesso não verificado';
  const accessBadgeReady = isSupabaseConfigured && (!session?.user || accessStatus === 'approved');

  return (
    <div className="app-background relative min-h-screen overflow-x-clip">
      <div className="soft-grid absolute inset-0" />
      <div className="relative z-10 min-h-screen">
        {showSidebar && <Sidebar active={activeView} onNavigate={navigate} streak={stats?.currentStreak ?? 0} />}
        <div className={`min-h-screen ${showSidebar ? 'md:pl-[254px]' : ''}`}>
          <header className="sticky top-0 z-20 hidden h-[68px] items-center justify-between border-b border-white/[0.055] bg-[#081321]/80 px-6 backdrop-blur-xl md:flex lg:px-8">
            <div className="flex items-center gap-3"><div className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.06] bg-white/[0.025] text-slate-400"><Activity className="h-4 w-4" /></div><div><p className="text-xs font-semibold text-slate-200">{pageTitle}</p><p className="mt-0.5 text-[10px] text-slate-600">Sua preparação para a Polícia Civil do Pará</p></div></div>
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] ${accessBadgeReady ? 'border-mint/10 bg-mint/[0.035] text-mint' : 'border-amber-200/10 bg-amber-200/[0.03] text-amber-100/75'}`}><span className={`h-1.5 w-1.5 rounded-full ${accessBadgeReady ? 'bg-mint' : 'bg-amber-200'}`} />{accessBadge}</div>
              <div className="h-5 w-px bg-white/[0.08]" />
              {session?.user ? <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-xl bg-cyan-300/10 text-cyan-200"><CircleUserRound className="h-4 w-4" /></span><div className="hidden max-w-36 sm:block"><p className="truncate text-[11px] font-medium text-slate-200">{session.user.email ?? 'Estudante'}</p><p className="text-[9px] text-slate-500">{accessStatus === 'approved' ? 'Progresso sincronizado' : accessStatus === 'pending' ? 'Aguardando aprovação' : accessStatus === 'checking' ? 'Verificando liberação' : 'Acesso em verificação'}</p></div><button onClick={() => void signOut()} disabled={signingOut} className="ml-1 grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-white/5 hover:text-white" title="Sair"><LogOut className="h-3.5 w-3.5" /></button></div> : isSupabaseConfigured && <Button variant="secondary" size="sm" onClick={() => setAuthOpen(true)}><CircleUserRound className="h-3.5 w-3.5" />Entrar</Button>}
            </div>
          </header>
          <main className="mx-auto max-w-[1500px] px-4 pb-10 pt-5 sm:px-6 md:px-7 md:pt-7 lg:px-9">
            <div className="mb-5 flex items-center justify-between md:hidden"><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500">{pageTitle}</p><p className="mt-1 text-[10px] text-slate-600">Sua preparação para a PCPA</p></div>{isSupabaseConfigured && <MobileUserControl session={session} onSignIn={() => setAuthOpen(true)} onSignOut={() => void signOut()} />}</div>
            {hasUnapprovedSession ? (
              <AccessPending
                state={accessStatus === 'pending' ? 'pending' : accessStatus === 'error' ? 'error' : 'checking'}
                email={session?.user.email ?? undefined}
                onRefresh={refreshAccessStatus}
                onSignOut={signOut}
              />
            ) : (
              <>
                {!isSupabaseConfigured && activeView !== 'overview' && <div className="mb-5 flex items-center gap-2 rounded-xl border border-amber-300/10 bg-amber-300/[0.025] px-3 py-2.5 text-[10px] leading-4 text-amber-100/70"><Cloud className="h-3.5 w-3.5 shrink-0 text-amber-200" />Modo demonstração: seu progresso fica salvo neste dispositivo. A busca de novas questões e a sincronização entre aparelhos podem estar limitadas.</div>}
                <Suspense fallback={<PageLoading />}>
                  {activeView === 'overview' && <DashboardOverview userId={session?.user.id} onNavigate={navigate} onPractice={openPractice} />}
                  {activeView === 'practice' && <QuestionPractice key={practiceSubject ?? 'all'} initialSubject={practiceSubject} userId={session?.user.id} onAskTutor={askTutor} />}
                  {activeView === 'simulados' && <SimuladoSession userId={session?.user.id} />}
                  {activeView === 'flashcards' && <FlashcardSession userId={session?.user.id} />}
                  {activeView === 'wrong' && <WrongAnswersNotebook userId={session?.user.id} onPractice={openPractice} />}
                  {activeView === 'tutor' && <TutorChat questionContext={questionContext} userId={session?.user.id} onClearContext={() => setQuestionContext(null)} />}
                  {activeView === 'stats' && <StatsView userId={session?.user.id} onNavigate={navigate} />}
                </Suspense>
                <footer className="mt-9 flex items-center gap-1.5 border-t border-white/[0.05] pt-4 text-[9px] text-slate-600"><ShieldCheck className="h-3 w-3 shrink-0 text-mint/50" />Tutor PCPA · Material de apoio para estudos. Consulte o edital e as fontes oficiais.</footer>
              </>
            )}
          </main>
        </div>
      </div>
      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}

function MobileUserControl({ session, onSignIn, onSignOut }: { session: Session | null; onSignIn: () => void; onSignOut: () => void }) {
  return session?.user ? <button onClick={onSignOut} title="Sair da conta" className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-white/[0.025] text-cyan-200"><LogOut className="h-3.5 w-3.5" /></button> : <button onClick={onSignIn} className="flex items-center gap-1 rounded-lg border border-line bg-white/[0.025] px-2.5 py-2 text-[10px] text-slate-300"><CircleUserRound className="h-3.5 w-3.5" />Entrar<ChevronDown className="h-3 w-3 text-slate-500" /></button>;
}

export default App;
