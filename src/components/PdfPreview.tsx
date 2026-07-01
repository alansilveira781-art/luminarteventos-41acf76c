import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import { Loader2, FileIcon, Download, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

const workerUrl = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();
if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
}

export type PdfPreviewProps = {
  fileUrl: string;
  onDownload: () => void;
};

const MIN = 0.5;
const MAX = 3;
const STEP = 0.25;

export default function PdfPreview({ fileUrl, onDownload }: PdfPreviewProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1);

  const zoomIn = () => setScale((s) => Math.min(MAX, +(s + STEP).toFixed(2)));
  const zoomOut = () => setScale((s) => Math.max(MIN, +(s - STEP).toFixed(2)));
  const zoomReset = () => setScale(1);

  return (
    <div className="w-full flex flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-1 justify-end border-b bg-background/95 backdrop-blur px-2 py-1.5">
        <Button type="button" size="sm" variant="ghost" onClick={zoomOut} disabled={scale <= MIN} title="Diminuir zoom">
          <ZoomOut className="h-4 w-4" />
        </Button>
        <button
          type="button"
          onClick={zoomReset}
          className="text-xs tabular-nums w-14 text-center hover:underline"
          title="Restaurar 100%"
        >
          {Math.round(scale * 100)}%
        </button>
        <Button type="button" size="sm" variant="ghost" onClick={zoomIn} disabled={scale >= MAX} title="Aumentar zoom">
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={zoomReset} title="Restaurar zoom">
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
      <div className="w-full overflow-auto" style={{ maxHeight: "70vh" }}>
        <Document
          file={fileUrl}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          loading={
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          }
          error={
            <div className="flex flex-col items-center gap-2 p-8 text-center">
              <FileIcon className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm">Não foi possível exibir a prévia do PDF.</p>
              <Button type="button" size="sm" onClick={onDownload}>
                <Download className="h-4 w-4 mr-1" /> Baixar para visualizar
              </Button>
            </div>
          }
        >
          {Array.from({ length: numPages }, (_, i) => (
            <Page
              key={`${i}-${scale}`}
              pageNumber={i + 1}
              width={760}
              scale={scale}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              className="mb-3 shadow-sm mx-auto"
            />
          ))}
        </Document>
      </div>
    </div>
  );
}
