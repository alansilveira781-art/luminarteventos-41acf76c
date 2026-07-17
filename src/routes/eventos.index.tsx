import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Link2, ExternalLink, Trash2, CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { GanttEventos, type EventoCal } from "@/components/eventos/GanttEventos";
import { SearchableSelect } from "@/components/SearchableSelect";
import { fetchEstados, fetchMunicipios } from "@/lib/ibge";

const sb = supabase as any;

async function copyTextRobust(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fallback
    }
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/eventos/")({ component: EventosPage });

function EventosPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);

  const { data: eventos = [] } = useQuery({
    queryKey: ["eventos"],
    queryFn: async () => {
      const { data } = await sb.from("eventos").select("*").order("data_evento");
      return (data ?? []) as EventoCal[];
    },
  });

  const urlCalendarioPublico = `${window.location.origin}/calendario-publico`;

  const copiarLinkPublico = async () => {
    const ok = await copyTextRobust(urlCalendarioPublico);
    if (ok) {
      toast.success(`Link copiado: ${urlCalendarioPublico}`);
    } else {
      toast.info(`Link público: ${urlCalendarioPublico}`, { duration: 8000 });
    }
  };

  const abrirCalendarioPublico = () => {
    window.open("/calendario-publico", "_blank");
  };

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Eventos"
        description="Calendário de eventos com montagem, evento e desmontagem"
        actions={
          <>
            <Button variant="outline" onClick={copiarLinkPublico}>
              <Link2 className="h-4 w-4 mr-2" /> Copiar link público
            </Button>
            <Button variant="outline" onClick={abrirCalendarioPublico}>
              <ExternalLink className="h-4 w-4 mr-2" /> Abrir calendário público
            </Button>
            <Button onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Novo evento
            </Button>
          </>
        }
      />

      <Card className="p-4">
        <GanttEventos
          eventos={eventos}
          onSelectEvento={(e: EventoCal) => { setEditing(e); setOpen(true); }}
        />
      </Card>

      {open && (
        <EventoDialog
          evento={editing}
          onClose={() => { setOpen(false); setEditing(null); }}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["eventos"] }); }}
        />
      )}
    </div>
  );
}

const TIPOS = ["Social", "Corporativo", "Cenografia", "Stand"];
const PRODUTORES = ["Matheus Fernandes", "Romulo Manoel"];

