import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Pencil, Trash2, Bold, Italic, List, Heading2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CAMPOS_SUGERIDOS, extrairCampos, normalizarHtmlEditor, sanitizeHtml } from "@/lib/juridico/modelo-render";

export const Route = createFileRoute("/juridico/modelos")({ component: ModelosPage });

const TIPOS = [
  { value: "corporativo", label: "Corporativo" },
  { value: "cenografia", label: "Cenografia" },
  { value: "stand", label: "Stand" },
  { value: "social", label: "Social" },
] as const;

type Modelo = { id: string; tipo: string; nome: string; corpo_html: string; variaveis: string[]; ativo: boolean };

const extractVars = extrairCampos;


function ModelosPage() {
  const qc = useQueryClient();
  const { isModuleAdmin, user } = useAuth();
  const isAdmin = isModuleAdmin("juridico");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Modelo | null>(null);

  const { data: modelos, isLoading } = useQuery({
    queryKey: ["juridico_modelos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("juridico_modelos").select("*").order("tipo").order("nome");
      if (error) throw error;
      return (data ?? []) as Modelo[];
    },
  });

  const saveMut = useMutation({
    mutationFn: async (p: any) => {
      const safeHtml = sanitizeHtml(p.corpo_html ?? "");
      const variaveis = extractVars(safeHtml);
      const payload = { ...p, corpo_html: safeHtml, variaveis };
      const { id, ...rest } = payload;
      if (id) {
        const { error } = await supabase.from("juridico_modelos").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("juridico_modelos").insert({ ...rest, created_by: user?.id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["juridico_modelos"] }); toast.success("Salvo"); setOpen(false); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("juridico_modelos").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["juridico_modelos"] }); toast.success("Removido"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Modelos de contrato"
        description="Modelos reutilizáveis para gerar contratos automaticamente na etapa de Criação. Use {{variavel}} para campos a preencher."
        actions={isAdmin && <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Novo modelo</Button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {TIPOS.map((t) => {
          const list = (modelos ?? []).filter((m) => m.tipo === t.value);
          return (
            <Card key={t.value} className="p-3">
              <div className="font-semibold text-sm mb-2">{t.label}</div>
              {isLoading && <div className="text-xs text-muted-foreground">Carregando…</div>}
              {!isLoading && list.length === 0 && <div className="text-xs text-muted-foreground">Nenhum modelo.</div>}
              <div className="space-y-1">
                {list.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-xs">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{m.nome}</div>
                      <div className="text-[10px] text-muted-foreground">{(m.variaveis ?? []).length} variáveis</div>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1">
                        <button className="h-6 w-6 rounded hover:bg-muted inline-flex items-center justify-center" onClick={() => { setEditing(m); setOpen(true); }}><Pencil className="h-3 w-3" /></button>
                        <button className="h-6 w-6 rounded hover:bg-muted text-rose-600 inline-flex items-center justify-center" onClick={() => { if (confirm("Remover modelo?")) delMut.mutate(m.id); }}><Trash2 className="h-3 w-3" /></button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      <ModeloDialog open={open} onOpenChange={setOpen} editing={editing} onSave={(p) => saveMut.mutate(p)} />
    </>
  );
}

function ModeloDialog({ open, onOpenChange, editing, onSave }: {
  open: boolean; onOpenChange: (v: boolean) => void; editing: Modelo | null; onSave: (p: any) => void;
}) {
  const [f, setF] = useState<any>({});
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const init = editing ?? { tipo: "corporativo", nome: "", corpo_html: "<p>Cole ou escreva o contrato aqui. Use <strong>[cliente_nome]</strong>, [cliente_documento], [valor_total] nos trechos a preencher.</p>" };
    setF({ ...init });
    const id = requestAnimationFrame(() => {
      if (ref.current) ref.current.innerHTML = sanitizeHtml(init.corpo_html ?? "");
      try { document.execCommand("styleWithCSS", false, "false"); } catch { /* noop */ }
    });
    return () => cancelAnimationFrame(id);
  }, [editing, open]);

  const exec = (cmd: string, val?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, val);
    setF((p: any) => ({ ...p, corpo_html: ref.current?.innerHTML ?? p.corpo_html }));
  };

  /** Colagem do Word: limpa classes/estilos e quebras soltas, preservando negrito e listas. */
  const colar = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const html = e.clipboardData.getData("text/html");
    const texto = e.clipboardData.getData("text/plain");
    if (html) {
      document.execCommand("insertHTML", false, normalizarHtmlEditor(html));
    } else {
      const blocos = texto
        .split(/\n{2,}/)
        .map((b) => `<p>${b.replace(/\n/g, " ").replace(/[<>]/g, "").trim()}</p>`)
        .join("");
      document.execCommand("insertHTML", false, blocos);
    }
    setF((p: any) => ({ ...p, corpo_html: ref.current?.innerHTML ?? p.corpo_html }));
  };

  const salvar = () => {
    if (!f.nome) return toast.error("Informe o nome");
    onSave({ ...f, corpo_html: ref.current?.innerHTML ?? f.corpo_html ?? "" });
  };

  const vars = useMemo(() => extractVars(f.corpo_html ?? ""), [f.corpo_html]);


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader><DialogTitle>{editing ? "Editar modelo" : "Novo modelo"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Tipo</Label>
            <Select value={f.tipo ?? "corporativo"} onValueChange={(v) => setF({ ...f, tipo: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Nome do modelo *</Label><Input value={f.nome ?? ""} onChange={(e) => setF({ ...f, nome: e.target.value })} /></div>
        </div>
        <div className="mt-3">
          <Label>Corpo do contrato</Label>
          <div className="border rounded-md overflow-hidden mt-1">
            <div className="flex items-center gap-1 border-b border-border p-1 bg-muted/30">
              <button type="button" onClick={() => exec("bold")} className="h-7 w-7 rounded hover:bg-muted inline-flex items-center justify-center"><Bold className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => exec("italic")} className="h-7 w-7 rounded hover:bg-muted inline-flex items-center justify-center"><Italic className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => exec("formatBlock", "<h2>")} className="h-7 w-7 rounded hover:bg-muted inline-flex items-center justify-center"><Heading2 className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => exec("insertUnorderedList")} className="h-7 w-7 rounded hover:bg-muted inline-flex items-center justify-center"><List className="h-3.5 w-3.5" /></button>
              <div className="mx-2 h-4 w-px bg-border" />
              <button type="button" onClick={() => { const v = prompt("Nome do campo (ex: cliente_nome)"); if (v) exec("insertText", `[${v.trim().replace(/\s+/g, "_")}]`); }} className="text-xs px-2 h-7 rounded hover:bg-muted">+ Campo</button>
            </div>
            <div className="flex flex-wrap gap-1 border-b border-border p-1 bg-background max-h-52 overflow-y-auto">
              <span className="text-[11px] text-muted-foreground px-1 py-0.5">Campos automáticos:</span>
              {CAMPOS_SUGERIDOS.map((c) => (
                <button
                  key={c.campo}
                  type="button"
                  title={`[${c.campo}]`}
                  onClick={() => exec("insertText", `[${c.campo}]`)}
                  className="text-[11px] px-1.5 py-0.5 rounded bg-muted hover:bg-primary/10"
                >
                  {c.label}
                </button>
              ))}

            </div>
            <div
              ref={ref}
              contentEditable
              onInput={() => setF((p: any) => ({ ...p, corpo_html: ref.current?.innerHTML ?? p.corpo_html }))}
              onBlur={() => setF((p: any) => ({ ...p, corpo_html: ref.current?.innerHTML ?? p.corpo_html }))}
              onPaste={colar}
              className="prose prose-sm max-w-none p-3 min-h-[300px] max-h-[55vh] overflow-y-auto focus:outline-none contrato-preview"
              suppressContentEditableWarning
            />

          </div>
          {vars.length > 0 && (
            <div className="mt-2 text-xs text-muted-foreground">
              Campos detectados: {vars.map((v) => <span key={v} className="inline-block px-1.5 py-0.5 rounded bg-muted mr-1 font-mono">[{v}]</span>)}
            </div>
          )}

        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => { if (!f.nome) return toast.error("Informe o nome"); onSave(f); }}>{editing ? "Salvar" : "Criar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
