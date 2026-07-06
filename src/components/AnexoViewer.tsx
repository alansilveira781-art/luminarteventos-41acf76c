import { lazy, Suspense, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, FileIcon, Loader2, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";


const PdfPreview = lazy(() => import("./PdfPreview"));


export type AnexoViewerProps = {
  bucket: string;
  anexo:
    | {
        path: string;
        nome: string;
        mime_type?: string | null;
        tamanho?: number | null;
      }
    | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function fmtSize(n?: number | null) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function detectKind(nome: string, mime?: string | null): "image" | "pdf" | "other" {
  const m = (mime ?? "").toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m === "application/pdf") return "pdf";
  const ext = nome.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  return "other";
}

export async function baixarAnexo(bucket: string, path: string, nome: string) {
  try {
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error || !data) throw error ?? new Error("download falhou");
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    toast.error("Não foi possível baixar o arquivo");
  }
}

export function AnexoViewer({ bucket, anexo, open, onOpenChange }: AnexoViewerProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [imgScale, setImgScale] = useState<number>(1);

  useEffect(() => {
    if (open) setImgScale(1);
  }, [open, anexo]);

  useEffect(() => {
    if (!open || !anexo) {
      setObjectUrl(null);
      return;
    }
    let cancelled = false;
    let createdUrl: string | null = null;
    setLoading(true);
    supabase.storage
      .from(bucket)
      .download(anexo.path)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          toast.error("Não foi possível abrir a prévia");
          setObjectUrl(null);
        } else {
          createdUrl = URL.createObjectURL(data);
          setObjectUrl(createdUrl);
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [open, anexo, bucket]);

  if (!anexo) return null;
  const kind = detectKind(anexo.nome, anexo.mime_type);
  const IMG_MIN = 0.25;
  const IMG_MAX = 5;
  const IMG_STEP = 0.25;
  const zoomInImg = () => setImgScale((s) => Math.min(IMG_MAX, +(s + IMG_STEP).toFixed(2)));
  const zoomOutImg = () => setImgScale((s) => Math.max(IMG_MIN, +(s - IMG_STEP).toFixed(2)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{anexo.nome}</DialogTitle>
          {anexo.tamanho ? (
            <p className="text-xs text-muted-foreground">{fmtSize(anexo.tamanho)}</p>
          ) : null}
        </DialogHeader>

        <div className="min-h-[40vh] flex flex-col bg-muted/30 rounded-md overflow-hidden">
          {loading || !objectUrl ? (
            <div className="flex-1 flex items-center justify-center min-h-[40vh]">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : kind === "image" ? (
            <>
              <div className="sticky top-0 z-10 flex items-center gap-1 justify-end border-b bg-background/95 backdrop-blur px-2 py-1.5">
                <Button type="button" size="sm" variant="ghost" onClick={zoomOutImg} disabled={imgScale <= IMG_MIN} title="Diminuir zoom">
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <button
                  type="button"
                  onClick={() => setImgScale(1)}
                  className="text-xs tabular-nums w-14 text-center hover:underline"
                  title="Restaurar 100%"
                >
                  {Math.round(imgScale * 100)}%
                </button>
                <Button type="button" size="sm" variant="ghost" onClick={zoomInImg} disabled={imgScale >= IMG_MAX} title="Aumentar zoom">
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setImgScale(1)} title="Restaurar zoom">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-auto flex items-start justify-center p-2" style={{ maxHeight: "70vh" }}>
                <img
                  src={objectUrl}
                  alt={anexo.nome}
                  style={{ transform: `scale(${imgScale})`, transformOrigin: "top center", transition: "transform 120ms ease-out" }}
                  className="max-w-full object-contain"
                />
              </div>
            </>

          ) : kind === "pdf" ? (
            <Suspense
              fallback={
                <div className="flex-1 flex items-center justify-center min-h-[40vh]">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              }
            >
              <PdfPreview
                fileUrl={objectUrl}
                onDownload={() => baixarAnexo(bucket, anexo.path, anexo.nome)}
              />
            </Suspense>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 p-8 text-center min-h-[40vh]">
              <FileIcon className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-medium">{anexo.nome}</p>
              <p className="text-xs text-muted-foreground">
                Pré-visualização não disponível para este tipo de arquivo
              </p>
            </div>
          )}

        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button type="button" onClick={() => baixarAnexo(bucket, anexo.path, anexo.nome)}>
            <Download className="h-4 w-4 mr-1" /> Baixar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
