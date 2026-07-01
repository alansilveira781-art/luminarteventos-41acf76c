import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link2, Check } from "lucide-react";
import { toast } from "sonner";

async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* fallback */ }
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

export function CopiarLinkButton({
  path,
  label = "Copiar link",
  variant = "outline",
  size = "sm",
  title,
}: {
  path: string;
  label?: string;
  variant?: "outline" | "secondary" | "ghost" | "default";
  size?: "sm" | "default" | "icon";
  title?: string;
}) {
  const [copiado, setCopiado] = useState(false);

  const handle = async () => {
    const url = `${window.location.origin}${path}`;
    const ok = await copyText(url);
    if (ok) {
      setCopiado(true);
      toast.success("Link copiado! Já pode compartilhar.");
      setTimeout(() => setCopiado(false), 2000);
    } else {
      toast.info(`Copie manualmente: ${url}`, { duration: 8000 });
    }
  };

  const iconOnly = size === "icon" || !label;

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handle}
      title={title ?? (label || "Copiar link")}
    >
      {copiado ? (
        <Check className={iconOnly ? "h-4 w-4" : "h-4 w-4 mr-1"} />
      ) : (
        <Link2 className={iconOnly ? "h-4 w-4" : "h-4 w-4 mr-1"} />
      )}
      {label ? (copiado ? "Copiado!" : label) : null}
    </Button>
  );
}
