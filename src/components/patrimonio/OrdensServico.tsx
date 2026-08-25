import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Printer, Search, Trash2, Undo2, X } from "lucide-react";
import { gerarOSPdf } from "@/lib/patrimonio/os-pdf";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { EventoSheetCombobox } from "@/components/EventoSheetCombobox";
import {
  PatGroupSelect,
  buildPatGroups,
  allocateFromGroup,
  type PatItem,
} from "@/components/patrimonio/PatGroupSelect";
import { normalize } from "@/lib/utils";

type OS = {
  id: string;
  numero: number;
  tipo: string;
  evento_projeto: string | null;
  tomador_id: string | null;
  retirante_nome: string | null;
  retirante_cpf: string | null;
  data_saida: string;
  previsao_retorno: string | null;
  responsavel: string | null;
  observacoes: string | null;
  status: string;
  created_at: string;
};

type OSItem = {
  id: string;
  os_id: string;
  item_id: string | null;
  quantidade: number;
  quantidade_devolvida: number;
  quantidade_perdida: number;
};

type Tomador = {
  id: string;
  tipo: string;
  nome: string;
  documento: string | null;
  endereco: string | null;
  contato_nome: string | null;
  contato_telefone: string | null;
  email: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  parcial: "Parcial",
  concluida: "Concluída",
};

const hoje = () => new Date().toISOString().slice(0, 10);

/** Nomes de colaboradores ativos (RH) para os seletores de responsável. */
function useColaboradoresNomes(atual?: string | null) {
  const { data } = useQuery({
    queryKey: ["rh_colaboradores_nomes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rh_colaboradores")
        .select("nome,ativo")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []).map((c: any) => String(c.nome ?? "").trim()).filter(Boolean);
    },
    staleTime: 5 * 60_000,
  });
  return useMemo(() => {
    const s = new Set<string>(data ?? []);
    const a = (atual ?? "").trim();
    if (a) s.add(a);
    return [...s].sort((x, y) => x.localeCompare(y, "pt-BR"));
  }, [data, atual]);
}


