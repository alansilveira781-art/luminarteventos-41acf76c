import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  CAMPOS_SUGERIDOS, extrairCampos, renderizarModelo, variaveisDoContrato,
} from "@/lib/juridico/modelo-render";
import { fmtMoeda } from "@/lib/juridico/contrato-form";
import { toast } from "sonner";

const sb = supabase as any;

export const CATEGORIAS_CONTRATO = [
  { value: "stand", label: "Stand" },
  { value: "corporativo", label: "Corporativo" },
  { value: "social", label: "Social" },
  { value: "cenografia", label: "Cenografia" },
] as const;

const LABEL_CAMPO: Record<string, string> = CAMPOS_SUGERIDOS.reduce(
  (a, c) => ({ ...a, [c.campo]: c.label }),
  {},
);

/**
 * Diálogo exibido ao mover um contrato para a etapa de Criação:
 * define a categoria, escolhe o modelo e gera o corpo do contrato.
 */
export function DefinirCategoriaDialog({
  contrato,
  open,
  onOpenChange,
  onConfirm,
}: {
  contrato: any | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (patch: Record<string, any>) => Promise<void> | void;
}) {
  const [categoria, setCategoria] = useState<string>("");
  const [modeloId, setModeloId] = useState<string>("");
  const [modelos, setModelos] = useState<any[]>([]);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [manuais, setManuais] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [propostaExistente, setPropostaExistente] = useState<any | null>(null);
  const [propostaFile, setPropostaFile] = useState<File | null>(null);


  useEffect(() => {
    if (!open) return;
    setCategoria(contrato?.categoria ?? "");
    setModeloId(contrato?.modelo_id ?? "");
    setManuais((contrato?.variaveis_valores as Record<string, string>) ?? {});
    sb.from("juridico_modelos")
      .select("id,nome,tipo,corpo_html")
      .eq("ativo", true)
      .order("nome")
      .then(({ data }: any) => setModelos(data ?? []));
    sb.from("admin_empresas")
      .select("razao_social,nome_fantasia,cnpj,endereco,representante_nome,representante_documento")
      .then(({ data }: any) => setEmpresas(data ?? []));
    setPropostaFile(null);
    setPropostaExistente(null);
    if (contrato?.id) {
      sb.from("juridico_anexos")
        .select("id,nome,path")
        .eq("contrato_id", contrato.id)
        .eq("tipo", "proposta")
        .order("created_at", { ascending: false })
        .limit(1)
        .then(({ data }: any) => setPropostaExistente(data?.[0] ?? null));
    }
  }, [open, contrato?.id]);


  const modelosDaCategoria = useMemo(
    () => modelos.filter((m) => (m.tipo ?? "").toLowerCase() === categoria),
    [modelos, categoria],
  );

  const empresa = useMemo(() => {
    const alvo = (contrato?.empresa ?? "").trim().toLowerCase();
    if (!alvo) return null;
    return (
      empresas.find(
        (e) =>
          (e.razao_social ?? "").trim().toLowerCase() === alvo ||
          (e.nome_fantasia ?? "").trim().toLowerCase() === alvo,
      ) ?? null
    );
  }, [empresas, contrato?.empresa]);

  const modelo = modelos.find((m) => m.id === modeloId) ?? null;
  const auto = useMemo(
    () => (contrato ? variaveisDoContrato({ ...contrato, categoria }, empresa) : {}),
    [contrato, categoria, empresa],
  );
  const campos = useMemo(() => extrairCampos(modelo?.corpo_html ?? ""), [modelo]);
  const pendentes = campos.filter((c) => !(auto as any)[c]);

  const preview = useMemo(
    () => (modelo ? renderizarModelo(modelo.corpo_html ?? "", { ...auto, ...manuais }) : ""),
    [modelo, auto, manuais],
  );

  async function enviarProposta() {
    if (!propostaFile || !contrato?.id) return;
    const safe = propostaFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${contrato.id}/${Date.now()}_${safe}`;
    const { error: upErr } = await sb.storage
      .from("juridico-anexos")
      .upload(path, propostaFile, { contentType: propostaFile.type || undefined });
    if (upErr) throw new Error(upErr.message);
    const { error: insErr } = await sb.from("juridico_anexos").insert({
      contrato_id: contrato.id,
      nome: propostaFile.name,
      path,
      mime_type: propostaFile.type || null,
      tamanho: propostaFile.size,
      tipo: "proposta",
    });
    if (insErr) throw new Error(insErr.message);
  }

  async function confirmar() {
    if (!categoria) return toast.error("Escolha o tipo do contrato");
    setSalvando(true);
    try {
      await enviarProposta();
      await onConfirm({
        status: "criacao",
        categoria,
        modelo_id: modelo?.id ?? contrato?.modelo_id ?? null,
        corpo_html: modelo ? preview : contrato?.corpo_html ?? null,
        variaveis_valores: manuais,
      });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao anexar a proposta");
    } finally {
      setSalvando(false);
    }

      setSalvando(false);
    }
  }

  if (!contrato) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mover para Criação</DialogTitle>
          <DialogDescription>
            Informe o que é este contrato e escolha o modelo para gerar o documento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Tipo do contrato *</Label>
            <div className="grid grid-cols-4 gap-2 mt-1">
              {CATEGORIAS_CONTRATO.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => { setCategoria(c.value); setModeloId(""); }}
                  className={`rounded-md border p-2 text-sm ${
                    categoria === c.value ? "border-primary bg-primary/10 font-medium" : "hover:bg-muted"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {categoria && (
            <div>
              <Label>Modelo</Label>
              {modelosDaCategoria.length === 0 ? (
                <p className="text-xs text-muted-foreground mt-1">
                  Nenhum modelo cadastrado para {categoria}. O contrato será movido sem corpo gerado.
                </p>
              ) : (
                <div className="space-y-1 mt-1">
                  {modelosDaCategoria.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setModeloId(m.id)}
                      className={`w-full text-left rounded-md border p-2 text-sm ${
                        modeloId === m.id ? "border-primary bg-primary/10" : "hover:bg-muted"
                      }`}
                    >
                      {m.nome}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="rounded-md border p-3 text-sm space-y-1 bg-muted/30">
            <div className="text-xs font-semibold text-muted-foreground">Dados que serão aplicados</div>
            <div>Cliente: {contrato.cliente_nome || "—"} · {contrato.cliente_documento || "—"}</div>
            <div>Endereço: {auto.cliente_endereco || "—"}</div>
            <div>
              Valor: {contrato.valor != null ? fmtMoeda(Number(contrato.valor)) : "—"} ·{" "}
              {(contrato.pagamento_parcelas ?? []).length}x {auto.forma_pagamento}
            </div>
          </div>

          {modelo && pendentes.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground">
                Campos a preencher ({pendentes.length})
              </div>
              <div className="grid grid-cols-2 gap-2">
                {pendentes.map((c) => (
                  <div key={c}>
                    <Label className="text-xs">{LABEL_CAMPO[c] ?? c}</Label>
                    <Input
                      value={manuais[c] ?? ""}
                      onChange={(e) => setManuais((p) => ({ ...p, [c]: e.target.value }))}
                      placeholder={`[${c}]`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {modelo && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-1">Prévia do contrato</div>
              <div
                className="prose prose-sm max-w-none rounded-md border p-3 max-h-64 overflow-y-auto contrato-preview"
                dangerouslySetInnerHTML={{ __html: preview }}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={salvando}>
            {salvando ? "Gerando…" : "Gerar e mover para Criação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
