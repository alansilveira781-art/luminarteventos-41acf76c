import { useEffect, useRef, useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, Loader2, Send, Sparkles, User as UserIcon, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/assistente")({
  component: AssistentePage,
  head: () => ({
    meta: [
      { title: "Assistente Claude | Grupo Luminart" },
      {
        name: "description",
        content:
          "Assistente de IA interno do Grupo Luminart para consultas de eventos, compras, aquisições, estoque e finanças.",
      },
      { property: "og:title", content: "Assistente Claude | Grupo Luminart" },
      {
        property: "og:description",
        content: "Converse com o assistente interno para analisar dados de eventos e finanças.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Msg = { role: "user" | "assistant"; texto: string; ferramentas?: string[] };

const SUGESTOES = [
  "Quanto gastamos em compras e aquisições no mês passado?",
  "Quais eventos acontecem nos próximos 30 dias?",
  "Quais itens do estoque estão abaixo do mínimo?",
  "Quais centros de custo tiveram maior saída no Conta Azul?",
];

const NOMES_FERRAMENTAS: Record<string, string> = {
  listar_eventos: "Consultando eventos",
  listar_compras: "Consultando compras",
  listar_aquisicoes: "Consultando aquisições",
  consultar_estoque: "Consultando estoque",
  resumo_financeiro: "Calculando resumo financeiro",
  gastos_por_centro_custo: "Somando rateios por centro de custo",
  consultar_uber: "Consultando corridas Uber",
};

function AssistentePage() {
  const { loading, isMasterAdmin } = useAuth();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [enviando, setEnviando] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, enviando]);

  if (loading) return null;
  if (!isMasterAdmin) return <Navigate to="/" />;

  async function enviar(texto: string) {
    const pergunta = texto.trim();
    if (!pergunta || enviando) return;
    setInput("");
    const historico = [...msgs, { role: "user" as const, texto: pergunta }];
    setMsgs([...historico, { role: "assistant", texto: "", ferramentas: [] }]);
    setEnviando(true);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const res = await fetch("/api/assistente/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          messages: historico.map((m) => ({ role: m.role, content: m.texto })),
        }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Falha na requisição" }));
        setMsgs((prev) => {
          const c = [...prev];
          c[c.length - 1] = { role: "assistant", texto: `⚠️ ${err.error ?? "Erro"}` };
          return c;
        });
        return;
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const partes = buf.split("\n\n");
        buf = partes.pop() ?? "";
        for (const parte of partes) {
          const linha = parte.split("\n").find((l) => l.startsWith("data: "));
          if (!linha) continue;
          let ev: any;
          try {
            ev = JSON.parse(linha.slice(6));
          } catch {
            continue;
          }
          setMsgs((prev) => {
            const c = [...prev];
            const ult = { ...c[c.length - 1] } as Msg;
            if (ev.type === "texto") ult.texto += ev.delta;
            else if (ev.type === "ferramenta")
              ult.ferramentas = [...(ult.ferramentas ?? []), ev.nome];
            else if (ev.type === "erro") ult.texto += `\n\n⚠️ ${ev.mensagem}`;
            c[c.length - 1] = ult;
            return c;
          });
        }
      }
    } catch (e: any) {
      setMsgs((prev) => {
        const c = [...prev];
        c[c.length - 1] = { role: "assistant", texto: `⚠️ ${e?.message ?? "Erro inesperado"}` };
        return c;
      });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-1rem)] flex-col gap-4 p-4">
      <PageHeader
        title="Assistente"
        description="Claude conectado aos dados do Luminart — acesso restrito ao administrador mestre."
      />

      <div className="flex-1 overflow-y-auto rounded-lg border bg-card p-4">
        {msgs.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
            <Sparkles className="h-10 w-10 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">Como posso ajudar?</h2>
              <p className="text-sm text-muted-foreground">
                Pergunte sobre eventos, compras, aquisições, estoque ou finanças.
              </p>
            </div>
            <div className="grid w-full max-w-2xl gap-2 sm:grid-cols-2">
              {SUGESTOES.map((s) => (
                <button
                  key={s}
                  onClick={() => enviar(s)}
                  className="rounded-md border p-3 text-left text-sm transition hover:bg-accent"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-5">
            {msgs.map((m, i) => (
              <div key={i} className="flex gap-3">
                <div className="mt-1 shrink-0 rounded-md bg-muted p-1.5">
                  {m.role === "user" ? <UserIcon className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  {!!m.ferramentas?.length && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {m.ferramentas.map((f, k) => (
                        <span
                          key={k}
                          className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                        >
                          <Wrench className="h-3 w-3" />
                          {NOMES_FERRAMENTAS[f] ?? f}
                        </span>
                      ))}
                    </div>
                  )}
                  {m.role === "user" ? (
                    <p className="whitespace-pre-wrap text-sm">{m.texto}</p>
                  ) : m.texto ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert [&_table]:w-full [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:px-2 [&_th]:py-1">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.texto}</ReactMarkdown>
                    </div>
                  ) : (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              </div>
            ))}
            <div ref={fimRef} />
          </div>
        )}
      </div>

      <div className="mx-auto flex w-full max-w-3xl items-end gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              enviar(input);
            }
          }}
          placeholder="Pergunte alguma coisa…"
          rows={2}
          className="resize-none"
        />
        <Button onClick={() => enviar(input)} disabled={enviando || !input.trim()} size="icon" className="h-10 w-10">
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
