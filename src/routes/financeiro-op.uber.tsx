import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { UberImportButton } from "@/components/financeiro/UberImportButton";
import { UberDashboard } from "@/components/financeiro/UberDashboard";

export const Route = createFileRoute("/financeiro-op/uber")({
  component: UberPage,
});

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const PAGE_SIZE = 50;

type Row = {
  id: string;
  data_solicitacao: string;
  hora_solicitacao: string | null;
  nome: string | null;
  sobrenome: string | null;
  servico: string | null;
  cidade: string | null;
  endereco_partida: string | null;
  endereco_destino: string | null;
  valor: number;
};

function UberPage() {
  const qc = useQueryClient();
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["uber-corridas-all", from, to],
    queryFn: async () => {
      let query = supabase
        .from("uber_corridas")
        .select("id, data_solicitacao, hora_solicitacao, nome, sobrenome, servico, cidade, endereco_partida, endereco_destino, valor")
        .order("data_solicitacao", { ascending: false })
        .order("hora_solicitacao", { ascending: false })
        .limit(20000);
      if (from) query = query.gte("data_solicitacao", from);
      if (to) query = query.lte("data_solicitacao", to);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((r) => ({ ...r, valor: Number(r.valor) })) as Row[];
    },
  });

  const rows = data ?? [];

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => {
      const hay = [r.nome, r.sobrenome, r.servico, r.cidade, r.endereco_partida, r.endereco_destino]
        .filter(Boolean).join(" ").toLowerCase();
      return hay.includes(term);
    });
  }, [rows, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const somaFiltrado = filtered.reduce((s, r) => s + (r.valor ?? 0), 0);

  const dashFrom = from || (rows.length ? rows[rows.length - 1].data_solicitacao : new Date().toISOString().slice(0, 10));
  const dashTo = to || (rows.length ? rows[0].data_solicitacao : new Date().toISOString().slice(0, 10));

  const allChecked = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));
  function toggleAll() {
    const next = new Set(selected);
    if (allChecked) pageRows.forEach((r) => next.delete(r.id));
    else pageRows.forEach((r) => next.add(r.id));
    setSelected(next);
  }
  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }

  async function excluirSelecionadas() {
    if (!selected.size) return;
    if (!confirm(`Excluir ${selected.size} corrida(s)?`)) return;
    const ids = Array.from(selected);
    const { error } = await supabase.from("uber_corridas").delete().in("id", ids);
    if (error) { toast.error(error.message); return; }
    toast.success(`${ids.length} corrida(s) excluída(s)`);
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["uber-corridas-all"] });
    qc.invalidateQueries({ queryKey: ["uber-corridas"] });
  }

  return (
    <div>
      <PageHeader
        title="Uber — Base de Corridas"
        description="Todas as corridas importadas dos relatórios da Uber Business"
        actions={<UberImportButton />}
      />

      <UberDashboard from={dashFrom} to={dashTo} />

      <Card className="p-4 mt-6">
        <div className="flex flex-wrap gap-3 items-end mb-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">De</label>
            <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="w-44" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Até</label>
            <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="w-44" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-medium text-muted-foreground block mb-1">Buscar</label>
            <Input placeholder="Nome, serviço, endereço..." value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          </div>
          {selected.size > 0 && (
            <Button variant="destructive" onClick={excluirSelecionadas}>
              <Trash2 className="h-4 w-4 mr-2" /> Excluir {selected.size}
            </Button>
          )}
        </div>

        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="py-2 w-8"><Checkbox checked={allChecked} onCheckedChange={toggleAll} /></th>
                <th className="text-left py-2">Data</th>
                <th className="text-left py-2">Hora</th>
                <th className="text-left py-2">Nome</th>
                <th className="text-left py-2">Sobrenome</th>
                <th className="text-left py-2">Serviço</th>
                <th className="text-left py-2">Cidade</th>
                <th className="text-left py-2">Partida</th>
                <th className="text-left py-2">Destino</th>
                <th className="text-right py-2">Valor</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={10} className="py-6 text-center text-muted-foreground">Carregando...</td></tr>}
              {!isLoading && pageRows.length === 0 && (
                <tr><td colSpan={10} className="py-6 text-center text-muted-foreground">Nenhuma corrida encontrada. Importe uma planilha.</td></tr>
              )}
              {pageRows.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="py-2"><Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleOne(r.id)} /></td>
                  <td className="py-2">{r.data_solicitacao.split("-").reverse().join("/")}</td>
                  <td className="py-2">{r.hora_solicitacao ?? ""}</td>
                  <td className="py-2">{r.nome ?? ""}</td>
                  <td className="py-2">{r.sobrenome ?? ""}</td>
                  <td className="py-2">{r.servico ?? ""}</td>
                  <td className="py-2">{r.cidade ?? ""}</td>
                  <td className="py-2 max-w-[220px] truncate" title={r.endereco_partida ?? ""}>{r.endereco_partida ?? ""}</td>
                  <td className="py-2 max-w-[220px] truncate" title={r.endereco_destino ?? ""}>{r.endereco_destino ?? ""}</td>
                  <td className="py-2 text-right">{fmt(r.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t text-sm">
          <div className="text-muted-foreground">
            {filtered.length.toLocaleString("pt-BR")} corrida(s) · Total: <span className="font-semibold text-foreground">{fmt(somaFiltrado)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Anterior</Button>
            <span className="text-xs text-muted-foreground">Página {currentPage} de {totalPages}</span>
            <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>Próxima</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
