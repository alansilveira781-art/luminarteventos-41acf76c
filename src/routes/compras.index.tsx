import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePersistedState } from "@/hooks/usePersistedState";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, ChevronRight, ArrowRightLeft } from "lucide-react";
import { CompraDialog } from "@/components/CompraDialog";
import { COMPRA_STATUSES, canEditCompra, canMoveCompra, compraBackStatus, isNatanaelShortcut, moveBlockedMessage, nextCompraStatus, PEDRO_EMAIL, PEDRO_MOVE_BLOCKED_MSG, type CompraStatus } from "@/lib/compras";
import { Checkbox } from "@/components/ui/checkbox";

import { useTiposDespesa } from "@/hooks/useTiposDespesa";
import { statusPagamentos, formatBRL, type PagamentoLinha, type StatusPagamentos } from "@/lib/pagamentos";
import { KanbanFilters, applyKanbanFilters, type FieldDef, type Filters } from "@/components/KanbanFilters";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { AvancarCardDialog } from "@/components/AvancarCardDialog";
import { PrazoDot } from "@/components/PrazoDot";
import { prazoVigente } from "@/lib/prazo";

import { notifyResponsavel } from "@/lib/notify";

const sb = supabase as any;

export const Route = createFileRoute("/compras/")({
  component: ComprasKanban,
});

type Origem = "compra" | "demanda";

type Compra = {
  id: string;
  origem: Origem;
  numero: number | null;
  status: CompraStatus;
  titulo: string | null;
  solicitante: string | null;
  solicitante_id: string | null;
  fornecedor: string | null;
  comprador: string | null;
  data_solicitacao: string | null;
  data_compra: string | null;
  data_servico: string | null;
  valor_total: number | null;
  prazo?: string | null;
  prazo_aprovacao?: string | null;

  responsavel_id: string | null;
  responsavel_nome: string | null;
  tipo_compra: string | null;
  tipo_demanda?: string | null;
  created_by: string | null;
};

const codigoCard = (c: { origem: Origem; numero: number | null }) =>
  c.numero != null ? `${c.origem === "demanda" ? "DEMANDA" : "COMPRA"}-${c.numero}` : "—";

