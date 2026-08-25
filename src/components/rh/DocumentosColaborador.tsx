import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const TIPOS_DOCUMENTO = [
  { value: "rg", label: "RG" },
  { value: "cpf", label: "CPF" },
  { value: "ctps", label: "CTPS" },
  { value: "aso", label: "ASO" },
  { value: "contrato", label: "Contrato" },
  { value: "certificado", label: "Certificado" },
  { value: "outros", label: "Outros" },
] as const;

type Doc = {
  id: string;
  colaborador_id: string;
  tipo: string;
  descricao: string | null;
  arquivo_path: string;
  arquivo_nome: string;
  validade: string | null;
  created_at: string;
};

function tipoLabel(t: string) {
  return TIPOS_DOCUMENTO.find((x) => x.value === t)?.label ?? "Outros";
}

function sanitize(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(-120);
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function statusValidade(validade: string | null) {
  if (!validade) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const v = new Date(`${validade}T00:00:00`);
  const dias = Math.round((v.getTime() - hoje.getTime()) / 86_400_000);
  if (dias < 0) return { label: "Vencido", cls: "bg-rose-500/15 text-rose-600 border-rose-500/30" };
  if (dias <= 30) return { label: `Vence em ${dias}d`, cls: "bg-amber-500/15 text-amber-600 border-amber-500/30" };
  return null;
}

export function DocumentosColaborador({ colaboradorId }: { colaboradorId: string }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [tipo, setTipo] = useState("outros");
  const [descricao, setDescricao] = useState("");
  const [validade, setValidade] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("rh_colaborador_documentos")
      .select("*")
      .eq("colaborador_id", colaboradorId)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setDocs((data as any) ?? []);
    setLoading(false);
  }, [colaboradorId]);

  useEffect(() => {
    load();
  }, [load]);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      for (const file of Array.from(files)) {
        const path = `${colaboradorId}/${Date.now()}-${sanitize(file.name)}`;
        const { error: upErr } = await supabase.storage.from("rh-documentos").upload(path, file);
        if (upErr) throw upErr;
        const { error } = await supabase.from("rh_colaborador_documentos").insert({
          colaborador_id: colaboradorId,
          tipo,
          descricao: descricao.trim() || null,
          arquivo_path: path,
          arquivo_nome: file.name,
          validade: validade || null,
          created_by: uid,
        } as any);
        if (error) throw error;
      }
      toast.success("Documento(s) enviado(s)");
      setDescricao("");
      setValidade("");
      if (fileRef.current) fileRef.current.value = "";
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Falha no envio");
    } finally {
      setUploading(false);
    }
  }

  async function abrir(doc: Doc) {
    const { data, error } = await supabase.storage.from("rh-documentos").createSignedUrl(doc.arquivo_path, 60);
    if (error || !data?.signedUrl) return toast.error(error?.message ?? "Não foi possível abrir o arquivo");
    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function excluir(doc: Doc) {
    if (!confirm(`Excluir "${doc.arquivo_nome}"?`)) return;
    const { error } = await supabase.from("rh_colaborador_documentos").delete().eq("id", doc.id);
    if (error) return toast.error(error.message);
    await supabase.storage.from("rh-documentos").remove([doc.arquivo_path]);
    toast.success("Documento excluído");
    load();
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div>
          <Label className="text-xs">Tipo</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_DOCUMENTO.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Descrição</Label>
          <Input className="h-9" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Opcional" />
        </div>
        <div>
          <Label className="text-xs">Validade</Label>
          <Input className="h-9" type="date" value={validade} onChange={(e) => setValidade(e.target.value)} />
        </div>
      </div>

      <div>
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
          {uploading ? "Enviando…" : "Enviar documento"}
        </Button>
      </div>

      <div className="rounded-md border border-border divide-y">
        {loading ? (
          <p className="p-3 text-sm text-muted-foreground">Carregando…</p>
        ) : docs.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">Nenhum documento enviado.</p>
        ) : (
          docs.map((d) => {
            const st = statusValidade(d.validade);
            return (
              <div key={d.id} className="flex items-center gap-2 p-2 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{tipoLabel(d.tipo)}</Badge>
                    <span className="truncate font-medium">{d.arquivo_nome}</span>
                    {st && <Badge className={`text-[10px] ${st.cls}`}>{st.label}</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {d.descricao ? `${d.descricao} · ` : ""}Enviado em {fmtDate(d.created_at)}
                    {d.validade ? ` · Validade ${fmtDate(d.validade)}` : ""}
                  </div>
                </div>
                <Button size="icon" variant="ghost" title="Abrir" onClick={() => abrir(d)}>
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" title="Excluir" className="text-rose-600" onClick={() => excluir(d)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
