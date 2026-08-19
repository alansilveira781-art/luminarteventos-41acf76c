import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { gerarContratoPdfBase64 } from "@/lib/juridico/contrato-pdf";
import { enviarParaAssinatura } from "@/lib/juridico/clicksign.functions";
import {
  CAMPOS_OBRIGATORIOS,
  CAMPOS_SUGERIDOS,
  camposPendentes,
  limparCamposVazios,
  renderizarModelo,
  variaveisDoContrato,
} from "@/lib/juridico/modelo-render";

const LABEL_CAMPO: Record<string, string> = CAMPOS_SUGERIDOS.reduce(
  (a: Record<string, string>, c: any) => ({ ...a, [c.campo]: c.label }),
  {},
);

const sb = supabase as any;

export type Papel = "cliente" | "contratada" | "testemunha";
type Signatario = { nome: string; email: string; documento: string; papel: Papel };

const PAPEL_LABEL: Record<Papel, string> = {
  cliente: "Cliente",
  contratada: "Contratada (Luminart)",
  testemunha: "Testemunha",
};

function signatariosDoContrato(c: any): Signatario[] {
  const out: Signatario[] = [];
  const pj = (c?.cliente_tipo ?? "").toLowerCase() === "pj";

  if (pj && (c?.resp_legal_nome || c?.resp_legal_email)) {
    out.push({
      nome: c.resp_legal_nome ?? c.cliente_nome ?? "",
      email: c.resp_legal_email ?? c.cliente_email ?? "",
      documento: c.resp_legal_documento ?? "",
      papel: "cliente",
    });
    if (c?.resp_legal2_nome || c?.resp_legal2_email) {
      out.push({
        nome: c.resp_legal2_nome ?? "",
        email: c.resp_legal2_email ?? "",
        documento: c.resp_legal2_documento ?? "",
        papel: "cliente",
      });
    }
  } else {
    out.push({
      nome: c?.cliente_nome ?? "",
      email: c?.cliente_email ?? "",
      documento: c?.cliente_documento ?? "",
      papel: "cliente",
    });
  }

  const contratadaSalva = (() => {
    try {
      const raw = localStorage.getItem(`clicksign-contratada:${c?.empresa ?? ""}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();
  out.push({
    nome: contratadaSalva?.nome ?? "",
    email: contratadaSalva?.email ?? "",
    documento: contratadaSalva?.documento ?? "",
    papel: "contratada",
  });

  for (const t of (c?.testemunhas ?? []) as any[]) {
    if (!(t?.nome ?? "").trim()) continue;
    out.push({ nome: t.nome, email: t.email ?? "", documento: t.documento ?? "", papel: "testemunha" });
  }
  return out;
}

async function pdfDoContrato(contrato: any, html: string): Promise<{ base64: string; nomeArquivo: string }> {
  if ((html ?? "").trim()) {
    return gerarContratoPdfBase64(contrato.titulo ?? "Contrato", limparCamposVazios(html));
  }
  // Sem corpo próprio: usa o contrato anexado ao card.
  const { data: anexos } = await sb
    .from("juridico_anexos")
    .select("nome,path,mime_type")
    .eq("contrato_id", contrato.id)
    .eq("tipo", "contrato")
    .order("created_at", { ascending: false })
    .limit(1);
  const anexo = anexos?.[0];
  if (!anexo) throw new Error("Contrato sem corpo e sem arquivo anexado — anexe o PDF do contrato antes de enviar.");
  const { data: file, error } = await sb.storage.from("juridico-anexos").download(anexo.path);
  if (error) throw new Error(error.message);
  const buffer = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buffer.length; i += 8192) {
    bin += String.fromCharCode(...buffer.subarray(i, i + 8192));
  }
  return { base64: btoa(bin), nomeArquivo: anexo.nome ?? "contrato.pdf" };
}

export function EnviarAssinaturaDialog({
  contrato,
  open,
  onOpenChange,
  onEnviado,
}: {
  contrato: any | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onEnviado: () => void;
}) {
  const [signatarios, setSignatarios] = useState<Signatario[]>([]);
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [empresa, setEmpresa] = useState<any>(null);
  const [modeloHtml, setModeloHtml] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !contrato) return;
    setSignatarios(signatariosDoContrato(contrato));
    setMensagem(`Olá! Segue o contrato "${contrato.titulo ?? ""}" para assinatura eletrônica.`);

    // Empresa contratada (dados usados nos campos automáticos do modelo).
    sb.from("admin_empresas")
      .select("razao_social,nome_fantasia,cnpj,endereco,representante_nome,representante_documento")
      .then(({ data }: any) => {
        const alvo = (contrato?.empresa ?? "").trim().toLowerCase();
        setEmpresa(
          (data ?? []).find(
            (e: any) =>
              (e.razao_social ?? "").trim().toLowerCase() === alvo ||
              (e.nome_fantasia ?? "").trim().toLowerCase() === alvo,
          ) ?? null,
        );
      });

    // Modelo original (com os marcadores) para re-renderizar com os dados atuais.
    if (contrato?.modelo_id) {
      sb.from("juridico_modelos")
        .select("corpo_html")
        .eq("id", contrato.modelo_id)
        .maybeSingle()
        .then(({ data }: any) => setModeloHtml(data?.corpo_html ?? null));
    } else {
      setModeloHtml(null);
    }
  }, [open, contrato?.id]);

  const valores = useMemo(
    () => ({
      ...(contrato ? variaveisDoContrato(contrato, empresa) : {}),
      ...((contrato?.variaveis_valores as Record<string, string>) ?? {}),
    }),
    [contrato, empresa],
  );

  const baseHtml = modeloHtml ?? contrato?.corpo_html ?? "";
  const htmlRenderizado = useMemo(
    () => (baseHtml ? renderizarModelo(baseHtml, valores as Record<string, string>) : ""),
    [baseHtml, valores],
  );
  const pendentes = useMemo(
    () => (baseHtml ? camposPendentes(baseHtml, valores) : []),
    [baseHtml, valores],
  );
  const faltamObrigatorios = pendentes.filter((c) => CAMPOS_OBRIGATORIOS.includes(c));

  function set(i: number, patch: Partial<Signatario>) {
    setSignatarios((p) => p.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  }

  async function enviar() {
    if (!contrato) return;
    const limpos = signatarios
      .map((s) => ({ ...s, nome: s.nome.trim(), email: s.email.trim() }))
      .filter((s) => s.nome || s.email);
    if (limpos.length === 0) return toast.error("Informe ao menos um signatário");
    for (const s of limpos) {
      if (!s.nome) return toast.error("Há signatário sem nome");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.email)) return toast.error(`E-mail inválido: ${s.nome}`);
    }

    setEnviando(true);
    try {
      const { base64, nomeArquivo } = await pdfDoContrato(contrato);

      const contratada = limpos.find((s) => s.papel === "contratada");
      if (contratada) {
        localStorage.setItem(
          `clicksign-contratada:${contrato.empresa ?? ""}`,
          JSON.stringify({ nome: contratada.nome, email: contratada.email, documento: contratada.documento }),
        );
      }

      await enviarParaAssinatura({
        data: {
          contratoId: contrato.id,
          nomeArquivo,
          pdfBase64: base64,
          mensagem,
          signatarios: limpos.map((s) => ({
            nome: s.nome,
            email: s.email,
            documento: s.documento || null,
            papel: s.papel,
          })),
        },
      });

      toast.success("Contrato enviado para assinatura");
      onOpenChange(false);
      onEnviado();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao enviar para assinatura");
    } finally {
      setEnviando(false);
    }
  }

  if (!contrato) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !enviando) onOpenChange(false); }}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enviar para assinatura — {contrato.titulo}</DialogTitle>
          <DialogDescription>
            Confira os signatários. O PDF do contrato será gerado e enviado ao Clicksign, que dispara os e-mails de assinatura.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {signatarios.map((s, i) => (
            <div key={i} className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-muted-foreground">{PAPEL_LABEL[s.papel]}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSignatarios((p) => p.filter((_, j) => j !== i))}
                  aria-label="Remover signatário"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Nome</Label>
                  <Input value={s.nome} onChange={(e) => set(i, { nome: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">E-mail</Label>
                  <Input type="email" value={s.email} onChange={(e) => set(i, { email: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">CPF/CNPJ</Label>
                  <Input value={s.documento} onChange={(e) => set(i, { documento: e.target.value })} />
                </div>
              </div>
            </div>
          ))}

          <div className="flex flex-wrap gap-2">
            {(["cliente", "contratada", "testemunha"] as Papel[]).map((p) => (
              <Button
                key={p}
                variant="outline"
                size="sm"
                onClick={() => setSignatarios((prev) => [...prev, { nome: "", email: "", documento: "", papel: p }])}
              >
                <Plus className="h-4 w-4 mr-1" /> {PAPEL_LABEL[p]}
              </Button>
            ))}
          </div>

          <div>
            <Label>Mensagem do e-mail</Label>
            <Textarea rows={2} value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
          </div>
        </div>

        <DialogFooter className="gap-2 mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={enviando}>
            <Send className="h-4 w-4 mr-1" /> {enviando ? "Enviando…" : "Enviar para assinatura"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
