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
import { fetchAllRows } from "@/lib/fetch-all";
import { UberImportButton } from "@/components/financeiro/UberImportButton";

export const Route = createFileRoute("/financeiro-op/uber")({
  component: UberTabelona,
});

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
  projeto: string | null;
  detalhamento: string | null;
};

const PAGE_SIZE = 50;
const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function UberTabelona() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["uber-corridas-tabelona"],
    queryFn: async () => {
      const rows = await fetchAllRows<Row>(
        "uber_corridas",
        "id, data_solicitacao, hora_solicitacao, nome, sobrenome, servico, cidade, endereco_partida, endereco_destino, valor, projeto, detalhamento",
        { orderBy: { column: "data_solicitacao", ascending: false } },
      );
      return rows.map((r) => ({ ...r, valor: Number(r.valor) }));
    },
    staleTime: 30 * 1000,
  });

  const rows = data ?? [];

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = [r.nome, r.sobrenome, r.servico, r.cidade, r.endereco_partida, r.endereco_destino, r.projeto]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, busca]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const paged = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);
  const somaTotal = filtered.reduce((s, r) => s + (r.valor ?? 0), 0);

  const allChecked = paged.length > 0 && paged.every((r) => selected.has(r.id));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  function toggleAll() {
    setSelected((prev) => {
      const n = new Set(prev);
      if (allChecked) paged.forEach((r) => n.delete(r.id));
      else paged.forEach((r) => n.add(r.id));
      return n;
    });
  }

  async function excluirSelecionadas() {
    if (!selected.size) return;
    if (!confirm(`Excluir ${selected.size} corrida(s)?`)) return;
    const ids = Array.from(selected);
    const { error } = await supabase.from("uber_corridas").delete().in("id", ids);
    if (error) {
      toast.error(`Falha ao excluir: ${error.message}`);
      return;
    }
    toast.success(`${ids.length} corrida(s) excluída(s)`);
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["uber-corridas-tabelona"] });
    qc.invalidateQueries({ queryKey: ["uber-corridas-all"] });
  }

  return (
    <>
      <PageHeader
        title="Uber"
        description="Base acumulativa de corridas importadas da Uber Business"
        actions={
          <div className="flex gap-2">
            {selected.size > 0 && (
              <Button variant="outline" onClick={excluirSelecionadas}>
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir ({selected.size})
              </Button>
            )}
            <UberImportButton />
          </div>
        }
      />

      <div className="mb-3">
        <Input
          placeholder="Buscar por nome, serviço, endereço..."
          value={busca}
          onChange={(e) => { setBusca(e.target.value); setPage(1); }}
          className="max-w-md"
        />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-2 w-8">
                  <Checkbox checked={allChecked} onCheckedChange={toggleAll} />
                </th>
                <th className="text-left p-2">Data</th>
                <th className="text-left p-2">Hora</th>
                <th className="text-left p-2">Nome</th>
                <th className="text-left p-2">Sobrenome</th>
                <th className="text-left p-2">Serviço</th>
                <th className="text-left p-2">Cidade</th>
                <th className="text-left p-2">Projeto</th>
                <th className="text-left p-2">Partida</th>
                <th className="text-left p-2">Destino</th>
                <th className="text-right p-2">Valor</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={11} className="p-8 text-center text-muted-foreground">Carregando...</td></tr>
              ) : paged.length === 0 ? (
                <tr><td colSpan={11} className="p-8 text-center text-muted-foreground">Nenhuma corrida. Importe um CSV da Uber Business.</td></tr>
              ) : paged.map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/30">
                  <td className="p-2">
                    <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleOne(r.id)} />
                  </td>
                  <td className="p-2 whitespace-nowrap">{r.data_solicitacao.split("-").reverse().join("/")}</td>
                  <td className="p-2 whitespace-nowrap">{r.hora_solicitacao ?? "—"}</td>
                  <td className="p-2">{r.nome ?? "—"}</td>
                  <td className="p-2">{r.sobrenome ?? "—"}</td>
                  <td className="p-2">{r.servico ?? "—"}</td>
                  <td className="p-2">{r.cidade ?? "—"}</td>
                  <td className="p-2 max-w-[16rem] truncate" title={r.projeto ?? ""}>{r.projeto ?? "—"}</td>
                  <td className="p-2 max-w-xs truncate" title={r.endereco_partida ?? ""}>{r.endereco_partida ?? "—"}</td>
                  <td className="p-2 max-w-xs truncate" title={r.endereco_destino ?? ""}>{r.endereco_destino ?? "—"}</td>
                  <td className="p-2 text-right whitespace-nowrap">{fmtBRL(r.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-t bg-muted/20 text-sm">
          <div className="text-muted-foreground">
            <strong>{filtered.length}</strong> corridas • Total <strong>{fmtBRL(somaTotal)}</strong>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={pageSafe <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</Button>
            <span className="text-xs text-muted-foreground">Página {pageSafe} de {totalPages}</span>
            <Button size="sm" variant="outline" disabled={pageSafe >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Próxima</Button>
          </div>
        </div>
      </Card>
    </>
  );
}
