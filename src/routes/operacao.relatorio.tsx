import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/operacao/relatorio")({ component: RelatorioGargalo });

const sb = supabase as any;

function RelatorioGargalo() {
  const [setorId, setSetorId] = useState<string>("__all__");

  const { data: setores = [] } = useQuery<any[]>({
    queryKey: ["op_setores_all_r"],
    queryFn: async () => (await sb.from("op_setores").select("id,nome").order("ordem")).data ?? [],
  });
  const { data: etapas = [] } = useQuery<any[]>({
    queryKey: ["op_etapas_all_r"],
    queryFn: async () => (await sb.from("op_setor_etapas").select("id,setor_id,nome,ordem").order("ordem")).data ?? [],
  });
  const { data: aponts = [] } = useQuery<any[]>({
    queryKey: ["op_aponts_r"],
    queryFn: async () => (await sb.from("op_ordem_apontamentos").select("etapa_id,iniciado_em,finalizado_em").not("finalizado_em", "is", null)).data ?? [],
  });
  const { data: ordens = [] } = useQuery<any[]>({
    queryKey: ["op_ordens_all_r"],
    queryFn: async () => (await sb.from("op_ordens").select("id,setor_id,etapa_atual_id,status")).data ?? [],
  });

  const rows = useMemo(() => {
    const filteredEtapas = setorId === "__all__" ? etapas : etapas.filter((e) => e.setor_id === setorId);
    return filteredEtapas.map((et) => {
      const setor = setores.find((s) => s.id === et.setor_id);
      const eventos = aponts.filter((a) => a.etapa_id === et.id);
      const total = eventos.length;
      let sum = 0;
      eventos.forEach((a) => {
        sum += (new Date(a.finalizado_em).getTime() - new Date(a.iniciado_em).getTime()) / 60000;
      });
      const media = total ? sum / total : 0;
      const abertas = ordens.filter((o) => o.etapa_atual_id === et.id && o.status !== "finalizada" && o.status !== "cancelada").length;
      return { setor: setor?.nome, etapa: et.nome, ordem: et.ordem, total, media, abertas };
    }).sort((a, b) => (b.abertas - a.abertas) || (b.media - a.media));
  }, [etapas, aponts, ordens, setorId, setores]);

  const fmtMin = (m: number) => m < 60 ? `${Math.round(m)} min` : `${(m / 60).toFixed(1)} h`;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Relatório de gargalo"
        description="Etapas com mais ordens paradas e maior tempo médio"
        actions={
          <Select value={setorId} onValueChange={setSetorId}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os setores</SelectItem>
              {setores.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Setor</TableHead>
              <TableHead>Etapa</TableHead>
              <TableHead className="text-right">Ordens paradas</TableHead>
              <TableHead className="text-right">Tempo médio</TableHead>
              <TableHead className="text-right">Apontamentos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell>{r.setor}</TableCell>
                <TableCell>{r.etapa}</TableCell>
                <TableCell className="text-right">
                  <span className={r.abertas > 3 ? "font-semibold text-rose-600" : ""}>{r.abertas}</span>
                </TableCell>
                <TableCell className="text-right">{r.total ? fmtMin(r.media) : "—"}</TableCell>
                <TableCell className="text-right text-muted-foreground">{r.total}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sem dados.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
