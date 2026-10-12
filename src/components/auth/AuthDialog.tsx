import { useEffect, useState } from 'react';
import { CheckCircle2, LoaderCircle, Mail, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isSupabaseConfigured, supabase } from '@/integrations/supabase/client';

interface AuthDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AuthDialog({ open, onClose }: AuthDialogProps) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  useEffect(() => {
    if (!open) { setSent(false); setBusy(false); }
  }, [open]);
  if (!open) return null;

  async function sendLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isSupabaseConfigured) {
      toast.error('O acesso por e-mail ainda não está disponível', { description: 'Você pode continuar estudando nesta versão de demonstração.' });
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: window.location.origin } });
    setBusy(false);
    if (error) {
      toast.error('Não foi possível enviar o link', { description: 'Confira o endereço de e-mail e tente novamente em instantes.' });
      return;
    }
    setSent(true);
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/65 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="auth-title" className="animate-float-in max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-3xl border border-line bg-[#0c1928] p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-mint/10 text-mint"><Mail className="h-5 w-5" /></div>
          <button className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-white" onClick={onClose} aria-label="Fechar"><X className="h-4 w-4" /></button>
        </div>
        {sent ? (
          <div className="pt-5">
            <div className="flex items-center gap-2 text-mint"><CheckCircle2 className="h-5 w-5" /><h2 id="auth-title" className="text-lg font-semibold">Confira seu e-mail</h2></div>
            <p className="mt-3 text-sm leading-6 text-slate-400">Enviamos um link de acesso para <span className="font-medium text-slate-200">{email}</span>. Abra-o neste navegador para sincronizar seu progresso.</p>
            <Button variant="secondary" className="mt-6 w-full" onClick={onClose}>Concluir</Button>
          </div>
        ) : (
          <>
            <h2 id="auth-title" className="mt-5 text-xl font-semibold text-white">Acesse sua conta</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Entre com seu e-mail para guardar seu caderno de erros e acessar seu progresso em outros dispositivos.</p>
            <form className="mt-6 space-y-4" onSubmit={sendLink}>
              <label className="block text-xs font-semibold text-slate-300" htmlFor="auth-email">E-mail</label>
              <Input id="auth-email" type="email" required autoComplete="email" placeholder="voce@exemplo.com" value={email} onChange={(event) => setEmail(event.target.value)} disabled={!isSupabaseConfigured || busy} />
              <Button className="w-full" type="submit" disabled={busy || !isSupabaseConfigured}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}{isSupabaseConfigured ? "Enviar link de acesso" : "Acesso indisponível nesta versão"}</Button>
            </form>
            {!isSupabaseConfigured && <p className="mt-4 rounded-xl border border-amber-400/15 bg-amber-400/[0.06] p-3 text-xs leading-5 text-amber-200/80">O acesso por e-mail e a sincronização ainda não estão disponíveis nesta versão. Seu progresso continua salvo neste dispositivo.</p>}
          </>
        )}
      </section>
    </div>
  );
}
