import { Fragment } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subDays, addDays, addWeeks, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Settings, Plus, Pencil, Trash2, Loader2, Download, ChevronDown, ChevronRight, ChevronLeft, LayoutGrid, List } from "lucide-react";
import { toast } from "sonner";
type XLSXNs = typeof import("xlsx");
let _xlsxPromise: Promise<XLSXNs> | null = null;
const loadXLSX = () => (_xlsxPromise ??= import("xlsx"));

import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

import { MoneyInput } from "@/components/MoneyInput";
import { EventoSheetCombobox } from "@/components/EventoSheetCombobox";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  calcularApontamento,
  calcularApontamentoComEventos,
  formatHoras,
  intervaloExibicao,

  type Local,
  type ModoDivisao,
} from "@/lib/diaristas-calc";
import { useDiaristaAcesso } from "@/lib/diaristas-acesso";
import { useDiaristaConfig, useDiaristaDepartamentos } from "@/lib/diaristas-config";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/financeiro-op/diaristas/")({
  component: DiaristasIndex,
});

type Diarista = {
  id: string;
  nome: string;
  apelido?: string | null;
  departamento?: string | null;
  valor_hora_fortaleza: number;
  valor_hora_fora: number;
  chave_pix: string | null;
  ativo: boolean;
};

/** Opções de departamento: cadastro + os já usados pelos diaristas. */
function useOpcoesDepartamento(lista: { departamento?: string | null }[]) {
  const { data: departamentos = [] } = useDiaristaDepartamentos();
  return useMemo(() => {
    const set = new Set<string>(departamentos.map((d) => d.nome));
    for (const d of lista) if (d.departamento) set.add(d.departamento);
    return Array.from(set);
  }, [departamentos, lista]);
}

/** Nome usado nas listagens: apelido quando houver, senão o nome completo. */
function nomeExib(d?: Pick<Diarista, "nome" | "apelido"> | null) {
  if (!d) return "—";
  const ap = (d.apelido ?? "").trim();
  return ap || d.nome;
}

/** true quando o diarista atende ao filtro de departamento selecionado. */
function matchDepto(d: Diarista | undefined, filtro: string) {
  if (filtro === "todos") return true;
  const dep = (d?.departamento ?? "").trim();
  if (filtro === "__sem") return !dep;
  return dep === filtro;
}



type Apontamento = {
  id: string;
  diarista_id: string;
  empresa: string | null;
  atividade: string | null;
  projeto: string | null;
  comodos: string | null;
  data: string;
  hora_inicial: string;
  hora_final: string;
  intervalo_minutos: number;
  local: string;
  obs: string | null;
  extra_manual: number;
  created_by: string | null;
  modo_divisao: ModoDivisao | null;
  almoco: boolean | null;
  janta: boolean | null;
  diaria_minima: boolean | null;
  empeleita: boolean | null;
  fechamento_id: string | null;
};

type EventoLinha = {
  evento_nome: string;
  hora_inicial: string;
  hora_final: string;
  intervalo_minutos: number;
  bloco: number;
  empeleita: boolean;
};

type ApontamentoEventoRow = EventoLinha & {
  id: string;
  apontamento_id: string;
  ordem: number;
};

type ApontamentoForm = {
  id?: string;
  diarista_id: string;
  projeto: string;
  data: string;
  hora_inicial: string;
  hora_final: string;
  intervalo_minutos: number;
  local: Local;
  obs: string;
  extra_manual: number;
  modo_divisao: ModoDivisao;
  eventos: EventoLinha[];
  almoco: boolean;
  janta: boolean;
  diaria_minima: boolean;
  empeleita: boolean;
};

const emptyEvento = (bloco = 0, horas?: Partial<EventoLinha>): EventoLinha => ({
  evento_nome: "",
  hora_inicial: "08:00",
  hora_final: "12:00",
  intervalo_minutos: 0,
  bloco,
  empeleita: false,
  ...horas,
});

const emptyApontamento = (): ApontamentoForm => ({
  diarista_id: "",
  projeto: "",
  data: format(new Date(), "yyyy-MM-dd"),
  hora_inicial: "08:00",
  hora_final: "17:00",
  intervalo_minutos: 60,
  local: "Fortaleza",
  obs: "",
  extra_manual: 0,
  modo_divisao: "unico",
  eventos: [],
  almoco: false,
  janta: false,
  diaria_minima: true,
  empeleita: false,
});

