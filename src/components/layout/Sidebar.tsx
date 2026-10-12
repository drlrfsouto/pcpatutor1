import {
  BarChart3,
  BookOpenCheck,
  BrainCircuit,
  ClipboardList,
  FileQuestion,
  Flame,
  Home,
  MessagesSquare,
  NotebookTabs,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type AppView = 'overview' | 'practice' | 'simulados' | 'flashcards' | 'wrong' | 'tutor' | 'stats';

const NAV_ITEMS: { id: AppView; label: string; icon: typeof Home; badge?: string }[] = [
  { id: 'overview', label: 'Visão geral', icon: Home },
  { id: 'practice', label: 'Questões', icon: FileQuestion },
  { id: 'simulados', label: 'Simulados', icon: ClipboardList },
  { id: 'flashcards', label: 'Flashcards', icon: BrainCircuit },
  { id: 'wrong', label: 'Caderno de erros', icon: NotebookTabs },
  { id: 'tutor', label: 'Tutor IA', icon: MessagesSquare },
  { id: 'stats', label: 'Estatísticas', icon: BarChart3 },
];

interface SidebarProps {
  active: AppView;
  onNavigate: (view: AppView) => void;
  streak?: number;
}

export function Sidebar({ active, onNavigate, streak = 0 }: SidebarProps) {
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[254px] flex-col border-r border-white/[0.07] bg-[#081321]/90 px-4 py-5 backdrop-blur-xl md:flex">
        <div className="flex items-center gap-3 px-2">
          <div className="relative grid h-11 w-11 place-items-center rounded-2xl border border-mint/20 bg-mint/10 text-mint shadow-glow">
            <BookOpenCheck className="h-5 w-5" />
            <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-[#081321] bg-mint" />
          </div>
          <div>
            <p className="text-[15px] font-bold tracking-tight text-white">TUTOR <span className="text-mint">PCPA</span></p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[.2em] text-slate-500">sua rotina de aprovação</p>
          </div>
        </div>

        <div className="mt-9 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-slate-600">Estudar</div>
        <nav aria-label="Navegação principal" className="mt-3 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const selected = active === item.id;
            return (
              <button key={item.id} onClick={() => onNavigate(item.id)} className={cn(
                'group flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[13px] font-medium transition-all',
                selected ? 'border border-mint/10 bg-mint/[0.09] text-mint' : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100',
              )} aria-current={selected ? 'page' : undefined}>
                <Icon className={cn('h-[17px] w-[17px]', selected ? 'text-mint' : 'text-slate-500 group-hover:text-slate-300')} />
                <span className="flex-1">{item.label}</span>
                {item.id === 'tutor' && <Sparkles className="h-3.5 w-3.5 text-amber-300/80" />}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto rounded-2xl border border-white/[0.07] bg-gradient-to-br from-[#102434] to-[#0d1826] p-4">
          <div className="flex items-center justify-between">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-orange-400/10 text-orange-300"><Flame className="h-4 w-4" /></span>
            <span className="text-xs font-semibold text-orange-200">{streak} {streak === 1 ? 'dia' : 'dias'}</span>
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-100">Uma revisão por dia.</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Pequenos blocos de estudo mantêm sua sequência viva.</p>
        </div>
        <p className="mt-4 px-2 text-[10px] text-slate-600">PCPA · Pará · Área do candidato</p>
      </aside>

      <div className="mobile-nav-shell sticky top-0 z-30 border-b border-white/[0.07] bg-[#081321]/95 px-4 py-3 backdrop-blur-md md:hidden">
        <div className="mb-3 flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-mint/10 text-mint"><BookOpenCheck className="h-4 w-4" /></div>
          <div className="text-sm font-bold text-white">TUTOR <span className="text-mint">PCPA</span></div>
        </div>
        <nav aria-label="Navegação móvel" className="custom-scrollbar flex gap-1 overflow-x-auto pb-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const selected = active === item.id;
            return <button key={item.id} onClick={() => onNavigate(item.id)} className={cn('flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium', selected ? 'bg-mint/10 text-mint' : 'text-slate-400 hover:bg-white/5')} aria-current={selected ? 'page' : undefined}><Icon className="h-3.5 w-3.5" />{item.label}</button>;
          })}
        </nav>
      </div>
    </>
  );
}
