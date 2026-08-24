import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { runTool, toolDefs } from "@/lib/assistente/ferramentas.server";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-4-5";

function jsonError(error: string, status: number) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function userClient(token: string) {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input: any, init: any) => {
        const h = new Headers(init?.headers);
        h.set("apikey", key);
        h.set("Authorization", `Bearer ${token}`);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

const SYSTEM = `Você é o assistente interno do Grupo Luminart, uma empresa de eventos.
Responda sempre em português do Brasil, de forma objetiva e executiva.
Use as ferramentas disponíveis para consultar dados reais do sistema antes de responder perguntas sobre eventos, compras, aquisições, estoque, finanças ou Uber — nunca invente números.
Valores estão em reais (BRL) e datas no formato AAAA-MM-DD. Formate valores como R$ 1.234,56.
Você tem acesso somente de leitura: não é possível criar, alterar ou excluir registros.
Quando apresentar listas ou comparativos, prefira tabelas em markdown e finalize com uma breve análise.
Ferramentas disponíveis: listar_eventos, listar_compras, listar_aquisicoes, consultar_estoque, resumo_financeiro, gastos_por_centro_custo, consultar_uber.`;

async function callAnthropic(apiKey: string, model: string, body: any) {
  return fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ ...body, model }),
  });
}

async function resolveModel(apiKey: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/models?limit=50", {
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
  });
  if (!res.ok) return DEFAULT_MODEL;
  const json: any = await res.json();
  const ids: string[] = (json?.data ?? []).map((m: any) => m.id);
  return ids.find((id) => id.includes("sonnet")) ?? ids[0] ?? DEFAULT_MODEL;
}

export const Route = createFileRoute("/api/assistente/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        if (!auth.startsWith("Bearer ")) return jsonError("Não autenticado", 401);
        const token = auth.slice(7);

        const sb = userClient(token);
        const { data: userRes, error: userErr } = await sb.auth.getUser(token);
        if (userErr || !userRes?.user) return jsonError("Token inválido", 401);

        const { data: isMaster, error: rpcErr } = await sb.rpc("is_master_admin", {
          _user_id: userRes.user.id,
        });
        if (rpcErr) return jsonError(rpcErr.message, 500);
        if (!isMaster) return jsonError("Acesso restrito ao administrador mestre", 403);

        const apiKey = process.env["ANTHROPIC_API_KEY"];
        if (!apiKey) return jsonError("Chave da Anthropic não configurada", 500);

        const payload = (await request.json()) as {
          messages: { role: "user" | "assistant"; content: any }[];
        };
        const messages: any[] = Array.isArray(payload?.messages) ? [...payload.messages] : [];
        if (!messages.length) return jsonError("Mensagens ausentes", 400);

        let model = process.env["ANTHROPIC_MODEL"] || DEFAULT_MODEL;

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            const send = (obj: any) =>
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
            try {
              const hoje = new Date().toISOString().slice(0, 10);
              for (let volta = 0; volta < 8; volta++) {
                let res = await callAnthropic(apiKey, model, {
                  max_tokens: 4096,
                  system: `${SYSTEM}\nData de hoje: ${hoje}.`,
                  tools: toolDefs,
                  stream: true,
                  messages,
                });
                if (res.status === 404) {
                  model = await resolveModel(apiKey);
                  res = await callAnthropic(apiKey, model, {
                    max_tokens: 4096,
                    system: `${SYSTEM}\nData de hoje: ${hoje}.`,
                    tools: toolDefs,
                    stream: true,
                    messages,
                  });
                }
                if (!res.ok || !res.body) {
                  const txt = await res.text().catch(() => "");
                  send({ type: "erro", mensagem: `Falha na IA (${res.status}): ${txt.slice(0, 500)}` });
                  break;
                }

                const blocks: any[] = [];
                let stopReason: string | null = null;
                const reader = res.body.getReader();
                const dec = new TextDecoder();
                let buf = "";
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  buf += dec.decode(value, { stream: true });
                  const parts = buf.split("\n\n");
                  buf = parts.pop() ?? "";
                  for (const part of parts) {
                    const line = part.split("\n").find((l) => l.startsWith("data: "));
                    if (!line) continue;
                    let ev: any;
                    try {
                      ev = JSON.parse(line.slice(6));
                    } catch {
                      continue;
                    }
                    if (ev.type === "content_block_start") {
                      blocks[ev.index] =
                        ev.content_block.type === "tool_use"
                          ? { ...ev.content_block, input: "" }
                          : { ...ev.content_block, text: "" };
                      if (ev.content_block.type === "tool_use") {
                        send({ type: "ferramenta", nome: ev.content_block.name });
                      }
                    } else if (ev.type === "content_block_delta") {
                      const b = blocks[ev.index];
                      if (!b) continue;
                      if (ev.delta.type === "text_delta") {
                        b.text += ev.delta.text;
                        send({ type: "texto", delta: ev.delta.text });
                      } else if (ev.delta.type === "input_json_delta") {
                        b.input += ev.delta.partial_json;
                      }
                    } else if (ev.type === "message_delta") {
                      stopReason = ev.delta?.stop_reason ?? stopReason;
                    } else if (ev.type === "error") {
                      send({ type: "erro", mensagem: ev.error?.message ?? "Erro da IA" });
                    }
                  }
                }

                const content = blocks.filter(Boolean).map((b: any) =>
                  b.type === "tool_use"
                    ? { type: "tool_use", id: b.id, name: b.name, input: b.input ? JSON.parse(b.input) : {} }
                    : { type: "text", text: b.text },
                );
                messages.push({ role: "assistant", content });

                if (stopReason !== "tool_use") break;

                const results: any[] = [];
                for (const b of content) {
                  if (b.type !== "tool_use") continue;
                  try {
                    const out = await runTool(sb as any, b.name, b.input);
                    results.push({
                      type: "tool_result",
                      tool_use_id: b.id,
                      content: JSON.stringify(out).slice(0, 120000),
                    });
                  } catch (e: any) {
                    results.push({
                      type: "tool_result",
                      tool_use_id: b.id,
                      is_error: true,
                      content: String(e?.message ?? e),
                    });
                  }
                }
                messages.push({ role: "user", content: results });
              }
              send({ type: "fim" });
            } catch (e: any) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "erro", mensagem: String(e?.message ?? e) })}\n\n`),
              );
            } finally {
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-store",
            Connection: "keep-alive",
          },
        });
      },
    },
  },
});
