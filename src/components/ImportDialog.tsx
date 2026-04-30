import { useState, ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Download, Upload, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { parseSpreadsheet, downloadTemplate, pickRow, ImportRow } from "@/lib/import-utils";

export function ImportDialog({
  open,
  onOpenChange,
  title,
  templateFilename,
  templateHeaders,
  templateExample,
  description,
  onImport,
  extraInfo,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  templateFilename: string;
  templateHeaders: string[];
  templateExample: Record<string, any>;
  description: string;
  onImport: (rows: ImportRow[]) => Promise<{ inserted: number; skipped: number; errors: string[] }>;
  extraInfo?: ReactNode;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ inserted: number; skipped: number; errors: string[] } | null>(null);

  const handle = async () => {
    if (!file) return toast.error("Selecione um arquivo");
    setBusy(true); setResult(null);
    try {
      const rows = await parseSpreadsheet(file);
      const normalized = rows.map((r) => pickRow(r, templateHeaders));
      const r = await onImport(normalized);
      setResult(r);
      toast.success(`${r.inserted} importados, ${r.skipped} ignorados`);
    } catch (e: any) {
      toast.error(e.message ?? "Falha na importação");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setFile(null); setResult(null); } }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{description}</p>

          <Card className="p-4 bg-muted/30">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                <div>
                  <div className="text-sm font-medium">Modelo da planilha</div>
                  <div className="text-xs text-muted-foreground">Baixe, preencha e envie de volta</div>
                </div>
              </div>
              <Button type="button" variant="outline" onClick={() => downloadTemplate(templateFilename, templateHeaders, templateExample)}>
                <Download className="h-4 w-4 mr-1" /> Baixar modelo
              </Button>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              Colunas esperadas: <span className="font-mono">{templateHeaders.join(", ")}</span>
            </div>
          </Card>

          {extraInfo}

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Arquivo (.xlsx, .xls, .csv)</label>
            <Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>

          {result && (
            <Card className="p-3 text-sm space-y-1">
              <div className="text-success">✓ Importados: {result.inserted}</div>
              <div className="text-muted-foreground">Ignorados (duplicados ou inválidos): {result.skipped}</div>
              {result.errors.length > 0 && (
                <div className="mt-2 text-xs text-destructive max-h-40 overflow-auto">
                  {result.errors.slice(0, 20).map((e, i) => <div key={i}>• {e}</div>)}
                </div>
              )}
            </Card>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
            <Button type="button" onClick={handle} disabled={!file || busy}>
              <Upload className="h-4 w-4 mr-1" /> {busy ? "Importando…" : "Importar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
