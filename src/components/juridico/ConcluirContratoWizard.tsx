import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EventoFormFields, type EventoFormBase } from "@/components/eventos/EventoFormFields";
import { VendaFormFields } from "@/components/comercial/VendaFormFields";
import {
  buildVendaDbPayload, emptyVendaForm, todayIso, type VendaFormState,
} from "@/lib/comercial/venda-form";
import { calcularDerivados } from "@/lib/comercial/comissao";
import { useVendedores, useCerimoniais } from "@/lib/comercial/cadastros";
import { useServerFn } from "@tanstack/react-start";
import { criarPastasContrato } from "@/lib/juridico/dropbox.functions";
import {
  SUBPASTAS, caminhoPastaEvento, nomePastaEvento, pastaFromContrato, RAIZ_PADRAO,
  type PastaContratoInput,
} from "@/lib/juridico/dropbox-paths";

const sb = supabase as any;

const STEPS = ["Cadastro no calendário", "Cadastro em Vendas", "Pastas no Dropbox"];

/** Categoria do contrato → tipo do evento / classificação da venda. */
function categoriaLabel(categoria?: string | null): string {
  switch ((categoria ?? "").toLowerCase()) {
    case "stand": return "Stand";
    case "corporativo": return "Corporativo";
    case "cenografia": return "Cenografia";
    case "social": return "Social";
    default: return "Social";
  }
}

type EventoForm = EventoFormBase & {
  data_montagem: string;
  data_montagem_fim: string;
  data_desmontagem: string;
  data_desmontagem_fim: string;
  hora_montagem: string;
  hora_desmontagem: string;
};

function eventoFormFromContrato(c: any): EventoForm {
  return {
    nome: c?.titulo ?? "",
    local: c?.cliente_cidade ? "" : "",
    cidade: c?.cliente_cidade ?? "",
    uf: c?.cliente_uf ?? "",
    tipo: categoriaLabel(c?.categoria),
    data_evento: c?.evento_inicio ?? "",
    data_evento_fim: c?.evento_fim ?? c?.evento_inicio ?? "",
    observacoes: c?.observacoes ?? "",
    situacao: "Em Aprovação",
    data_montagem: c?.montagem_inicio ?? "",
    data_montagem_fim: c?.montagem_fim ?? "",
    data_desmontagem: c?.desmontagem_inicio ?? "",
    data_desmontagem_fim: c?.desmontagem_fim ?? "",
    hora_montagem: c?.montagem_hora_inicio ?? "",
    hora_desmontagem: c?.desmontagem_hora_inicio ?? "",
  };
}

function vendaFormFromContrato(c: any): VendaFormState {
  return {
    ...emptyVendaForm(),
    data_registro: todayIso(),
    data_evento: c?.evento_inicio ?? "",
    nome_evento: c?.titulo ?? "",
    cidade: c?.cliente_cidade ?? "",
    estado: c?.cliente_uf ?? "",
    classificacao: categoriaLabel(c?.categoria),
    consultor: c?.responsavel ?? "",
    empresa: c?.empresa ?? "",
    valor_proposta: Number(c?.valor ?? 0) || 0,
  };
}

/**
 * Assistente exibido ao mover um contrato para Concluído:
 * 1) cadastra o evento no calendário, 2) cadastra a venda no comercial.
 */
