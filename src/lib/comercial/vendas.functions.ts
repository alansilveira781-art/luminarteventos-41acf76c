export type VendaRow = {
  id?: string;
  dataRegistro: string | null; // ISO yyyy-mm-dd
  ano: number | null;
  mes: string | null;
  semana: number | null;
  tipo: string | null; // VENDA / EXTRA ...
  quantidade: number;
  nomeEvento: string | null;
  local: string | null;
  estado: string | null;
  cidade: string | null;
  salao: string | null;
  tipoEvento: string | null;
  classificacao: string | null;
  dataEvento: string | null;
  consultor: string | null;
  gestor: string | null;
  cerimonial: string | null;
  decorador: string | null;
  empresa: string | null;
  valorProposta: number;
  desconto: number;
  percentual: number;
  valorFinal: number;
  valorBV: number;
  valorComissao: number;
  comissaoGestor: number;
  tipoComissao: string | null;
  comissaoConsultor: number; // sometimes bool; converted to numeric flag
  mesEvento: string | null;
  anoEvento: number | null;
  trimestreEvento: 1 | 2 | 3 | 4 | null;
};

export type ListVendasResult = {
  rows: VendaRow[];
  fetchedAt: string;
  error?: string;
};
