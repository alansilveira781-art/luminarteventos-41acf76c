import { Button } from "@/components/ui/button";
import { Pencil, X } from "lucide-react";

export function BulkActionsBar({
  count,
  onEdit,
  onClear,
  label = "selecionados",
  extraActions,
}: {
  count: number;
  onEdit: () => void;
  onClear: () => void;
  label?: string;
  extraActions?: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div className="sticky top-0 z-10 mb-3 flex items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
      <span className="font-medium">
        {count} {label}
      </span>
      <div className="flex items-center gap-1">
        <Button type="button" size="sm" variant="default" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5 mr-1" /> Editar em massa
        </Button>
        {extraActions}
        <Button type="button" size="sm" variant="ghost" onClick={onClear}>
          <X className="h-3.5 w-3.5 mr-1" /> Limpar
        </Button>
      </div>
    </div>
  );
}
