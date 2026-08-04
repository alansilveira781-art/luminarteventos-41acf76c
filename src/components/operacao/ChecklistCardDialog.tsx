import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fmtData,
  progressoOrdem,
  type ChecklistItem,
  type Ordem,
  type OrdemSetor,
  type Setor,
} from "@/lib/operacao";

const sb = supabase as any;

/** Cria os itens de checklist do setor a partir das etapas configuradas, se ainda não existirem. */
export async function garantirChecklist(ordemId: string, setorId: string) {
  const { data: existentes } = await sb
    .from("op_ordem_checklist")
    .select("id")
    .eq("ordem_id", ordemId)
    .eq("setor_id", setorId)
    .limit(1);
  if ((existentes ?? []).length > 0) return;
  const { data: etapas } = await sb
    .from("op_setor_etapas")
    .select("id,nome,descricao,ordem")
    .eq("setor_id", setorId)
    .eq("ativo", true)
    .order("ordem");
  const rows = (etapas ?? []).map((e: any, i: number) => ({
    ordem_id: ordemId,
    setor_id: setorId,
    etapa_id: e.id,
    nome: e.nome,
    descricao: e.descricao ?? null,
    ordem: e.ordem ?? i * 10,
  }));
  if (rows.length) await sb.from("op_ordem_checklist").insert(rows);
}

