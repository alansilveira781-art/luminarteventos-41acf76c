import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, FileSpreadsheet, X, Download, Search, Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { normalize, cn } from "@/lib/utils";

type SistemaItem = {
  id: string;
  nome: string;
  codigo: string | null;
  quantidade_atual: number | null;
  status: string | null;
};

type EgestorRow = {
  codigo: string;
  produto: string;
  estoque: number;
};

type LinhaConferencia = {
  itemId: string | null;
  nome: string;
  codigoSistema: string | null;
  saldoSistema: number | null;
  saldoEgestor: number | null;
  diferenca: number | null;
  status: "ok" | "divergente" | "so_egestor" | "so_sistema";
  inativo?: boolean;
};

type Filtro = "todos" | "divergentes" | "so_egestor" | "so_sistema";

function parseEgestor(file: ArrayBuffer): EgestorRow[] {
  const wb = XLSX.read(file, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
  let headerIdx = -1;
  for (let i = 0; i < Math.min(aoa.length, 10); i++) {
    const first = String(aoa[i]?.[0] ?? "").trim().toLowerCase();
    if (first === "código" || first === "codigo") {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) throw new Error("Formato não reconhecido: cabeçalho 'Código' não encontrado.");
  const header = aoa[headerIdx].map((h: any) => normalize(String(h ?? "")));
  const colCodigo = header.indexOf("codigo");
  const colProduto = header.indexOf("produto");
  const colEstoque = header.indexOf("estoque");
  if (colProduto < 0 || colEstoque < 0)
    throw new Error("Colunas 'Produto' e/ou 'Estoque' não encontradas.");

  const rows: EgestorRow[] = [];
  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const r = aoa[i];
    if (!r) continue;
    const produto = String(r[colProduto] ?? "").trim();
    if (!produto) continue;
    const codigo = colCodigo >= 0 ? String(r[colCodigo] ?? "").trim() : "";
    const estoque = parseSaldoEgestor(r[colEstoque]);
    rows.push({ codigo, produto, estoque });
  }
  return rows;
}

export function ConferenciaEgestorDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [linhas, setLinhas] = useState<LinhaConferencia[] | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("divergentes");
  const [busca, setBusca] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [ajustando, setAjustando] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setLinhas(null);
    setBusca("");
    setFiltro("divergentes");
    setSelected(new Set());
    setAjustando(new Set());
  };

  const acceptFile = (f: File | null | undefined) => {
    if (!f) return;
    if (!/\.(xlsx|xls)$/i.test(f.name)) {
      toast.error("Use um arquivo .xlsx ou .xls do Egestor");
      return;
    }
    setFile(f);
    setLinhas(null);
    setSelected(new Set());
  };

  const conferir = async () => {
    if (!file) return toast.error("Selecione o arquivo do Egestor");
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const egestor = parseEgestor(buf);

      const all: SistemaItem[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("itens")
          .select("id,nome,codigo,quantidade_atual,status")
          .order("nome")
          .range(from, from + 999);
        if (error) throw error;
        all.push(...((data ?? []) as any));
        if ((data?.length ?? 0) < 1000) break;
        from += 1000;
      }

      const porNome = new Map<string, SistemaItem>();
      const porCodigo = new Map<string, SistemaItem>();
      for (const it of all) {
        if (it.nome) porNome.set(normalize(it.nome), it);
        if (it.codigo) porCodigo.set(normalize(it.codigo), it);
      }

      const matched = new Set<string>();
      const out: LinhaConferencia[] = [];

      for (const eg of egestor) {
        const nKey = normalize(eg.produto);
        const cKey = normalize(eg.codigo);
        let sis = porNome.get(nKey);
        if (!sis && cKey) sis = porCodigo.get(cKey);
        if (sis) {
          matched.add(sis.id);
          const saldoSis = Number(sis.quantidade_atual ?? 0);
          const dif = saldoSis - eg.estoque;
          out.push({
            itemId: sis.id,
            nome: sis.nome,
            codigoSistema: sis.codigo,
            saldoSistema: saldoSis,
            saldoEgestor: eg.estoque,
            diferenca: dif,
            status: dif === 0 ? "ok" : "divergente",
            inativo: sis.status === "inativo",
          });
        } else {
          out.push({
            itemId: null,
            nome: eg.produto,
            codigoSistema: eg.codigo || null,
            saldoSistema: null,
            saldoEgestor: eg.estoque,
            diferenca: null,
            status: "so_egestor",
          });
        }
      }

      for (const it of all) {
        if (matched.has(it.id)) continue;
        if (it.status === "inativo") continue;
        out.push({
          itemId: it.id,
          nome: it.nome,
          codigoSistema: it.codigo,
          saldoSistema: Number(it.quantidade_atual ?? 0),
          saldoEgestor: null,
          diferenca: null,
          status: "so_sistema",
        });
      }

      setLinhas(out);
      setSelected(new Set());
      const divs = out.filter((l) => l.status === "divergente").length;
      toast.success(`Conferência concluída: ${out.length} linhas · ${divs} divergentes`);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao processar a planilha");
    } finally {
      setBusy(false);
    }
  };

  const filtradas = useMemo(() => {
    if (!linhas) return [];
    const b = normalize(busca);
    return linhas.filter((l) => {
      if (filtro === "divergentes" && l.status !== "divergente") return false;
      if (filtro === "so_egestor" && l.status !== "so_egestor") return false;
      if (filtro === "so_sistema" && l.status !== "so_sistema") return false;
      if (b && !normalize(`${l.nome} ${l.codigoSistema ?? ""}`).includes(b)) return false;
      return true;
    });
  }, [linhas, filtro, busca]);

  const divergentesVisiveis = useMemo(
    () => filtradas.filter((l) => l.status === "divergente" && l.itemId),
    [filtradas],
  );

  /** Lança um ajuste para alinhar saldo do sistema ao Egestor. */
  const ajustarLinha = async (l: LinhaConferencia): Promise<boolean> => {
    if (!l.itemId || l.saldoSistema == null || l.saldoEgestor == null) return false;
    const dif = l.saldoSistema - l.saldoEgestor;
    if (dif === 0) return true;
    const qtd = Math.abs(dif);
    const obs = `Ajuste por conferência Egestor (saldo anterior: ${l.saldoSistema}, novo: ${l.saldoEgestor})`;

    let payload: Record<string, any>;
    if (dif < 0) {
      // sistema < egestor → entrada de ajuste
      payload = {
        tipo: "entrada",
        entrada_tipo: "ajuste",
        item_id: l.itemId,
        quantidade: qtd,
        observacoes: obs,
      };
    } else {
      // sistema > egestor → saída de ajuste (já finalizada, não pendente)
      payload = {
        tipo: "saida",
        saida_tipo: "outros",
        saida_status: "finalizada",
        item_id: l.itemId,
        quantidade: qtd,
        observacoes: obs,
        finalidade: "Ajuste por conferência Egestor",
      };
    }

    const { error } = await supabase.from("movimentacoes").insert(payload as any);
    if (error) {
      toast.error(`${l.nome}: ${error.message}`);
      return false;
    }
    return true;
  };

  const aplicarLinha = async (idx: number) => {
    const l = linhas?.[idx];
    if (!l || !l.itemId) return;
    const key = l.itemId;
    setAjustando((s) => new Set(s).add(key));
    const ok = await ajustarLinha(l);
    if (ok && linhas) {
      const novo = [...linhas];
      novo[idx] = {
        ...l,
        saldoSistema: l.saldoEgestor,
        diferenca: 0,
        status: "ok",
      };
      setLinhas(novo);
      setSelected((s) => {
        const ns = new Set(s);
        ns.delete(key);
        return ns;
      });
      toast.success(`Ajuste lançado: ${l.nome}`);
    }
    setAjustando((s) => {
      const ns = new Set(s);
      ns.delete(key);
      return ns;
    });
  };

  const aplicarSelecionados = async () => {
    if (!linhas) return;
    const alvos = linhas
      .map((l, i) => ({ l, i }))
      .filter(({ l }) => l.itemId && selected.has(l.itemId) && l.status === "divergente");
    if (alvos.length === 0) return toast.error("Nenhuma linha selecionada");

    setAjustando((s) => {
      const ns = new Set(s);
      alvos.forEach(({ l }) => l.itemId && ns.add(l.itemId));
      return ns;
    });

    let ok = 0;
    let fail = 0;
    const novo = [...linhas];
    for (const { l, i } of alvos) {
      const sucesso = await ajustarLinha(l);
      if (sucesso) {
        ok++;
        novo[i] = { ...l, saldoSistema: l.saldoEgestor, diferenca: 0, status: "ok" };
      } else {
        fail++;
      }
    }
    setLinhas(novo);
    setSelected(new Set());
    setAjustando(new Set());
    if (fail === 0) toast.success(`${ok} ajuste(s) lançado(s)`);
    else toast.warning(`${ok} ajustado(s) · ${fail} falha(s)`);
  };

  const toggleSelectAll = (checked: boolean) => {
    if (!checked) return setSelected(new Set());
    const ns = new Set<string>();
    divergentesVisiveis.forEach((l) => l.itemId && ns.add(l.itemId));
    setSelected(ns);
  };

  const exportar = () => {
    if (!filtradas.length) return toast.error("Nada para exportar");
    const data = filtradas.map((l) => ({
      Nome: l.nome,
      "Código sistema": l.codigoSistema ?? "",
      "Saldo sistema": l.saldoSistema ?? "",
      "Saldo Egestor": l.saldoEgestor ?? "",
      Diferença: l.diferenca ?? "",
      Status: statusLabel(l.status),
      Inativo: l.inativo ? "Sim" : "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Conferencia");
    XLSX.writeFile(wb, `conferencia_egestor_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const counts = useMemo(() => {
    if (!linhas) return { todos: 0, divergentes: 0, so_egestor: 0, so_sistema: 0 };
    return {
      todos: linhas.length,
      divergentes: linhas.filter((l) => l.status === "divergente").length,
      so_egestor: linhas.filter((l) => l.status === "so_egestor").length,
      so_sistema: linhas.filter((l) => l.status === "so_sistema").length,
    };
  }, [linhas]);

  const allSelected =
    divergentesVisiveis.length > 0 && divergentesVisiveis.every((l) => l.itemId && selected.has(l.itemId));

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Conferir estoque (Egestor)</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Envie o relatório de estoque do Egestor. Os itens são casados por <strong>nome</strong> (e por código como
            fallback). Você pode <strong>ajustar saldos divergentes</strong> — cada ajuste gera uma{" "}
            <strong>entrada</strong> ou <strong>saída</strong> de ajuste no histórico do item.
          </p>

          <div className="space-y-2">
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                acceptFile(e.target.files?.[0]);
                if (inputRef.current) inputRef.current.value = "";
              }}
            />
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                acceptFile(e.dataTransfer.files?.[0]);
              }}
              className={cn(
                "cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition-colors",
                dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30",
              )}
            >
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileSpreadsheet className="h-8 w-8 text-primary" />
                  <div className="text-left">
                    <div className="text-sm font-medium">{file.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB · clique para trocar
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      reset();
                    }}
                    title="Remover"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-2">
                  <Upload className="h-6 w-6 text-primary" />
                  <div className="text-sm font-medium">Clique ou arraste o arquivo .xlsx do Egestor</div>
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <Button type="button" onClick={conferir} disabled={!file || busy}>
                {busy ? "Conferindo…" : "Conferir"}
              </Button>
            </div>
          </div>

          {linhas && (
            <Card className="p-3 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <FiltroChip label={`Todos (${counts.todos})`} active={filtro === "todos"} onClick={() => setFiltro("todos")} />
                <FiltroChip
                  label={`Divergentes (${counts.divergentes})`}
                  active={filtro === "divergentes"}
                  onClick={() => setFiltro("divergentes")}
                />
                <FiltroChip
                  label={`Apenas no Egestor (${counts.so_egestor})`}
                  active={filtro === "so_egestor"}
                  onClick={() => setFiltro("so_egestor")}
                />
                <FiltroChip
                  label={`Apenas no sistema (${counts.so_sistema})`}
                  active={filtro === "so_sistema"}
                  onClick={() => setFiltro("so_sistema")}
                />
                <div className="relative ml-auto w-full sm:w-64">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar nome ou código…"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="h-8 pl-7"
                  />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={exportar}>
                  <Download className="h-4 w-4 mr-1" /> Exportar (.xlsx)
                </Button>
              </div>

              {selected.size > 0 && (
                <div className="flex items-center justify-between rounded border bg-primary/5 px-3 py-2 text-sm">
                  <span>{selected.size} divergência(s) selecionada(s)</span>
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                      Limpar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={aplicarSelecionados}
                      disabled={ajustando.size > 0}
                    >
                      <Wand2 className="h-4 w-4 mr-1" /> Ajustar selecionados ({selected.size})
                    </Button>
                  </div>
                </div>
              )}

              <div className="overflow-auto max-h-[55vh] rounded border">
                <table className="w-full text-xs">
                  <thead className="bg-background text-muted-foreground sticky top-0 z-10 shadow-[inset_0_-1px_0_hsl(var(--border))]">
                    <tr>
                      <th className="px-2 py-2 w-8">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={(v) => toggleSelectAll(!!v)}
                          disabled={divergentesVisiveis.length === 0}
                          aria-label="Selecionar todos"
                        />
                      </th>
                      <th className="px-2 py-2 text-left">Nome</th>
                      <th className="px-2 py-2 text-left">Cód. sistema</th>
                      <th className="px-2 py-2 text-right">Saldo sistema</th>
                      <th className="px-2 py-2 text-right">Saldo Egestor</th>
                      <th className="px-2 py-2 text-right">Diferença</th>
                      <th className="px-2 py-2 text-left">Status</th>
                      <th className="px-2 py-2 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtradas.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-2 py-6 text-center text-muted-foreground">
                          Nenhuma linha neste filtro.
                        </td>
                      </tr>
                    ) : (
                      filtradas.map((l) => {
                        const idx = linhas!.indexOf(l);
                        const isAdj = l.itemId ? ajustando.has(l.itemId) : false;
                        const canAdjust = l.status === "divergente" && !!l.itemId;
                        return (
                          <tr key={idx} className="border-t border-border/40">
                            <td className="px-2 py-1.5">
                              {canAdjust && l.itemId && (
                                <Checkbox
                                  checked={selected.has(l.itemId)}
                                  onCheckedChange={(v) => {
                                    setSelected((s) => {
                                      const ns = new Set(s);
                                      if (v) ns.add(l.itemId!);
                                      else ns.delete(l.itemId!);
                                      return ns;
                                    });
                                  }}
                                  aria-label="Selecionar"
                                />
                              )}
                            </td>
                            <td className="px-2 py-1.5">
                              {l.nome}
                              {l.inativo && <span className="ml-2 text-[10px] text-muted-foreground">(inativo)</span>}
                            </td>
                            <td className="px-2 py-1.5 font-mono">{l.codigoSistema ?? "—"}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{fmt(l.saldoSistema)}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{fmt(l.saldoEgestor)}</td>
                            <td
                              className={cn(
                                "px-2 py-1.5 text-right tabular-nums font-medium",
                                l.diferenca === 0 && "text-success",
                                l.diferenca != null && l.diferenca !== 0 && "text-destructive",
                              )}
                            >
                              {l.diferenca == null ? "—" : (l.diferenca > 0 ? `+${l.diferenca}` : String(l.diferenca))}
                            </td>
                            <td className="px-2 py-1.5">
                              <StatusChip status={l.status} />
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              {canAdjust && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2"
                                  disabled={isAdj}
                                  onClick={() => aplicarLinha(idx)}
                                  title={
                                    l.diferenca! < 0
                                      ? `Entrada de ajuste de ${Math.abs(l.diferenca!)}`
                                      : `Saída de ajuste de ${l.diferenca}`
                                  }
                                >
                                  {isAdj ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <>
                                      <Wand2 className="h-3.5 w-3.5 mr-1" /> Ajustar
                                    </>
                                  )}
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return Number(n).toLocaleString("pt-BR");
}

function statusLabel(s: LinhaConferencia["status"]) {
  switch (s) {
    case "ok": return "OK";
    case "divergente": return "Divergente";
    case "so_egestor": return "Apenas no Egestor";
    case "so_sistema": return "Apenas no sistema";
  }
}

function StatusChip({ status }: { status: LinhaConferencia["status"] }) {
  const map: Record<LinhaConferencia["status"], string> = {
    ok: "bg-success/15 text-success border-success/30",
    divergente: "bg-destructive/15 text-destructive border-destructive/30",
    so_egestor: "bg-warning/15 text-warning border-warning/30",
    so_sistema: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge variant="outline" className={cn("font-normal", map[status])}>
      {statusLabel(status)}
    </Badge>
  );
}

function FiltroChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-xs px-3 py-1 rounded-full border transition-colors",
        active ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}
