import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireApprovedUser } from "../_shared/auth.ts";
import { getGeminiApiKeys } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUBJECTS = [
  "Língua Portuguesa",
  "Redação",
  "Raciocínio Lógico",
  "Informática",
  "Direito Administrativo",
  "Legislação Administrativa - Regime Jurídico Único - RJU",
  "Direito Constitucional",
  "Direito Penal Geral",
  "Direito Processual Penal",
  "Legislação Especial",
  "Estatística",
];

const SYSTEM_INSTRUCTION = `Você é um tutor especializado em concursos da Polícia Civil do Pará (PCPA).

POLÍTICA ZERO ALUCINAÇÃO JURÍDICA:
- Nunca invente números de artigos, parágrafos, incisos, alíneas, leis, decisões, súmulas ou jurisprudência.
- Cite apenas referências que você possa sustentar. Base legal de estudo: CF/88, Código Penal (Decreto-Lei 2.848/1940), Código de Processo Penal (Decreto-Lei 3.689/1941), CTB (Lei 9.503/1997), Lei 10.826/2003, Lei 11.343/2006, Lei 11.340/2006, Lei 8.069/1990 e Lei Estadual do Pará 5.810/1994.
- Se houver qualquer dúvida sobre uma referência legal, não tente adivinhar: sinalize “⚠️ Verificar Lei Seca” e diga onde consultar, por exemplo o Portal da Legislação do Planalto ou a fonte legislativa oficial do Pará.
- Em caso de pergunta que dependa de alteração legislativa recente, deixe explícito que o texto vigente precisa ser confirmado em fonte oficial.

MATÉRIAS OFICIAIS DO PCPA (usar estes nomes exatamente):
${SUBJECTS.map((subject, index) => `${index + 1}. ${subject}`).join("\n")}

ESTILO:
- Português brasileiro natural, tom didático, encorajador e acessível.
- Explique passo a passo, priorize clareza e evite juridiquês desnecessário.
- Use exemplos práticos de aplicação policial quando ajudarem a compreensão.
- Ajude a identificar pegadinhas e conceitos-chave sem desanimar o estudante.
- Não apresente o conteúdo como aconselhamento jurídico para um caso concreto.

Se o estudante trouxer uma questão, use o contexto anexado sem afirmar que uma explicação gerada por IA substitui o gabarito oficial. `;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function cleanText(value: unknown, maxLength = 4000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function buildInstruction(questionContext: Record<string, unknown> | null) {
  if (!questionContext) return SYSTEM_INSTRUCTION;
  const context = {
    subject: cleanText(questionContext.subject, 150),
    topic: cleanText(questionContext.topic, 250),
    prompt: cleanText(questionContext.prompt, 2500),
    answer: cleanText(questionContext.answer, 300),
    gabarito_comentado: cleanText(questionContext.gabarito_comentado, 2500),
  };
  return `${SYSTEM_INSTRUCTION}\n\nCONTEXTO DA QUESTÃO ATUAL (material de estudo, pode conter erro; confira antes de repetir referência legal):\n${JSON.stringify(context, null, 2)}\nUse este contexto apenas para explicar a questão apresentada e sinalize se houver dúvida.`;
}

async function requestStream(model: string, apiKey: string, contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }>, systemInstruction: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;
  return await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey, Accept: "text/event-stream" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents,
      generationConfig: { maxOutputTokens: 2048 },
    }),
  });
}