export function ChecklistCardDialog({
  ordemId,
  setores,
  podeEditar,
  onClose,
}: {
  ordemId: string;
  setores: Setor[];
  podeEditar: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [obs, setObs] = useState("");
  const [salvando, setSalvando] = useState(false);

  const { data: ordem } = useQuery<Ordem | null>({
    queryKey: ["op_ordem", ordemId],
    queryFn: async () => (await sb.from("op_ordens").select("*").eq("id", ordemId).maybeSingle()).data,
  });

  const { data: roteiro = [] } = useQuery<OrdemSetor[]>({
    queryKey: ["op_roteiro", ordemId],
    queryFn: async () =>
      (await sb.from("op_ordem_setores").select("*").eq("ordem_id", ordemId).order("posicao")).data ?? [],
  });

  const { data: checklist = [] } = useQuery<ChecklistItem[]>({
    queryKey: ["op_checklist", ordemId],
    queryFn: async () =>
      (await sb.from("op_ordem_checklist").select("*").eq("ordem_id", ordemId).order("ordem")).data ?? [],
  });

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["op_ordem", ordemId] });
    qc.invalidateQueries({ queryKey: ["op_roteiro", ordemId] });
    qc.invalidateQueries({ queryKey: ["op_checklist", ordemId] });
    qc.invalidateQueries({ queryKey: ["op_ordens"] });
    qc.invalidateQueries({ queryKey: ["op_roteiros"] });
    qc.invalidateQueries({ queryKey: ["op_checklists"] });
  };

  if (!ordem) return null;

  const setorAtualId = ordem.setor_id;
  const nomeSetor = (id: string | null) => setores.find((s) => s.id === id)?.nome ?? "—";
  const idx = roteiro.findIndex((r) => r.setor_id === setorAtualId);
  const proximo = idx >= 0 && idx < roteiro.length - 1 ? roteiro[idx + 1] : null;
  const itens = checklist.filter((c) => c.setor_id === setorAtualId);
  const prog = progressoOrdem(roteiro, checklist, setorAtualId);
  const finalizada = ordem.status === "finalizada" || ordem.status === "cancelada";

  async function toggleItem(item: ChecklistItem, valor: boolean) {
    if (!podeEditar) return;
    const { error } = await sb
      .from("op_ordem_checklist")
      .update({
        concluido: valor,
        concluido_por: valor ? user?.id ?? null : null,
        concluido_em: valor ? new Date().toISOString() : null,
      })
      .eq("id", item.id);
    if (error) return toast.error(error.message);
    if (ordem && ordem.status === "aberta") {
      await sb.from("op_ordens").update({ status: "em_andamento" }).eq("id", ordemId);
    }
    invalidar();
  }

  async function avancar() {
    if (!podeEditar || !ordem) return;
    const pendentes = itens.filter((i) => !i.concluido).length;
    if (pendentes > 0) {
      const ok = window.confirm(
        `Ainda há ${pendentes} etapa(s) não marcada(s) em ${nomeSetor(setorAtualId)}. Avançar mesmo assim?`,
      );
      if (!ok) return;
    }
    setSalvando(true);
    const agora = new Date().toISOString();
    try {
      if (setorAtualId) {
        await sb
          .from("op_ordem_setores")
          .update({ status: "concluido", concluido_em: agora })
          .eq("ordem_id", ordemId)
          .eq("setor_id", setorAtualId);
        await sb
          .from("op_ordem_apontamentos")
          .update({ finalizado_em: agora, observacoes: obs || null })
          .eq("ordem_id", ordemId)
          .is("finalizado_em", null);
      }
      if (proximo) {
        await garantirChecklist(ordemId, proximo.setor_id);
        await sb
          .from("op_ordem_setores")
          .update({ status: "em_andamento", iniciado_em: agora })
          .eq("id", proximo.id);
        await sb
          .from("op_ordens")
          .update({ setor_id: proximo.setor_id, status: "em_andamento" })
          .eq("id", ordemId);
        await sb.from("op_ordem_apontamentos").insert({
          ordem_id: ordemId,
          etapa_id: null,
          executado_por: user?.id ?? null,
        });
        toast.success(`Avançou para ${nomeSetor(proximo.setor_id)}`);
      } else {
        await sb.from("op_ordens").update({ status: "finalizada" }).eq("id", ordemId);
        toast.success("Ordem concluída");
      }
      setObs("");
      invalidar();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao avançar");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            OP-{ordem.numero} · {ordem.titulo}
          </DialogTitle>
          <DialogDescription>
            {nomeSetor(setorAtualId)} · {ordem.quantidade ?? "—"} {ordem.tipo_unidade ?? ""}
            {ordem.evento_ref ? ` · ${ordem.evento_ref}` : ""}
            {ordem.prazo ? ` · prazo ${fmtData(ordem.prazo)}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {ordem.descricao && (
            <div className="text-sm whitespace-pre-wrap bg-muted/40 rounded p-2">{ordem.descricao}</div>
          )}

          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Progresso do processo</span>
              <span>
                {prog.concluidos}/{prog.total} setores · {prog.pct}%
              </span>
            </div>
            <div className="h-2 w-full rounded bg-muted overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${prog.pct}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {roteiro.map((r) => (
                <span
                  key={r.id}
                  className={`text-[10px] rounded-full border px-2 py-0.5 ${
                    r.status === "concluido"
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                      : r.setor_id === setorAtualId
                        ? "bg-primary/10 text-primary border-primary/30"
                        : "text-muted-foreground"
                  }`}
                >
                  {nomeSetor(r.setor_id)}
                </span>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs uppercase text-muted-foreground mb-2">
              Checklist · {nomeSetor(setorAtualId)} ({prog.itensFeitos}/{prog.itensTotal})
            </div>
            {itens.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                Nenhuma etapa configurada para este setor.
              </div>
            ) : (
              <ul className="space-y-1.5">
                {itens.map((i) => (
                  <li key={i.id} className="flex items-start gap-2 rounded border p-2">
                    <Checkbox
                      checked={i.concluido}
                      disabled={!podeEditar || finalizada}
                      onCheckedChange={(v) => toggleItem(i, !!v)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm ${i.concluido ? "line-through text-muted-foreground" : ""}`}>
                        {i.nome}
                      </div>
                      {i.concluido_em && (
                        <div className="text-[11px] text-muted-foreground">
                          concluído em {fmtData(i.concluido_em)}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {podeEditar && !finalizada && (
            <div className="space-y-2">
              <Label>Observação do setor (opcional)</Label>
              <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          {podeEditar && !finalizada && (
            <Button onClick={avancar} disabled={salvando}>
              {proximo ? (
                <>
                  <ArrowRight className="h-4 w-4 mr-1" /> Avançar para {nomeSetor(proximo.setor_id)}
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Concluir OP
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
