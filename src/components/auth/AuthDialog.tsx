import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, LoaderCircle, Mail, ShieldCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isSupabaseConfigured, supabase } from '@/integrations/supabase/client';

interface AuthDialogProps {
  open: boolean;
  onClose: () => void;
}

type AuthStep = 'email' | 'code';
const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

export function AuthDialog({ open, onClose }: AuthDialogProps) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<AuthStep>('email');
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setEmail('');
      setCode('');
      setStep('email');
      setBusy(false);
      setResendIn(0);
    }
  }, [open]);

  useEffect(() => {
    if (open && step === 'code') codeInputRef.current?.focus();
  }, [open, step]);

  useEffect(() => {
    if (!open || step !== 'code' || resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [open, step, resendIn]);

  if (!open) return null;

  async function requestCode() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    if (!isSupabaseConfigured) {
      toast.error('O acesso por e-mail ainda não está disponível', {
        description: 'Você pode continuar estudando nesta versão de demonstração.',
      });
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: { shouldCreateUser: true },
      });
      if (error) throw error;

      setEmail(normalizedEmail);
      setCode('');
      setStep('code');
      setResendIn(RESEND_COOLDOWN_SECONDS);
      toast.success('Código enviado', { description: 'Confira sua caixa de entrada e a pasta de spam.' });
    } catch {
      toast.error('Não foi possível enviar o código', {
        description: 'Confira o endereço de e-mail e tente novamente em instantes.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleEmailSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await requestCode();
  }

  async function handleCodeSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (code.length !== CODE_LENGTH || busy) return;

    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code,
        type: 'email',
      });
      if (error) throw error;

      toast.success('E-mail confirmado', { description: 'Vamos verificar a liberação do seu acesso.' });
      onClose();
    } catch {
      toast.error('Não foi possível confirmar o código', {
        description: 'Confira os seis dígitos ou solicite um novo código.',
      });
    } finally {
      setBusy(false);
    }
  }

  function changeEmail() {
    setCode('');
    setStep('email');
    setResendIn(0);
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/65 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="auth-title" className="animate-float-in max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-3xl border border-line bg-[#0c1928] p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-mint/10 text-mint">{step === 'code' ? <ShieldCheck className="h-5 w-5" /> : <Mail className="h-5 w-5" />}</div>
          <button className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-white" onClick={onClose} aria-label="Fechar"><X className="h-4 w-4" /></button>
        </div>

        {step === 'code' ? (
          <div className="pt-5">
            <div className="flex items-center gap-2 text-mint"><CheckCircle2 className="h-5 w-5" /><h2 id="auth-title" className="text-lg font-semibold">Confirme seu e-mail</h2></div>
            <p className="mt-3 text-sm leading-6 text-slate-400">Enviamos um código de {CODE_LENGTH} dígitos para <span className="font-medium text-slate-200">{email}</span>. Digite-o abaixo para entrar.</p>
            <form className="mt-6 space-y-4" onSubmit={handleCodeSubmit}>
              <label className="block text-xs font-semibold text-slate-300" htmlFor="auth-code">Código de confirmação</label>
              <Input
                ref={codeInputRef}
                id="auth-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={CODE_LENGTH}
                required
                aria-describedby="auth-code-help"
                placeholder="000000"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
                disabled={busy}
                className="h-14 text-center font-mono text-2xl tracking-[0.65em] tabular-nums"
              />
              <p id="auth-code-help" className="-mt-2 text-xs leading-5 text-slate-500">O código pode levar alguns instantes. Confira também a pasta de spam.</p>
              <Button className="w-full" type="submit" disabled={busy || code.length !== CODE_LENGTH}>
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {busy ? 'Confirmando…' : 'Confirmar e entrar'}
              </Button>
            </form>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs">
              {resendIn > 0 ? <span className="text-slate-500">Reenviar código em {resendIn}s</span> : <button type="button" onClick={() => void requestCode()} disabled={busy} className="font-medium text-mint hover:text-white disabled:opacity-50">Reenviar código</button>}
              <button type="button" onClick={changeEmail} disabled={busy} className="inline-flex items-center gap-1 text-slate-400 hover:text-white disabled:opacity-50"><ArrowLeft className="h-3.5 w-3.5" />Alterar e-mail</button>
            </div>
          </div>
        ) : (
          <>
            <h2 id="auth-title" className="mt-5 text-xl font-semibold text-white">Acesse sua conta</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Informe seu e-mail. Vamos enviar um código de confirmação para liberar sua sessão e sincronizar seu progresso.</p>
            <form className="mt-6 space-y-4" onSubmit={handleEmailSubmit}>
              <label className="block text-xs font-semibold text-slate-300" htmlFor="auth-email">E-mail</label>
              <Input id="auth-email" type="email" required autoComplete="email" placeholder="voce@exemplo.com" value={email} onChange={(event) => setEmail(event.target.value)} disabled={!isSupabaseConfigured || busy} />
              <Button className="w-full" type="submit" disabled={busy || !isSupabaseConfigured}>
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {busy ? 'Enviando código…' : isSupabaseConfigured ? 'Enviar código de acesso' : 'Acesso indisponível nesta versão'}
              </Button>
            </form>
            {!isSupabaseConfigured && <p className="mt-4 rounded-xl border border-amber-400/15 bg-amber-400/[0.06] p-3 text-xs leading-5 text-amber-200/80">O acesso por e-mail e a sincronização ainda não estão disponíveis nesta versão. Seu progresso continua salvo neste dispositivo.</p>}
          </>
        )}
      </section>
    </div>
  );
}
