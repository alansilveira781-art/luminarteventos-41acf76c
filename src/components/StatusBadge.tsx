import { cn } from "@/lib/utils";

const itemMap: Record<string, { label: string; className: string }> = {
  disponivel: { label: "Disponível", className: "bg-success/15 text-success border border-success/30" },
  baixo_estoque: { label: "Baixo estoque", className: "bg-warning/15 text-warning border border-warning/30" },
  sem_estoque: { label: "Sem estoque", className: "bg-destructive/15 text-destructive border border-destructive/30" },
  em_manutencao: { label: "Em manutenção", className: "bg-accent/15 text-accent border border-accent/30" },
  inativo: { label: "Inativo", className: "bg-muted text-muted-foreground border border-border" },
  ativo: { label: "Ativo", className: "bg-success/15 text-success border border-success/30" },
  aberta: { label: "Aberta", className: "bg-primary/15 text-primary border border-primary/30" },
  parcialmente_devolvida: { label: "Parcialmente devolvida", className: "bg-warning/15 text-warning border border-warning/30" },
  devolvida: { label: "Devolvida", className: "bg-success/15 text-success border border-success/30" },
  finalizada: { label: "Finalizada", className: "bg-muted text-muted-foreground border border-border" },
  cancelada: { label: "Cancelada", className: "bg-destructive/15 text-destructive border border-destructive/30" },
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null;
  const cfg = itemMap[status] ?? { label: status, className: "bg-muted text-muted-foreground border border-border" };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        cfg.className,
      )}
    >
      {cfg.label}
    </span>
  );
}
