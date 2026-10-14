import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireAuthenticatedUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function responseJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return responseJson({ success: false, error: "Método não permitido." }, 405);

  try {
    const user = await requireAuthenticatedUser(req);
    if (!user) return responseJson({ success: false, error: "Entre com uma conta autorizada." }, 401);

    const url = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceRoleKey) {
      console.error("[ADMIN] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente.");
      return responseJson({ success: false, error: "A administração não está configurada no servidor." }, 503);
    }

    const serviceClient = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: admin, error: adminError } = await serviceClient
      .from("pcpa_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (adminError) {
      console.error("[ADMIN] Falha ao verificar o papel administrativo:", adminError.message);
      return responseJson({ success: false, error: "Não foi possível verificar a permissão administrativa." }, 500);
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return responseJson({ success: false, error: "Envie uma solicitação JSON válida." }, 400);
    }

    const action = typeof body.action === "string" ? body.action : "";
    const isAdmin = Boolean(admin);

    // The signed-in client may ask only whether its own account is an admin.
    if (action === "check") {
      return responseJson({ success: true, is_admin: isAdmin });
    }

    if (!isAdmin) return responseJson({ success: false, error: "Acesso restrito a administradores." }, 403);

    if (action === "list") {
      const includeApproved = body.includeApproved === true;
      let query = serviceClient
        .from("pcpa_access_requests")
        .select("user_id, email, requested_at, approved_at")
        .order("requested_at", { ascending: false })
        .limit(500);
      if (!includeApproved) query = query.is("approved_at", null);

      const { data, error } = await query;
      if (error) {
        console.error("[ADMIN] Falha ao listar solicitações:", error.message);
        return responseJson({ success: false, error: "Não foi possível carregar os pedidos de acesso." }, 500);
      }
      return responseJson({ success: true, requests: data ?? [] });
    }

    if (action === "approve" || action === "revoke") {
      const userId = body.user_id;
      if (!isUuid(userId)) {
        return responseJson({ success: false, error: "Identificador de usuário inválido." }, 400);
      }
      if (action === "revoke" && userId === user.id) {
        return responseJson({ success: false, error: "Não é possível revogar o próprio acesso por aqui." }, 400);
      }

      const approvedAt = action === "approve" ? new Date().toISOString() : null;
      const { data, error } = await serviceClient
        .from("pcpa_access_requests")
        .update({ approved_at: approvedAt })
        .eq("user_id", userId)
        .select("user_id, email, requested_at, approved_at")
        .maybeSingle();

      if (error) {
        console.error(`[ADMIN] Falha ao ${action === "approve" ? "aprovar" : "revogar"} usuário:`, error.message);
        return responseJson({ success: false, error: "Não foi possível atualizar a aprovação." }, 500);
      }
      if (!data) return responseJson({ success: false, error: "Não foi encontrado um pedido para essa conta." }, 404);

      console.info(`[ADMIN] ${action} user_id=${userId} by admin_id=${user.id}`);
      return responseJson({ success: true, request: data });
    }

    return responseJson({ success: false, error: "Ação administrativa inválida." }, 400);
  } catch (error) {
    console.error("[ADMIN] Erro inesperado:", error);
    return responseJson({ success: false, error: "Ocorreu um erro inesperado na administração." }, 500);
  }
});