function ComprasKanban() {
  const qc = useQueryClient();
  const { user, isAdmin: isGlobalAdmin, modulos } = useAuth();
  const isAdmin = isGlobalAdmin || modulos.some((m) => m.slug === "compras" && m.is_admin);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<CompraStatus>("solicitacao");
  // Card de Aquisição (tabela demandas)
  const [openDemanda, setOpenDemanda] = useState(false);
  const [editDemandaId, setEditDemandaId] = useState<string | null>(null);
  const [escolherTipo, setEscolherTipo] = useState<CompraStatus | null>(null);
  const [q, setQ] = useState<string>(""); const qd = useDebouncedValue(q, 300);
  const [filters, setFilters] = usePersistedState<Filters>("compras.kanban", {});
  const [migrarCompra, setMigrarCompra] = useState<Compra | null>(null);

  // Abre o card automaticamente quando a URL tem ?id=...
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) {
      setEditId(id);
      setOpen(true);
    }
  }, []);



  const { data: compras = [] } = useQuery({
    queryKey: ["compras"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("compras")
        .select("id,numero,status,titulo,solicitante,solicitante_id,fornecedor,comprador,data_solicitacao,data_compra,data_servico,prazo,prazo_aprovacao,valor_total,responsavel_id,responsavel_nome,tipo_compra,numero_nf,numeros_nf,tem_nf,empresa_faturada,created_by")

        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Compra[];
    },
  });

  // Aquisições (tabela demandas) ainda em aberto — passam a viver no Quadro de Compras
  const { data: demandasAbertas = [] } = useQuery({
    queryKey: ["compras", "demandas-abertas"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("demandas")
        .select("id,numero,status,titulo,solicitante,fornecedor,comprador,data_solicitacao,data_compra,prazo,valor_total,tipo_demanda,responsavel_id,responsavel_nome,created_by")
        .not("status", "in", "(finalizado,negada)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const cards = useMemo<Compra[]>(
    () => [
      ...(compras ?? []).map((c: any) => ({ ...c, origem: "compra" as const })),
      ...(demandasAbertas ?? []).map((d: any) => ({
        ...d,
        origem: "demanda" as const,
        solicitante_id: null,
        data_servico: null,
        tipo_compra: null,
      })),
    ],
    [compras, demandasAbertas],
  );

  const { data: pagamentosRows = [] } = useQuery({
    queryKey: ["compras", "pagamentos-quadro"],
    queryFn: async () => {
      const { data } = await sb
        .from("compra_pagamentos")
        .select("compra_id,forma,valor,parcelamento,data_pagamento,pago,pago_em");
      return (data ?? []) as any[];
    },
    staleTime: 30 * 1000,
  });

  const { data: pagamentosDemandaRows = [] } = useQuery({
    queryKey: ["compras", "pagamentos-quadro-demandas"],
    queryFn: async () => {
      const { data } = await sb
        .from("demanda_pagamentos")
        .select("demanda_id,forma,valor,parcelamento,data_pagamento,pago,pago_em");
      return (data ?? []) as any[];
    },
    staleTime: 30 * 1000,
  });

  const pagamentosPorCompra = useMemo(() => {
    const m = new Map<string, StatusPagamentos>();
    const grouped = new Map<string, PagamentoLinha[]>();
    const add = (id: string, p: any) => {
      const arr = grouped.get(id) ?? [];
      arr.push({
        forma: p.forma ?? null,
        valor: Number(p.valor ?? 0),
        parcelamento: p.parcelamento ?? null,
        data_pagamento: p.data_pagamento ?? null,
        pago: !!p.pago,
        pago_em: p.pago_em ?? null,
      });
      grouped.set(id, arr);
    };
    for (const p of pagamentosRows) add(p.compra_id, p);
    for (const p of pagamentosDemandaRows) add(p.demanda_id, p);
    grouped.forEach((linhas, id) => m.set(id, statusPagamentos(linhas)));
    return m;
  }, [pagamentosRows, pagamentosDemandaRows]);


  const { data: statusDefaults = [] } = useQuery({
    queryKey: ["compras_status_defaults"],
    queryFn: async () => {
      const { data } = await sb
        .from("compras_status_defaults")
        .select("status, responsavel_id, responsavel_nome");
      return (data ?? []) as { status: CompraStatus; responsavel_id: string | null; responsavel_nome: string | null }[];
    },
    staleTime: 1000 * 60 * 5,
  });

  // Responsáveis padrão das Aquisições (tabela demandas)
  const { data: statusDefaultsDemanda = [] } = useQuery({
    queryKey: ["financeiro_status_defaults"],
    queryFn: async () => {
      const { data } = await sb
        .from("financeiro_status_defaults")
        .select("status, responsavel_id, responsavel_nome");
      return (data ?? []) as { status: CompraStatus; responsavel_id: string | null; responsavel_nome: string | null }[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const responsavelDoStatus = (status?: CompraStatus | null): string | null => {
    if (!status) return null;
    const def = statusDefaults.find((d) => d.status === status && d.responsavel_id);
    return def?.responsavel_id ?? null;
  };

  const statusMoveBlockedMessage = (target?: CompraStatus | null) => {
    if (!target) return "Movimentação não permitida para este card.";
    const targetLabel = COMPRA_STATUSES.find((s) => s.key === target)?.label ?? target;
    const respNomeDest = statusDefaults.find((d) => d.status === target)?.responsavel_nome;
    return respNomeDest
      ? `Apenas ${respNomeDest} ou o responsável pelo status atual pode mover para "${targetLabel}".`
      : `Apenas o responsável pelo status atual pode mover para "${targetLabel}".`;
  };

  const filterFields = useMemo<FieldDef<Compra>[]>(() => [
    { key: "status", label: "Status", type: "multi", getValue: (r) => r.status, formatValue: (v) => COMPRA_STATUSES.find((s) => s.key === v)?.label ?? v },
    { key: "origem", label: "Origem", type: "multi", getValue: (r) => (r.origem === "demanda" ? "Aquisição" : "Compra") },
    { key: "fornecedor", label: "Fornecedor", type: "multi", getValue: (r) => r.fornecedor },
    { key: "solicitante", label: "Solicitante", type: "multi", getValue: (r) => r.solicitante },
    { key: "comprador", label: "Comprador", type: "multi", getValue: (r) => r.comprador },
    { key: "responsavel_nome", label: "Responsável", type: "multi", getValue: (r) => r.responsavel_nome },
    { key: "tipo_compra", label: "Tipo", type: "multi", getValue: (r) => r.tipo_compra ?? r.tipo_demanda },
    { key: "empresa_faturada", label: "Empresa faturada", type: "multi", getValue: (r) => (r as any).empresa_faturada },
    { key: "tem_nf", label: "Tem NF", type: "multi", getValue: (r) => ((r as any).tem_nf === false ? "Não" : (r as any).tem_nf === true ? "Sim" : null) },
    { key: "data_compra", label: "Data de compra", type: "date-range", getValue: (r) => r.data_compra },
    { key: "data_servico", label: "Data de serviço", type: "date-range", getValue: (r) => r.data_servico },
    { key: "valor_total", label: "Valor total", type: "number-range", getValue: (r) => r.valor_total },
  ], []);

  const filteredCompras = useMemo(() => {
    let base = applyKanbanFilters(cards, filters, filterFields);
    const s = qd.toLowerCase().trim();
    if (!s) return base;
    return base.filter((c) => {
      const num = codigoCard(c).toLowerCase();
      return [num, String(c.numero ?? ""), c.titulo, c.solicitante, c.fornecedor, c.comprador]
        .some((v) => String(v ?? "").toLowerCase().includes(s));
    });
  }, [cards, qd, filters, filterFields]);


  const byStatus = useMemo(() => {
    const m: Record<CompraStatus, Compra[]> = {} as any;
    COMPRA_STATUSES.forEach((s) => (m[s.key] = []));
    filteredCompras.forEach((c) => {
      (m[c.status] ??= []).push(c);
    });
    return m;
  }, [filteredCompras]);

  const [pendingMove, setPendingMove] = useState<{ id: string; status: CompraStatus; titulo: string; prazo?: string } | null>(null);


  const moveStatus = useMutation({
    mutationFn: async (vars: { id: string; status: CompraStatus; responsavelId?: string; responsavelNome?: string; prazo?: string }) => {
      const { error } = await sb.rpc("move_compra_status", {
        p_id: vars.id,
        p_status: vars.status,
        p_responsavel_id: vars.responsavelId ?? null,
        p_responsavel_nome: vars.responsavelNome ?? null,
        p_prazo: vars.prazo ?? null,
      } as any);
      if (error) throw error;
    },
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ["compras"] });
      const prev = qc.getQueryData<Compra[]>(["compras"]);
      qc.setQueryData<Compra[]>(["compras"], (old) =>
        (old ?? []).map((c) => (c.id === id ? { ...c, status } : c)),
      );
      return { prev };
    },
    onError: (e: any, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["compras"], ctx.prev);
      qc.invalidateQueries({ queryKey: ["compras"] });
      const msg = String(e?.message ?? "").trim();
      toast.error(msg || "Você não tem permissão para mover este card, ou a ação foi bloqueada.");
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["compras-receber"] });
    },
  });

  const moveDemandaStatus = useMutation({
    mutationFn: async (vars: { id: string; status: CompraStatus; responsavelId?: string | null; responsavelNome?: string | null }) => {
      const patch: any = { status: vars.status };
      if (vars.responsavelId) {
        patch.responsavel_id = vars.responsavelId;
        patch.responsavel_nome = vars.responsavelNome ?? null;
      }
      const { error } = await sb.from("demandas").update(patch).eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["compras", "demandas-abertas"] });
      qc.invalidateQueries({ queryKey: ["demandas"] });
      qc.invalidateQueries({ queryKey: ["demandas-receber"] });
    },
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Movimentação de cards de Aquisição (tabela demandas), com as mesmas regras
  // do antigo Quadro de Aquisições (inclusive comunicação com Estoque/Patrimônio).
  async function advanceDemanda(
    card: Compra,
    status: CompraStatus,
    opts?: { force?: boolean; toastMsg?: string; silent?: boolean },
  ): Promise<{ ok: boolean; motivo?: string }> {
    const fail = (motivo: string) => {
      if (!opts?.silent) toast.error(motivo);
      return { ok: false, motivo };
    };
    if (card.status === status) return { ok: true };
    if (status === "a_receber" && !tiposDespesa.vaiParaRecebimento(card.tipo_demanda)) {
      return fail('Este tipo de aquisição não gera recebimento em Estoque ou Patrimônio, então não pode ir para "A Receber".');
    }
    const titulo = card.titulo || card.fornecedor || `Aquisição ${card.numero ?? ""}`;
    const statusLabel = COMPRA_STATUSES.find((s) => s.key === status)?.label || status;
    const def = statusDefaultsDemanda.find((d) => d.status === status && d.responsavel_id);
    try {
      await moveDemandaStatus.mutateAsync({
        id: card.id,
        status,
        responsavelId: def?.responsavel_id ?? null,
        responsavelNome: def?.responsavel_nome ?? null,
      });
    } catch (e: any) {
      return fail(String(e?.message ?? "Não foi possível mover o card."));
    }
    if (def?.responsavel_id) {
      notifyResponsavel({
        userId: def.responsavel_id,
        titulo: `Aquisição: ${statusLabel}`,
        mensagem: titulo,
        link: `/compras?id=${card.id}`,
        tipo: "compra_responsavel",
      }).catch(() => {});
    }
    if (!opts?.silent) toast.success(opts?.toastMsg ?? "Card movido.");
    return { ok: true };
  }

  async function advanceToStatus(
    compra: Compra,
    status: CompraStatus,
    opts?: { force?: boolean; toastMsg?: string; prazo?: string; silent?: boolean },
  ): Promise<{ ok: boolean; motivo?: string }> {
    const fail = (motivo: string) => {
      if (!opts?.silent) toast.error(motivo);
      return { ok: false, motivo };
    };
    if (compra.status === status) return { ok: true };
    if (compra.origem === "demanda") return advanceDemanda(compra, status, opts);


    if (!canMoveCompra(compra, user?.id, isAdmin, user?.email, status, compra.status, responsavelDoStatus(status), responsavelDoStatus(compra.status))) {
      const isPedro = !!user?.email && user.email.trim().toLowerCase() === PEDRO_EMAIL;
      const respIdDest = responsavelDoStatus(status);
      return fail(
        isPedro
          ? PEDRO_MOVE_BLOCKED_MSG
          : respIdDest
          ? statusMoveBlockedMessage(status)
          : moveBlockedMessage(compra),
      );
    }


    if (status === "pendente_aprovacao") {
      const { data: itensEvento, error: itensErr } = await sb
        .from("compra_itens")
        .select("id,evento_projeto")
        .eq("compra_id", compra.id);
      if (itensErr) {
        return fail("Não foi possível validar os itens da compra. Tente novamente.");
      }
      if (!itensEvento || itensEvento.length === 0) {
        return fail("Adicione os itens da compra (com Evento / Projeto) antes de enviar para Pendente Aprovação.");
      }
      const semEvento = itensEvento.filter((it: any) => !String(it.evento_projeto ?? "").trim()).length;
      if (semEvento > 0) {
        return fail(
          `Preencha o Evento / Projeto de todos os itens antes de enviar para Pendente Aprovação (${semEvento} item(ns) sem evento).`,
        );
      }
    }



    if (status === "a_receber") {
      if (!compra.tipo_compra) {
        return fail("Defina o tipo da compra antes de movê-la para Compras a Receber.");
      }
      if ((compra as any).tem_nf !== false) {
        const nfs = ((compra as any).numeros_nf as string[] | null) ?? [];
        const hasNf = nfs.some((n) => (n ?? "").trim()) || !!String((compra as any).numero_nf ?? "").trim();
        if (!hasNf) {
          return fail("Adicione pelo menos uma NF antes de mover para Compras a Receber (ou desmarque \"Tem NF\").");
        }
      }
      if (!(compra as any).empresa_faturada) {
        return fail("Informe a empresa faturada antes de mover para Compras a Receber.");
      }
    }

    const oldIdx = COMPRA_STATUSES.findIndex((s) => s.key === compra.status);
    const newIdx = COMPRA_STATUSES.findIndex((s) => s.key === status);
    const isAdvance = newIdx > oldIdx;
    const id = compra.id;
    const statusLabel = COMPRA_STATUSES.find((s) => s.key === status)?.label || status;
    const titulo = compra.titulo || compra.fornecedor || `Compra ${compra.numero ?? ""}`;

    if (isAdvance) {
      const def = statusDefaults.find((d) => d.status === status && d.responsavel_id);
      if (def?.responsavel_id) {
        try {
          await moveStatus.mutateAsync({
            id,
            status,
            responsavelId: def.responsavel_id,
            responsavelNome: def.responsavel_nome ?? undefined,
            prazo: opts?.prazo,
          });
        } catch (e: any) {
          return { ok: false, motivo: String(e?.message ?? "Movimentação bloqueada.") };
        }
        notifyResponsavel({
          userId: def.responsavel_id,
          titulo: `Compra: ${statusLabel}`,
          mensagem: titulo,
          link: `/compras?id=${id}`,
          tipo: "compra_responsavel",
        }).catch(() => {});
        if (!opts?.silent) toast.success(opts?.toastMsg ?? `Card movido. ${def.responsavel_nome ?? "Responsável"} foi notificado.`);
        return { ok: true };
      }
      if (opts?.force) {
        try {
          await moveStatus.mutateAsync({ id, status, prazo: opts?.prazo });
        } catch (e: any) {
          return { ok: false, motivo: String(e?.message ?? "Movimentação bloqueada.") };
        }
        if (!opts?.silent) toast.success(opts.toastMsg ?? "Card movido.");
        return { ok: true };
      }
      setPendingMove({ id, status, titulo, prazo: opts?.prazo });
      return { ok: true };
    }

    try {
      await moveStatus.mutateAsync({ id, status, prazo: opts?.prazo });
    } catch (e: any) {
      return { ok: false, motivo: String(e?.message ?? "Movimentação bloqueada.") };
    }
    return { ok: true };
  }

  // ---- Seleção múltipla / ações em massa ----
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTarget, setBulkTarget] = useState<CompraStatus | "">("");
  const [bulkBusy, setBulkBusy] = useState(false);

  const toggleSelect = (id: string) =>
    setSelectedIds((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const selectedCompras = useMemo(
    () => cards.filter((c) => selectedIds.has(c.id)),
    [cards, selectedIds],
  );
  const selectedTotal = useMemo(
    () => selectedCompras.reduce((acc, c) => acc + Number(c.valor_total ?? 0), 0),
    [selectedCompras],
  );
  const todosPendentes =
    selectedCompras.length > 0 && selectedCompras.every((c) => c.status === "pendente_aprovacao");

  async function runBulk(target: CompraStatus) {
    if (selectedCompras.length === 0) return;
    setBulkBusy(true);
    let ok = 0;
    const motivos: string[] = [];
    for (const c of selectedCompras) {
      const atual = cards.find((x) => x.id === c.id) ?? c;
      const r = await advanceToStatus(atual, target, { force: true, silent: true });
      if (r.ok) ok++;
      else if (r.motivo && !motivos.includes(r.motivo)) motivos.push(r.motivo);
    }
    setBulkBusy(false);
    setSelectedIds(new Set());
    qc.invalidateQueries({ queryKey: ["compras"] });
    const bloqueados = selectedCompras.length - ok;
    if (bloqueados === 0) toast.success(`${ok} card(s) movido(s).`);
    else
      toast.warning(`${ok} movido(s), ${bloqueados} bloqueado(s).`, {
        description: motivos.slice(0, 2).join(" "),
      });
  }

  function abrirCard(c: Compra) {
    if (c.origem === "demanda") {
      setEditDemandaId(c.id);
      setOpenDemanda(true);
      return;
    }
    setEditId(c.id);
    setOpen(true);
  }

  async function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;
    let status: CompraStatus | undefined;
    if (COMPRA_STATUSES.some((s) => s.key === overId)) {
      status = overId as CompraStatus;
    } else {
      const overCompra = cards.find((c) => c.id === overId);
      status = overCompra?.status;
    }
    if (!status) return;
    const compra = cards.find((c) => c.id === id);
    if (!compra) return;
    if (
      compra.origem === "compra" &&
      !canMoveCompra(compra, user?.id, isAdmin, user?.email, status, compra.status, responsavelDoStatus(status), responsavelDoStatus(compra.status))
    ) {
      const isPedro = !!user?.email && user.email.trim().toLowerCase() === PEDRO_EMAIL;
      const respIdDest = responsavelDoStatus(status);
      toast.error(
        isPedro
          ? PEDRO_MOVE_BLOCKED_MSG
          : respIdDest
          ? statusMoveBlockedMessage(status)
          : moveBlockedMessage(compra),
      );
      return;
    }

    await advanceToStatus(compra, status);
  }


  return (
    <>
      <PageHeader
        title="Compras"
        description="Arraste os cards entre as colunas para alterar o status"
        actions={
          <Button onClick={() => setEscolherTipo("solicitacao")}>
            <Plus className="h-4 w-4 mr-1" /> Nova compra
          </Button>
        }
      />

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código (ex: 12), título, fornecedor, solicitante…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <KanbanFilters rows={cards} fields={filterFields} value={filters} onChange={setFilters} />
      </div>

      {selectedIds.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
          <span className="font-medium">{selectedIds.size} card(s) selecionado(s)</span>
          <span className="rounded bg-background/70 px-2 py-0.5 font-semibold">
            Total: {formatBRL(selectedTotal)}
          </span>
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <Select value={bulkTarget} onValueChange={(v) => setBulkTarget(v as CompraStatus)}>
              <SelectTrigger className="h-8 w-56">
                <SelectValue placeholder="Mover para..." />
              </SelectTrigger>
              <SelectContent>
                {COMPRA_STATUSES.map((s) => (
                  <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={!bulkTarget || bulkBusy}
              onClick={() => bulkTarget && runBulk(bulkTarget as CompraStatus)}
            >
              Mover selecionados
            </Button>
            {todosPendentes && (
              <Button size="sm" variant="secondary" disabled={bulkBusy} onClick={() => runBulk("aprovada")}>
                Aprovar selecionados
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              Limpar
            </Button>
          </div>
        </div>
      )}


      {q.trim() ? (
        <div className="rounded-lg border border-border bg-card divide-y divide-border max-h-[calc(100vh-180px)] overflow-auto">
          {filteredCompras.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground text-center">Nenhum card encontrado.</div>
          )}
          {filteredCompras.map((c) => {
            const statusInfo = COMPRA_STATUSES.find((s) => s.key === c.status);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => abrirCard(c)}
                className="w-full text-left p-3 hover:bg-muted/50 flex items-center gap-3 text-sm"
              >
                <span className="text-[11px] font-mono text-muted-foreground w-28 shrink-0">
                  {codigoCard(c)}
                </span>
                <span className="flex-1 min-w-0 truncate font-medium">
                  {c.titulo || c.fornecedor || (c.origem === "demanda" ? "Aquisição sem título" : "Compra sem título")}
                </span>
                <span className="hidden sm:block text-xs text-muted-foreground truncate w-32">
                  {c.fornecedor || "—"}
                </span>
                <span className="hidden md:block text-xs text-muted-foreground truncate w-32">
                  {c.solicitante || "—"}
                </span>
                {statusInfo && (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                    <span className={`h-2 w-2 rounded-full ${statusInfo.color}`} />
                    <span className="hidden sm:inline">{statusInfo.label}</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto overflow-y-hidden pb-4 items-stretch h-[calc(100dvh-200px)] min-h-[420px]">
          {COMPRA_STATUSES.map((s) => (
            <Column key={s.key} statusKey={s.key} label={s.label} color={s.color} count={byStatus[s.key]?.length ?? 0}>
              {(byStatus[s.key] ?? []).map((c) => {
                const isDemanda = c.origem === "demanda";
                const next = isDemanda
                  ? proximoStatusDemanda(c.status, c.tipo_demanda ?? null, tiposDespesa.paraRecebimento)
                  : nextCompraStatus(c.status);
                const back = compraBackStatus(c.status);
                const atalho = isNatanaelShortcut(user?.email, c.status, "finalizado");
                const canMove = isDemanda
                  ? true
                  : atalho ||
                    canMoveCompra(c, user?.id, isAdmin, user?.email, next ?? undefined, c.status, responsavelDoStatus(next), responsavelDoStatus(c.status)) ||
                    (!!back && canMoveCompra(c, user?.id, isAdmin, user?.email, back, c.status, responsavelDoStatus(back), responsavelDoStatus(c.status)));
                const canMigrate =
                  !isDemanda &&
                  (c.status === "solicitacao" || c.status === "a_receber") &&
                  canEditCompra(c, user?.id, isAdmin, user?.email, responsavelDoStatus(c.status));

                return (
                  <Card
                    key={c.id}
                    compra={c}
                    onOpen={() => abrirCard(c)}
                    nextStatusLabel={next ? (COMPRA_STATUSES.find((x) => x.key === next)?.label ?? null) : null}
                    onAdvance={next ? () => { void advanceToStatus(c, next); } : undefined}
                    canMove={canMove}
                    blockedMsg={canMove ? null : statusMoveBlockedMessage(next)}
                    onMigrar={canMigrate ? () => setMigrarCompra(c) : undefined}
                    pagto={pagamentosPorCompra.get(c.id) ?? null}
                    selected={selectedIds.has(c.id)}
                    onToggleSelect={() => toggleSelect(c.id)}
                  />
                );

              })}

              <button
                type="button"
                onClick={() => { setEditId(null); setDefaultStatus(s.key); setOpen(true); }}
                className="w-full text-xs text-muted-foreground hover:text-foreground py-1.5 rounded border border-dashed border-border hover:border-primary"
              >
                + adicionar
              </button>
            </Column>
          ))}
        </div>
      </DndContext>
      )}

      <CompraDialog
        open={open}
        onOpenChange={setOpen}
        compraId={editId}
        defaultStatus={defaultStatus}
        onAdvance={async (compraData, opts) => {
          const target = opts?.deny ? "negada" : opts?.approve ? "aprovada" : nextCompraStatus(compraData.status);
          if (!target) return;
          await advanceToStatus(compraData as unknown as Compra, target, {
            force: !!(opts?.approve || opts?.deny),
            toastMsg: opts?.approve
              ? "Compra aprovada."
              : opts?.deny
              ? "Compra reprovada."
              : undefined,
          });
          setOpen(false);
        }}
      />

      <AvancarCardDialog
        open={!!pendingMove}
        onOpenChange={(v) => { if (!v) setPendingMove(null); }}
        statusLabel={pendingMove ? (COMPRA_STATUSES.find((s) => s.key === pendingMove.status)?.label || "") : ""}
        onConfirm={async ({ responsavelId, responsavelNome, observacao }) => {
          if (!pendingMove) return;
          const { id, status, titulo, prazo } = pendingMove;
          const statusLabel = COMPRA_STATUSES.find((s) => s.key === status)?.label || status;
          try {
            await moveStatus.mutateAsync({ id, status, responsavelId, responsavelNome, prazo });
          } catch {
            return;
          }
          notifyResponsavel({
            userId: responsavelId,
            titulo: `Compra: ${statusLabel}`,
            mensagem: `${titulo}${observacao ? ` — ${observacao}` : ""}`,
            link: `/compras?id=${id}`,
            tipo: "compra_responsavel",
          }).catch(() => {});
          toast.success(`Card movido. ${responsavelNome} foi notificado.`);
          setPendingMove(null);
        }}
      />




      <MigrarCompraDialog
        compra={migrarCompra}
        onClose={() => setMigrarCompra(null)}
        onDone={() => {
          setMigrarCompra(null);
          qc.invalidateQueries({ queryKey: ["compras"] });
          qc.invalidateQueries({ queryKey: ["demandas"] });
        }}
      />

    </>
  );
}

function Column({
  statusKey, label, color, count, children,
}: { statusKey: string; label: string; color: string; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: statusKey });
  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-72 flex flex-col h-full rounded-lg border bg-muted/30 ${isOver ? "border-primary ring-2 ring-primary/30" : "border-border"}`}
    >
      <div className="px-3 py-2 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`h-2 w-2 rounded-full ${color}`} />
          <span className="text-xs font-semibold truncate">{label}</span>
        </div>
        <span className="text-[10px] text-muted-foreground">{count}</span>
      </div>
      <div className="p-2 space-y-2 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

function Card({
  compra, onOpen, onAdvance, nextStatusLabel, canMove = true, blockedMsg = null, onMigrar, pagto = null,
  selected = false, onToggleSelect,
}: {
  compra: Compra;
  onOpen: () => void;
  onAdvance?: () => void;
  nextStatusLabel?: string | null;
  canMove?: boolean;
  blockedMsg?: string | null;
  onMigrar?: () => void;
  pagto?: StatusPagamentos | null;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: compra.id, disabled: !canMove });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  const advanceDisabled = !canMove;
  // Compra parcelada (datas de pagamento diferentes) e ainda em aberto → destaque âmbar
  const parceladoPendente = !!pagto?.parcelado && !pagto?.quitado;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(canMove ? { ...listeners, ...attributes } : {})}
      onClick={onOpen}
      title={canMove ? undefined : blockedMsg ?? undefined}
      className={`rounded-md border p-2.5 text-xs shadow-sm ${parceladoPendente ? "border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10" : "border-border bg-card"} ${selected ? "ring-2 ring-primary" : ""} ${isDragging ? "opacity-50" : ""} ${canMove ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
    >
      <div className="flex items-start gap-2">
        {onToggleSelect && (
          <span
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="pt-[3px]"
          >
            <Checkbox
              checked={selected}
              onCheckedChange={() => onToggleSelect()}
              aria-label="Selecionar card"
              className="h-3.5 w-3.5 [&_svg]:h-3 [&_svg]:w-3"
            />
          </span>
        )}
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="font-medium text-sm truncate text-foreground flex-1 min-w-0 flex items-center gap-1.5">
              <PrazoDot prazo={prazoVigente(compra)} status={compra.status} />
              <span className="truncate">{compra.titulo || compra.fornecedor || "Compra sem título"}</span>
            </div>

            {compra.numero != null && (
              <span className="text-[10px] text-muted-foreground font-mono shrink-0 mt-0.5">
                COMPRA-{compra.numero}
              </span>
            )}
          </div>
          {pagto && (pagto.parcelado || pagto.quitado) && (
            <div className="flex flex-wrap items-center gap-1 mt-1">
              {pagto.parcelado && (
                <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-200/70 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200">
                  Parcelado{pagto.parcelasAbertas > 0 ? ` · ${pagto.parcelasAbertas} em aberto` : ""}
                </span>
              )}
              {pagto.quitado ? (
                <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                  Quitado
                </span>
              ) : (
                <span className="text-[10px] text-muted-foreground">
                  Pago {formatBRL(pagto.totalPago)} de {formatBRL(pagto.total)}
                  {pagto.proximaData ? ` · próx. ${formatDate(pagto.proximaData)}` : ""}
                </span>
              )}
              {pagto.vencidas > 0 && (
                <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-destructive/15 text-destructive">
                  {pagto.vencidas} vencida{pagto.vencidas > 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}
          {compra.fornecedor && compra.titulo && (
            <div className="text-[11px] text-muted-foreground truncate">{compra.fornecedor}</div>
          )}
          <div className="mt-1.5 space-y-0.5 text-[11px] text-muted-foreground">
            {compra.solicitante && <div>Solic.: {compra.solicitante}</div>}
            {compra.comprador && <div>Comprador: {compra.comprador}</div>}
            {compra.responsavel_nome && <div>Resp.: {compra.responsavel_nome}</div>}
            {!compra.tipo_compra && (
              <div>
                <span className="inline-block rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 text-[10px] font-medium">
                  Sem tipo
                </span>
              </div>
            )}

            {compra.tipo_compra === "servico" ? (
              <div>{compra.data_servico ? `Serviço: ${formatDate(compra.data_servico)}` : "Sem data de serviço"}</div>
            ) : (
              <div>{compra.data_compra ? `Comprada: ${formatDate(compra.data_compra)}` : "Não comprado"}</div>
            )}
            {compra.valor_total != null && (
              <div className="font-medium text-foreground">
                {Number(compra.valor_total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </div>
            )}
          </div>
        </div>
        {onMigrar && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onMigrar(); }}
            className="shrink-0 p-0.5 text-muted-foreground hover:text-primary"
            title="Migrar para Aquisição"
            aria-label="Migrar para Aquisição"
          >
            <ArrowRightLeft className="h-4 w-4" />
          </button>
        )}
        {onAdvance && nextStatusLabel && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); if (!advanceDisabled) onAdvance(); }}
            disabled={advanceDisabled}
            className={`shrink-0 p-0.5 transition-colors ${advanceDisabled ? "text-muted-foreground/40 cursor-not-allowed" : "text-muted-foreground hover:text-primary"}`}
            title={advanceDisabled ? blockedMsg ?? undefined : `Avançar para "${nextStatusLabel}"`}
            aria-label={`Avançar para ${nextStatusLabel}`}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>

  );
}

function formatDate(d: string) {
  // datas vêm como "YYYY-MM-DD" (tipo date no banco). Evita conversão UTC -> local que muda o dia.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return d; }
}

function MigrarCompraDialog({
  compra,
  onClose,
  onDone,
}: {
  compra: Compra | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [tipo, setTipo] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const tiposDespesa = useTiposDespesa();


  useEffect(() => {
    if (compra) setTipo("");
  }, [compra?.id]);

  if (!compra) return null;

  async function handleConfirm() {
    if (!tipo) {
      toast.error("Escolha o tipo de aquisição.");
      return;
    }
    if (!compra) return;
    setSaving(true);
    try {
      // 1) Buscar itens da compra
      const { data: itens, error: itensErr } = await sb
        .from("compra_itens")
        .select("descricao,quantidade,unidade,valor_unitario,evento_projeto")
        .eq("compra_id", compra.id);
      if (itensErr) throw itensErr;

      // 2) Buscar campos completos da compra
      const { data: full, error: fullErr } = await sb
        .from("compras")
        .select(
          "titulo,fornecedor,fornecedor_id,solicitante,solicitante_id,valor_total,observacoes,data_solicitacao,data_compra,comprador,responsavel_id,responsavel_nome,numero_nf,numeros_nf,tem_nf,parcelamento,condicao_pagamento,documento,created_by,solicitante_email,prazo,origem,op_ordem_id,status_financeiro",
        )
        .eq("id", compra.id)
        .maybeSingle();
      if (fullErr) throw fullErr;
      if (!full) throw new Error("Compra não encontrada");

      // 2b) Anexos, pagamentos e comentários da compra
      const [anexosRes, pagsRes, comsRes] = await Promise.all([
        sb.from("compra_anexos").select("*").eq("compra_id", compra.id),
        sb.from("compra_pagamentos").select("*").eq("compra_id", compra.id),
        sb.from("compra_comentarios").select("*").eq("compra_id", compra.id),
      ]);
      if (anexosRes.error) throw anexosRes.error;
      if (pagsRes.error) throw pagsRes.error;
      if (comsRes.error) throw comsRes.error;
      const anexos = (anexosRes.data ?? []) as any[];
      const pagamentos = (pagsRes.data ?? []) as any[];
      const comentarios = (comsRes.data ?? []) as any[];

      const usaItens = tiposDespesa.exigeItens(tipo);
      let observacoes: string | null = full.observacoes ?? null;
      if (!usaItens && itens && itens.length) {
        const linhas = itens.map((it: any) => {
          const q = Number(it.quantidade) || 0;
          const v = Number(it.valor_unitario) || 0;
          const val = v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
          return `${q}x ${it.descricao ?? ""} — ${val}`;
        });
        const texto = linhas.join("; ");
        observacoes = observacoes ? `${observacoes}\n\n${texto}` : texto;
      }

      const payload: any = {
        titulo: full.titulo,
        fornecedor: full.fornecedor,
        fornecedor_id: full.fornecedor_id,
        solicitante: full.solicitante,
        solicitante_id: full.solicitante_id,
        solicitante_email: full.solicitante_email,
        valor_total: full.valor_total,
        observacoes,
        data_solicitacao: full.data_solicitacao,
        data_compra: full.data_compra,
        comprador: full.comprador,
        responsavel_id: full.responsavel_id,
        responsavel_nome: full.responsavel_nome,
        numero_nf: full.numero_nf,
        numeros_nf: full.numeros_nf,
        tem_nf: full.tem_nf,
        parcelamento: full.parcelamento,
        condicao_pagamento: full.condicao_pagamento,
        documento: full.documento,
        created_by: full.created_by,
        prazo: full.prazo,
        origem: full.origem,
        op_ordem_id: full.op_ordem_id,
        status_financeiro: full.status_financeiro,
        tipo_demanda: tipo,
        status: compra.status === "a_receber" ? "a_receber" : "solicitacao",
      };

      // 3) Criar demanda
      const { data: novaDem, error: demErr } = await sb
        .from("demandas")
        .insert(payload)
        .select("id")
        .single();
      if (demErr) throw demErr;

      // 4) Copiar itens quando aplicável
      if (usaItens && itens && itens.length) {
        const rows = itens.map((it: any) => ({
          demanda_id: novaDem.id,
          descricao: it.descricao,
          quantidade: it.quantidade,
          unidade: it.unidade,
          valor_unitario: it.valor_unitario,
          evento_projeto: it.evento_projeto ?? null,
        }));
        const { error: insItErr } = await sb.from("demanda_itens").insert(rows);
        if (insItErr) throw insItErr;
      }

      // 4b) Copiar anexos (download do bucket de compras → upload no de aquisições)
      const pathsAntigos: string[] = [];
      for (const a of anexos) {
        const { data: blob, error: dlErr } = await sb.storage
          .from("compra-anexos")
          .download(a.path);
        if (dlErr || !blob) throw new Error(`Falha ao copiar anexo "${a.nome}"`);
        const safeName = (a.nome ?? "arquivo")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9._-]/g, "_");
        const novoPath = `${novaDem.id}/${Date.now()}_${safeName}`;
        const { error: upErr } = await sb.storage
          .from("demanda-anexos")
          .upload(novoPath, blob, { contentType: a.mime_type ?? undefined, upsert: false });
        if (upErr) throw new Error(`Falha ao enviar anexo "${a.nome}": ${upErr.message}`);
        const { error: insAnErr } = await sb.from("demanda_anexos").insert({
          demanda_id: novaDem.id,
          nome: a.nome,
          path: novoPath,
          mime_type: a.mime_type,
          tamanho: a.tamanho,
          uploaded_by: a.uploaded_by,
        });
        if (insAnErr) throw insAnErr;
        pathsAntigos.push(a.path);
      }

      // 4c) Copiar pagamentos
      if (pagamentos.length) {
        const rows = pagamentos.map((p) => ({
          demanda_id: novaDem.id,
          forma: p.forma,
          parcelamento: p.parcelamento,
          valor: p.valor,
          ordem: p.ordem,
          observacao: p.observacao,
          data_pagamento: p.data_pagamento,
          pago: p.pago,
          pago_em: p.pago_em,
        }));
        const { error: pagErr } = await sb.from("demanda_pagamentos").insert(rows);
        if (pagErr) throw pagErr;
      }

      // 4d) Copiar comentários
      if (comentarios.length) {
        const rows = comentarios.map((c) => ({
          demanda_id: novaDem.id,
          user_id: c.user_id,
          user_nome: c.user_nome,
          texto: c.texto,
          mencoes: c.mencoes,
          created_at: c.created_at,
        }));
        const { error: comErr } = await sb.from("demanda_comentarios").insert(rows);
        if (comErr) throw comErr;
      }

      // 5) Só agora limpar os registros da compra
      if (pathsAntigos.length) {
        await sb.storage.from("compra-anexos").remove(pathsAntigos);
      }
      await sb.from("compra_anexos").delete().eq("compra_id", compra.id);
      await sb.from("compra_pagamentos").delete().eq("compra_id", compra.id);
      await sb.from("compra_comentarios").delete().eq("compra_id", compra.id);
      await sb.from("compra_itens").delete().eq("compra_id", compra.id);
      const { error: delErr } = await sb.from("compras").delete().eq("id", compra.id);
      if (delErr) throw delErr;


      toast.success("Compra migrada para Aquisição");
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao migrar compra");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!compra} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Migrar para Aquisição</DialogTitle>
          <DialogDescription>
            Esta compra será convertida em uma aquisição e removida do Quadro de Compras.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label className="text-sm font-medium">Tipo de aquisição</label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo…" />
            </SelectTrigger>
            <SelectContent>
              {tiposDespesa.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {tipo && !tiposDespesa.exigeItens(tipo) && (
            <p className="text-xs text-muted-foreground">
              Os itens da compra serão convertidos em texto no campo de observações.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={saving || !tipo}>
            {saving ? "Migrando…" : "Confirmar migração"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
