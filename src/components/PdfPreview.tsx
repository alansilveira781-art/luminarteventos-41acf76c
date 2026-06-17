import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import { Loader2, FileIcon, Download } from "lucide-react";
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

export default function PdfPreview({ fileUrl, onDownload }: PdfPreviewProps) {
  const [numPages, setNumPages] = useState<number>(0);

  return (
    <div className="w-full overflow-y-auto" style={{ maxHeight: "70vh" }}>
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
            key={i}
            pageNumber={i + 1}
            width={760}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            className="mb-3 shadow-sm mx-auto"
          />
        ))}
      </Document>
    </div>
  );
}
