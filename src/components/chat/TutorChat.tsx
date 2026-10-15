import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  Bot,
  BookOpen,
  CircleHelp,
  LoaderCircle,
  MessagesSquare,
  Plus,
  Send,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { SubjectBadge } from '@/components/ui/SubjectBadge';
import { isSupabaseConfigured } from '@/integrations/supabase/client';
import type { PcpaQuestion } from '@/integrations/supabase/types';
import { streamTutorReply, type TutorMessage } from '@/lib/tutor-stream';
import { getStudyRole, type StudyRoleId } from '@/lib/constants/subjects';
import { toast } from 'sonner';

interface TutorChatProps {
  studyRoleId: StudyRoleId;
  questionContext: PcpaQuestion | null;
  userId?: string;
  onClearContext: () => void;
}

const SUGGESTIONS = [
  'Explique a diferença entre dolo eventual e culpa consciente.',
  'Como montar uma rotina de revisão para esta semana?',
  'Quais são as pegadinhas mais comuns em interpretação de texto?',
];

export function TutorChat({ studyRoleId, questionContext, userId, onClearContext }: TutorChatProps) {
  const studyRole = getStudyRole(studyRoleId);
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showScrollButton, setShowScrollButton] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isStreaming]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  async function sendMessage(text = draft) {
    const content = text.trim();
    if (!content || isStreaming) return;
    if (!isSupabaseConfigured) {
      toast.error('O Tutor está temporariamente indisponível', { description: 'Você pode continuar estudando pelas questões e flashcards.' });
      return;
    }
    if (!userId) {
      toast.error('Entre na sua conta para conversar com o Tutor', { description: 'Assim, você poderá guardar seu histórico de estudos.' });
      return;
    }
    const userMessage: TutorMessage = { role: 'user', content };
    const assistantIndex = messages.length + 1;
    const nextMessages: TutorMessage[] = [...messages, userMessage, { role: 'assistant', content: '' }];
    setMessages(nextMessages);
    setDraft('');
    setErrorMessage('');
    setIsStreaming(true);
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      await streamTutorReply([...messages, userMessage], questionContext, studyRoleId, (chunk) => {
        setMessages((current) => current.map((message, index) => index === assistantIndex ? { ...message, content: message.content + chunk } : message));
      }, controller.signal);
    } catch {
      setErrorMessage('Não foi possível concluir a resposta. Tente novamente em instantes.');
      setMessages((current) => current.map((item, index) => index === assistantIndex && !item.content ? { ...item, content: 'Não consegui concluir a resposta desta vez. Tente novamente em instantes.' } : item));
    } finally {
      setIsStreaming(false);
      controllerRef.current = null;
      inputRef.current?.focus();
    }
  }

  function startNewChat() {
    controllerRef.current?.abort();
    setMessages([]);
    setDraft('');
    setErrorMessage('');
    setIsStreaming(false);
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="animate-float-in mx-auto flex min-h-[calc(100svh-190px)] max-w-6xl flex-col md:min-h-[calc(100vh-170px)]">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-violet-300"><Sparkles className="h-3.5 w-3.5" /> Tutor de estudos</div><h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Tutor IA PCPA</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Tire dúvidas sobre os temas da trilha {studyRole?.label} · {studyRole?.notice}.</p></div>
        <Button variant="secondary" size="sm" onClick={startNewChat}><Plus className="h-3.5 w-3.5" />Nova conversa</Button>
      </div>

      <div className="mb-4"><Badge variant="secondary" className="gap-1.5"><MessagesSquare className="h-3 w-3 text-violet-300" />Resposta em streaming</Badge></div>

      {questionContext && <Card className="mb-4 flex items-start gap-3 border-cyan-300/15 bg-cyan-300/[0.035] p-4"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-cyan-300/10 text-cyan-200"><BookOpen className="h-4 w-4" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><SubjectBadge subject={questionContext.subject} /><span className="text-[10px] text-slate-500">Contexto anexado à conversa</span></div><p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-300">{questionContext.prompt}</p></div><button onClick={onClearContext} title="Remover contexto" className="rounded-lg p-1.5 text-slate-500 hover:bg-white/5 hover:text-white"><X className="h-4 w-4" /></button></Card>}

      {isSupabaseConfigured && !userId && <Alert className="mb-4 border-cyan-300/15 bg-cyan-300/[0.035]"><AlertTriangle className="h-4 w-4 text-cyan-200" /><AlertDescription className="text-xs leading-5 text-slate-300">Entre na sua conta para usar o Tutor.</AlertDescription></Alert>}
      {errorMessage && <Alert className="mb-4 border-rose-300/20 bg-rose-300/[0.045]"><AlertTriangle className="h-4 w-4 text-rose-300" /><AlertDescription className="text-xs text-rose-100/80">{errorMessage}</AlertDescription></Alert>}

      <Card className="flex min-h-[380px] flex-1 flex-col overflow-hidden sm:min-h-[450px]">
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3.5 md:px-5">
          <div className="relative grid h-9 w-9 place-items-center rounded-xl border border-violet-300/15 bg-violet-300/[0.08] text-violet-200"><Bot className="h-4 w-4" /><span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0c1928] bg-mint" /></div>
          <div className="flex-1"><p className="text-xs font-semibold text-slate-100">Assistente de preparação</p><p className="mt-0.5 text-[10px] text-slate-500">Português brasileiro · respostas didáticas</p></div>
          <span className="flex items-center gap-1.5 text-[10px] text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-mint" />{isStreaming ? 'respondendo' : 'pronto'}</span>
        </div>

        <div ref={listRef} onScroll={(event) => { const el = event.currentTarget; setShowScrollButton(el.scrollHeight - el.scrollTop - el.clientHeight > 100); }} className="custom-scrollbar relative flex-1 space-y-5 overflow-y-auto px-4 py-5 md:px-6">
          {isEmpty ? <div className="mx-auto flex min-h-[280px] max-w-2xl flex-col items-center justify-center text-center sm:min-h-[350px]">
            <div className="relative grid h-16 w-16 place-items-center rounded-[22px] border border-violet-300/15 bg-violet-300/[0.06] text-violet-200"><Sparkles className="h-7 w-7" /><span className="absolute -right-2 -top-1 grid h-6 w-6 place-items-center rounded-lg border border-amber-200/15 bg-amber-200/[0.08] text-amber-200"><CircleHelp className="h-3.5 w-3.5" /></span></div>
            <p className="mt-5 text-lg font-semibold text-white">Olá! Vamos estudar juntos.</p><p className="mt-2 max-w-lg text-sm leading-6 text-slate-400">Peça uma explicação passo a passo ou revise um conceito do edital.</p>
            <div className="mt-6 grid w-full gap-2 sm:grid-cols-3">{SUGGESTIONS.map((suggestion, index) => <button key={suggestion} onClick={() => sendMessage(suggestion)} disabled={!isSupabaseConfigured || !userId} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-left text-[11px] leading-5 text-slate-400 transition hover:border-violet-300/20 hover:bg-violet-300/[0.04] hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"><span className="mb-2 block text-[9px] font-bold uppercase tracking-[.13em] text-violet-200/70">Sugestão 0{index + 1}</span>{suggestion}</button>)}</div>
          </div> : messages.map((message, index) => <MessageBubble key={`${index}-${message.role}`} message={message} isStreaming={isStreaming && index === messages.length - 1} />)}
          {isStreaming && messages[messages.length - 1]?.content === '' && <div className="flex items-center gap-2 pl-11 text-xs text-slate-500"><LoaderCircle className="h-3.5 w-3.5 animate-spin text-violet-300" />Organizando uma resposta…</div>}
          {showScrollButton && <button onClick={() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })} className="sticky bottom-1 left-1/2 mx-auto grid h-8 w-8 place-items-center rounded-full border border-line bg-[#122133] text-slate-300 shadow-lg"><ArrowDown className="h-4 w-4" /></button>}
        </div>

        <form onSubmit={(event) => { event.preventDefault(); void sendMessage(); }} className="border-t border-white/[0.06] bg-[#091522]/65 p-3 md:p-4">
          <div className="flex items-end gap-2 rounded-2xl border border-white/[0.07] bg-[#07111f]/75 p-2 focus-within:border-violet-300/25 focus-within:ring-2 focus-within:ring-violet-300/[0.06]">
            <Textarea ref={inputRef} rows={1} maxLength={3000} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder={!isSupabaseConfigured ? 'Tutor temporariamente indisponível' : !userId ? 'Entre na sua conta para conversar com o Tutor' : 'Escreva sua dúvida… (Enter para enviar)'} disabled={!isSupabaseConfigured || !userId || isStreaming} className="min-h-11 max-h-36 resize-y border-0 bg-transparent px-2 py-2 text-sm shadow-none focus:border-0 focus:ring-0" />
            <Button type="submit" size="icon" disabled={!draft.trim() || isStreaming || !isSupabaseConfigured || !userId} className="h-10 w-10 shrink-0 rounded-xl" aria-label="Enviar mensagem">{isStreaming ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 px-1"><p className="text-[9px] leading-4 text-slate-600">A IA pode cometer erros. Confirme leis e dispositivos em fonte oficial.</p><span className="shrink-0 text-[9px] tabular-nums text-slate-600">{draft.length}/3000</span></div>
        </form>
      </Card>
    </div>
  );
}

