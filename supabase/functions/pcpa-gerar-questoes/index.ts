import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function responseJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

serve((request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return responseJson({ success: false, error: "Método não permitido." }, 405);

  return responseJson({
    success: false,
    error: "A aplicação não disponibiliza mais questões reais de concursos. Use a geração autoral por IA, orientada pelo edital e por sinais agregados de provas anteriores.",
  }, 410);
});