export function ConcluirContratoWizard({
  contrato,
  open,
  onOpenChange,
  onConcluir,
  onFinalizado,
}: {
  contrato: any | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Aplica o status "concluido" no contrato, com os vínculos criados. */
  onConcluir: (patch: Record<string, any>) => Promise<void>;
  onFinalizado: () => void;
}) {
  const [step, setStep] = useState(0);
  const [ev, setEv] = useState<EventoForm>(() => eventoFormFromContrato(contrato));
  const [venda, setVenda] = useState<VendaFormState>(() => vendaFormFromContrato(contrato));
  const [salvando, setSalvando] = useState(false);
  const [eventoId, setEventoId] = useState<string | null>(null);
  const [pasta, setPasta] = useState<PastaContratoInput>(() => pastaFromContrato(contrato));
  const [pastaCriada, setPastaCriada] = useState<{ path: string; url: string | null } | null>(null);
  const criarPastas = useServerFn(criarPastasContrato);

  const { data: vendedores = [] } = useVendedores();
  const { data: cerimoniais = [] } = useCerimoniais();

  useEffect(() => {
    if (!open || !contrato) return;
    setStep(0);
    setEventoId(null);
    setPastaCriada(null);
    setEv(eventoFormFromContrato(contrato));
    setVenda(vendaFormFromContrato(contrato));
    setPasta(pastaFromContrato(contrato));
  }, [open, contrato?.id]);

  const derived = useMemo(
    () =>
      calcularDerivados(
        {
          valor_proposta: venda.valor_proposta,
          desconto: venda.desconto,
          consultor: venda.consultor,
          cerimonial: venda.cerimonial,
        },
        vendedores as any,
        cerimoniais as any,
      ),
    [venda, vendedores, cerimoniais],
  );

  async function criarEvento(): Promise<string | null> {
    if (!ev.nome.trim()) { toast.error("Informe o nome do evento"); return null; }
    if (!ev.data_evento) { toast.error("Informe a data inicial do evento"); return null; }
    if (!ev.data_evento_fim) { toast.error("Informe a data final do evento"); return null; }

    const payload: any = {
      nome: ev.nome.trim(),
      local: ev.local || null,
      cidade: ev.cidade || null,
      uf: ev.uf || null,
      tipo: ev.tipo || null,
      data_evento: ev.data_evento,
      data_evento_fim: ev.data_evento_fim,
      observacoes: ev.observacoes || null,
      situacao: ev.situacao || null,
      data_montagem: ev.data_montagem || null,
      data_montagem_fim: ev.data_montagem_fim || null,
      data_desmontagem: ev.data_desmontagem || null,
      data_desmontagem_fim: ev.data_desmontagem_fim || null,
      hora_montagem: ev.hora_montagem || null,
      hora_desmontagem: ev.hora_desmontagem || null,
    };

    for (let tentativa = 0; tentativa < 3; tentativa++) {
      const { data: codigo, error: codErr } = await sb.rpc("proximo_codigo_evento", { _data: ev.data_evento });
      if (codErr) { toast.error(codErr.message); return null; }
      const { data, error } = await sb
        .from("eventos")
        .insert({ ...payload, codigo, origem: "juridico" })
        .select("id")
        .single();
      if (!error) return data?.id ?? null;
      const msg = String(error.message ?? "");
      if (error.code === "23505" && /eventos_codigo_key/.test(msg)) continue;
      if (error.code === "23505" && /ux_eventos_codigo/.test(msg)) {
        toast.error("Já existe um evento com este nome e local nesta data final.");
        return null;
      }
      toast.error(msg || "Erro ao criar evento");
      return null;
    }
    toast.error("Não foi possível gerar um código único para o evento.");
    return null;
  }

  async function confirmarEvento() {
    setSalvando(true);
    try {
      const id = await criarEvento();
      if (!id) return;
      setEventoId(id);
      await onConcluir({ status: "concluido", evento_id: id });
      toast.success("Evento cadastrado no calendário");
      setStep(1);
    } finally {
      setSalvando(false);
    }
  }

  async function pularEvento() {
    setSalvando(true);
    try {
      await onConcluir({ status: "concluido" });
      setStep(1);
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarVenda() {
    if (!venda.nome_evento.trim()) return toast.error("Informe o nome do evento");
    setSalvando(true);
    try {
      const payload = buildVendaDbPayload(venda, derived);
      const { data, error } = await sb
        .from("comercial_vendas")
        .insert({ ...payload, source: "juridico" })
        .select("id")
        .single();
      if (error) { toast.error(error.message); return; }
      await onConcluir({
        status: "concluido",
        venda_id: data?.id ?? null,
        ...(eventoId ? { evento_id: eventoId } : {}),
      });
      toast.success("Venda cadastrada no comercial");
      setStep(2);
    } finally {
      setSalvando(false);
    }
  }

  function pularVenda() {
    setStep(2);
  }

  function fechar() {
    onOpenChange(false);
    onFinalizado();
  }

  async function confirmarPastas() {
    if (!pasta.nomeEvento.trim()) return toast.error("Informe o nome do evento");
    if (!pasta.ano.trim() || !pasta.mes.trim()) return toast.error("Informe ano e mês da pasta");
    setSalvando(true);
    try {
      const res = await criarPastas({
        data: { contratoId: contrato.id, caminho: caminhoPastaEvento(pasta), enviarAnexos: true },
      });
      setPastaCriada({ path: res.path, url: res.url ?? null });
      toast.success(
        res.enviados.length
          ? `Pastas criadas e ${res.enviados.length} arquivo(s) enviados`
          : "Pastas criadas no Dropbox",
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao criar pastas no Dropbox");
    } finally {
      setSalvando(false);
    }
  }

  if (!contrato) return null;

  const jaTemEvento = !!contrato.evento_id;
  const jaTemVenda = !!contrato.venda_id;
  const caminhoPreview = caminhoPastaEvento(pasta);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !salvando) onOpenChange(false); }}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Concluir contrato — {STEPS[step]}</DialogTitle>
          <DialogDescription>
            Revise os dados pré-preenchidos a partir do contrato e confirme cada cadastro.
          </DialogDescription>
        </DialogHeader>

        <Progress value={((step + 1) / STEPS.length) * 100} className="mb-3" />

        {step === 0 && (
          <div className="space-y-4">
            {jaTemEvento && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
                Este contrato já gerou um evento no calendário. Confirmar criará um novo registro.
              </div>
            )}
            <EventoFormFields f={ev} setF={setEv} />
            <div className="rounded-md border p-4 space-y-4">
              <div className="text-sm font-semibold">Montagem e desmontagem</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Montagem — data inicial</Label>
                  <Input type="date" value={ev.data_montagem} onChange={(e) => setEv((p) => ({ ...p, data_montagem: e.target.value }))} />
                </div>
                <div>
                  <Label>Montagem — data final</Label>
                  <Input type="date" value={ev.data_montagem_fim} onChange={(e) => setEv((p) => ({ ...p, data_montagem_fim: e.target.value }))} />
                </div>
                <div>
                  <Label>Hora da montagem</Label>
                  <Input type="time" value={ev.hora_montagem} onChange={(e) => setEv((p) => ({ ...p, hora_montagem: e.target.value }))} />
                </div>
                <div>
                  <Label>Desmontagem — data inicial</Label>
                  <Input type="date" value={ev.data_desmontagem} onChange={(e) => setEv((p) => ({ ...p, data_desmontagem: e.target.value }))} />
                </div>
                <div>
                  <Label>Desmontagem — data final</Label>
                  <Input type="date" value={ev.data_desmontagem_fim} onChange={(e) => setEv((p) => ({ ...p, data_desmontagem_fim: e.target.value }))} />
                </div>
                <div>
                  <Label>Hora da desmontagem</Label>
                  <Input type="time" value={ev.hora_desmontagem} onChange={(e) => setEv((p) => ({ ...p, hora_desmontagem: e.target.value }))} />
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            {jaTemVenda && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
                Este contrato já gerou uma venda. Confirmar criará um novo registro.
              </div>
            )}
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              <VendaFormFields form={venda} setForm={setVenda} derived={derived} />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 mt-2">
          {step === 0 ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
                Cancelar
              </Button>
              <Button variant="ghost" onClick={pularEvento} disabled={salvando}>
                Pular cadastro do evento
              </Button>
              <Button onClick={confirmarEvento} disabled={salvando}>
                {salvando ? "Salvando…" : "Cadastrar evento e avançar"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={pularVenda} disabled={salvando}>
                Pular cadastro da venda
              </Button>
              <Button onClick={confirmarVenda} disabled={salvando}>
                {salvando ? "Salvando…" : "Cadastrar venda e concluir"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