function MessageBubble({ message, isStreaming }: { message: TutorMessage; isStreaming: boolean }) {
  const isAssistant = message.role === 'assistant';
  return <div className={`flex items-start gap-3 ${isAssistant ? '' : 'flex-row-reverse'}`}>
    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${isAssistant ? 'border border-violet-300/15 bg-violet-300/[0.07] text-violet-200' : 'bg-mint/10 text-mint'}`}>{isAssistant ? <Bot className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}</span>
    <div className={`max-w-[88%] rounded-2xl px-4 py-3 md:max-w-[78%] ${isAssistant ? 'rounded-tl-md border border-white/[0.06] bg-white/[0.025]' : 'rounded-tr-md border border-mint/10 bg-mint/[0.07]'}`}>
      <p className="mb-1 text-[9px] font-bold uppercase tracking-[.14em] text-slate-500">{isAssistant ? 'Tutor PCPA' : 'Você'}</p>
      {message.content ? <p className="whitespace-pre-wrap text-sm leading-6 text-slate-200">{message.content}{isStreaming && <span className="ml-1 inline-block h-4 w-1 animate-pulse rounded-full bg-violet-300 align-middle" />}</p> : <LoaderCircle className="h-4 w-4 animate-spin text-violet-200" />}
    </div>
  </div>;
}
