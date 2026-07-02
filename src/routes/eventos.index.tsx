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
import { Plus, Link2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CalendarioEventos, type EventoCal } from "@/components/eventos/CalendarioEventos";

const sb = supabase as any;

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

  const copiarLinkPublico = async () => {
    const url = `${window.location.origin}/calendario-publico`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link público copiado! Já pode compartilhar com a empresa.");
    } catch {
      toast.info(`Link público: ${url}`, { duration: 8000 });
    }
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
            <Button onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Novo evento
            </Button>
          </>
        }
      />

      <Card className="p-4">
        <CalendarioEventos
          eventos={eventos}
          onSelectEvento={(e) => { setEditing(e); setOpen(true); }}
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

const TIPOS = ["Social", "Corporativo", "Stand", "Cenografia", "Planejados", "Outro"];

function EventoDialog({ evento, onClose, onSaved }: { evento: any | null; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [f, setF] = useState<any>(() => ({
    nome: evento?.nome ?? "",
    local: evento?.local ?? "",
    cidade: evento?.cidade ?? "",
    tipo: evento?.tipo ?? "Social",
    data_evento: evento?.data_evento ?? "",
    data_montagem: evento?.data_montagem ?? "",
    data_desmontagem: evento?.data_desmontagem ?? "",
    hora_inicio: evento?.hora_inicio ?? "",
    hora_fim: evento?.hora_fim ?? "",
    responsavel: evento?.responsavel ?? "",
    observacoes: evento?.observacoes ?? "",
    cor: evento?.cor ?? "#6366f1",
  }));
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  const salvar = useMutation({
    mutationFn: async () => {
      if (!f.nome.trim()) throw new Error("Informe o nome do evento");
      if (!f.data_evento) throw new Error("Informe a data do evento");

      const payload = {
        nome: f.nome.trim(),
        local: f.local || null,
        cidade: f.cidade || null,
        tipo: f.tipo || null,
        data_evento: f.data_evento,
        data_montagem: f.data_montagem || null,
        data_desmontagem: f.data_desmontagem || null,
        hora_inicio: f.hora_inicio || null,
        hora_fim: f.hora_fim || null,
        responsavel: f.responsavel || null,
        observacoes: f.observacoes || null,
        cor: f.cor || "#6366f1",
      };

      if (evento?.id) {
        const { error } = await sb.from("eventos").update(payload).eq("id", evento.id);
        if (error) throw error;
      } else {
        const { data: codigo, error: codErr } = await sb.rpc("proximo_codigo_evento", { _data: f.data_evento });
        if (codErr) throw codErr;
        const { error } = await sb.from("eventos").insert({
          ...payload,
          codigo,
          origem: "manual",
          created_by: user?.id ?? null,
        });
        if (error) throw error;
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

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {evento?.id ? "Editar evento" : "Novo evento"}
            {evento?.codigo && <span className="text-sm text-muted-foreground font-mono">#{evento.codigo}</span>}
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
            <Label>Cor no calendário</Label>
            <Input type="color" value={f.cor} onChange={(e) => set("cor", e.target.value)} className="h-10 p-1" />
          </div>
          <div>
            <Label>Data de montagem</Label>
            <Input type="date" value={f.data_montagem} onChange={(e) => set("data_montagem", e.target.value)} />
          </div>
          <div>
            <Label>Data do evento *</Label>
            <Input type="date" value={f.data_evento} onChange={(e) => set("data_evento", e.target.value)} />
          </div>
          <div>
            <Label>Data de desmontagem</Label>
            <Input type="date" value={f.data_desmontagem} onChange={(e) => set("data_desmontagem", e.target.value)} />
          </div>
          <div>
            <Label>Responsável</Label>
            <Input value={f.responsavel} onChange={(e) => set("responsavel", e.target.value)} />
          </div>
          <div>
            <Label>Hora início</Label>
            <Input type="time" value={f.hora_inicio} onChange={(e) => set("hora_inicio", e.target.value)} />
          </div>
          <div>
            <Label>Hora fim</Label>
            <Input type="time" value={f.hora_fim} onChange={(e) => set("hora_fim", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Observações</Label>
            <Textarea value={f.observacoes} onChange={(e) => set("observacoes", e.target.value)} />
          </div>
        </div>

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