function fmtBRL(v: number) {
  return (v || 0).toLocaleString("pt-BR", {
    style: "currency", currency: "BRL", maximumFractionDigits: 2,
  });
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

function Linha({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between text-sm ${bold ? "font-semibold" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function DiaristasIndex() {
  const { isFinAdmin, podeLancar, podeAcessar, verValores, loading } = useDiaristaAcesso();

  if (loading) return null;
  if (!podeAcessar) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Você não tem acesso ao módulo de diaristas.
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader
          title="Diaristas"
          description={
            verValores
              ? "Apontamento de dias trabalhados e fechamento por período."
              : "Lance as diárias do pessoal. Você vê, edita e exclui apenas os seus lançamentos."
          }
        />
        {(isFinAdmin || podeLancar) && (
          <Button asChild variant="outline">
            <Link to="/financeiro-op/diaristas/configuracoes">
              <Settings className="h-4 w-4 mr-2" />
              {isFinAdmin ? "Configurações" : "Cadastro de diaristas"}
            </Link>
          </Button>
        )}
      </div>

      {verValores ? (
        <Tabs defaultValue="apontamento">
          <TabsList>
            <TabsTrigger value="apontamento">Apontamento</TabsTrigger>
            <TabsTrigger value="fechamento">Fechamento</TabsTrigger>
            <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
          </TabsList>
          <TabsContent value="apontamento" className="mt-4">
            <ApontamentoTab />
          </TabsContent>
          <TabsContent value="fechamento" className="mt-4">
            <FechamentoTab />
          </TabsContent>
          <TabsContent value="relatorios" className="mt-4">
            <RelatoriosTab />
          </TabsContent>
        </Tabs>
      ) : (
        <ApontamentoTab />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Data hooks
// ─────────────────────────────────────────────────────────────

function useDiaristas() {
  return useQuery({
    queryKey: ["diaristas"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("diaristas")
        .select("*")
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Diarista[];
    },
  });
}

function useApontamentos() {
  return useQuery({
    queryKey: ["diarista_apontamentos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("diarista_apontamentos")
        .select("*")
        .order("data", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Apontamento[];
    },
  });
}

function useApontamentoEventos() {
  return useQuery({
    queryKey: ["diarista_apontamento_eventos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("diarista_apontamento_eventos")
        .select("*")
        .order("ordem", { ascending: true });
      if (error) throw error;
      const map = new Map<string, ApontamentoEventoRow[]>();
      for (const r of (data ?? []) as any[]) {
        const row: ApontamentoEventoRow = {
          id: r.id,
          apontamento_id: r.apontamento_id,
          ordem: r.ordem ?? 0,
          evento_nome: r.evento_nome ?? "",
          hora_inicial: (r.hora_inicial ?? "").slice(0, 5),
          hora_final: (r.hora_final ?? "").slice(0, 5),
          intervalo_minutos: r.intervalo_minutos ?? 0,
          bloco: r.bloco ?? r.ordem ?? 0,
          empeleita: !!r.empeleita,
        };
        const list = map.get(row.apontamento_id) ?? [];
        list.push(row);
        map.set(row.apontamento_id, list);
      }
      return map;
    },
  });
}

type Fechamento = {
  id: string;
  periodo_inicio: string;
  periodo_fim: string;
  filtros: any;
  total_dias: number;
  total_minutos: number;
  total_valor: number;
  data_pagamento: string;
  observacao: string | null;
  created_at: string;
};

function useFechamentos() {
  return useQuery({
    queryKey: ["diarista_fechamentos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("diarista_fechamentos")
        .select("*")
        .order("periodo_inicio", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Fechamento[];
    },
  });
}

// ─────────────────────────────────────────────────────────────
// Apontamento
// ─────────────────────────────────────────────────────────────

function ApontamentoTab() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { verValores, somenteProprios } = useDiaristaAcesso();
  const { data: diaristas = [] } = useDiaristas();
  const { data: apontamentos = [], isLoading } = useApontamentos();
  const { data: eventosMap } = useApontamentoEventos();
  const { data: cfgRefeicao } = useDiaristaConfig();
  const tarifaDe = (d: Diarista) => ({
    ...d,
    valor_almoco: cfgRefeicao?.valor_almoco ?? 0,
    valor_janta: cfgRefeicao?.valor_janta ?? 0,
  });

  const diaristasAtivos = useMemo(() => diaristas.filter((d) => d.ativo), [diaristas]);
  const opcoesDepartamento = useOpcoesDepartamento(diaristas);
  const diaristasMap = useMemo(
    () => new Map(diaristas.map((d) => [d.id, d])),
    [diaristas],
  );

  // filtros
  const [fDiarista, setFDiarista] = useState<string>("todos");
  const [fDepto, setFDepto] = useState<string>("todos");
  const [fLocal, setFLocal] = useState<string>("todos");
  const [fProjeto, setFProjeto] = useState<string>("");
  const [fDe, setFDe] = useState<string>("");
  const [fAte, setFAte] = useState<string>("");
  const [fSituacao, setFSituacao] = useState<"todas" | "aberto" | "pago" | "empeleita">("todas");

  const [visao, setVisao] = useState<"tabela" | "semana">("tabela");
  const [semanaRef, setSemanaRef] = useState<Date>(() => new Date());
  const [detalheId, setDetalheId] = useState<string | null>(null);

  const semana = useMemo(() => {
    const ini = startOfWeek(semanaRef, { weekStartsOn: 1 });
    const fim = endOfWeek(semanaRef, { weekStartsOn: 1 });
    return {
      ini,
      fim,
      iniYmd: format(ini, "yyyy-MM-dd"),
      fimYmd: format(fim, "yyyy-MM-dd"),
      dias: Array.from({ length: 7 }, (_, i) => addDays(ini, i)),
    };
  }, [semanaRef]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ApontamentoForm>(emptyApontamento());
  const [expandido, setExpandido] = useState<Set<string>>(new Set());

  const toggleExp = (id: string) =>
    setExpandido((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });

  const upsert = useMutation({
    mutationFn: async (payload: ApontamentoForm) => {
      if (!payload.diarista_id) throw new Error("Selecione o diarista");
      const eventos = payload.eventos.filter((e) => e.evento_nome.trim() !== "");
      if (payload.modo_divisao !== "unico" && eventos.length < 2) {
        throw new Error("Informe pelo menos 2 eventos para dividir o dia");
      }
      const row = {
        diarista_id: payload.diarista_id,
        projeto:
          payload.modo_divisao === "unico"
            ? payload.projeto.trim() || null
            : eventos.map((e) => e.evento_nome).join(" + "),
        data: payload.data,
        hora_inicial: payload.hora_inicial,
        hora_final: payload.hora_final,
        intervalo_minutos: Number(payload.intervalo_minutos) || 0,
        local: payload.local,
        obs: payload.obs.trim() || null,
        extra_manual: Number(payload.extra_manual) || 0,
        modo_divisao: payload.modo_divisao,
        almoco: !!payload.almoco,
        janta: !!payload.janta,
        diaria_minima: !!payload.diaria_minima,
        empeleita: !!payload.empeleita,
      };

      let apontamentoId = payload.id;
      if (payload.id) {
        const { error } = await (supabase as any)
          .from("diarista_apontamentos").update(row).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any)
          .from("diarista_apontamentos").insert(row).select("id").single();
        if (error) throw error;
        apontamentoId = data.id;
      }

      // Eventos do dia
      await (supabase as any)
        .from("diarista_apontamento_eventos")
        .delete()
        .eq("apontamento_id", apontamentoId);

      if (payload.modo_divisao !== "unico" && eventos.length > 0) {
        const { error } = await (supabase as any)
          .from("diarista_apontamento_eventos")
          .insert(
            eventos.map((e, i) => ({
              apontamento_id: apontamentoId,
              evento_nome: e.evento_nome.trim(),
              hora_inicial: payload.modo_divisao === "horarios" ? e.hora_inicial : null,
              hora_final: payload.modo_divisao === "horarios" ? e.hora_final : null,
              intervalo_minutos:
                payload.modo_divisao === "horarios" ? Number(e.intervalo_minutos) || 0 : 0,
              ordem: i,
              bloco: payload.modo_divisao === "horarios" ? (e.bloco ?? i) : i,
              empeleita: payload.modo_divisao === "horarios" ? !!e.empeleita : false,
            })),
          );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Apontamento salvo");
      qc.invalidateQueries({ queryKey: ["diarista_apontamentos"] });
      qc.invalidateQueries({ queryKey: ["diarista_apontamento_eventos"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("diarista_apontamentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Apontamento removido");
      qc.invalidateQueries({ queryKey: ["diarista_apontamentos"] });
      qc.invalidateQueries({ queryKey: ["diarista_apontamento_eventos"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const filtered = useMemo(() => {
    return apontamentos.filter((a) => {
      if (somenteProprios && a.created_by !== user?.id) return false;
      if (fDiarista !== "todos" && a.diarista_id !== fDiarista) return false;
      if (!matchDepto(diaristasMap.get(a.diarista_id), fDepto)) return false;
      if (fLocal !== "todos" && a.local !== fLocal) return false;
      if (fProjeto && !(a.projeto ?? "").toLowerCase().includes(fProjeto.toLowerCase())) return false;
      if (fSituacao === "aberto" && a.fechamento_id) return false;
      if (fSituacao === "pago" && !a.fechamento_id) return false;
      if (fSituacao === "empeleita" && !a.empeleita) return false;
      if (visao === "semana") {
        if (a.data < semana.iniYmd || a.data > semana.fimYmd) return false;
      } else {
        if (fDe && a.data < fDe) return false;
        if (fAte && a.data > fAte) return false;
      }
      return true;
    });
  }, [apontamentos, fDiarista, fDepto, diaristasMap, fLocal, fProjeto, fDe, fAte, fSituacao, visao, semana, somenteProprios, user?.id]);

  const calcDe = (a: Apontamento) => {
    const d = diaristasMap.get(a.diarista_id);
    if (!d) return null;
    const evs = eventosMap?.get(a.id) ?? [];
    return calcularApontamentoComEventos(a, tarifaDe(d), (a.modo_divisao ?? "unico") as ModoDivisao, evs);
  };

  const porDia = useMemo(() => {
    const m = new Map<string, Apontamento[]>();
    for (const a of filtered) {
      const arr = m.get(a.data);
      if (arr) arr.push(a);
      else m.set(a.data, [a]);
    }
    return m;
  }, [filtered]);

  const detalhe = useMemo(
    () => filtered.find((a) => a.id === detalheId) ?? null,
    [filtered, detalheId],
  );

  const abrirEdicao = (a: Apontamento) => {
    const evs = eventosMap?.get(a.id) ?? [];
    setEditing({
      id: a.id,
      diarista_id: a.diarista_id,
      projeto: a.projeto ?? "",
      data: a.data,
      hora_inicial: a.hora_inicial.slice(0, 5),
      hora_final: a.hora_final.slice(0, 5),
      intervalo_minutos: a.intervalo_minutos,
      local: (a.local as Local) ?? "Fortaleza",
      obs: a.obs ?? "",
      extra_manual: Number(a.extra_manual) || 0,
      modo_divisao: (a.modo_divisao ?? "unico") as ModoDivisao,
      almoco: !!a.almoco,
      janta: !!a.janta,
      diaria_minima: a.diaria_minima !== false,
      empeleita: !!a.empeleita,
      eventos: evs.map((e, i) => ({
        evento_nome: e.evento_nome,
        hora_inicial: e.hora_inicial || "08:00",
        hora_final: e.hora_final || "12:00",
        intervalo_minutos: e.intervalo_minutos,
        bloco: e.bloco ?? i,
        empeleita: !!e.empeleita,
      })),
    });
    setOpen(true);
  };


  // preview em tempo real no formulário
  const previewDiarista = diaristasMap.get(editing.diarista_id);
  const preview = previewDiarista
    ? calcularApontamentoComEventos(editing, tarifaDe(previewDiarista), editing.modo_divisao, editing.eventos)
    : null;

  const setEvento = (i: number, patch: Partial<EventoLinha>) =>
    setEditing((prev) => ({
      ...prev,
      eventos: prev.eventos.map((e, idx) => (idx === i ? { ...e, ...patch } : e)),
    }));

  // Blocos de horário (modo "horarios"): um mesmo horário pode ter vários projetos
  const blocos = useMemo(() => {
    const ordem: number[] = [];
    for (const e of editing.eventos) if (!ordem.includes(e.bloco)) ordem.push(e.bloco);
    return ordem;
  }, [editing.eventos]);

  const setBlocoHoras = (bloco: number, patch: Partial<EventoLinha>) =>
    setEditing((prev) => ({
      ...prev,
      eventos: prev.eventos.map((e) => (e.bloco === bloco ? { ...e, ...patch } : e)),
    }));

  const addBloco = () =>
    setEditing((prev) => {
      const novo = prev.eventos.reduce((m, e) => Math.max(m, e.bloco), -1) + 1;
      return { ...prev, eventos: [...prev.eventos, emptyEvento(novo)] };
    });

  const addProjetoNoBloco = (bloco: number) =>
    setEditing((prev) => {
      const base = prev.eventos.find((e) => e.bloco === bloco);
      return {
        ...prev,
        eventos: [
          ...prev.eventos,
          emptyEvento(bloco, {
            hora_inicial: base?.hora_inicial ?? "08:00",
            hora_final: base?.hora_final ?? "12:00",
            intervalo_minutos: base?.intervalo_minutos ?? 0,
          }),
        ],
      };
    });

  const removeBloco = (bloco: number) =>
    setEditing((prev) => ({ ...prev, eventos: prev.eventos.filter((e) => e.bloco !== bloco) }));

  const removeEvento = (idx: number) =>
    setEditing((prev) => ({ ...prev, eventos: prev.eventos.filter((_, i) => i !== idx) }));


  return (
    <div className="space-y-4">
      {/* Visualização */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={visao === "tabela" ? "default" : "outline"}
          onClick={() => setVisao("tabela")}
        >
          <List className="h-4 w-4 mr-1" /> Tabela
        </Button>
        <Button
          size="sm"
          variant={visao === "semana" ? "default" : "outline"}
          onClick={() => setVisao("semana")}
        >
          <LayoutGrid className="h-4 w-4 mr-1" /> Semana
        </Button>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-7 items-end">
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Diarista</Label>
            <Select value={fDiarista} onValueChange={setFDiarista}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {diaristas.filter((d) => matchDepto(d, fDepto)).map((d) => (
                  <SelectItem key={d.id} value={d.id}>{nomeExib(d)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Departamento</Label>
            <Select value={fDepto} onValueChange={setFDepto}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {opcoesDepartamento.map((dep) => (
                  <SelectItem key={dep} value={dep}>{dep}</SelectItem>
                ))}
                <SelectItem value="__sem">Sem departamento</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Local</Label>
            <Select value={fLocal} onValueChange={setFLocal}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="Fortaleza">Fortaleza</SelectItem>
                <SelectItem value="Fora">Fora</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Projeto</Label>
            <Input value={fProjeto} onChange={(e) => setFProjeto(e.target.value)} placeholder="Filtrar" />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Situação</Label>
            <Select value={fSituacao} onValueChange={(v) => setFSituacao(v as typeof fSituacao)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="aberto">Em aberto</SelectItem>
                <SelectItem value="pago">Pagas</SelectItem>
                <SelectItem value="empeleita">Empeleita</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {visao === "tabela" ? (
            <>
              <div className="space-y-1">
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">De</Label>
                <Input type="date" value={fDe} onChange={(e) => setFDe(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Até</Label>
                <Input type="date" value={fAte} onChange={(e) => setFAte(e.target.value)} />
              </div>
            </>
          ) : (
            <div className="space-y-1 col-span-2">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Semana</Label>
              <div className="flex items-center gap-1">
                <Button type="button" variant="outline" size="icon" className="h-9 w-9"
                  onClick={() => setSemanaRef((d) => subWeeks(d, 1))} aria-label="Semana anterior">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="flex-1 text-center text-xs font-medium tabular-nums">
                  {format(semana.ini, "dd/MM")} – {format(semana.fim, "dd/MM/yy")}
                </span>
                <Button type="button" variant="outline" size="icon" className="h-9 w-9"
                  onClick={() => setSemanaRef((d) => addWeeks(d, 1))} aria-label="Próxima semana">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
          <div>
            <Button
              className="w-full"
              onClick={() => { setEditing(emptyApontamento()); setOpen(true); }}
            >
              <Plus className="h-4 w-4 mr-1" /> Novo apontamento
            </Button>
          </div>
        </div>
      </Card>

      {/* Visão semanal em cards */}
      {visao === "semana" && (
        isLoading ? (
          <Card className="p-6 flex justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {semana.dias.map((dia) => {
              const ymd = format(dia, "yyyy-MM-dd");
              const itens = porDia.get(ymd) ?? [];
              const totalDia = itens.reduce((acc, a) => acc + (calcDe(a)?.total ?? 0), 0);
              return (
                <Card key={ymd} className="p-3 space-y-2">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <div className="text-sm font-semibold capitalize">
                        {format(dia, "EEEE", { locale: ptBR })}
                      </div>
                      <div className="text-[11px] text-muted-foreground tabular-nums">
                        {format(dia, "dd/MM/yyyy")}
                      </div>
                    </div>
                    <span className="text-[11px] text-muted-foreground">{itens.length}</span>
                  </div>
                  <div className="space-y-1">
                    {itens.length === 0 ? (
                      <div className="text-xs text-muted-foreground py-2">Sem lançamentos.</div>
                    ) : itens.map((a) => {
                      const calc = calcDe(a);
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => setDetalheId(a.id)}
                          className="w-full rounded-md border border-border/60 px-2 py-1.5 text-left hover:bg-muted/50"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium truncate">
                              {nomeExib(diaristasMap.get(a.diarista_id))}
                            </span>
                            <span className="text-[11px] tabular-nums text-muted-foreground">
                              {calc?.horasLabel ?? "—"}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center justify-between gap-2">
                            <span className="text-[11px] text-muted-foreground truncate">
                              {a.projeto || "—"}
                            </span>
                            {verValores && (
                              <span className="text-[11px] tabular-nums font-semibold">
                                {calc ? fmtBRL(calc.total) : "—"}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${a.fechamento_id ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                              {a.fechamento_id ? "pago" : "em aberto"}
                            </span>
                            {a.empeleita && (
                              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-600">
                                empeleita
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {verValores && itens.length > 0 && (
                    <div className="border-t border-border pt-1.5 flex items-center justify-between text-xs font-semibold">
                      <span>Total</span>
                      <span className="tabular-nums">{fmtBRL(totalDia)}</span>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )
      )}

      {/* Tabela */}
      {visao === "tabela" && (
      <Card className="p-4">
        {isLoading ? (
          <div className="p-6 flex justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Nenhum apontamento no filtro selecionado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-border text-muted-foreground text-xs uppercase tracking-wide">
                  <th className="py-2 pr-3 w-8" />
                  <th className="py-2 pr-3">Data</th>
                  <th className="py-2 px-3">Diarista</th>
                  <th className="py-2 px-3">Projeto</th>
                  <th className="py-2 px-3">Local</th>
                  <th className="py-2 px-3">Horário</th>
                  <th className="py-2 px-3 text-right">Interv.</th>
                  <th className="py-2 px-3 text-right">Horas</th>
                  {verValores && <th className="py-2 px-3 text-right">R$/h</th>}
                  {verValores && <th className="py-2 px-3 text-right">Diária</th>}
                  {verValores && <th className="py-2 px-3 text-right">Extra</th>}
                  {verValores && <th className="py-2 px-3 text-right">Total</th>}
                  <th className="py-2 pl-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const d = diaristasMap.get(a.diarista_id);
                  const calc = calcDe(a);
                  const evs = eventosMap?.get(a.id) ?? [];
                  const dividido = (a.modo_divisao ?? "unico") !== "unico" && evs.length > 0;
                  const aberto = expandido.has(a.id);
                  const colSpan = verValores ? 13 : 9;
                  return (
                    <Fragment key={a.id}>
                      <tr className="border-b border-border/50 hover:bg-muted/40">
                        <td className="py-2 pr-1">
                          {dividido && (
                            <Button size="icon" variant="ghost" className="h-6 w-6"
                              onClick={() => toggleExp(a.id)}
                            >
                              {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </Button>
                          )}
                        </td>
                        <td className="py-2 pr-3 tabular-nums">{fmtDate(a.data)}</td>
                        <td className="py-2 px-3 font-medium">{nomeExib(d)}</td>
                        <td className="py-2 px-3">
                          {a.projeto ?? "—"}
                          {a.empeleita && (
                            <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-600">
                              empeleita
                            </span>
                          )}
                          {dividido && (
                            <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                              {a.modo_divisao === "horarios" ? "por horários" : "dividido"}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3">{a.local}</td>
                        <td className="py-2 px-3 tabular-nums">
                          {intervaloExibicao(a, evs, (a.modo_divisao ?? "unico") as ModoDivisao).label}
                        </td>

                        <td className="py-2 px-3 text-right tabular-nums">{a.intervalo_minutos}min</td>
                        <td className="py-2 px-3 text-right tabular-nums">{calc?.horasLabel ?? "—"}</td>
                        {verValores && (
                          <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                            {calc ? fmtBRL(calc.valorHora) : "—"}
                          </td>
                        )}
                        {verValores && (
                          <td className="py-2 px-3 text-right tabular-nums">{calc ? fmtBRL(calc.diaria) : "—"}</td>
                        )}
                        {verValores && (
                          <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                            {calc ? fmtBRL(calc.extra) : "—"}
                          </td>
                        )}
                        {verValores && (
                          <td className="py-2 px-3 text-right tabular-nums font-semibold">
                            {calc ? fmtBRL(calc.total) : "—"}
                          </td>
                        )}
                        <td className="py-2 pl-3 text-right">
                          <div className="flex gap-1 justify-end">
                            <Button size="icon" variant="ghost" className="h-8 w-8"
                              onClick={() => {
                                setEditing({
                                  id: a.id,
                                  diarista_id: a.diarista_id,
                                  projeto: a.projeto ?? "",
                                  data: a.data,
                                  hora_inicial: a.hora_inicial.slice(0, 5),
                                  hora_final: a.hora_final.slice(0, 5),
                                  intervalo_minutos: a.intervalo_minutos,
                                  local: (a.local as Local) ?? "Fortaleza",
                                  obs: a.obs ?? "",
                                  extra_manual: Number(a.extra_manual) || 0,
                                  modo_divisao: (a.modo_divisao ?? "unico") as ModoDivisao,
                                  almoco: !!a.almoco,
                                  janta: !!a.janta,
                                  diaria_minima: a.diaria_minima !== false,
                                  empeleita: !!a.empeleita,
                                  eventos: evs.map((e, i) => ({
                                    evento_nome: e.evento_nome,
                                    hora_inicial: e.hora_inicial || "08:00",
                                    hora_final: e.hora_final || "12:00",
                                    intervalo_minutos: e.intervalo_minutos,
                                    bloco: e.bloco ?? i,
                                    empeleita: !!e.empeleita,
                                  })),
                                });
                                setOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => { if (confirm("Excluir este apontamento?")) remove.mutate(a.id); }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {dividido && aberto && (
                        <tr className="border-b border-border/50 bg-muted/20">
                          <td />
                          <td colSpan={colSpan - 1} className="py-2 px-3">
                            <div className="space-y-1">
                              {(calc?.rateio ?? []).map((r, i) => (
                                <div key={i} className="flex items-center justify-between gap-4 text-xs">
                                  <span className="font-medium">
                                    {r.evento_nome}
                                    {r.empeleita && (
                                      <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-600">
                                        empreitada
                                      </span>
                                    )}
                                  </span>
                                  <span className="tabular-nums text-muted-foreground">
                                    {r.horasLabel}
                                    {verValores ? ` · ${fmtBRL(r.valor)}` : ""}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              {verValores && (
                <tfoot>
                  <tr className="border-t border-border font-semibold">
                    <td colSpan={11} className="py-2 pr-3 text-right">Total</td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {fmtBRL(filtered.reduce((acc, a) => acc + (calcDe(a)?.total ?? 0), 0))}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </Card>
      )}

      {/* Detalhe do apontamento (visão semanal) */}
      <Dialog open={!!detalhe} onOpenChange={(v) => !v && setDetalheId(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do apontamento</DialogTitle>
          </DialogHeader>
          {detalhe && (() => {
            const d = diaristasMap.get(detalhe.diarista_id);
            const evs = eventosMap?.get(detalhe.id) ?? [];
            const calc = calcDe(detalhe);
            const modo = (detalhe.modo_divisao ?? "unico") as ModoDivisao;
            return (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <Info label="Diarista" value={nomeExib(d)} />
                  <Info label="Data" value={fmtDate(detalhe.data)} />
                  <Info label="Projeto" value={detalhe.projeto || "—"} />
                  <Info label="Local" value={detalhe.local} />
                  <Info label="Horário" value={intervaloExibicao(detalhe, evs, modo).label} />
                  <Info label="Intervalo" value={`${detalhe.intervalo_minutos}min`} />
                  <Info label="Horas" value={calc?.horasLabel ?? "—"} />
                  <Info label="Situação" value={detalhe.fechamento_id ? "Pago" : "Em aberto"} />
                  {detalhe.empeleita && <Info label="Empeleita" value="Sim" />}
                  {(detalhe.almoco || detalhe.janta) && (
                    <Info
                      label="Refeições"
                      value={[detalhe.almoco ? "Almoço" : null, detalhe.janta ? "Janta" : null].filter(Boolean).join(" · ")}
                    />
                  )}
                </div>

                {verValores && calc && (
                  <div className="rounded-md border border-border p-3 space-y-1">
                    <Linha label="Diária" value={fmtBRL(calc.diaria)} />
                    <Linha label="Extra" value={fmtBRL(calc.extra)} />
                    <Linha label="Total" value={fmtBRL(calc.total)} bold />
                  </div>
                )}

                {(calc?.rateio?.length ?? 0) > 0 && (
                  <div className="space-y-1">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Eventos</div>
                    {(calc?.rateio ?? []).map((r, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 text-xs">
                        <span className="font-medium">
                          {r.evento_nome}
                          {r.empeleita && (
                            <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-600">
                              empreitada
                            </span>
                          )}
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {r.horasLabel}{verValores ? ` · ${fmtBRL(r.valor)}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {detalhe.obs && (
                  <div className="text-xs text-muted-foreground whitespace-pre-wrap">{detalhe.obs}</div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" size="sm"
                    onClick={() => { const a = detalhe; setDetalheId(null); abrirEdicao(a); }}
                  >
                    <Pencil className="h-4 w-4 mr-1" /> Editar
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm("Excluir este apontamento?")) { remove.mutate(detalhe.id); setDetalheId(null); }
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Excluir
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>



      {/* Dialog Novo/Editar */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing.id ? "Editar apontamento" : "Novo apontamento"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Diarista</Label>
                <Select
                  value={editing.diarista_id}
                  onValueChange={(v) => setEditing({ ...editing, diarista_id: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {diaristasAtivos.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{nomeExib(d)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Local</Label>
                <Select
                  value={editing.local}
                  onValueChange={(v) => setEditing({ ...editing, local: v as Local })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Fortaleza">Fortaleza</SelectItem>
                    <SelectItem value="Fora">Fora</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label>Trabalhou em mais de um evento no dia?</Label>
                <Select
                  value={editing.modo_divisao}
                  onValueChange={(v) => {
                    const modo = v as ModoDivisao;
                    setEditing((prev) => ({
                      ...prev,
                      modo_divisao: modo,
                      eventos:
                        modo === "unico"
                          ? []
                          : prev.eventos.length >= 2
                            ? prev.eventos
                            : [emptyEvento(0), emptyEvento(1)],
                    }));
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unico">Não — um evento só</SelectItem>
                    <SelectItem value="horarios">Sim — informar os horários de cada evento</SelectItem>
                    <SelectItem value="igual">Sim — dividir o valor igualmente entre os eventos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {editing.modo_divisao === "unico" && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Projeto (evento)</Label>
                  <EventoSheetCombobox
                    value={editing.projeto || null}
                    onChange={(v) => setEditing({ ...editing, projeto: v ?? "" })}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Data</Label>
                <Input type="date" value={editing.data}
                  onChange={(e) => setEditing({ ...editing, data: e.target.value })} />
              </div>

              {editing.modo_divisao !== "horarios" && (
                <>
                  <div className="space-y-1.5">
                    <Label>Intervalo (min)</Label>
                    <Input type="number" min={0} value={editing.intervalo_minutos}
                      onChange={(e) => setEditing({ ...editing, intervalo_minutos: Number(e.target.value) || 0 })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Horário inicial</Label>
                    <Input type="time" value={editing.hora_inicial}
                      onChange={(e) => setEditing({ ...editing, hora_inicial: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Horário final</Label>
                    <Input type="time" value={editing.hora_final}
                      onChange={(e) => setEditing({ ...editing, hora_final: e.target.value })} />
                  </div>
                </>
              )}

              {verValores && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Extra (R$)</Label>
                  <MoneyInput value={editing.extra_manual}
                    onChange={(v) => setEditing({ ...editing, extra_manual: v })} />
                </div>
              )}
              <div className="sm:col-span-2 flex items-start justify-between gap-4 rounded-md border border-border p-3">
                <div>
                  <Label htmlFor="diaria-minima">Garantir diária de 8h</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {editing.diaria_minima
                      ? "Paga em diárias fechadas de 8h, arredondando para cima (ex.: 15h30 = 2 diárias)."
                      : "Paga estritamente as horas trabalhadas (valor/hora × horas)."}
                  </p>
                </div>
                <Switch
                  id="diaria-minima"
                  checked={editing.diaria_minima}
                  onCheckedChange={(v) => setEditing({ ...editing, diaria_minima: v })}
                />
              </div>
              <div className="sm:col-span-2 flex items-start justify-between gap-4 rounded-md border border-border p-3">
                <div>
                  <Label htmlFor="empeleita">Empreitada (empeleita)</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {editing.empeleita
                      ? "Não contabiliza valores — as horas ficam apenas como registro visual."
                      : "Pagamento normal por horas/diária."}
                  </p>
                </div>
                <Switch
                  id="empeleita"
                  checked={editing.empeleita}
                  onCheckedChange={(v) => setEditing({ ...editing, empeleita: v })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Refeições</Label>
                <div className="flex flex-wrap items-center gap-6">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={editing.almoco}
                      onCheckedChange={(v) => setEditing({ ...editing, almoco: v === true })}
                    />
                    Almoço
                    {verValores && (cfgRefeicao?.valor_almoco ?? 0) > 0 && (
                      <span className="text-xs text-muted-foreground">
                        ({fmtBRL(cfgRefeicao?.valor_almoco ?? 0)})
                      </span>
                    )}
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={editing.janta}
                      onCheckedChange={(v) => setEditing({ ...editing, janta: v === true })}
                    />
                    Janta
                    {verValores && (cfgRefeicao?.valor_janta ?? 0) > 0 && (
                      <span className="text-xs text-muted-foreground">
                        ({fmtBRL(cfgRefeicao?.valor_janta ?? 0)})
                      </span>
                    )}
                  </label>
                </div>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label>Observações</Label>
                <Textarea rows={2} value={editing.obs}
                  onChange={(e) => setEditing({ ...editing, obs: e.target.value })} />
              </div>
            </div>

            {/* Eventos do dia */}
            {editing.modo_divisao !== "unico" && (
              <div className="rounded-md border border-border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">
                      {editing.modo_divisao === "horarios" ? "Blocos de horário" : "Eventos do dia"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {editing.modo_divisao === "horarios"
                        ? "Informe cada faixa de horário e os projetos trabalhados nela. Com mais de um projeto no mesmo horário, o tempo e o valor são divididos igualmente entre eles."
                        : "O valor total do dia será dividido em partes iguais entre os eventos."}
                    </div>
                  </div>
                  <Button size="sm" variant="outline"
                    onClick={() =>
                      editing.modo_divisao === "horarios"
                        ? addBloco()
                        : setEditing((p) => ({
                            ...p,
                            eventos: [...p.eventos, emptyEvento(p.eventos.length)],
                          }))
                    }
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    {editing.modo_divisao === "horarios" ? "Adicionar bloco" : "Adicionar evento"}
                  </Button>
                </div>

                {editing.modo_divisao === "horarios"
                  ? blocos.map((bloco, bi) => {
                      const base = editing.eventos.find((e) => e.bloco === bloco);
                      return (
                        <div key={bloco} className="rounded-md border border-border/60 p-2 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                              Bloco {bi + 1}
                              {base?.empeleita && (
                                <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-amber-600">
                                  empreitada
                                </span>
                              )}
                            </Label>
                            <div className="flex items-center gap-2">
                              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                                Empreitada
                                <Switch
                                  checked={!!base?.empeleita}
                                  onCheckedChange={(v) => setBlocoHoras(bloco, { empeleita: v })}
                                />
                              </label>
                              <Button size="icon" variant="ghost"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => removeBloco(bloco)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          {base?.empeleita && (
                            <p className="text-[11px] text-muted-foreground">
                              As horas deste bloco ficam apenas como registro — não entram no cálculo do valor do dia.
                            </p>
                          )}
                          <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Início</Label>
                              <Input type="time" value={base?.hora_inicial ?? "08:00"}
                                onChange={(e) => setBlocoHoras(bloco, { hora_inicial: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Fim</Label>
                              <Input type="time" value={base?.hora_final ?? "12:00"}
                                onChange={(e) => setBlocoHoras(bloco, { hora_final: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Intervalo (min)</Label>
                              <Input type="number" min={0} value={base?.intervalo_minutos ?? 0}
                                onChange={(e) =>
                                  setBlocoHoras(bloco, { intervalo_minutos: Number(e.target.value) || 0 })
                                } />
                            </div>
                          </div>
                          <div className="space-y-2">
                            {editing.eventos.map((ev, i) =>
                              ev.bloco !== bloco ? null : (
                                <div key={i} className="flex items-end gap-2">
                                  <div className="flex-1 space-y-1">
                                    <Label className="text-xs">Projeto</Label>
                                    <EventoSheetCombobox
                                      value={ev.evento_nome || null}
                                      onChange={(v) => setEvento(i, { evento_nome: v ?? "" })}
                                    />
                                  </div>
                                  <Button size="icon" variant="ghost"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => removeEvento(i)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              ),
                            )}
                            <Button size="sm" variant="ghost" onClick={() => addProjetoNoBloco(bloco)}>
                              <Plus className="h-4 w-4 mr-1" /> Adicionar projeto neste bloco
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  : editing.eventos.map((ev, i) => (
                      <div key={i} className="rounded-md border border-border/60 p-2">
                        <div className="flex items-end gap-2">
                          <div className="flex-1 space-y-1.5">
                            <Label className="text-xs">Evento {i + 1}</Label>
                            <EventoSheetCombobox
                              value={ev.evento_nome || null}
                              onChange={(v) => setEvento(i, { evento_nome: v ?? "" })}
                            />
                          </div>
                          <Button size="icon" variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => removeEvento(i)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
              </div>
            )}

            {/* Preview de cálculo */}
            <div className="rounded-md border border-border bg-muted/40 p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                Cálculo automático
              </div>
              {preview ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
                    <div>
                      <div className="text-muted-foreground text-xs">Horas trabalhadas</div>
                      <div className="font-semibold tabular-nums">{preview.horasLabel}</div>
                    </div>
                    {verValores && (
                      <>
                        <div>
                          <div className="text-muted-foreground text-xs">Valor/hora</div>
                          <div className="tabular-nums">{fmtBRL(preview.valorHora)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-xs">Valor da diária</div>
                          <div className="tabular-nums">{fmtBRL(preview.diaria)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-xs">Extra</div>
                          <div className="tabular-nums">{fmtBRL(preview.extra)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-xs">Refeições</div>
                          <div className="tabular-nums">{fmtBRL(preview.refeicoes)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-xs">Total</div>
                          <div className="font-semibold tabular-nums">{fmtBRL(preview.total)}</div>
                        </div>
                      </>
                    )}
                  </div>
                  {preview.rateio.length > 0 && (
                    <div className="mt-3 space-y-1 border-t border-border pt-2">
                      {preview.rateio.map((r, i) => (
                        <div key={i} className="flex items-center justify-between gap-3 text-xs">
                          <span>
                            {r.evento_nome || `Evento ${i + 1}`}
                            {r.empeleita && (
                              <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-600">
                                empreitada
                              </span>
                            )}
                          </span>
                          <span className="tabular-nums text-muted-foreground">
                            {r.horasLabel}
                            {verValores ? ` · ${fmtBRL(r.valor)}` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-xs text-muted-foreground">
                  Selecione um diarista para ver o cálculo.
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => upsert.mutate(editing)}
              disabled={upsert.isPending}
            >
              {upsert.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Fechamento / Relatório
// ─────────────────────────────────────────────────────────────

function FechamentoTab() {
  const hoje = new Date();
  const ini = subDays(startOfWeek(hoje, { weekStartsOn: 1 }), 7);
  return (
    <FechamentoView
      deInicial={format(ini, "yyyy-MM-dd")}
      ateInicial={format(endOfWeek(ini, { weekStartsOn: 1 }), "yyyy-MM-dd")}
      filePrefix="fechamento-diaristas"
      permitirFechar
    />
  );
}

function RelatoriosTab() {
  const hoje = new Date();
  const qc = useQueryClient();
  const { isFinAdmin } = useDiaristaAcesso();
  const { data: fechamentos = [] } = useFechamentos();
  const [selId, setSelId] = useState<string>("");
  const sel = fechamentos.find((f) => f.id === selId) ?? null;

  const reabrir = useMutation({
    mutationFn: async (f: Fechamento) => {
      const { error: e1 } = await (supabase as any)
        .from("diarista_apontamentos")
        .update({ fechamento_id: null })
        .eq("fechamento_id", f.id);
      if (e1) throw e1;
      const { error: e2 } = await (supabase as any)
        .from("diarista_fechamentos")
        .delete()
        .eq("id", f.id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Fechamento reaberto");
      setSelId("");
      qc.invalidateQueries({ queryKey: ["diarista_fechamentos"] });
      qc.invalidateQueries({ queryKey: ["diarista_apontamentos"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao reabrir"),
  });

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="text-sm font-semibold">Fechamentos realizados</div>
          {sel && (
            <Button variant="ghost" size="sm" onClick={() => setSelId("")}>
              Ver período livre
            </Button>
          )}
        </div>
        {fechamentos.length === 0 ? (
          <div className="text-xs text-muted-foreground">
            Nenhum fechamento registrado ainda. Use a aba Fechamento para fechar e marcar diárias como pagas.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-border text-muted-foreground text-xs uppercase tracking-wide">
                  <th className="py-2 pr-3">Período</th>
                  <th className="py-2 px-3">Filtros</th>
                  <th className="py-2 px-3 text-right">Dias</th>
                  <th className="py-2 px-3 text-right">Valor</th>
                  <th className="py-2 px-3">Pagamento</th>
                  <th className="py-2 pl-3" />
                </tr>
              </thead>
              <tbody>
                {fechamentos.map((f) => (
                  <tr
                    key={f.id}
                    className={`border-b border-border/50 cursor-pointer hover:bg-muted/40 ${
                      selId === f.id ? "bg-muted/60" : ""
                    }`}
                    onClick={() => setSelId(f.id)}
                  >
                    <td className="py-2 pr-3 tabular-nums">
                      {fmtDate(f.periodo_inicio)} a {fmtDate(f.periodo_fim)}
                    </td>
                    <td className="py-2 px-3 text-xs text-muted-foreground">
                      {(f.filtros?.descricao as string) || "—"}
                      {f.observacao ? ` · ${f.observacao}` : ""}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">{f.total_dias}</td>
                    <td className="py-2 px-3 text-right tabular-nums font-semibold">
                      {fmtBRL(Number(f.total_valor) || 0)}
                    </td>
                    <td className="py-2 px-3 tabular-nums">{fmtDate(f.data_pagamento)}</td>
                    <td className="py-2 pl-3 text-right">
                      {isFinAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Reabrir este fechamento? As diárias voltam para 'Em aberto'.")) {
                              reabrir.mutate(f);
                            }
                          }}
                        >
                          Reabrir
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <FechamentoView
        key={sel?.id ?? "livre"}
        deInicial={sel ? sel.periodo_inicio : format(startOfMonth(hoje), "yyyy-MM-dd")}
        ateInicial={sel ? sel.periodo_fim : format(endOfMonth(hoje), "yyyy-MM-dd")}
        filePrefix="relatorio-diaristas"
        agruparPorEvento
        fechamentoSel={sel}
      />
    </div>
  );
}

function FechamentoView({
  deInicial,
  ateInicial,
  filePrefix,
  agruparPorEvento = false,
  permitirFechar = false,
  fechamentoSel = null,
}: {
  deInicial: string;
  ateInicial: string;
  filePrefix: string;
  agruparPorEvento?: boolean;
  permitirFechar?: boolean;
  fechamentoSel?: Fechamento | null;
}) {
  const { data: diaristas = [] } = useDiaristas();
  const { data: apontamentos = [], isLoading } = useApontamentos();
  const { data: eventosMap } = useApontamentoEventos();
  const { data: cfgRefeicao } = useDiaristaConfig();
  const tarifaDe = (d: Diarista) => ({
    ...d,
    valor_almoco: cfgRefeicao?.valor_almoco ?? 0,
    valor_janta: cfgRefeicao?.valor_janta ?? 0,
  });




  const opcoesDepartamento = useOpcoesDepartamento(diaristas);

  const diaristasMap = useMemo(
    () => new Map(diaristas.map((d) => [d.id, d])),
    [diaristas],
  );

  const qc = useQueryClient();
  const { user } = useAuth();
  const { isFinAdmin } = useDiaristaAcesso();

  const [de, setDe] = useState<string>(deInicial);
  const [ate, setAte] = useState<string>(ateInicial);
  const [fLocal, setFLocal] = useState<string>("todos");
  const [fDiarista, setFDiarista] = useState<string>("todos");
  const [fDepto, setFDepto] = useState<string>("todos");
  const [fSituacao, setFSituacao] = useState<string>("todas");
  const [expandido, setExpandido] = useState<Set<string>>(new Set());
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [fecharOpen, setFecharOpen] = useState(false);
  const [dataPagamento, setDataPagamento] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [observacao, setObservacao] = useState("");

  const toggleExp = (id: string) => {
    setExpandido((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const toggleSel = (id: string) => {
    setSelecionados((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const linhas = useMemo(() => {
    const filtrados = apontamentos.filter((a) => {
      if (fechamentoSel) {
        if (a.fechamento_id !== fechamentoSel.id) return false;
      } else {
        if (de && a.data < de) return false;
        if (ate && a.data > ate) return false;
      }
      if (fLocal !== "todos" && a.local !== fLocal) return false;
      if (fDiarista !== "todos" && a.diarista_id !== fDiarista) return false;
      if (!matchDepto(diaristasMap.get(a.diarista_id), fDepto)) return false;
      if (fSituacao === "aberto" && a.fechamento_id) return false;
      if (fSituacao === "pago" && !a.fechamento_id) return false;
      return true;
    });

    type EventoAgregado = { nome: string; dias: number; minutos: number; total: number };
    const grupos = new Map<string, {
      diarista: Diarista | undefined;
      dias: number;
      pagos: number;
      minutos: number;
      total: number;
      itens: Array<{ ap: Apontamento; calc: ReturnType<typeof calcularApontamento> | null }>;
      eventos: Map<string, EventoAgregado>;
    }>();

    for (const a of filtrados) {
      const d = diaristasMap.get(a.diarista_id);
      const t = d ? tarifaDe(d) : null;
      const evs = eventosMap?.get(a.id) ?? [];
      const modo = (a.modo_divisao ?? "unico") as ModoDivisao;
      const calcEv =
        t && modo !== "unico" && evs.length > 0
          ? calcularApontamentoComEventos(a, t, modo, evs)
          : null;
      const calc = calcEv ?? (t ? calcularApontamento(a, t) : null);
      const g = grupos.get(a.diarista_id) ?? {
        diarista: d, dias: 0, pagos: 0, minutos: 0, total: 0, itens: [], eventos: new Map<string, EventoAgregado>(),
      };
      g.dias += 1;
      if (a.fechamento_id) g.pagos += 1;
      g.minutos += calc?.minutosTrabalhados ?? 0;
      g.total += calc?.total ?? 0;
      g.itens.push({ ap: a, calc });

      // Fatias por evento (ignora o dia; soma por evento dentro do período)
      const fatias =
        calcEv && calcEv.rateio.length > 0
          ? calcEv.rateio.map((r) => ({
              nome: (r.evento_nome ?? "").trim() || "Sem evento",
              minutos: r.minutos,
              valor: r.valor,
            }))
          : [{
              nome: (a.projeto ?? "").trim() || "Sem evento",
              minutos: calc?.minutosTrabalhados ?? 0,
              valor: calc?.total ?? 0,
            }];
      for (const f of fatias) {
        const chave = f.nome.toLocaleLowerCase("pt-BR");
        const ag = g.eventos.get(chave) ?? { nome: f.nome, dias: 0, minutos: 0, total: 0 };
        ag.dias += 1;
        ag.minutos += f.minutos;
        ag.total += f.valor;
        g.eventos.set(chave, ag);
      }

      grupos.set(a.diarista_id, g);
    }

    return [...grupos.entries()]
      .map(([id, g]) => ({
        id,
        ...g,
        statusLabel:
          g.pagos === 0 ? "Em aberto" : g.pagos === g.dias ? "Pago" : "Parcial",
        eventos: [...g.eventos.values()].sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR")),
      }))
      .sort((a, b) => nomeExib(a.diarista).localeCompare(nomeExib(b.diarista), "pt-BR"));
  }, [apontamentos, de, ate, fLocal, fDiarista, fDepto, fSituacao, fechamentoSel, diaristasMap, eventosMap, cfgRefeicao]);

  // Diárias em aberto por diarista (base do fechamento)
  const abertosPorDiarista = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const l of linhas) {
      const ids = l.itens.filter((it) => !it.ap.fechamento_id).map((it) => it.ap.id);
      if (ids.length) m.set(l.id, ids);
    }
    return m;
  }, [linhas]);

  const idsParaFechar = useMemo(
    () => [...selecionados].flatMap((id) => abertosPorDiarista.get(id) ?? []),
    [selecionados, abertosPorDiarista],
  );

  const resumoSelecao = useMemo(() => {
    let dias = 0, minutos = 0, valor = 0;
    for (const l of linhas) {
      if (!selecionados.has(l.id)) continue;
      for (const it of l.itens) {
        if (it.ap.fechamento_id) continue;
        dias += 1;
        minutos += it.calc?.minutosTrabalhados ?? 0;
        valor += it.calc?.total ?? 0;
      }
    }
    return { dias, minutos, valor, pessoas: selecionados.size };
  }, [linhas, selecionados]);

  const descricaoFiltros = () => {
    const f: string[] = [];
    if (fLocal !== "todos") f.push(`Local: ${fLocal}`);
    if (fDepto !== "todos") f.push(`Departamento: ${fDepto === "__sem" ? "Sem departamento" : fDepto}`);
    if (fDiarista !== "todos") f.push(`Diarista: ${nomeExib(diaristasMap.get(fDiarista))}`);
    return f;
  };

  const fechar = useMutation({
    mutationFn: async () => {
      if (idsParaFechar.length === 0) throw new Error("Nenhuma diária em aberto selecionada.");
      const { data, error } = await (supabase as any)
        .from("diarista_fechamentos")
        .insert({
          periodo_inicio: de,
          periodo_fim: ate,
          filtros: {
            descricao: descricaoFiltros().join(" · "),
            diaristas: [...selecionados],
          },
          total_dias: resumoSelecao.dias,
          total_minutos: resumoSelecao.minutos,
          total_valor: Number(resumoSelecao.valor.toFixed(2)),
          data_pagamento: dataPagamento,
          observacao: observacao.trim() || null,
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      const { error: e2 } = await (supabase as any)
        .from("diarista_apontamentos")
        .update({ fechamento_id: data.id })
        .in("id", idsParaFechar);
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Fechamento realizado — diárias marcadas como pagas");
      setFecharOpen(false);
      setSelecionados(new Set());
      setObservacao("");
      qc.invalidateQueries({ queryKey: ["diarista_apontamentos"] });
      qc.invalidateQueries({ queryKey: ["diarista_fechamentos"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao fechar"),
  });

  const podeFechar = permitirFechar && isFinAdmin;


  const totalGeral = linhas.reduce((acc, l) => acc + l.total, 0);
  const totalDias = linhas.reduce((acc, l) => acc + l.dias, 0);
  const totalMinutos = linhas.reduce((acc, l) => acc + l.minutos, 0);

  const exportarPdf = async () => {
    const { gerarRelatorioDiaristasPdf } = await import("@/lib/diaristas-pdf");
    const filtros: string[] = [];
    if (fLocal !== "todos") filtros.push(`Local: ${fLocal}`);
    if (fDepto !== "todos")
      filtros.push(`Departamento: ${fDepto === "__sem" ? "Sem departamento" : fDepto}`);
    if (fDiarista !== "todos")
      filtros.push(`Diarista: ${nomeExib(diaristasMap.get(fDiarista))}`);

    await gerarRelatorioDiaristasPdf({
      de,
      ate,
      filtros,
      porEvento: agruparPorEvento,
      grupos: linhas.map((l) => ({
        eventos: l.eventos.map((e) => ({
          evento: e.nome,
          dias: e.dias,
          horasLabel: formatHoras(e.minutos),
          total: e.total,
        })),
        nome:
          ((l.diarista?.apelido ?? "").trim()
            ? `${nomeExib(l.diarista)} (${l.diarista?.nome})`
            : nomeExib(l.diarista)) +
          ((l.diarista?.departamento ?? "").trim()
            ? ` · ${l.diarista?.departamento}`
            : ""),
        statusLabel: l.statusLabel,
        chavePix: l.diarista?.chave_pix ?? null,
        dias: l.dias,
        horasLabel: formatHoras(l.minutos),
        total: l.total,
        valorHoraFortaleza: Number(l.diarista?.valor_hora_fortaleza) || 0,
        valorHoraFora: Number(l.diarista?.valor_hora_fora) || 0,
        itens: l.itens.map((it) => {
          const evs = eventosMap?.get(it.ap.id) ?? [];
          const modo = it.ap.modo_divisao ?? "unico";
          return {
            data: it.ap.data,
            projeto: it.ap.projeto ?? "",
            local: it.ap.local,
            horarioLabel: intervaloExibicao(it.ap, evs, modo as ModoDivisao).label,
            horasLabel: it.calc?.horasLabel ?? "",

            diaria: it.calc?.diaria ?? 0,
            extra: it.calc?.extra ?? 0,
            refeicoes: it.calc?.refeicoes ?? 0,
            total: it.calc?.total ?? 0,
          };
        }),
      })),
      totais: { dias: totalDias, horasLabel: formatHoras(totalMinutos), valor: totalGeral },
    });
  };

  const exportar = async (formato: "xlsx" | "csv") => {

    const header = ["Diarista", "Chave Pix", "Situação", "Qtde de dias", "Total de horas", "Total a pagar"];
    const body = linhas.map((l) => [
      nomeExib(l.diarista),
      l.diarista?.chave_pix ?? "",
      l.statusLabel,
      l.dias,
      formatHoras(l.minutos),
      Number(l.total.toFixed(2)),
    ]);
    const foot = ["TOTAL", "", "", totalDias, formatHoras(totalMinutos), Number(totalGeral.toFixed(2))];

    if (formato === "csv") {
      const rows = [header, ...body, foot];
      const csv = rows.map((r) =>
        r.map((v) => {
          const s = String(v ?? "");
          return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        }).join(";")
      ).join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filePrefix}-${de}_a_${ate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    const XLSX = await loadXLSX();
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["Fechamento — Diaristas"],
      ["Período", `${fmtDate(de)} a ${fmtDate(ate)}`],
      [],
      header,
      ...body,
      [],
      foot,
    ]);
    ws["!cols"] = [{ wch: 28 }, { wch: 32 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws, "Resumo");

    // Detalhe
    if (agruparPorEvento) {
      const evHeader = ["Diarista", "Evento / Projeto", "Dias", "Horas", "Total"];
      const evBody: any[][] = [];
      for (const l of linhas) {
        for (const e of l.eventos) {
          evBody.push([
            nomeExib(l.diarista),
            e.nome,
            e.dias,
            formatHoras(e.minutos),
            Number(e.total.toFixed(2)),
          ]);
        }
      }
      const wsEv = XLSX.utils.aoa_to_sheet([evHeader, ...evBody]);
      wsEv["!cols"] = [{ wch: 24 }, { wch: 40 }, { wch: 8 }, { wch: 12 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, wsEv, "Por evento");
    } else {
      const detHeader = ["Diarista", "Data", "Projeto", "Local", "Horas", "Diária", "Extra", "Total"];
      const detBody: any[][] = [];
      for (const l of linhas) {
        for (const it of l.itens) {
          detBody.push([
            nomeExib(l.diarista),
            fmtDate(it.ap.data),
            it.ap.projeto ?? "",
            it.ap.local,
            it.calc?.horasLabel ?? "",
            Number((it.calc?.diaria ?? 0).toFixed(2)),
            Number((it.calc?.extra ?? 0).toFixed(2)),
            Number((it.calc?.total ?? 0).toFixed(2)),
          ]);
        }
      }
      const ws2 = XLSX.utils.aoa_to_sheet([detHeader, ...detBody]);
      ws2["!cols"] = [{ wch: 24 }, { wch: 12 }, { wch: 28 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, ws2, "Detalhe");
    }

    XLSX.writeFile(wb, `${filePrefix}-${de}_a_${ate}.xlsx`);
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card className="p-4">
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-7 items-end">
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">De</Label>
            <Input type="date" value={de} disabled={!!fechamentoSel} onChange={(e) => setDe(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Até</Label>
            <Input type="date" value={ate} disabled={!!fechamentoSel} onChange={(e) => setAte(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Situação</Label>
            <Select value={fSituacao} onValueChange={setFSituacao}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="aberto">Em aberto</SelectItem>
                <SelectItem value="pago">Pagas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Local</Label>
            <Select value={fLocal} onValueChange={setFLocal}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="Fortaleza">Fortaleza</SelectItem>
                <SelectItem value="Fora">Fora</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Departamento</Label>
            <Select value={fDepto} onValueChange={setFDepto}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {opcoesDepartamento.map((dep) => (
                  <SelectItem key={dep} value={dep}>{dep}</SelectItem>
                ))}
                <SelectItem value="__sem">Sem departamento</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Diarista</Label>
            <Select value={fDiarista} onValueChange={setFDiarista}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {diaristas.filter((d) => matchDepto(d, fDepto)).map((d) => (
                  <SelectItem key={d.id} value={d.id}>{nomeExib(d)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="w-full" variant="outline" disabled={linhas.length === 0}>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportarPdf()}>PDF (relatório)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportar("xlsx")}>Excel (.xlsx)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportar("csv")}>CSV</DropdownMenuItem>

              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </Card>

      {podeFechar && (
        <Card className="p-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {resumoSelecao.pessoas === 0 ? (
              "Selecione os diaristas para fechar as diárias em aberto do período."
            ) : (
              <>
                <span className="font-medium text-foreground">{resumoSelecao.pessoas}</span> pessoa(s) ·{" "}
                <span className="font-medium text-foreground">{resumoSelecao.dias}</span> dia(s) ·{" "}
                {formatHoras(resumoSelecao.minutos)} ·{" "}
                <span className="font-semibold text-foreground">{fmtBRL(resumoSelecao.valor)}</span>
              </>
            )}
          </div>
          <Button
            disabled={idsParaFechar.length === 0}
            onClick={() => {
              setDataPagamento(format(new Date(), "yyyy-MM-dd"));
              setFecharOpen(true);
            }}
          >
            Fechar e marcar como pago
          </Button>
        </Card>
      )}

      {/* Tabela consolidada */}
      <Card className="p-4">
        {isLoading ? (
          <div className="p-6 flex justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : linhas.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Nenhum apontamento no período selecionado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-border text-muted-foreground text-xs uppercase tracking-wide">
                  {podeFechar && (
                    <th className="py-2 pr-2 w-8">
                      <Checkbox
                        checked={
                          abertosPorDiarista.size > 0 &&
                          [...abertosPorDiarista.keys()].every((id) => selecionados.has(id))
                        }
                        onCheckedChange={(v) =>
                          setSelecionados(v ? new Set(abertosPorDiarista.keys()) : new Set())
                        }
                      />
                    </th>
                  )}
                  <th className="py-2 pr-3 w-8" />
                  <th className="py-2 px-3">Diarista</th>
                  <th className="py-2 px-3">Chave Pix</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 text-right">Dias</th>
                  <th className="py-2 px-3 text-right">Total de horas</th>
                  <th className="py-2 pl-3 text-right">Total a pagar</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => {
                  const aberto = expandido.has(l.id);
                  const abertosDaLinha = abertosPorDiarista.get(l.id)?.length ?? 0;
                  return (
                    <Fragment key={l.id}>
                      <tr key={l.id} className="border-b border-border/50 hover:bg-muted/40 cursor-pointer"
                        onClick={() => toggleExp(l.id)}>
                        {podeFechar && (
                          <td className="py-2 pr-2" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              disabled={abertosDaLinha === 0}
                              checked={selecionados.has(l.id)}
                              onCheckedChange={(v) =>
                                setSelecionados((prev) => {
                                  const n = new Set(prev);
                                  if (v) n.add(l.id); else n.delete(l.id);
                                  return n;
                                })
                              }
                            />
                          </td>
                        )}
                        <td className="py-2 pr-3">
                          {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </td>
                        <td className="py-2 px-3 font-medium">
                          <div>{nomeExib(l.diarista)}</div>
                          {(l.diarista?.apelido ?? "").trim() && (
                            <div className="text-[11px] font-normal text-muted-foreground">
                              {l.diarista?.nome}
                            </div>
                          )}

                          {(() => {
                            const vf = Number(l.diarista?.valor_hora_fortaleza) || 0;
                            const vo = Number(l.diarista?.valor_hora_fora) || 0;
                            const partes = [
                              vf > 0 ? `Fortaleza ${fmtBRL(vf)}/h` : null,
                              vo > 0 ? `Fora ${fmtBRL(vo)}/h` : null,
                            ].filter(Boolean);
                            return partes.length ? (
                              <div className="text-[11px] font-normal text-muted-foreground">
                                {partes.join(" · ")}
                              </div>
                            ) : null;
                          })()}
                        </td>
                        <td className="py-2 px-3 text-xs text-muted-foreground">{l.diarista?.chave_pix ?? "—"}</td>
                        <td className="py-2 px-3">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border",
                              l.statusLabel === "Pago"
                                ? "bg-success/15 text-success border-success/30"
                                : l.statusLabel === "Parcial"
                                  ? "bg-warning/15 text-warning border-warning/30"
                                  : "bg-muted text-muted-foreground border-border",
                            )}
                          >
                            {l.statusLabel}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums">{l.dias}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{formatHoras(l.minutos)}</td>
                        <td className="py-2 pl-3 text-right tabular-nums font-semibold">{fmtBRL(l.total)}</td>
                      </tr>
                      {aberto && agruparPorEvento && (
                        <tr key={l.id + "-ev"} className="bg-muted/30">
                          <td />
                          <td colSpan={podeFechar ? 7 : 6} className="p-3">
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-left border-b border-border/60 text-muted-foreground">
                                    <th className="py-1 pr-2">Evento / Projeto</th>
                                    <th className="py-1 px-2 text-right">Dias</th>
                                    <th className="py-1 px-2 text-right">Horas</th>
                                    <th className="py-1 pl-2 text-right">Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {l.eventos.map((e) => (
                                    <tr key={e.nome} className="border-b border-border/40">
                                      <td className="py-1 pr-2">{e.nome}</td>
                                      <td className="py-1 px-2 text-right tabular-nums">{e.dias}</td>
                                      <td className="py-1 px-2 text-right tabular-nums">{formatHoras(e.minutos)}</td>
                                      <td className="py-1 pl-2 text-right tabular-nums font-medium">{fmtBRL(e.total)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                      {aberto && !agruparPorEvento && (
                        <tr key={l.id + "-det"} className="bg-muted/30">
                          <td />
                          <td colSpan={podeFechar ? 7 : 6} className="p-3">
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-left border-b border-border/60 text-muted-foreground">
                                    <th className="py-1 pr-2">Data</th>
                                    <th className="py-1 px-2">Projeto</th>
                                    <th className="py-1 px-2">Local</th>
                                    <th className="py-1 px-2">Horário</th>
                                    <th className="py-1 px-2 text-right">Horas</th>
                                    <th className="py-1 px-2 text-right">Diária</th>
                                    <th className="py-1 px-2 text-right">Extra</th>
                                    <th className="py-1 px-2 text-right">Refeições</th>
                                    <th className="py-1 pl-2 text-right">Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {l.itens.map((it) => (
                                    <tr key={it.ap.id} className="border-b border-border/40">
                                      <td className="py-1 pr-2 tabular-nums">{fmtDate(it.ap.data)}</td>
                                      <td className="py-1 px-2">{it.ap.projeto ?? "—"}</td>
                                      <td className="py-1 px-2">{it.ap.local}</td>
                                      <td className="py-1 px-2 tabular-nums">
                                        {intervaloExibicao(
                                          it.ap,
                                          eventosMap?.get(it.ap.id) ?? [],
                                          (it.ap.modo_divisao ?? "unico") as ModoDivisao,
                                        ).label}
                                      </td>
                                      <td className="py-1 px-2 text-right tabular-nums">{it.calc?.horasLabel ?? "—"}</td>
                                      <td className="py-1 px-2 text-right tabular-nums">{fmtBRL(it.calc?.diaria ?? 0)}</td>
                                      <td className="py-1 px-2 text-right tabular-nums">{fmtBRL(it.calc?.extra ?? 0)}</td>
                                      <td className="py-1 px-2 text-right tabular-nums">{fmtBRL(it.calc?.refeicoes ?? 0)}</td>
                                      <td className="py-1 pl-2 text-right tabular-nums font-medium">{fmtBRL(it.calc?.total ?? 0)}</td>
                                    </tr>
                                  ))}

                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-semibold">
                  {podeFechar && <td />}
                  <td />
                  <td className="py-2 px-3">TOTAL GERAL</td>
                  <td />
                  <td />
                  <td className="py-2 px-3 text-right tabular-nums">{totalDias}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{formatHoras(totalMinutos)}</td>
                  <td className="py-2 pl-3 text-right tabular-nums">{fmtBRL(totalGeral)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={fecharOpen} onOpenChange={setFecharOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fechar diárias</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border border-border p-3 text-sm space-y-1">
              <div>Período: <b>{fmtDate(de)} a {fmtDate(ate)}</b></div>
              <div>Pessoas: <b>{resumoSelecao.pessoas}</b> · Dias: <b>{resumoSelecao.dias}</b></div>
              <div>Horas: <b>{formatHoras(resumoSelecao.minutos)}</b></div>
              <div>Total a pagar: <b>{fmtBRL(resumoSelecao.valor)}</b></div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data do pagamento</Label>
              <Input type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Observação</Label>
              <Input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Opcional" />
            </div>
            <p className="text-[11px] text-muted-foreground">
              As diárias incluídas serão marcadas como pagas e não poderão mais ser editadas pelos lançadores.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFecharOpen(false)}>Cancelar</Button>
            <Button disabled={fechar.isPending} onClick={() => fechar.mutate()}>
              {fechar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar fechamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
