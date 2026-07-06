import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { parseUberCsv } from "@/lib/uber/parse-csv";

export function UberImportButton() {
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  async function handleFile(file: File) {
    setLoading(true);
    try {
      const text = await file.text();
      const parsed = parseUberCsv(text);
      if (!parsed.rows.length) {
        toast.error("Nenhuma corrida (Fare) encontrada no arquivo.");
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;

      const payload = parsed.rows.map((r) => ({ ...r, importado_por: uid }));

      // Insere em lotes com on-conflict-do-nothing (dedup por hash_dedup)
      const CHUNK = 500;
      let inserted = 0;
      for (let i = 0; i < payload.length; i += CHUNK) {
        const slice = payload.slice(i, i + CHUNK);
        const { data, error } = await supabase
          .from("uber_corridas")
          .upsert(slice, { onConflict: "hash_dedup", ignoreDuplicates: true })
          .select("id");
        if (error) throw error;
        inserted += data?.length ?? 0;
      }

      const duplicadas = parsed.rows.length - inserted;
      toast.success(
        `${inserted} corridas importadas` +
          (duplicadas > 0 ? ` • ${duplicadas} duplicadas ignoradas` : "") +
          (parsed.ignoredPayments > 0 ? ` • ${parsed.ignoredPayments} pagamentos ignorados` : ""),
      );
      qc.invalidateQueries({ queryKey: ["uber-corridas-tabelona"] });
      qc.invalidateQueries({ queryKey: ["uber-corridas-all"] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Falha ao importar: ${msg}`);
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
      >
        {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
        Importar planilha (.csv)
      </Button>
    </>
  );
}
