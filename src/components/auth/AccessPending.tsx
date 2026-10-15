import { useState } from 'react';
import { Clock3, LoaderCircle, LogOut, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export type AccessReviewState = 'checking' | 'pending' | 'error';

interface AccessPendingProps {
  state: AccessReviewState;
  email?: string;
  onRefresh: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

export function AccessPending({ state, email, onRefresh, onSignOut }: AccessPendingProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    try { await onRefresh(); } finally { setRefreshing(false); }
  }

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try { await onSignOut(); } finally { setSigningOut(false); }
  }

  const isChecking = state === 'checking';
  const isError = state === 'error';
  const Icon = isChecking ? LoaderCircle : isError ? ShieldAlert : state === 'pending' ? Clock3 : ShieldCheck;

  return (
    <div className="mx-auto grid min-h-[58vh] max-w-2xl place-items-center py-8">
      <Card className="w-full overflow-hidden border-white/[0.07] bg-[#0c1928]/90">
        <CardContent className="p-6 text-center sm:p-9">
          <span className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl ${isError ? 'bg-amber-300/10 text-amber-200' : 'bg-mint/10 text-mint'}`}>
            <Icon className={`h-6 w-6 ${isChecking ? 'animate-spin' : ''}`} />
          </span>
          <p className="mt-5 text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">Acesso ao Tutor PCPA</p>
          <h1 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
            {isChecking ? 'Verificando seu acesso…' : isError ? 'Não foi possível verificar agora' : 'Solicitação recebida'}
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-400">
            {isChecking
              ? 'Consultando a situação do cadastro…'
              : isError
                ? 'Não foi possível confirmar o acesso. Tente novamente.'
                : 'E-mail confirmado. O acesso aguarda aprovação manual.'}
          </p>
          {email && <p className="mt-3 text-xs text-slate-500">Conta: <span className="font-medium text-slate-300">{email}</span></p>}
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Button onClick={() => void refresh()} disabled={isChecking || refreshing}>
              {refreshing || isChecking ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {isError ? 'Tentar novamente' : 'Verificar aprovação'}
            </Button>
            <Button variant="secondary" onClick={() => void signOut()} disabled={signingOut}>
              {signingOut ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              Sair da conta
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