async function requestStreamWithFallback(
  primaryModel: string,
  fallbackModel: string,
  apiKeys: string[],
  contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }>,
  systemInstruction: string,
) {
  const models = [...new Set([primaryModel, fallbackModel].filter(Boolean))];
  let lastResponse: Response | null = null;

  for (const model of models) {
    for (let index = 0; index < apiKeys.length; index += 1) {
      let response: Response;
      try {
        response = await requestStream(model, apiKeys[index], contents, systemInstruction);
      } catch (error) {
        console.warn(`[TUTOR] Falha de rede com a chave ${index + 1} para ${model}; tentando contingência.`, error);
        continue;
      }
      if (response.ok && response.body) {
        if (index > 0) console.info(`[TUTOR] A chave principal falhou; a chave reserva ${index + 1} respondeu para ${model}.`);
        return response;
      }
      const details = await response.clone().text().catch(() => "");
      console.warn(`[TUTOR] Modelo ${model} falhou com a chave ${index + 1} (${response.status}); tentando contingência.`, details.slice(0, 300));
      lastResponse = response;
    }
  }

  return lastResponse ?? new Response("Gemini indisponível.", { status: 502 });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);

  try {
    const access = await requireApprovedUser(req);
    if (access.status === "unauthenticated") return jsonResponse({ error: "Entre na sua conta para usar o Tutor." }, 401);
    if (access.status === "pending") return jsonResponse({ error: "Seu cadastro está aguardando aprovação." }, 403);
    if (access.status === "unavailable") return jsonResponse({ error: "Não foi possível confirmar a liberação da sua conta." }, 503);

    const apiKeys = getGeminiApiKeys();
    if (!apiKeys.length) return jsonResponse({ error: "As credenciais do Tutor não estão configuradas no servidor." }, 503);

    const body = await req.json();
    const rawMessages = Array.isArray(body?.messages) ? body.messages : [];
    if (rawMessages.length < 1 || rawMessages.length > 20) {
      return jsonResponse({ error: "Envie de 1 a 20 mensagens para a conversa." }, 400);
    }

    const messages: ChatMessage[] = rawMessages.map((message: Record<string, unknown>) => ({
      role: message?.role === "assistant" ? "assistant" : "user",
      content: cleanText(message?.content, 3000),
    })).filter((message: ChatMessage) => Boolean(message.content));

    if (!messages.length || messages[messages.length - 1].role !== "user") {
      return jsonResponse({ error: "A última mensagem precisa ser uma pergunta do estudante." }, 400);
    }

    const contents = messages.map((message) => ({
      role: message.role === "assistant" ? "model" as const : "user" as const,
      parts: [{ text: message.content }],
    }));
    const rawContext = body?.questionContext && typeof body.questionContext === "object"
      ? body.questionContext as Record<string, unknown>
      : null;
    const systemInstruction = buildInstruction(rawContext);
    const primaryModel = Deno.env.get("GEMINI_MODEL") || "gemini-3.8-flash";
    const fallbackModel = Deno.env.get("GEMINI_FALLBACK_MODEL") || "gemini-3.5-flash-lite";

    const upstream = await requestStreamWithFallback(primaryModel, fallbackModel, apiKeys, contents, systemInstruction);
    if (!upstream.ok || !upstream.body) {
      const providerMessage = await upstream.clone().text().catch(() => "");
      console.error(`[TUTOR] Falha no streaming (${upstream.status}).`, providerMessage.slice(0, 500));
      return jsonResponse({ error: "Não foi possível iniciar a resposta do Tutor. Confira as chaves Gemini e tente novamente." }, 502);
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = upstream.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let emittedText = false;
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split(/\r?\n\r?\n/);
            buffer = events.pop() ?? "";
            for (const event of events) {
              const data = event.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
              if (!data || data === "[DONE]") continue;
              try {
                const payload = JSON.parse(data);
                const text = (payload?.candidates?.[0]?.content?.parts ?? [])
                  .map((part: { text?: string }) => typeof part.text === "string" ? part.text : "")
                  .join("");
                if (text) {
                  emittedText = true;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: text })}\n\n`));
                }
                const providerError = payload?.error?.message;
                if (providerError) throw new Error(String(providerError));
              } catch (error) {
                if (error instanceof SyntaxError) continue;
                throw error;
              }
            }
          }
          if (!emittedText) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Não foi possível concluir a resposta. Tente reformular sua pergunta." })}\n\n`));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch (error) {
          console.error("[TUTOR] Erro durante streaming:", error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "A resposta foi interrompida. Tente novamente." })}\n\n`));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } finally {
          reader.releaseLock();
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("Erro no pcpa-tutor:", error);
    return jsonResponse({ error: "O Tutor encontrou um erro inesperado. Tente novamente." }, 500);
  }
});
