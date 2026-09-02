import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePersistedState } from "@/hooks/usePersistedState";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, ChevronRight } from "lucide-react";
import { CompraDialog } from "@/components/CompraDialog";
import { DemandaDialog } from "@/components/DemandaDialog";
import { proximoStatusDemanda } from "@/lib/demandas";
import { COMPRA_STATUSES, canMoveCompra, compraBackStatus, isNatanaelShortcut, moveBlockedMessage, nextCompraStatus, PEDRO_EMAIL, PEDRO_MOVE_BLOCKED_MSG, type CompraStatus } from "@/lib/compras";
import { Checkbox } from "@/components/ui/checkbox";

import { useTiposDespesa } from "@/hooks/useTiposDespesa";
import { statusPagamentos, formatBRL, type PagamentoLinha, type StatusPagamentos } from "@/lib/pagamentos";
import { KanbanFilters, applyKanbanFilters, countActiveFilters, type FieldDef, type Filters } from "@/components/KanbanFilters";
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
  validateSearch: (search: Record<string, unknown>): { id?: string; origem?: string } => ({
    id: typeof search.id === "string" && search.id ? search.id : undefined,
    origem: typeof search.origem === "string" && search.origem ? search.origem : undefined,
  }),
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
  const tiposDespesa = useTiposDespesa();

  // Abre o card automaticamente quando o link tem ?id=... (reativo à URL)
  const search = Route.useSearch();
  const navigate = useNavigate();
  const limparLink = () => {
    if (search.id) navigate({ to: "/compras", search: {}, replace: true });
  };

  useEffect(() => {
    const id = search.id;
    if (!id) return;
    let cancelado = false;
    (async () => {
      let origem = search.origem === "demanda" ? "demanda" : search.origem === "compra" ? "compra" : null;
      if (!origem) {
        const [{ data: c }, { data: d }] = await Promise.all([
          sb.from("compras").select("id").eq("id", id).maybeSingle(),
          sb.from("demandas").select("id").eq("id", id).maybeSingle(),
        ]);
        origem = c ? "compra" : d ? "demanda" : null;
      }
      if (cancelado) return;
      if (!origem) {
        toast.error("Card não encontrado ou você não tem acesso a ele.");
        navigate({ to: "/compras", search: {}, replace: true });
        return;
      }
      if (origem === "demanda") {
        setEditDemandaId(id);
        setOpenDemanda(true);
      } else {
        setEditId(id);
        setOpen(true);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [search.id, search.origem, navigate]);



  const { data: compras = [] } = useQuery({
    queryKey: ["compras"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("compras")
        .select("id,numero,status,titulo,solicitante,solicitante_id,fornecedor,comprador,data_solicitacao,data_compra,data_servico,prazo,prazo_aprovacao,valor_total,responsavel_id,responsavel_nome,tipo_compra,numero_nf,numeros_nf,tem_nf,empresa_faturada,condicao_pagamento,created_by")

        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Compra[];
    },
  });

  // Aquisições (tabela demandas) vivem definitivamente no Quadro de Compras,
  // inclusive quando finalizadas ou negadas.
  const { data: demandas = [] } = useQuery({
    queryKey: ["compras", "demandas"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("demandas")
        .select("id,numero,status,titulo,solicitante,fornecedor,comprador,data_solicitacao,data_compra,prazo,valor_total,tipo_demanda,responsavel_id,responsavel_nome,condicao_pagamento,created_by")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const cards = useMemo<Compra[]>(
    () => [
      ...(compras ?? []).map((c: any) => ({ ...c, origem: "compra" as const })),
      ...(demandas ?? []).map((d: any) => ({
        ...d,
        origem: "demanda" as const,
        solicitante_id: null,
        data_servico: null,
        tipo_compra: null,
      })),
    ],
    [compras, demandas],
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

  // Formas de pagamento por card (grade de pagamentos + condição do próprio card).
  const formasPorCard = useMemo(() => {
    const m = new Map<string, Set<string>>();
    const add = (id: string, forma: any) => {
      const f = String(forma ?? "").trim();
      if (!id || !f) return;
      const set = m.get(id) ?? new Set<string>();
      set.add(f);
      m.set(id, set);
    };
    for (const p of pagamentosRows) add(p.compra_id, p.forma);
    for (const p of pagamentosDemandaRows) add(p.demanda_id, p.forma);
    return m;
  }, [pagamentosRows, pagamentosDemandaRows]);

  const filterFields = useMemo<FieldDef<Compra>[]>(() => [
    { key: "status", label: "Status", type: "multi", getValue: (r) => r.status, formatValue: (v) => COMPRA_STATUSES.find((s) => s.key === v)?.label ?? v },
    { key: "origem", label: "Origem", type: "multi", getValue: (r) => (r.origem === "demanda" ? "Aquisição" : "Compra") },
    { key: "fornecedor", label: "Fornecedor", type: "multi", getValue: (r) => r.fornecedor },
    { key: "solicitante", label: "Solicitante", type: "multi", getValue: (r) => r.solicitante },
    { key: "comprador", label: "Comprador", type: "multi", getValue: (r) => r.comprador },
    { key: "responsavel_nome", label: "Responsável", type: "multi", getValue: (r) => r.responsavel_nome },
    { key: "tipo_compra", label: "Tipo", type: "multi", getValue: (r) => r.tipo_compra ?? r.tipo_demanda },
    {
      key: "forma_pagamento",
      label: "Forma de pagamento",
      type: "multi",
      getValue: (r) => {
        const set = new Set<string>(formasPorCard.get((r as any).id) ?? []);
        const cond = String((r as any).condicao_pagamento ?? "").trim();
        if (cond && cond.toLowerCase() !== "múltiplas" && cond.toLowerCase() !== "multiplas") set.add(cond);
        return [...set];
      },
    },
    { key: "empresa_faturada", label: "Empresa faturada", type: "multi", getValue: (r) => (r as any).empresa_faturada },
    { key: "tem_nf", label: "Tem NF", type: "multi", getValue: (r) => ((r as any).tem_nf === false ? "Não" : (r as any).tem_nf === true ? "Sim" : null) },
    { key: "data_compra", label: "Data de compra", type: "date-range", getValue: (r) => r.data_compra },
    { key: "data_servico", label: "Data de serviço", type: "date-range", getValue: (r) => r.data_servico },
    { key: "valor_total", label: "Valor total", type: "number-range", getValue: (r) => r.valor_total },
  ], [formasPorCard]);


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

  const filtrosAtivos = useMemo(() => countActiveFilters(filters), [filters]);

  /** Total por status antes de qualquer filtro — para avisar quando a coluna só parece vazia. */
  const totalPorStatus = useMemo(() => {
    const m: Record<string, number> = {};
    cards.forEach((c) => (m[c.status] = (m[c.status] ?? 0) + 1));
    return m;
  }, [cards]);

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
    onMutate: async ({ id, status }) => {
      const queryKey = ["compras", "demandas"] as const;
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData<any[]>(queryKey);
      qc.setQueryData<any[]>(queryKey, (old) =>
        (old ?? []).map((card) => (card.id === id ? { ...card, status } : card)),
      );
      return { prev };
    },
    onError: (_error, _vars, context) => {
      if (context?.prev) qc.setQueryData(["compras", "demandas"], context.prev);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["compras", "demandas"] });
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
        link: `/compras?id=${card.id}&origem=demanda`,
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

      {filtrosAtivos > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          <span>
            <strong>{filtrosAtivos}</strong> filtro(s) ativo(s) — {cards.length - filteredCompras.length} card(s)
            estão ocultos nesta visualização.
          </span>
          <Button size="sm" variant="secondary" className="ml-auto h-7" onClick={() => setFilters({})}>
            Limpar filtros
          </Button>
        </div>
      )}

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
            <Column
              key={s.key}
              statusKey={s.key}
              label={s.label}
              color={s.color}
              count={byStatus[s.key]?.length ?? 0}
              ocultos={Math.max(0, (totalPorStatus[s.key] ?? 0) - (byStatus[s.key]?.length ?? 0))}
            >
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
                return (
                  <Card
                    key={c.id}
                    compra={c}
                    onOpen={() => abrirCard(c)}
                    nextStatusLabel={next ? (COMPRA_STATUSES.find((x) => x.key === next)?.label ?? null) : null}
                    onAdvance={next ? () => { void advanceToStatus(c, next); } : undefined}
                    canMove={canMove}
                    blockedMsg={canMove ? null : statusMoveBlockedMessage(next)}
                    pagto={pagamentosPorCompra.get(c.id) ?? null}
                    selected={selectedIds.has(c.id)}
                    onToggleSelect={() => toggleSelect(c.id)}
                  />
                );

              })}

              <button
                type="button"
                onClick={() => setEscolherTipo(s.key)}
                className="w-full text-xs text-muted-foreground hover:text-foreground py-1.5 rounded border border-dashed border-border hover:border-primary"
              >
                + adicionar
              </button>
            </Column>
          ))}
        </div>
      </DndContext>
      )}

      <Dialog open={!!escolherTipo} onOpenChange={(v) => { if (!v) setEscolherTipo(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>O que você quer criar?</DialogTitle>
            <DialogDescription>
              Compras e Aquisições ficam no mesmo quadro; o que muda é o código do card.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Button
              variant="outline"
              className="justify-start h-auto py-3"
              onClick={() => {
                setDefaultStatus(escolherTipo ?? "solicitacao");
                setEditId(null);
                setEscolherTipo(null);
                setOpen(true);
              }}
            >
              <div className="text-left">
                <div className="font-medium">Compra</div>
                <div className="text-xs text-muted-foreground">Card padrão de compras (COMPRA-000)</div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="justify-start h-auto py-3"
              onClick={() => {
                setDefaultStatus(escolherTipo ?? "solicitacao");
                setEditDemandaId(null);
                setEscolherTipo(null);
                setOpenDemanda(true);
              }}
            >
              <div className="text-left">
                <div className="font-medium">Aquisição</div>
                <div className="text-xs text-muted-foreground">Card de aquisição (DEMANDA-000)</div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CompraDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) {
            setEditId(null);
            limparLink();
          }
        }}
        compraId={editId}
        onConverted={(novo) => {
          qc.invalidateQueries({ queryKey: ["compras"] });
          qc.invalidateQueries({ queryKey: ["compras", "demandas"] });
          setEditId(null);
          setOpen(false);
          setEditDemandaId(novo.id);
          setOpenDemanda(true);
        }}

        defaultStatus={defaultStatus}
        onAdvance={async (compraData, opts) => {
          const target = opts?.deny ? "negada" : opts?.approve ? "aprovada" : nextCompraStatus(compraData.status);
          if (!target) return;
          await advanceToStatus({ ...(compraData as any), origem: "compra" } as Compra, target, {
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

      <DemandaDialog
        open={openDemanda}
        onOpenChange={(v) => {
          setOpenDemanda(v);
          if (!v) {
            setEditDemandaId(null);
            limparLink();
            qc.invalidateQueries({ queryKey: ["compras", "demandas"] });
            qc.invalidateQueries({ queryKey: ["compras", "pagamentos-quadro-demandas"] });
          }
        }}
        demandaId={editDemandaId}
        onConverted={(novo) => {
          qc.invalidateQueries({ queryKey: ["compras"] });
          qc.invalidateQueries({ queryKey: ["compras", "demandas"] });
          setEditDemandaId(null);
          setOpenDemanda(false);
          setEditId(novo.id);
          setOpen(true);
        }}

        defaultStatus={defaultStatus}
        onAdvance={async (demandaData: any, opts: any) => {
          const card = { ...(demandaData as any), origem: "demanda" } as Compra;
          const target = opts?.deny
            ? "negada"
            : opts?.approve
            ? "aprovada"
            : proximoStatusDemanda(card.status, card.tipo_demanda ?? null, tiposDespesa.paraRecebimento);
          if (!target) return;
          await advanceDemanda(card, target as CompraStatus, {
            force: true,
            toastMsg: opts?.approve ? "Aquisição aprovada." : opts?.deny ? "Aquisição reprovada." : undefined,
          });
          setOpenDemanda(false);
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




    </>
  );
}

function Column({
  statusKey, label, color, count, ocultos = 0, children,
}: { statusKey: string; label: string; color: string; count: number; ocultos?: number; children: React.ReactNode }) {
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
      <div className="p-2 space-y-2 flex-1 overflow-y-auto">
        {count === 0 && ocultos > 0 ? (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] leading-snug text-muted-foreground">
            {ocultos} card(s) nesta etapa estão ocultos pelos filtros ativos.
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}

function Card({
  compra, onOpen, onAdvance, nextStatusLabel, canMove = true, blockedMsg = null, pagto = null,
  selected = false, onToggleSelect,
}: {
  compra: Compra;
  onOpen: () => void;
  onAdvance?: () => void;
  nextStatusLabel?: string | null;
  canMove?: boolean;
  blockedMsg?: string | null;
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
              <span className="truncate">{compra.titulo || compra.fornecedor || (compra.origem === "demanda" ? "Aquisição sem título" : "Compra sem título")}</span>
            </div>

            {compra.numero != null && (
              <span className="text-[10px] text-muted-foreground font-mono shrink-0 mt-0.5">
                {codigoCard(compra)}
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
            {compra.origem === "compra" && !compra.tipo_compra && (
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