function EventoDialog({ evento, onClose, onSaved }: { evento: any | null; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const isNew = !evento?.id;
  const [showMontagem, setShowMontagem] = useState(false);

  const [f, setF] = useState<any>(() => ({
    nome: evento?.nome ?? "",
    local: evento?.local ?? "",
    cidade: evento?.cidade ?? "",
    uf: evento?.uf ?? "",
    tipo: evento?.tipo && TIPOS.includes(evento.tipo) ? evento.tipo : "Social",
    data_evento: evento?.data_evento ?? "",
    data_evento_fim: evento?.data_evento_fim ?? "",
    observacoes: evento?.observacoes ?? "",
    data_montagem: evento?.data_montagem ?? "",
    data_montagem_fim: evento?.data_montagem_fim ?? "",
    data_desmontagem: evento?.data_desmontagem ?? "",
    data_desmontagem_fim: evento?.data_desmontagem_fim ?? "",
    produtor: evento?.produtor ?? "",
    situacao: evento?.situacao ?? "Em Aprovação",
    hora_montagem: evento?.hora_montagem ?? "",
    hora_desmontagem: evento?.hora_desmontagem ?? "",
  }));
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  const { data: estados = [] } = useQuery({
    queryKey: ["ibge-estados"],
    queryFn: fetchEstados,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const { data: municipios = [] } = useQuery({
    queryKey: ["ibge-municipios"],
    queryFn: fetchMunicipios,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const ufOptions = estados.map((e) => ({ value: e.sigla, label: `${e.sigla} — ${e.nome}` }));
  const cidadeOptions = (f.uf
    ? municipios.filter((m) => m.uf === f.uf).map((m) => ({ value: m.nome, label: m.nome }))
    : municipios.map((m) => ({ value: `${m.nome}|${m.uf}`, label: `${m.nome} - ${m.uf}` })));

  const cidadeValue = f.uf ? f.cidade : (f.cidade ? `${f.cidade}|${f.uf}` : "");

  const handleCidadeChange = (v: string) => {
    if (f.uf) {
      set("cidade", v);
    } else {
      const [nome, uf] = v.split("|");
      setF((p: any) => ({ ...p, cidade: nome, uf: uf ?? "" }));
    }
  };

  const handleUfChange = (v: string) => {
    setF((p: any) => {
      const cidadePertence = municipios.some((m) => m.uf === v && m.nome === p.cidade);
      return { ...p, uf: v, cidade: cidadePertence ? p.cidade : "" };
    });
  };


  const salvar = useMutation({
    mutationFn: async () => {
      if (!f.nome.trim()) throw new Error("Informe o nome do evento");
      if (!f.data_evento) throw new Error("Informe a data inicial do evento");
      if (!f.data_evento_fim) throw new Error("Informe a data final do evento");

      const payload: any = {
        nome: f.nome.trim(),
        local: f.local || null,
        cidade: f.cidade || null,
        uf: f.uf || null,
        tipo: f.tipo || null,
        data_evento: f.data_evento,
        data_evento_fim: f.data_evento_fim,
        observacoes: f.observacoes || null,
        situacao: f.situacao || null,
      };

      if (evento?.id) {
        payload.data_montagem = f.data_montagem || null;
        payload.data_montagem_fim = f.data_montagem_fim || null;
        payload.data_desmontagem = f.data_desmontagem || null;
        payload.data_desmontagem_fim = f.data_desmontagem_fim || null;
        payload.produtor = f.produtor || null;
        payload.hora_montagem = f.hora_montagem || null;
        payload.hora_desmontagem = f.hora_desmontagem || null;

        const { error } = await sb.from("eventos").update(payload).eq("id", evento.id);
        if (error) {
          if ((error as any).code === "23505") {
            throw new Error("Já existe um evento com este nome e local nesta data final.");
          }
          throw error;
        }
      } else {
        const { data: codigo, error: codErr } = await sb.rpc("proximo_codigo_evento", { _data: f.data_evento });
        if (codErr) throw codErr;
        const { error } = await sb.from("eventos").insert({
          ...payload,
          codigo,
          origem: "manual",
          created_by: user?.id ?? null,
        });
        if (error) {
          if ((error as any).code === "23505") {
            throw new Error("Já existe um evento com este nome e local nesta data final.");
          }
          throw error;
        }
      }
    },
    onSuccess: () => { toast.success("Evento salvo!"); onSaved(); onClose(); },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const excluir = useMutation({
    mutationFn: async () => {
      const { error } = await sb.from("eventos").delete().eq("id", evento.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Evento excluído"); onSaved(); onClose(); },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
  });

  const showMontagemSection = !isNew && (showMontagem
    || f.data_montagem || f.data_montagem_fim
    || f.data_desmontagem || f.data_desmontagem_fim
    || f.produtor || f.hora_montagem || f.hora_desmontagem);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {isNew ? "Novo evento" : "Editar evento"}
            {evento?.codigo_evento && (
              <span className="text-xs text-muted-foreground font-mono break-all">{evento.codigo_evento}</span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Label>Nome do evento *</Label>
            <Input value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex: Casamento Ana & João" />
          </div>
          <div>
            <Label>Local</Label>
            <Input value={f.local} onChange={(e) => set("local", e.target.value)} />
          </div>
          <div>
            <Label>Cidade</Label>
            <Input value={f.cidade} onChange={(e) => set("cidade", e.target.value)} />
          </div>
          <div>
            <Label>Tipo</Label>
            <select
              value={f.tipo}
              onChange={(e) => set("tipo", e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <Label>Situação</Label>
            <select
              value={f.situacao}
              onChange={(e) => set("situacao", e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              {["Aprovado", "Em Aprovação", "Reservado"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Data inicial do evento *</Label>
            <Input type="date" value={f.data_evento} onChange={(e) => set("data_evento", e.target.value)} />
          </div>
          <div>
            <Label>Data final do evento *</Label>
            <Input type="date" value={f.data_evento_fim} onChange={(e) => set("data_evento_fim", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Observações</Label>
            <Textarea value={f.observacoes} onChange={(e) => set("observacoes", e.target.value)} />
          </div>
        </div>

        {!isNew && !showMontagemSection && (
          <div className="pt-2">
            <Button type="button" variant="outline" onClick={() => setShowMontagem(true)}>
              <CalendarPlus className="h-4 w-4 mr-2" /> Adicionar montagem e desmontagem
            </Button>
          </div>
        )}

        {showMontagemSection && (
          <div className="mt-2 rounded-md border p-4 space-y-4">
            <div className="text-sm font-semibold">Montagem, desmontagem e produtor</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Montagem — data inicial</Label>
                <Input type="date" value={f.data_montagem} onChange={(e) => set("data_montagem", e.target.value)} />
              </div>
              <div>
                <Label>Montagem — data final</Label>
                <Input type="date" value={f.data_montagem_fim} onChange={(e) => set("data_montagem_fim", e.target.value)} />
              </div>
              <div>
                <Label>Hora da montagem</Label>
                <Input type="time" value={f.hora_montagem} onChange={(e) => set("hora_montagem", e.target.value)} />
              </div>
              <div>
                <Label>Desmontagem — data inicial</Label>
                <Input type="date" value={f.data_desmontagem} onChange={(e) => set("data_desmontagem", e.target.value)} />
              </div>
              <div>
                <Label>Desmontagem — data final</Label>
                <Input type="date" value={f.data_desmontagem_fim} onChange={(e) => set("data_desmontagem_fim", e.target.value)} />
              </div>
              <div>
                <Label>Hora da desmontagem</Label>
                <Input type="time" value={f.hora_desmontagem} onChange={(e) => set("hora_desmontagem", e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label>Produtor do evento</Label>
                <select
                  value={f.produtor}
                  onChange={(e) => set("produtor", e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">— Selecione —</option>
                  {PRODUTORES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="sm:justify-between">
          {evento?.id ? (
            <Button variant="destructive" onClick={() => excluir.mutate()} disabled={excluir.isPending}>
              <Trash2 className="h-4 w-4 mr-1" /> Excluir
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
              {salvar.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
