import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { CalendarDays, CheckCircle2 } from "lucide-react";
import { garantirChecklist } from "./ChecklistCardDialog";
import { fmtData, type Setor } from "@/lib/operacao";

const sb = supabase as any;

type EventoLite = {
  id: string;
  codigo: string | null;
  codigo_evento: string | null;
  nome: string;
  local: string | null;
  cidade: string | null;
  uf: string | null;
  data_evento: string | null;
  data_evento_fim: string | null;
  data_montagem: string | null;
};

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Segunda-feira da semana da data informada. */
function inicioSemana(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return toISO(d);
}

function fimSemana(isoInicio: string) {
  const d = new Date(`${isoInicio}T12:00:00`);
  d.setDate(d.getDate() + 6);
  return toISO(d);
}

export function ImplementarProjetoDialog({
  open,
  onOpenChange,
  setores,
  userId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  setores: Setor[];
  userId: string | null;
  onCreated: () => void;
}) {
  const hoje = new Date();
  const [mes, setMes] = useState(`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`);
  const [modo, setModo] = useState("semana");
  const [busca, setBusca] = useState("");
  const [criando, setCriando] = useState<string | null>(null);

  const inicioMes = `${mes}-01`;
  const fimMes = useMemo(() => {
    const [y, m] = mes.split("-").map(Number);
    return toISO(new Date(y, m, 0));
  }, [mes]);

  const { data: eventos = [], isLoading } = useQuery<EventoLite[]>({
    queryKey: ["op_eventos_calendario", inicioMes, fimMes],
    queryFn: async () => {
      const { data, error } = await sb
        .from("eventos")
        .select("id,codigo,codigo_evento,nome,local,cidade,uf,data_evento,data_evento_fim,data_montagem")
        .gte("data_evento", inicioMes)
        .lte("data_evento", fimMes)
        .order("data_evento");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const { data: jaCriados = [] } = useQuery<string[]>({
    queryKey: ["op_ordens_evento_ids"],
    queryFn: async () => {
      const { data } = await sb.from("op_ordens").select("evento_id").not("evento_id", "is", null);
      return (data ?? []).map((r: any) => r.evento_id as string);
    },
    enabled: open,
  });

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return eventos;
    return eventos.filter((e) =>
      [e.nome, e.codigo, e.codigo_evento, e.local, e.cidade]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [eventos, busca]);

  const grupos = useMemo(() => {
    if (modo === "mes") return [{ chave: "mes", titulo: "", itens: filtrados }];
    const map = new Map<string, EventoLite[]>();
    filtrados.forEach((e) => {
      const base = e.data_evento ?? e.data_montagem;
      const chave = base ? inicioSemana(base) : "sem-data";
      if (!map.has(chave)) map.set(chave, []);
      map.get(chave)!.push(e);
    });
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([chave, itens]) => ({
        chave,
        titulo:
          chave === "sem-data"
            ? "Sem data definida"
            : `Semana de ${fmtData(chave)} a ${fmtData(fimSemana(chave))}`,
        itens,
      }));
  }, [filtrados, modo]);

  const roteiroPadrao = useMemo(() => {
    const fixos = setores.filter((s) => s.fixo);
    const demais = setores.filter((s) => !s.fixo);
    return [...fixos, ...demais];
  }, [setores]);

  async function implementar(ev: EventoLite) {
    if (roteiroPadrao.length === 0) return toast.error("Nenhum setor configurado");
    setCriando(ev.id);
    try {
      const primeiro = roteiroPadrao[0];
      const { data: nova, error } = await sb
        .from("op_ordens")
        .insert({
          setor_id: primeiro.id,
          titulo: ev.nome,
          descricao: [ev.local, ev.cidade, ev.uf].filter(Boolean).join(" · ") || null,
          evento_ref: ev.codigo_evento ?? ev.codigo ?? ev.nome,
          evento_id: ev.id,
          origem: "evento",
          status: "aberta",
          data_inicio: toISO(new Date()),
          prazo: ev.data_montagem ?? ev.data_evento ?? null,
          created_by: userId,
        })
        .select("id")
        .single();
      if (error) throw error;

      const agora = new Date().toISOString();
      await sb.from("op_ordem_setores").insert(
        roteiroPadrao.map((s, i) => ({
          ordem_id: nova.id,
          setor_id: s.id,
          posicao: i,
          status: i === 0 ? "em_andamento" : "pendente",
          iniciado_em: i === 0 ? agora : null,
        })),
      );
      await garantirChecklist(nova.id, primeiro.id);

      toast.success(`Projeto de "${ev.nome}" iniciado em ${primeiro.nome}`);
      onCreated();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao implementar projeto");
    } finally {
      setCriando(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Implementar projeto</DialogTitle>
          <DialogDescription>
            Escolha um evento do calendário para iniciar o processo em {roteiroPadrao[0]?.nome ?? "Preparação"}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">Mês</Label>
            <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="h-9 w-44" />
          </div>
          <Tabs value={modo} onValueChange={setModo}>
            <TabsList>
              <TabsTrigger value="semana">Semana</TabsTrigger>
              <TabsTrigger value="mes">Mês</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex-1 min-w-[180px]">
            <Label className="text-xs">Buscar</Label>
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome, código, local…"
              className="h-9"
            />
          </div>
        </div>

        <div className="space-y-4 mt-2">
          {isLoading && <div className="text-sm text-muted-foreground">Carregando eventos…</div>}
          {!isLoading && filtrados.length === 0 && (
            <div className="text-sm text-muted-foreground">Nenhum evento no período.</div>
          )}
          {grupos.map((g) => (
            <div key={g.chave}>
              {g.titulo && (
                <div className="flex items-center gap-1.5 text-xs uppercase text-muted-foreground mb-1">
                  <CalendarDays className="h-3.5 w-3.5" /> {g.titulo}
                </div>
              )}
              <div className="space-y-1.5">
                {g.itens.map((e) => {
                  const feito = jaCriados.includes(e.id);
                  return (
                    <div
                      key={e.id}
                      className="flex items-center justify-between gap-3 rounded border p-2"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">
                          {e.nome}
                          {e.codigo ? ` · ${e.codigo}` : ""}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {[e.local, [e.cidade, e.uf].filter(Boolean).join("/")].filter(Boolean).join(" · ")}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          evento {fmtData(e.data_evento)}
                          {e.data_evento_fim ? ` a ${fmtData(e.data_evento_fim)}` : ""}
                          {e.data_montagem ? ` · montagem ${fmtData(e.data_montagem)}` : ""}
                        </div>
                      </div>
                      {feito ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-600 shrink-0">
                          <CheckCircle2 className="h-3.5 w-3.5" /> já implementado
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          className="shrink-0"
                          disabled={criando !== null}
                          onClick={() => implementar(e)}
                        >
                          Implementar
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
