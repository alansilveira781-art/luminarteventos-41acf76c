import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronsUpDown, Search, Plus } from "lucide-react";
import { normalize } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MoneyInput } from "@/components/MoneyInput";
import { toast } from "sonner";
import { useCatalogo, useCatalogoMutations } from "@/lib/comercial/useCatalogo";
import { TIPO_MEDIDA_LABEL, type CatalogoDescricao, type TipoMedida } from "@/lib/comercial/types";

const TIPOS: TipoMedida[] = ["unidade", "dimensional", "area", "linear"];

/**
 * Combobox digitável de descrições do catálogo (lê do Supabase).
 */
export function CatalogoPicker({
  onPick,
  onPickVazia,
}: {
  onPick: (c: CatalogoDescricao) => void;
  onPickVazia: () => void;
}) {
  const { catalogo } = useCatalogo();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [novoOpen, setNovoOpen] = useState(false);

  const filtered = useMemo(() => {
    const terms = normalize(search).split(/\s+/).filter(Boolean);
    if (!terms.length) return catalogo;
    return catalogo.filter((o) => {
      const h = normalize(o.nome);
      return terms.every((t) => h.includes(t));
    });
  }, [catalogo, search]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const pick = (c: CatalogoDescricao) => {
    onPick(c);
    setSearch("");
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full justify-between"
        onClick={() => setOpen((c) => !c)}
      >
        + Adicionar descrição (catálogo)
        <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" />
      </Button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover text-popover-foreground shadow-md">
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="h-4 w-4 opacity-60" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (filtered.length === 1) pick(filtered[0]);
                }
              }}
              placeholder="Buscar descrição…"
              className="h-10 border-0 bg-transparent px-0 py-3 shadow-none focus-visible:ring-0"
            />
          </div>

          <div className="max-h-64 overflow-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                {catalogo.length === 0 ? "Catálogo vazio" : "Nenhum resultado"}
              </div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); pick(c); }}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                >
                  <span className="truncate">{c.nome}</span>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {TIPO_MEDIDA_LABEL[c.tipoMedida]}
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="border-t border-border">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setOpen(false);
                setNovoOpen(true);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left text-primary"
            >
              <Plus className="h-3.5 w-3.5" />
              {search.trim() ? `“${search.trim()}” + Nova descrição` : "Nova descrição"}
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setOpen(false);
                onPickVazia();
              }}
              className="w-full px-3 py-2 text-sm hover:bg-accent text-left text-muted-foreground"
            >
              Descrição manual (em branco)
            </button>
          </div>
        </div>
      )}

      <NovaDescricaoDialog
        open={novoOpen}
        onOpenChange={setNovoOpen}
        nomeInicial={search}
        onCreated={(c) => {
          setNovoOpen(false);
          setSearch("");
          onPick(c);
        }}
      />
    </div>
  );
}

function NovaDescricaoDialog({
  open, onOpenChange, nomeInicial, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  nomeInicial: string;
  onCreated: (c: CatalogoDescricao) => void;
}) {
  const { create } = useCatalogoMutations();
  const [nome, setNome] = useState("");
  const [tipoMedida, setTipoMedida] = useState<TipoMedida>("unidade");
  const [valor, setValor] = useState(0);
  const [unidade, setUnidade] = useState("un");

  useEffect(() => {
    if (!open) return;
    setNome(nomeInicial ?? "");
    setTipoMedida("unidade");
    setValor(0);
    setUnidade("un");
  }, [open, nomeInicial]);

  function salvar() {
    if (!nome.trim()) return toast.error("Informe o nome");
    create.mutate(
      { nome: nome.trim(), tipoMedida, valorUnitario: valor, unidade },
      {
        onSuccess: (c) => { toast.success("Descrição cadastrada"); onCreated(c); },
        onError: (e: any) => toast.error(e?.message ?? "Falha ao cadastrar"),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova descrição</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus placeholder="Ex: Painel LED 4x2, Mesa redonda…" />
          </div>
          <div>
            <Label>Tipo de medida *</Label>
            <Select value={tipoMedida} onValueChange={(v) => setTipoMedida(v as TipoMedida)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => <SelectItem key={t} value={t}>{TIPO_MEDIDA_LABEL[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {tipoMedida === "unidade" && (
            <div>
              <Label>Unidade (rótulo)</Label>
              <Input value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="un, pç, kg…" />
            </div>
          )}
          <div>
            <Label>Valor unitário (R${tipoMedida === "area" ? "/m²" : tipoMedida === "linear" ? "/m" : ""}) *</Label>
            <MoneyInput value={valor} onChange={setValor} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={create.isPending}>Salvar e adicionar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
