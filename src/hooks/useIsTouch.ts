import { useEffect, useState } from "react";

/**
 * Detecta dispositivos com toque (tablets/celulares) para ajustar
 * interações que dependem de hover, como os tooltips dos gráficos.
 */
export function useIsTouch(): boolean {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(hover: none), (pointer: coarse)");
    const update = () => setIsTouch(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  return isTouch;
}

/** Trigger do Tooltip do recharts: clique/toque em telas sem hover. */
export function useChartTooltipTrigger(): "hover" | "click" {
  return useIsTouch() ? "click" : "hover";
}
