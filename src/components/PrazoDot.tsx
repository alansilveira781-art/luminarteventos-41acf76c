import { cn } from "@/lib/utils";
import { PRAZO_DOT_CLASS, prazoLabel, prazoStatus } from "@/lib/prazo";

/** Bolinha colorida indicando a situação do prazo do card. */
export function PrazoDot({ prazo, className }: { prazo?: string | null; className?: string }) {
  const status = prazoStatus(prazo);
  if (!status) return null;
  return (
    <span
      title={prazoLabel(prazo)}
      aria-label={prazoLabel(prazo)}
      className={cn(
        "inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10",
        PRAZO_DOT_CLASS[status],
        className,
      )}
    />
  );
}
