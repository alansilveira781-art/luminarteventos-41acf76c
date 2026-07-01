import { createContext, useContext } from "react";
import type { VendaRow } from "./vendas.functions";
import { filtrosIniciais, type Filtros } from "./vendas-metrics";

export type DashboardCtxValue = {
  rows: VendaRow[];
  filtered: VendaRow[];
  previous: VendaRow[];
  filtros: Filtros;
  setFiltros: (f: Filtros) => void;
  fetchedAt: string;
};

export const DashboardCtx = createContext<DashboardCtxValue | null>(null);

export function useDashboard(): DashboardCtxValue {
  const c = useContext(DashboardCtx);
  if (c) return c;
  return {
    rows: [],
    filtered: [],
    previous: [],
    filtros: filtrosIniciais,
    setFiltros: () => {},
    fetchedAt: "",
  };
}
