import { useEffect, useState } from 'react';
import {
  Check,
  Clock3,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  ShieldX,
  UsersRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

interface AccessRequest {
  user_id: string;
  email: string;
  requested_at: string;
  approved_at: string | null;
}

interface AdminResponse {
  success?: boolean;
  error?: string;
  requests?: AccessRequest[];
  request?: AccessRequest;
}

async function adminRequest(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke<AdminResponse>('pcpa-admin-access', { body });
  if (error) {
    const context = (error as unknown as { context?: unknown }).context;
    if (context instanceof Response) {
      const payload = await context.clone().json().catch(() => null) as AdminResponse | null;
      throw new Error(payload?.error || error.message);
    }
    throw new Error(error.message);
  }
  if (!data?.success) throw new Error(data?.error || 'A solicitação administrativa não foi concluída.');
  return data;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Data indisponível'
    : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function AdminAccessPanel() {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  async function loadRequests(includeApproved = showAll) {
    setLoading(true);
    setErrorMessage('');
    try {
      const result = await adminRequest({ action: 'list', includeApproved });
      setRequests(result.requests ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível carregar os pedidos.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRequests(showAll);
  }, [showAll]);

  async function changeApproval(request: AccessRequest) {
    const isApproved = Boolean(request.approved_at);
    const action = isApproved ? 'revoke' : 'approve';
    if (isApproved && !window.confirm(`Revogar o acesso de ${request.email}?`)) return;

    setBusyUserId(request.user_id);
    try {
      await adminRequest({ action, user_id: request.user_id });
      toast.success(isApproved ? 'Acesso revogado' : 'Conta aprovada', {
        description: request.email,
      });
      await loadRequests(showAll);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível alterar a aprovação.';
      toast.error('Não foi possível atualizar o acesso', { description: message });
    } finally {
      setBusyUserId(null);
    }
  }

  const pendingCount = requests.filter((request) => !request.approved_at).length;

  return (
    <div className="animate-float-in mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-mint">
            <ShieldCheck className="h-4 w-4" /> Administração segura
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Aprovação de cadastros</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Confirme quem pode usar as ferramentas protegidas do Tutor PCPA. Confirmar o e-mail não aprova automaticamente a conta.
          </p>
        </div>
        <Button variant="secondary" onClick={() => void loadRequests()} disabled={loading || busyUserId !== null}>
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Atualizar lista
        </Button>
      </div>

      <Card className="border-mint/10 bg-mint/[0.025]">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-mint/10 text-mint"><UsersRound className="h-5 w-5" /></span>
            <div>
              <p className="text-sm font-semibold text-slate-100">{showAll ? 'Todos os cadastros' : 'Fila de aprovação'}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {showAll ? `${pendingCount} pendente(s) nesta lista` : `${requests.length} pedido(s) aguardando análise`}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowAll((value) => !value)} disabled={loading || busyUserId !== null}>
            {showAll ? 'Mostrar só pendentes' : 'Ver também aprovados'}
          </Button>
        </CardContent>
      </Card>

      {errorMessage && (
        <Alert className="border-rose-400/20 bg-rose-400/[0.06]">
          <ShieldX className="h-4 w-4 text-rose-300" />
          <AlertDescription className="text-rose-100/80">
            {errorMessage} Confira se a migration e a função administrativa foram publicadas e se esta conta foi cadastrada como administradora.
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <Card className="p-10 text-center">
          <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-mint" />
          <p className="mt-3 text-sm text-slate-400">Carregando pedidos de acesso…</p>
        </Card>
      ) : requests.length === 0 ? (
        <Card className="p-10 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.04] text-slate-400"><Check className="h-5 w-5" /></span>
          <h2 className="mt-4 text-base font-semibold text-white">{showAll ? 'Nenhum cadastro encontrado' : 'Fila em dia'}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            {showAll ? 'Ainda não há pedidos registrados.' : 'Não há contas aguardando aprovação neste momento.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => {
            const isApproved = Boolean(request.approved_at);
            const busy = busyUserId === request.user_id;
            return (
              <Card key={request.user_id} className="transition-colors hover:border-white/[0.12]">
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="break-all text-sm font-semibold text-slate-100">{request.email || 'E-mail indisponível'}</p>
                      <Badge variant={isApproved ? 'default' : 'outline'}>
                        {isApproved ? 'Aprovado' : 'Aguardando aprovação'}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3 w-3" />Pedido: {formatDate(request.requested_at)}</span>
                      {request.approved_at && <span>Liberação: {formatDate(request.approved_at)}</span>}
                    </div>
                  </div>
                  <Button
                    variant={isApproved ? 'destructive' : 'default'}
                    size="sm"
                    onClick={() => void changeApproval(request)}
                    disabled={busyUserId !== null}
                    className="shrink-0"
                  >
                    {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : isApproved ? <ShieldX className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                    {busy ? 'Salvando…' : isApproved ? 'Revogar acesso' : 'Aprovar conta'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <p className="text-center text-[11px] leading-5 text-slate-600">As alterações são verificadas no servidor. A chave administrativa não é enviada ao navegador.</p>
    </div>
  );
}
