import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ListChecks, X } from "lucide-react";

export type Atividade = {
  id: string;
  titulo: string;
  descricao: string | null;
  ativo: boolean;
};

export type RotinaAtividadeLink = {
  id: string;
  rotina_id: string;
  atividade_id: string;
  ordem: number;
};

export function useAtividades() {
  return useQuery({
    queryKey: ["financeiro-atividades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_atividades" as any)
        .select("*")
        .order("titulo", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Atividade[];
    },
  });
}

/** Vínculos rotina ↔ atividades (chave de cache própria). */
export function useRotinaAtividades() {
  return useQuery({
    queryKey: ["financeiro-rotina-atividades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_rotina_atividades" as any)
        .select("id,rotina_id,atividade_id,ordem")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as RotinaAtividadeLink[];
    },
  });
}

/** Mapa rotina_id -> atividade_id[] na ordem gravada. */
export function useRotinaAtividadesMap() {
  const { data: links = [] } = useRotinaAtividades();
  return useMemo(() => {
    const map = new Map<string, string[]>();
    for (const l of links) {
      const arr = map.get(l.rotina_id) ?? [];
      arr.push(l.atividade_id);
      map.set(l.rotina_id, arr);
    }
    return map;
  }, [links]);
}

/**
 * Sincroniza os vínculos de atividades de uma rotina (remove os desmarcados,
 * insere os novos) preservando a ordem de seleção.
 */
export async function syncRotinaAtividades(rotinaId: string, atividadeIds: string[]) {
  const { data: atuais, error: selErr } = await supabase
    .from("financeiro_rotina_atividades" as any)
    .select("id,atividade_id")
    .eq("rotina_id", rotinaId);
  if (selErr) throw selErr;

  const atuaisArr = (atuais ?? []) as unknown as { id: string; atividade_id: string }[];
  const remover = atuaisArr.filter((a) => !atividadeIds.includes(a.atividade_id));
  if (remover.length) {
    const { error } = await supabase
      .from("financeiro_rotina_atividades" as any)
      .delete()
      .in("id", remover.map((r) => r.id));
    if (error) throw error;
  }

  const existentes = new Set(atuaisArr.map((a) => a.atividade_id));
  const inserir = atividadeIds
    .map((id, idx) => ({ rotina_id: rotinaId, atividade_id: id, ordem: idx }))
    .filter((r) => !existentes.has(r.atividade_id));
  if (inserir.length) {
    const { error } = await supabase.from("financeiro_rotina_atividades" as any).insert(inserir);
    if (error) throw error;
  }

  // Atualiza a ordem dos que permaneceram
  for (const a of atuaisArr) {
    const idx = atividadeIds.indexOf(a.atividade_id);
    if (idx >= 0) {
      await supabase
        .from("financeiro_rotina_atividades" as any)
        .update({ ordem: idx })
        .eq("id", a.id);
    }
  }
}

/** Etiquetas compactas das atividades de uma rotina (para a tabela). */
export function AtividadesBadges({
  ids,
  atividades,
  max = 2,
}: {
  ids: string[];
  atividades: Atividade[];
  max?: number;
}) {
  if (!ids.length) return null;
  const titulos = ids.map((id) => atividades.find((a) => a.id === id)?.titulo ?? "Atividade");
  const visiveis = titulos.slice(0, max);
  const resto = titulos.length - visiveis.length;
  return (
    <>
      {visiveis.map((t, i) => (
        <Badge key={i} variant="secondary" className="text-[10px]">
          <ListChecks className="h-3 w-3 mr-1" />
          {t}
        </Badge>
      ))}
      {resto > 0 && (
        <Badge variant="outline" className="text-[10px]" title={titulos.join(", ")}>
          +{resto}
        </Badge>
      )}
    </>
  );
}

/** Lista de leitura com o descritivo de cada atividade selecionada. */
export function AtividadesDescritivos({
  ids,
  atividades,
}: {
  ids: string[];
  atividades: Atividade[];
}) {
  if (!ids.length) return null;
  return (
    <div className="space-y-2">
      {ids.map((id) => {
        const at = atividades.find((a) => a.id === id);
        if (!at) return null;
        return (
          <div key={id} className="rounded border bg-muted/40 p-2 text-xs">
            <div className="font-medium mb-1">{at.titulo}</div>
            <div className="whitespace-pre-wrap text-muted-foreground">
              {at.descricao?.trim() || "Esta atividade ainda não tem descritivo."}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Seleção múltipla de atividades com etiquetas removíveis. */
export function AtividadesMultiSelect({
  value,
  onChange,
  atividades,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  atividades: Atividade[];
}) {
  const disponiveis = atividades.filter((a) => a.ativo || value.includes(a.id));
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((id) => {
            const at = atividades.find((a) => a.id === id);
            return (
              <Badge key={id} variant="secondary" className="text-[11px] gap-1">
                {at?.titulo ?? "Atividade"}
                <button
                  type="button"
                  aria-label="Remover atividade"
                  onClick={() => toggle(id)}
                  className="opacity-70 hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
      <div className="max-h-40 overflow-y-auto rounded border p-2 space-y-1">
        {disponiveis.length === 0 && (
          <div className="text-xs text-muted-foreground">Nenhuma atividade cadastrada.</div>
        )}
        {disponiveis.map((a) => (
          <label key={a.id} className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={value.includes(a.id)} onCheckedChange={() => toggle(a.id)} />
            <span className="truncate">{a.titulo}</span>
          </label>
        ))}
      </div>
      <AtividadesDescritivos ids={value} atividades={atividades} />
    </div>
  );
}