export function PatrimonioOS() {
  const qc = useQueryClient();
  const { isModuleAdmin } = useAuth();
  const isAdmin = isModuleAdmin("patrimonio");

  const [q, setQ] = useState("");
  const [fTipo, setFTipo] = useState("todos");
  const [fStatus, setFStatus] = useState("todos");
  const [novaOpen, setNovaOpen] = useState(false);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  /* ---------------- dados ---------------- */
  const { data: itens } = useQuery({
    queryKey: ["pat_itens_os"],
    queryFn: async () => {
      const all: PatItem[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("pat_itens")
          .select("id,id_item,cod,nome,especificacao,dimensoes,categoria,subcategoria,unidade,quantidade,estado")
          .order("nome")
          .range(from, from + 999);
        if (error) throw error;
        all.push(...((data ?? []) as any));
        if ((data?.length ?? 0) < 1000) break;
        from += 1000;
      }
      return all;
    },
  });
  const itemMap = useMemo(
    () => Object.fromEntries((itens ?? []).map((i: any) => [i.id, i])),
    [itens],
  );

  const { data: saidasAbertas } = useQuery({
    queryKey: ["pat_saidas_abertas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pat_movimentacoes")
        .select("id,item_id,quantidade,saida_status")
        .eq("tipo", "saida")
        .in("saida_status", ["aberta", "parcialmente_devolvida"]);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; item_id: string | null; quantidade: number }>;
    },
  });

  const { data: devolvidoPorOrigem } = useQuery({
    queryKey: ["pat_devolvido_por_origem"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pat_movimentacoes")
        .select("saida_origem_id, quantidade")
        .in("tipo", ["devolucao", "perda"])
        .not("saida_origem_id", "is", null);
      const m = new Map<string, number>();
      (data ?? []).forEach((r: any) => {
        m.set(r.saida_origem_id, (m.get(r.saida_origem_id) ?? 0) + Number(r.quantidade));
      });
      return m;
    },
  });

  const emUsoPorItem = useMemo(() => {
    const m = new Map<string, number>();
    (saidasAbertas ?? []).forEach((s: any) => {
      if (!s.item_id) return;
      const jaDev = devolvidoPorOrigem?.get(s.id) ?? 0;
      const restante = Math.max(0, Number(s.quantidade) - jaDev);
      if (restante > 0) m.set(s.item_id, (m.get(s.item_id) ?? 0) + restante);
    });
    return m;
  }, [saidasAbertas, devolvidoPorOrigem]);

  const groups = useMemo(
    () => buildPatGroups(itens ?? [], emUsoPorItem),
    [itens, emUsoPorItem],
  );

  const { data: tomadores } = useQuery({
    queryKey: ["pat_tomadores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pat_tomadores").select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as Tomador[];
    },
  });

  const { data: ordens, isLoading } = useQuery({
    queryKey: ["pat_os"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pat_os")
        .select("*")
        .order("numero", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as OS[];
    },
  });

  const { data: osItens } = useQuery({
    queryKey: ["pat_os_itens"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pat_os_itens").select("*").limit(5000);
      if (error) throw error;
      return (data ?? []) as OSItem[];
    },
  });

  const itensPorOS = useMemo(() => {
    const m = new Map<string, OSItem[]>();
    (osItens ?? []).forEach((i) => {
      const arr = m.get(i.os_id) ?? [];
      arr.push(i);
      m.set(i.os_id, arr);
    });
    return m;
  }, [osItens]);

  const tomadorMap = useMemo(
    () => Object.fromEntries((tomadores ?? []).map((t) => [t.id, t])),
    [tomadores],
  );

  const filtradas = useMemo(() => {
    const nq = normalize(q);
    return (ordens ?? []).filter((o) => {
      if (fTipo !== "todos" && o.tipo !== fTipo) return false;
      if (fStatus !== "todos" && o.status !== fStatus) return false;
      if (!nq) return true;
      const tom = o.tomador_id ? (tomadorMap as any)[o.tomador_id] : null;
      return [
        `OS-${o.numero}`,
        o.evento_projeto,
        o.responsavel,
        o.retirante_nome,
        tom?.nome,
        tom?.documento,
      ].some((v) => normalize(String(v ?? "")).includes(nq));
    });
  }, [ordens, q, fTipo, fStatus, tomadorMap]);

  const refetchTudo = () => {
    qc.invalidateQueries({ queryKey: ["pat_os"] });
    qc.invalidateQueries({ queryKey: ["pat_os_itens"] });
    qc.invalidateQueries({ queryKey: ["pat_os_devolucoes"] });
    qc.invalidateQueries({ queryKey: ["pat_tomadores"] });
    qc.invalidateQueries({ queryKey: ["pat_saidas_abertas"] });
    qc.invalidateQueries({ queryKey: ["pat_devolvido_por_origem"] });
    qc.invalidateQueries({ queryKey: ["pat_itens_os"] });
    qc.invalidateQueries({ queryKey: ["pat_itens"] });
    qc.invalidateQueries({ queryKey: ["pat_movs", "saida"] });
    qc.invalidateQueries({ queryKey: ["pat_movs", "devolucao"] });
  };

  const excluirMut = useMutation({
    mutationFn: async (os: OS) => {
      const { error } = await supabase.rpc("pat_os_excluir", { p_os_id: os.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("O.S. excluída");
      refetchTudo();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const imprimirMut = useMutation({
    mutationFn: async (os: OS) => {
      const linhas = itensPorOS.get(os.id) ?? [];
      const tom = os.tomador_id ? (tomadorMap as any)[os.tomador_id] : null;
      const { data: devs } = await supabase
        .from("pat_os_devolucoes")
        .select("*, pat_os_devolucao_itens(*)")
        .eq("os_id", os.id)
        .order("created_at", { ascending: true });
      const nomeDeItem = (osItemId: string) => {
        const li = linhas.find((l) => l.id === osItemId);
        const it = li?.item_id ? (itemMap as any)[li.item_id] : null;
        return it ? `${it.nome}${it.especificacao ? ` — ${it.especificacao}` : ""}` : "—";
      };
      await gerarOSPdf({
        numero: os.numero,
        tipo: os.tipo,
        status: STATUS_LABEL[os.status] ?? os.status,
        dataSaida: os.data_saida,
        previsaoRetorno: os.previsao_retorno,
        eventoProjeto: os.evento_projeto,
        tomadorNome: tom?.nome ?? null,
        tomadorDocumento: tom?.documento ?? null,
        tomadorEndereco: tom?.endereco ?? null,
        tomadorTelefone: tom?.contato_telefone ?? null,
        retiranteNome: os.retirante_nome,
        retiranteCpf: os.retirante_cpf,
        responsavel: os.responsavel,
        observacoes: os.observacoes,
        itens: linhas.map((l) => {
          const it = l.item_id ? (itemMap as any)[l.item_id] : null;
          return {
            nome: it?.nome ?? "—",
            especificacao: it?.especificacao ?? null,
            id_item: it?.id_item ?? null,
            unidade: it?.unidade ?? null,
            quantidade: Number(l.quantidade),
            devolvida: Number(l.quantidade_devolvida),
            perdida: Number(l.quantidade_perdida),
          };
        }),
        devolucoes: ((devs ?? []) as any[]).map((d) => ({
          data: d.data_devolucao,
          responsavel: d.responsavel,
          observacoes: d.observacoes,
          linhas: (d.pat_os_devolucao_itens ?? []).map((li: any) => ({
            material: nomeDeItem(li.os_item_id),
            devolvida: Number(li.quantidade_devolvida ?? 0),
            faltante: Number(li.quantidade_faltante ?? 0),
            motivo: li.motivo,
            justificativa: li.justificativa,
          })),
        })),
      });
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao gerar o PDF"),
  });

  const detalhe = (ordens ?? []).find((o) => o.id === detalheId) ?? null;
  const emEdicao = (ordens ?? []).find((o) => o.id === editId) ?? null;

  return (
    <>
      <PageHeader
        title="O.S. — Ordens de Saída"
        description="Controle do material que sai do galpão e do seu retorno"
        actions={
          <Button onClick={() => setNovaOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nova O.S.
          </Button>
        }
      />

      <Card className="p-3 mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar por número, evento, empresa, responsável…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select value={fTipo} onValueChange={setFTipo}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="evento">Uso em Evento</SelectItem>
            <SelectItem value="emprestimo">Empréstimo</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as situações</SelectItem>
            <SelectItem value="aberta">Aberta</SelectItem>
            <SelectItem value="parcial">Parcial</SelectItem>
            <SelectItem value="concluida">Concluída</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-300px)]">
          <table className="w-full text-xs">
            <thead className="bg-card sticky top-0 z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
              <tr className="text-left">
                <th className="px-2 py-2 w-24">O.S.</th>
                <th className="px-2 py-2 w-28">Saída</th>
                <th className="px-2 py-2 w-32">Tipo</th>
                <th className="px-2 py-2">Destino</th>
                <th className="px-2 py-2">Responsável</th>
                <th className="px-2 py-2 text-right w-24">Itens</th>
                <th className="px-2 py-2 text-right w-24">Pendente</th>
                <th className="px-2 py-2 w-28">Prev. retorno</th>
                <th className="px-2 py-2 w-28">Situação</th>
                <th className="px-2 py-2 w-28 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={10} className="p-4 text-center text-muted-foreground">Carregando…</td></tr>
              )}
              {!isLoading && filtradas.length === 0 && (
                <tr><td colSpan={10} className="p-4 text-center text-muted-foreground">Nenhuma O.S. registrada.</td></tr>
              )}
              {filtradas.map((o) => {
                const linhas = itensPorOS.get(o.id) ?? [];
                const total = linhas.reduce((s, l) => s + Number(l.quantidade), 0);
                const pendente = linhas.reduce(
                  (s, l) => s + Math.max(0, Number(l.quantidade) - Number(l.quantidade_devolvida) - Number(l.quantidade_perdida)),
                  0,
                );
                const tom = o.tomador_id ? (tomadorMap as any)[o.tomador_id] : null;
                return (
                  <tr
                    key={o.id}
                    className="border-t border-border hover:bg-muted/30 cursor-pointer"
                    onClick={() => setDetalheId(o.id)}
                  >
                    <td className="px-2 py-1.5 font-mono">O.S.-{String(o.numero).padStart(3, "0")}</td>
                    <td className="px-2 py-1.5">{o.data_saida?.split("-").reverse().join("/")}</td>
                    <td className="px-2 py-1.5">{o.tipo === "evento" ? "Uso em Evento" : "Empréstimo"}</td>
                    <td className="px-2 py-1.5">
                      {o.tipo === "evento" ? (o.evento_projeto ?? "—") : (tom?.nome ?? "—")}
                    </td>
                    <td className="px-2 py-1.5">{o.responsavel ?? "—"}</td>
                    <td className="px-2 py-1.5 text-right">{total}</td>
                    <td className="px-2 py-1.5 text-right">{pendente}</td>
                    <td className="px-2 py-1.5">{o.previsao_retorno?.split("-").reverse().join("/") ?? "—"}</td>
                    <td className="px-2 py-1.5">
                      <Badge
                        variant={o.status === "concluida" ? "secondary" : o.status === "parcial" ? "outline" : "default"}
                      >
                        {STATUS_LABEL[o.status] ?? o.status}
                      </Badge>
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex justify-end gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Imprimir"
                          onClick={(e) => {
                            e.stopPropagation();
                            imprimirMut.mutate(o);
                          }}
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Editar"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditId(o.id);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-rose-600"
                            title="Excluir"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Excluir a O.S.-${o.numero}? As movimentações vinculadas serão removidas.`)) {
                                excluirMut.mutate(o);
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {novaOpen && (
        <NovaOSDialog
          open={novaOpen}
          onOpenChange={setNovaOpen}
          groups={groups}
          emUsoPorItem={emUsoPorItem}
          tomadores={tomadores ?? []}
          onSaved={refetchTudo}
        />
      )}

      {detalhe && (
        <DetalheOSDialog
          os={detalhe}
          itens={itensPorOS.get(detalhe.id) ?? []}
          itemMap={itemMap}
          tomador={detalhe.tomador_id ? (tomadorMap as any)[detalhe.tomador_id] ?? null : null}
          onClose={() => setDetalheId(null)}
          onSaved={refetchTudo}
        />
      )}

      {emEdicao && (
        <EditarOSDialog
          os={emEdicao}
          itens={itensPorOS.get(emEdicao.id) ?? []}
          itemMap={itemMap}
          groups={groups}
          emUsoPorItem={emUsoPorItem}
          tomadores={tomadores ?? []}
          onClose={() => setEditId(null)}
          onSaved={refetchTudo}
        />
      )}
    </>
  );
}

/* ==================================================================== */
/* Nova O.S.                                                            */
/* ==================================================================== */

type Linha = { key: string; groupKey: string; quantidade: string };

function TomadorPicker({
  tomadores,
  value,
  onPick,
}: {
  tomadores: Tomador[];
  value: string;
  onPick: (t: Tomador) => void;
}) {
  const [open, setOpen] = useState(false);
  const nq = normalize(value);
  const sugestoes = tomadores
    .filter((t) => !nq || normalize(`${t.nome} ${t.documento ?? ""}`).includes(nq))
    .slice(0, 8);
  if (!open || sugestoes.length === 0) {
    return (
      <button
        type="button"
        className="text-[11px] text-muted-foreground underline mt-1"
        onClick={() => setOpen(true)}
      >
        Buscar cadastro existente
      </button>
    );
  }
  return (
    <div className="mt-1 rounded-md border bg-popover">
      <div className="flex items-center justify-between px-2 py-1 text-[11px] text-muted-foreground">
        <span>Cadastros encontrados</span>
        <button type="button" onClick={() => setOpen(false)}><X className="h-3 w-3" /></button>
      </div>
      <div className="max-h-40 overflow-y-auto">
        {sugestoes.map((t) => (
          <button
            key={t.id}
            type="button"
            className="block w-full px-2 py-1.5 text-left text-xs hover:bg-accent"
            onPointerDown={(e) => {
              e.preventDefault();
              onPick(t);
              setOpen(false);
            }}
          >
            <span className="font-medium">{t.nome}</span>
            {t.documento && <span className="text-muted-foreground ml-2 font-mono">{t.documento}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function NovaOSDialog({
  open,
  onOpenChange,
  groups,
  emUsoPorItem,
  tomadores,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groups: ReturnType<typeof buildPatGroups>;
  emUsoPorItem: Map<string, number>;
  tomadores: Tomador[];
  onSaved: () => void;
}) {
  const [tipo, setTipo] = useState<"evento" | "emprestimo">("evento");
  const [evento, setEvento] = useState<string | null>(null);
  const [dataSaida, setDataSaida] = useState(hoje());
  const [previsao, setPrevisao] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const [tomadorId, setTomadorId] = useState<string | null>(null);
  const [tomTipo, setTomTipo] = useState<"PJ" | "PF">("PJ");
  const [tomNome, setTomNome] = useState("");
  const [tomDoc, setTomDoc] = useState("");
  const [tomEndereco, setTomEndereco] = useState("");
  const [tomTelefone, setTomTelefone] = useState("");
  const [retiranteNome, setRetiranteNome] = useState("");
  const [retiranteCpf, setRetiranteCpf] = useState("");

  const [linhas, setLinhas] = useState<Linha[]>([
    { key: crypto.randomUUID(), groupKey: "", quantidade: "1" },
  ]);

  const setLinha = (key: string, patch: Partial<Linha>) =>
    setLinhas((cur) => cur.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const salvarMut = useMutation({
    mutationFn: async () => {
      if (tipo === "evento" && !evento) throw new Error("Informe o evento/projeto.");
      if (tipo === "emprestimo") {
        if (!tomNome.trim()) throw new Error("Informe o nome/razão social de quem está solicitando.");
        if (!tomDoc.trim()) throw new Error(`Informe o ${tomTipo === "PJ" ? "CNPJ" : "CPF"}.`);
        if (!retiranteNome.trim() || !retiranteCpf.trim())
          throw new Error("Informe nome e CPF de quem está retirando.");
      }

      const linhasValidas = linhas.filter((l) => l.groupKey && Number(l.quantidade) > 0);
      if (!linhasValidas.length) throw new Error("Adicione ao menos um material.");

      // aloca peças dentro de cada grupo
      const usados = new Map<string, number>(emUsoPorItem);
      const alocacao = new Map<string, number>();
      for (const l of linhasValidas) {
        const g = groups.find((x) => x.key === l.groupKey);
        if (!g) throw new Error("Material inválido.");
        const qtd = Number(l.quantidade);
        const ids = allocateFromGroup(g, qtd, usados);
        if (ids.length < qtd)
          throw new Error(`Quantidade indisponível para "${g.nome}" (disponível: ${ids.length}).`);
        for (const id of ids) {
          usados.set(id, (usados.get(id) ?? 0) + 1);
          alocacao.set(id, (alocacao.get(id) ?? 0) + 1);
        }
      }

      let tid = tomadorId;
      if (tipo === "emprestimo") {
        const payload = {
          tipo: tomTipo,
          nome: tomNome.trim(),
          documento: tomDoc.trim() || null,
          endereco: tomEndereco.trim() || null,
          contato_telefone: tomTelefone.trim() || null,
        };
        if (tid) {
          const { error } = await supabase.from("pat_tomadores").update(payload).eq("id", tid);
          if (error) throw error;
        } else {
          const { data, error } = await supabase.from("pat_tomadores").insert(payload).select("id").single();
          if (error) throw error;
          tid = data.id;
        }
      } else {
        tid = null;
      }

      const { error } = await supabase.rpc("pat_os_criar", {
        p_meta: {
          tipo,
          evento_projeto: tipo === "evento" ? evento : null,
          tomador_id: tid,
          retirante_nome: tipo === "emprestimo" ? retiranteNome.trim() : null,
          retirante_cpf: tipo === "emprestimo" ? retiranteCpf.trim() : null,
          data_saida: dataSaida,
          previsao_retorno: previsao || null,
          responsavel: responsavel.trim() || null,
          observacoes: observacoes.trim() || null,
        } as any,
        p_linhas: Array.from(alocacao.entries()).map(([item_id, quantidade]) => ({
          item_id,
          quantidade,
        })) as any,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("O.S. registrada");
      onSaved();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nova O.S.</DialogTitle></DialogHeader>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="evento">Uso em Evento</SelectItem>
                <SelectItem value="emprestimo">Empréstimo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Data de saída</Label>
            <Input type="date" value={dataSaida} onChange={(e) => setDataSaida(e.target.value)} />
          </div>
          <div>
            <Label>Previsão de retorno</Label>
            <Input type="date" value={previsao} onChange={(e) => setPrevisao(e.target.value)} />
          </div>
        </div>

        {tipo === "evento" ? (
          <div>
            <Label>Evento / Projeto</Label>
            <EventoSheetCombobox value={evento} onChange={setEvento} />
          </div>
        ) : (
          <Card className="p-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label>Pessoa</Label>
                <Select value={tomTipo} onValueChange={(v) => setTomTipo(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PJ">Jurídica (empresa)</SelectItem>
                    <SelectItem value="PF">Física</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label>{tomTipo === "PJ" ? "Razão social / Empresa" : "Nome completo"}</Label>
                <Input
                  value={tomNome}
                  onChange={(e) => {
                    setTomNome(e.target.value);
                    setTomadorId(null);
                  }}
                  placeholder="Digite para buscar cadastros já registrados"
                />
                <TomadorPicker
                  tomadores={tomadores}
                  value={tomNome}
                  onPick={(t) => {
                    setTomadorId(t.id);
                    setTomTipo((t.tipo as any) === "PF" ? "PF" : "PJ");
                    setTomNome(t.nome);
                    setTomDoc(t.documento ?? "");
                    setTomEndereco(t.endereco ?? "");
                    setTomTelefone(t.contato_telefone ?? "");
                  }}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label>{tomTipo === "PJ" ? "CNPJ" : "CPF"}</Label>
                <Input value={tomDoc} onChange={(e) => setTomDoc(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label>Endereço</Label>
                <Input value={tomEndereco} onChange={(e) => setTomEndereco(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label>Telefone</Label>
                <Input value={tomTelefone} onChange={(e) => setTomTelefone(e.target.value)} />
              </div>
              <div>
                <Label>Quem está retirando</Label>
                <Input value={retiranteNome} onChange={(e) => setRetiranteNome(e.target.value)} />
              </div>
              <div>
                <Label>CPF de quem retira</Label>
                <Input value={retiranteCpf} onChange={(e) => setRetiranteCpf(e.target.value)} />
              </div>
            </div>
          </Card>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Responsável pela liberação</Label>
            <ComboboxCreatable options={colaboradores} value={responsavel} onChange={setResponsavel} placeholder="Selecione o colaborador…" />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea rows={1} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <Label>Materiais</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setLinhas((c) => [...c, { key: crypto.randomUUID(), groupKey: "", quantidade: "1" }])
              }
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
            </Button>
          </div>
          <div className="space-y-2">
            {linhas.map((l) => {
              const g = groups.find((x) => x.key === l.groupKey);
              return (
                <div key={l.key} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <PatGroupSelect
                      groups={groups}
                      value={l.groupKey}
                      onChange={(k) => setLinha(l.key, { groupKey: k })}
                    />
                  </div>
                  <Input
                    type="number"
                    min={1}
                    className="w-full sm:w-28"
                    value={l.quantidade}
                    onChange={(e) => setLinha(l.key, { quantidade: e.target.value })}
                  />
                  <span className="text-[11px] text-muted-foreground w-full sm:w-28">
                    {g ? `${g.disponivel} disp.` : ""}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setLinhas((c) => c.filter((x) => x.key !== l.key))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => salvarMut.mutate()} disabled={salvarMut.isPending}>
            {salvarMut.isPending ? "Salvando…" : "Registrar saída"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ==================================================================== */
/* Detalhe + devolução                                                  */
/* ==================================================================== */

type DevLinha = { qtd: string; motivo: "" | "emprestimo" | "perda"; justificativa: string; condicao: string };

function DetalheOSDialog({
  os,
  itens,
  itemMap,
  tomador,
  onClose,
  onSaved,
}: {
  os: OS;
  itens: OSItem[];
  itemMap: Record<string, any>;
  tomador: Tomador | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [dataDev, setDataDev] = useState(hoje());
  const [responsavel, setResponsavel] = useState("");
  const [obs, setObs] = useState("");
  const [novaPrevisao, setNovaPrevisao] = useState(os.previsao_retorno ?? "");
  const [linhas, setLinhas] = useState<Record<string, DevLinha>>(() =>
    Object.fromEntries(
      itens.map((i) => [
        i.id,
        { qtd: "", motivo: "", justificativa: "", condicao: "perfeito" } as DevLinha,
      ]),
    ),
  );

  const { data: historico } = useQuery({
    queryKey: ["pat_os_devolucoes", os.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pat_os_devolucoes")
        .select("*, pat_os_devolucao_itens(*)")
        .eq("os_id", os.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const pendenteDe = (i: OSItem) =>
    Math.max(0, Number(i.quantidade) - Number(i.quantidade_devolvida) - Number(i.quantidade_perdida));

  const setLinha = (id: string, patch: Partial<DevLinha>) =>
    setLinhas((c) => ({ ...c, [id]: { ...c[id], ...patch } }));

  const devolverMut = useMutation({
    mutationFn: async () => {
      const payload: any[] = [];
      let exigeOS = false;
      for (const i of itens) {
        const l = linhas[i.id];
        if (!l || l.qtd === "") continue;
        const qtd = Number(l.qtd);
        const pend = pendenteDe(i);
        if (Number.isNaN(qtd) || qtd < 0) throw new Error("Quantidade inválida.");
        if (qtd > pend) throw new Error("Quantidade devolvida maior que o pendente.");
        const diff = pend - qtd;
        if (diff > 0) {
          if (!l.motivo) throw new Error("Informe se a diferença é empréstimo em aberto ou perda.");
          if (!l.justificativa.trim()) throw new Error("A diferença exige justificativa.");
          if (l.motivo === "emprestimo") exigeOS = true;
        }
        payload.push({
          os_item_id: i.id,
          quantidade_devolvida: qtd,
          quantidade_faltante: diff,
          motivo: diff > 0 ? l.motivo : null,
          justificativa: diff > 0 ? l.justificativa.trim() : null,
          condicao: qtd > 0 ? l.condicao : null,
        });
      }
      if (!payload.length) throw new Error("Informe ao menos uma quantidade devolvida.");

      if (exigeOS) {
        if (!novaPrevisao) throw new Error("Continua emprestado: informe a nova previsão de retorno.");
        if (os.tipo === "emprestimo" && (!tomador?.nome || !tomador?.documento || !os.retirante_nome || !os.retirante_cpf))
          throw new Error("Continua emprestado: complete os dados da O.S. (empresa/CNPJ e quem retirou).");
        if (os.tipo === "evento" && !os.evento_projeto)
          throw new Error("Continua emprestado: complete os dados da O.S.");
        const { error } = await supabase
          .from("pat_os")
          .update({ previsao_retorno: novaPrevisao })
          .eq("id", os.id);
        if (error) throw error;
      }

      const { error } = await supabase.rpc("pat_os_registrar_devolucao", {
        p_os_id: os.id,
        p_data: dataDev,
        p_responsavel: responsavel.trim(),
        p_observacoes: obs.trim(),
        p_linhas: payload as any,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Devolução registrada");
      onSaved();
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            O.S.-{String(os.numero).padStart(3, "0")} ·{" "}
            {os.tipo === "evento" ? "Uso em Evento" : "Empréstimo"}
          </DialogTitle>
        </DialogHeader>

        <Card className="p-3 text-xs grid gap-2 sm:grid-cols-3">
          <div><span className="text-muted-foreground">Saída:</span> {os.data_saida?.split("-").reverse().join("/")}</div>
          <div><span className="text-muted-foreground">Previsão de retorno:</span> {os.previsao_retorno?.split("-").reverse().join("/") ?? "—"}</div>
          <div><span className="text-muted-foreground">Situação:</span> {STATUS_LABEL[os.status] ?? os.status}</div>
          {os.tipo === "evento" ? (
            <div className="sm:col-span-3"><span className="text-muted-foreground">Evento/Projeto:</span> {os.evento_projeto ?? "—"}</div>
          ) : (
            <>
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">{tomador?.tipo === "PF" ? "Pessoa" : "Empresa"}:</span>{" "}
                {tomador?.nome ?? "—"} {tomador?.documento && <span className="font-mono">· {tomador.documento}</span>}
              </div>
              <div><span className="text-muted-foreground">Telefone:</span> {tomador?.contato_telefone ?? "—"}</div>
              <div className="sm:col-span-2"><span className="text-muted-foreground">Endereço:</span> {tomador?.endereco ?? "—"}</div>
              <div><span className="text-muted-foreground">Retirou:</span> {os.retirante_nome ?? "—"} {os.retirante_cpf ? `(${os.retirante_cpf})` : ""}</div>
            </>
          )}
          <div><span className="text-muted-foreground">Responsável:</span> {os.responsavel ?? "—"}</div>
          {os.observacoes && <div className="sm:col-span-3"><span className="text-muted-foreground">Obs.:</span> {os.observacoes}</div>}
        </Card>

        <div className="text-sm font-medium mt-2 flex items-center gap-2">
          <Undo2 className="h-4 w-4" /> Devolução
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Data da devolução</Label>
            <Input type="date" value={dataDev} onChange={(e) => setDataDev(e.target.value)} />
          </div>
          <div>
            <Label>Recebido por</Label>
            <ComboboxCreatable options={colaboradores} value={responsavel} onChange={setResponsavel} placeholder="Selecione o colaborador…" />

          </div>
          <div>
            <Label>Observações</Label>
            <Input value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left border-b">
                <th className="px-2 py-1.5">Material</th>
                <th className="px-2 py-1.5 text-right w-16">Saiu</th>
                <th className="px-2 py-1.5 text-right w-20">Devolvido</th>
                <th className="px-2 py-1.5 text-right w-16">Perdido</th>
                <th className="px-2 py-1.5 text-right w-20">Pendente</th>
                <th className="px-2 py-1.5 w-24">Devolvendo</th>
                <th className="px-2 py-1.5 w-64">Diferença</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((i) => {
                const it = i.item_id ? itemMap[i.item_id] : null;
                const pend = pendenteDe(i);
                const l = linhas[i.id] ?? { qtd: "", motivo: "", justificativa: "", condicao: "perfeito" };
                const diff = l.qtd === "" ? 0 : Math.max(0, pend - Number(l.qtd || 0));
                return (
                  <tr key={i.id} className="border-b align-top">
                    <td className="px-2 py-1.5">
                      <div className="font-medium">{it?.nome ?? "—"}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {it?.especificacao} {it?.id_item ? `· ${it.id_item}` : ""}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-right">{Number(i.quantidade)}</td>
                    <td className="px-2 py-1.5 text-right">{Number(i.quantidade_devolvida)}</td>
                    <td className="px-2 py-1.5 text-right">{Number(i.quantidade_perdida)}</td>
                    <td className="px-2 py-1.5 text-right font-medium">{pend}</td>
                    <td className="px-2 py-1.5">
                      <Input
                        type="number"
                        min={0}
                        max={pend}
                        disabled={pend === 0}
                        className="h-8"
                        value={l.qtd}
                        onChange={(e) => setLinha(i.id, { qtd: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      {diff > 0 && (
                        <div className="space-y-1">
                          <div className="text-[11px] text-amber-600 dark:text-amber-400">
                            Faltam {diff}. O que aconteceu?
                          </div>
                          <Select value={l.motivo} onValueChange={(v) => setLinha(i.id, { motivo: v as any })}>
                            <SelectTrigger className="h-8"><SelectValue placeholder="Selecione…" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="emprestimo">Continua emprestado</SelectItem>
                              <SelectItem value="perda">Perda</SelectItem>
                            </SelectContent>
                          </Select>
                          <Textarea
                            rows={2}
                            placeholder="Justificativa"
                            value={l.justificativa}
                            onChange={(e) => setLinha(i.id, { justificativa: e.target.value })}
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Nova previsão de retorno</Label>
            <Input type="date" value={novaPrevisao} onChange={(e) => setNovaPrevisao(e.target.value)} />
            <p className="text-[11px] text-muted-foreground mt-1">
              Obrigatória quando algum material continuar emprestado.
            </p>
          </div>
        </div>

        {(historico?.length ?? 0) > 0 && (
          <div>
            <div className="text-sm font-medium mb-1">Histórico</div>
            <div className="space-y-2">
              {(historico ?? []).map((h: any) => (
                <Card key={h.id} className="p-2 text-xs">
                  <div className="font-medium">
                    {String(h.data_devolucao).split("-").reverse().join("/")}
                    {h.responsavel ? ` · ${h.responsavel}` : ""}
                  </div>
                  {(h.pat_os_devolucao_itens ?? []).map((di: any) => (
                    <div key={di.id} className="text-muted-foreground">
                      Devolvido {Number(di.quantidade_devolvida)}
                      {Number(di.quantidade_faltante) > 0 &&
                        ` · faltou ${Number(di.quantidade_faltante)} (${di.motivo === "perda" ? "perda" : "continua emprestado"}): ${di.justificativa ?? ""}`}
                    </div>
                  ))}
                  {h.observacoes && <div className="text-muted-foreground">Obs.: {h.observacoes}</div>}
                </Card>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={() => devolverMut.mutate()} disabled={devolverMut.isPending || os.status === "concluida"}>
            {devolverMut.isPending ? "Salvando…" : "Registrar devolução"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ==================================================================== */
/* Edição da O.S.                                                       */
/* ==================================================================== */

type EditLinha = {
  key: string;
  osItemId: string | null;
  groupKey: string;
  itemId: string | null;
  label: string;
  quantidade: string;
  minimo: number;
};

function EditarOSDialog({
  os,
  itens,
  itemMap,
  groups,
  emUsoPorItem,
  tomadores,
  onClose,
  onSaved,
}: {
  os: OS;
  itens: OSItem[];
  itemMap: Record<string, any>;
  groups: ReturnType<typeof buildPatGroups>;
  emUsoPorItem: Map<string, number>;
  tomadores: Tomador[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tipo, setTipo] = useState<"evento" | "emprestimo">(os.tipo === "emprestimo" ? "emprestimo" : "evento");
  const [evento, setEvento] = useState<string | null>(os.evento_projeto);
  const [dataSaida, setDataSaida] = useState(os.data_saida?.slice(0, 10) ?? hoje());
  const [previsao, setPrevisao] = useState(os.previsao_retorno?.slice(0, 10) ?? "");
  const [responsavel, setResponsavel] = useState(os.responsavel ?? "");
  const [observacoes, setObservacoes] = useState(os.observacoes ?? "");

  const tomAtual = tomadores.find((t) => t.id === os.tomador_id) ?? null;
  const [tomadorId, setTomadorId] = useState<string | null>(os.tomador_id);
  const [tomTipo, setTomTipo] = useState<"PJ" | "PF">((tomAtual?.tipo as any) === "PF" ? "PF" : "PJ");
  const [tomNome, setTomNome] = useState(tomAtual?.nome ?? "");
  const [tomDoc, setTomDoc] = useState(tomAtual?.documento ?? "");
  const [tomEndereco, setTomEndereco] = useState(tomAtual?.endereco ?? "");
  const [tomTelefone, setTomTelefone] = useState(tomAtual?.contato_telefone ?? "");
  const [retiranteNome, setRetiranteNome] = useState(os.retirante_nome ?? "");
  const [retiranteCpf, setRetiranteCpf] = useState(os.retirante_cpf ?? "");

  const [linhas, setLinhas] = useState<EditLinha[]>(() =>
    itens.map((i) => {
      const it = i.item_id ? itemMap[i.item_id] : null;
      return {
        key: i.id,
        osItemId: i.id,
        groupKey: "",
        itemId: i.item_id,
        label: it ? `${it.nome}${it.especificacao ? ` — ${it.especificacao}` : ""}${it.id_item ? ` · ${it.id_item}` : ""}` : "—",
        quantidade: String(Number(i.quantidade)),
        minimo: Number(i.quantidade_devolvida) + Number(i.quantidade_perdida),
      };
    }),
  );

  const setLinha = (key: string, patch: Partial<EditLinha>) =>
    setLinhas((c) => c.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const salvarMut = useMutation({
    mutationFn: async () => {
      if (tipo === "evento" && !evento) throw new Error("Informe o evento/projeto.");
      if (tipo === "emprestimo") {
        if (!tomNome.trim()) throw new Error("Informe o nome/razão social de quem está solicitando.");
        if (!tomDoc.trim()) throw new Error(`Informe o ${tomTipo === "PJ" ? "CNPJ" : "CPF"}.`);
        if (!retiranteNome.trim() || !retiranteCpf.trim())
          throw new Error("Informe nome e CPF de quem está retirando.");
      }

      const payload: any[] = [];
      const usados = new Map<string, number>(emUsoPorItem);

      for (const l of linhas) {
        const qtd = Number(l.quantidade);
        if (l.osItemId) {
          if (!Number.isFinite(qtd) || qtd <= 0) throw new Error("Quantidade inválida em um dos materiais.");
          if (qtd < l.minimo)
            throw new Error(`"${l.label}": a quantidade não pode ser menor que o já devolvido/perdido (${l.minimo}).`);
          payload.push({ os_item_id: l.osItemId, quantidade: qtd });
        } else {
          if (!l.groupKey || !(qtd > 0)) continue;
          const g = groups.find((x) => x.key === l.groupKey);
          if (!g) throw new Error("Material inválido.");
          const ids = allocateFromGroup(g, qtd, usados);
          if (ids.length < qtd)
            throw new Error(`Quantidade indisponível para "${g.nome}" (disponível: ${ids.length}).`);
          const contagem = new Map<string, number>();
          for (const id of ids) {
            usados.set(id, (usados.get(id) ?? 0) + 1);
            contagem.set(id, (contagem.get(id) ?? 0) + 1);
          }
          contagem.forEach((quantidade, item_id) => payload.push({ item_id, quantidade }));
        }
      }
      if (!payload.length) throw new Error("A O.S. precisa de ao menos um material.");

      let tid = tomadorId;
      if (tipo === "emprestimo") {
        const dados = {
          tipo: tomTipo,
          nome: tomNome.trim(),
          documento: tomDoc.trim() || null,
          endereco: tomEndereco.trim() || null,
          contato_telefone: tomTelefone.trim() || null,
        };
        if (tid) {
          const { error } = await supabase.from("pat_tomadores").update(dados).eq("id", tid);
          if (error) throw error;
        } else {
          const { data, error } = await supabase.from("pat_tomadores").insert(dados).select("id").single();
          if (error) throw error;
          tid = data.id;
        }
      } else {
        tid = null;
      }

      const { error } = await supabase.rpc("pat_os_editar", {
        p_os_id: os.id,
        p_meta: {
          tipo,
          evento_projeto: tipo === "evento" ? evento : null,
          tomador_id: tid,
          retirante_nome: tipo === "emprestimo" ? retiranteNome.trim() : null,
          retirante_cpf: tipo === "emprestimo" ? retiranteCpf.trim() : null,
          data_saida: dataSaida,
          previsao_retorno: previsao || null,
          responsavel: responsavel.trim() || null,
          observacoes: observacoes.trim() || null,
        } as any,
        p_linhas: payload as any,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("O.S. atualizada");
      onSaved();
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar O.S.-{String(os.numero).padStart(3, "0")}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="evento">Uso em Evento</SelectItem>
                <SelectItem value="emprestimo">Empréstimo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Data de saída</Label>
            <Input type="date" value={dataSaida} onChange={(e) => setDataSaida(e.target.value)} />
          </div>
          <div>
            <Label>Previsão de retorno</Label>
            <Input type="date" value={previsao} onChange={(e) => setPrevisao(e.target.value)} />
          </div>
        </div>

        {tipo === "evento" ? (
          <div>
            <Label>Evento / Projeto</Label>
            <EventoSheetCombobox value={evento} onChange={setEvento} />
          </div>
        ) : (
          <Card className="p-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label>Pessoa</Label>
                <Select value={tomTipo} onValueChange={(v) => setTomTipo(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PJ">Jurídica (empresa)</SelectItem>
                    <SelectItem value="PF">Física</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label>{tomTipo === "PJ" ? "Razão social / Empresa" : "Nome completo"}</Label>
                <Input
                  value={tomNome}
                  onChange={(e) => { setTomNome(e.target.value); setTomadorId(null); }}
                />
                <TomadorPicker
                  tomadores={tomadores}
                  value={tomNome}
                  onPick={(t) => {
                    setTomadorId(t.id);
                    setTomTipo((t.tipo as any) === "PF" ? "PF" : "PJ");
                    setTomNome(t.nome);
                    setTomDoc(t.documento ?? "");
                    setTomEndereco(t.endereco ?? "");
                    setTomTelefone(t.contato_telefone ?? "");
                  }}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label>{tomTipo === "PJ" ? "CNPJ" : "CPF"}</Label>
                <Input value={tomDoc} onChange={(e) => setTomDoc(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label>Endereço</Label>
                <Input value={tomEndereco} onChange={(e) => setTomEndereco(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label>Telefone</Label>
                <Input value={tomTelefone} onChange={(e) => setTomTelefone(e.target.value)} />
              </div>
              <div>
                <Label>Quem está retirando</Label>
                <Input value={retiranteNome} onChange={(e) => setRetiranteNome(e.target.value)} />
              </div>
              <div>
                <Label>CPF de quem retira</Label>
                <Input value={retiranteCpf} onChange={(e) => setRetiranteCpf(e.target.value)} />
              </div>
            </div>
          </Card>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Responsável pela liberação</Label>
            <ComboboxCreatable options={colaboradores} value={responsavel} onChange={setResponsavel} placeholder="Selecione o colaborador…" />

          </div>
          <div>
            <Label>Observações</Label>
            <Textarea rows={1} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <Label>Materiais</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setLinhas((c) => [
                  ...c,
                  { key: crypto.randomUUID(), osItemId: null, groupKey: "", itemId: null, label: "", quantidade: "1", minimo: 0 },
                ])
              }
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
            </Button>
          </div>
          <div className="space-y-2">
            {linhas.map((l) => (
              <div key={l.key} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex-1">
                  {l.osItemId ? (
                    <div className="text-xs px-2 py-2 rounded-md border bg-muted/30">{l.label}</div>
                  ) : (
                    <PatGroupSelect
                      groups={groups}
                      value={l.groupKey}
                      onChange={(k) => setLinha(l.key, { groupKey: k })}
                    />
                  )}
                </div>
                <Input
                  type="number"
                  min={l.minimo || 1}
                  className="w-full sm:w-28"
                  value={l.quantidade}
                  onChange={(e) => setLinha(l.key, { quantidade: e.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title={l.minimo > 0 ? "Materiais já devolvidos não podem ser removidos" : "Remover"}
                  disabled={l.minimo > 0}
                  onClick={() => setLinhas((c) => c.filter((x) => x.key !== l.key))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => salvarMut.mutate()} disabled={salvarMut.isPending}>
            {salvarMut.isPending ? "Salvando…" : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
