import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EMPRESAS } from "@/lib/empresas";
import { FileSearch, RefreshCw, Download, Info } from "lucide-react";
import { toast } from "sonner";

type NfeConsulta = {
  id: string;
  empresa: string;
  chave: string;
  numero: string | null;
  serie: string | null;
  emitente_cnpj: string | null;
  emitente_nome: string | null;
  destinatario_cnpj: string | null;
  destinatario_nome: string | null;
  valor: number | null;
  data_emissao: string | null;
  status: string | null;
  xml_url: string | null;
};

export function NotasSefaz() {
  const [empresa, setEmpresa] = useState<string>("__all");
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [q, setQ] = useState("");

  const { data: notas = [], refetch, isFetching } = useQuery({
    queryKey: ["nfe-consultas", empresa, from, to],
    queryFn: async () => {
      let query = supabase
        .from("nfe_consultas" as any)
        .select("*")
        .order("data_emissao", { ascending: false });
      if (empresa !== "__all") query = query.eq("empresa", empresa);
      if (from) query = query.gte("data_emissao", `${from}T00:00:00`);
      if (to) query = query.lte("data_emissao", `${to}T23:59:59`);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as NfeConsulta[];
    },
  });

  const filtered = useMemo(() => {
    if (!q) return notas;
    const term = q.toLowerCase();
    return notas.filter((n) =>
      [n.chave, n.numero, n.emitente_nome, n.destinatario_nome, n.emitente_cnpj]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(term)),
    );
  }, [notas, q]);

  const total = useMemo(
    () => filtered.reduce((s, n) => s + Number(n.valor ?? 0), 0),
    [filtered],
  );

  const sincronizar = async () => {
    toast.info("Sincronização SEFAZ ainda não está conectada", {
      description: "Aguardando credenciais do provedor (Focus NFe / PlugNotas). Quando configurado, este botão buscará as NFs emitidas no período.",
    });
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 border-primary/20 bg-primary/5">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-semibold mb-1">Consulta de notas emitidas (SEFAZ)</div>
            <div className="text-muted-foreground text-xs">
              Esta aba mostra as notas fiscais emitidas no CNPJ das empresas do grupo, sincronizadas via provedor (Focus NFe / PlugNotas).
              A integração será ativada após o cadastro das credenciais do provedor escolhido.
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-3 flex flex-wrap gap-2 items-end">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Empresa</label>
          <Select value={empresa} onValueChange={setEmpresa}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todas as empresas</SelectItem>
              {EMPRESAS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">De</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Até</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs text-muted-foreground block mb-1">Buscar</label>
          <Input placeholder="Chave, número, emitente…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Button onClick={sincronizar} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} /> Sincronizar SEFAZ
        </Button>
        <Button variant="outline" onClick={() => refetch()}>Atualizar lista</Button>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-2 border-b flex items-center justify-between text-sm">
          <div>{filtered.length} nota(s)</div>
          <div className="font-semibold tabular-nums">
            Total: {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Data</th>
                <th className="px-3 py-2 text-left">Empresa</th>
                <th className="px-3 py-2 text-left">Nº/Série</th>
                <th className="px-3 py-2 text-left">Emitente</th>
                <th className="px-3 py-2 text-right">Valor</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    <FileSearch className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    Nenhuma nota encontrada no período. Use "Sincronizar SEFAZ" para buscar.
                  </td>
                </tr>
              )}
              {filtered.map((n) => (
                <tr key={n.id} className="border-t hover:bg-muted/20">
                  <td className="px-3 py-2 text-xs tabular-nums">
                    {n.data_emissao ? new Date(n.data_emissao).toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">{n.empresa}</td>
                  <td className="px-3 py-2 text-xs tabular-nums">{n.numero ?? "—"}{n.serie ? `/${n.serie}` : ""}</td>
                  <td className="px-3 py-2">
                    <div className="text-sm">{n.emitente_nome ?? "—"}</div>
                    {n.emitente_cnpj && <div className="text-[10px] text-muted-foreground font-mono">{n.emitente_cnpj}</div>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {Number(n.valor ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </td>
                  <td className="px-3 py-2"><Badge variant="outline">{n.status ?? "—"}</Badge></td>
                  <td className="px-3 py-2 text-right">
                    {n.xml_url && (
                      <Button size="sm" variant="ghost" asChild>
                        <a href={n.xml_url} target="_blank" rel="noreferrer"><Download className="h-3.5 w-3.5 mr-1" /> XML</a>
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
