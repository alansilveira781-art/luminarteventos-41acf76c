import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/operacao/aprovacoes")({ component: Aprovacoes });

const sb = supabase as any;

function Aprovacoes() {
  const qc = useQueryClient();
  const { isAdmin, isModuleAdmin, user } = useAuth();
  const podeAprovar = isAdmin || isModuleAdmin("operacao");

  const { data: compras = [] } = useQuery<any[]>({
    queryKey: ["op_aprov_compras"],
    queryFn: async () => (await sb.from("compras")
      .select("id,numero,titulo,solicitante,valor_total,created_at,aprovacao_operacao,aprovacao_operacao_motivo")
      .eq("origem", "operacao").eq("aprovacao_operacao", "pendente").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: demandas = [] } = useQuery<any[]>({
    queryKey: ["op_aprov_demandas"],
    queryFn: async () => (await sb.from("demandas")
      .select("id,numero,titulo,solicitante,valor_total,created_at,aprovacao_operacao,aprovacao_operacao_motivo")
      .eq("origem", "operacao").eq("aprovacao_operacao", "pendente").order("created_at", { ascending: false })).data ?? [],
  });

  const inv = () => {
    qc.invalidateQueries({ queryKey: ["op_aprov_compras"] });
    qc.invalidateQueries({ queryKey: ["op_aprov_demandas"] });
  };

  async function decidir(tabela: "compras" | "demandas", id: string, aprovar: boolean) {
    let motivo: string | null = null;
    if (!aprovar) {
      motivo = prompt("Motivo da rejeição") ?? null;
      if (!motivo) return;
    }
    const patch: any = {
      aprovacao_operacao: aprovar ? "aprovada" : "rejeitada",
      aprovacao_operacao_motivo: motivo,
    };
    // aprovacao_operacao_autor pode não existir em todas as tabelas
    try { patch.aprovacao_operacao_autor = user?.id ?? null; } catch {}
    const { error } = await sb.from(tabela).update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(aprovar ? "Aprovado" : "Rejeitado");
    inv();
  }

  function Tab({ tabela, rows, base }: { tabela: "compras" | "demandas"; rows: any[]; base: string }) {
    return (
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Solicitante</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Data</TableHead>
              {podeAprovar && <TableHead className="text-right">Ação</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">
                  <Link to={base} search={{ id: r.id } as any} className="hover:underline">
                    {tabela === "compras" ? "COMPRA" : "DESPESA"}-{r.numero ?? "?"}
                  </Link>
                </TableCell>
                <TableCell>{r.titulo}</TableCell>
                <TableCell>{r.solicitante ?? "—"}</TableCell>
                <TableCell className="text-right">{r.valor_total?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) ?? "—"}</TableCell>
                <TableCell>{r.created_at ? new Date(r.created_at).toLocaleDateString("pt-BR") : "—"}</TableCell>
                {podeAprovar && (
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" className="mr-2" onClick={() => decidir(tabela, r.id, true)}>
                      <Check className="h-3.5 w-3.5 mr-1" /> Aprovar
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => decidir(tabela, r.id, false)}>
                      <X className="h-3.5 w-3.5 mr-1" /> Rejeitar
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={podeAprovar ? 6 : 5} className="text-center text-muted-foreground py-6">Nada pendente.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Aprovações de Operação" description="Solicitações originadas na produção aguardando decisão" />
      <div className="space-y-2">
        <div className="text-sm font-medium">Compras ({compras.length})</div>
        <Tab tabela="compras" rows={compras} base="/compras" />
      </div>
      <div className="space-y-2">
        <div className="text-sm font-medium">Despesas ({demandas.length})</div>
        <Tab tabela="demandas" rows={demandas} base="/financeiro" />
      </div>
    </div>
  );
}
