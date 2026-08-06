import { cn } from "@/lib/utils";
import { PRAZO_DOT_CLASS, prazoLabel, prazoStatus, prazoStatusCompra } from "@/lib/prazo";

/** Bolinha colorida indicando a situação do prazo do card. */
export function PrazoDot({
  prazo,
  status,
  className,
}: {
  prazo?: string | null;
  /** Status da compra: verde só em "finalizado". */
  status?: string | null;
  className?: string;
}) {
  const s = status != null ? prazoStatusCompra(prazo, status) : prazoStatus(prazo);
  if (!s) return null;
  return (
    <span
      title={prazoLabel(prazo)}
      aria-label={prazoLabel(prazo)}
      className={cn(
        "inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10",
        PRAZO_DOT_CLASS[s],
        className,
      )}
    />
  );
}
