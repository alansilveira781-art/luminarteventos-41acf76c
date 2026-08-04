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
  const { data: passagens = [] } = useQuery<any[]>({
    queryKey: ["op_passagens_r"],
    queryFn: async () =>
      (await sb.from("op_ordem_setores").select("setor_id,iniciado_em,concluido_em")).data ?? [],
  });
  const { data: checklist = [] } = useQuery<any[]>({
    queryKey: ["op_checklist_r"],
    queryFn: async () =>
      (await sb.from("op_ordem_checklist").select("setor_id,concluido")).data ?? [],
  });
  const { data: ordens = [] } = useQuery<any[]>({
    queryKey: ["op_ordens_all_r"],
    queryFn: async () => (await sb.from("op_ordens").select("id,setor_id,status")).data ?? [],
  });

  const rows = useMemo(() => {
    const alvo = setorId === "__all__" ? setores : setores.filter((s) => s.id === setorId);
    return alvo
      .map((s) => {
        const concluidas = passagens.filter(
          (p) => p.setor_id === s.id && p.iniciado_em && p.concluido_em,
        );
        const total = concluidas.length;
        let sum = 0;
        concluidas.forEach((p) => {
          sum += (new Date(p.concluido_em).getTime() - new Date(p.iniciado_em).getTime()) / 60000;
        });
        const media = total ? sum / total : 0;
        const abertas = ordens.filter(
          (o) => o.setor_id === s.id && o.status !== "finalizada" && o.status !== "cancelada",
        ).length;
        const itens = checklist.filter((c) => c.setor_id === s.id);
        const pendentes = itens.filter((c) => !c.concluido).length;
        return { setor: s.nome, pendentes, itens: itens.length, total, media, abertas };
      })
      .sort((a, b) => b.abertas - a.abertas || b.media - a.media);
  }, [setores, passagens, checklist, ordens, setorId]);


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
              <TableHead className="text-right">Etapas pendentes</TableHead>
              <TableHead className="text-right">Ordens paradas</TableHead>
              <TableHead className="text-right">Tempo médio</TableHead>
              <TableHead className="text-right">Passagens</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell>{r.setor}</TableCell>
                <TableCell className="text-right">{r.itens ? `${r.pendentes}/${r.itens}` : "—"}</TableCell>
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
