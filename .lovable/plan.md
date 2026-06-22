## Passo 1 — Camada de Métricas + Aba Metas

### A) Reescrever `src/lib/comercial/vendas-metrics.ts`

Manter como base o arquivo atual (que já tem quase tudo do escopo), garantindo exportações:

- **Helpers tolerantes**: `getAno`, `getMes`, `getTrimestre`, `cleanText` (já existem; manter).
- **Tipos/estado**: `Filtros`, `filtrosIniciais` (ano = ano atual; demais "Todos") — já existem.
- **Filtragem**: `applyFilters(rows, f)`, `previousPeriod(rows, f)` — já existem.
- **Agregações** sobre rows filtrados (sem recalcular valor_final/BV/comissão):
  - `kpis(curr, prev)` — vendas, qtde, desconto, ticket + anteriores + %.
  - `evolucaoTrimestre(rows)`, `evolucaoTicketTrimestre(rows)`.
  - `rankingConsultor(rows)`, `comissoesPorVendedor(rows)`.
  - `rankingCerimonial(rows)` — devolver `{ nome, valor, bv }` (Σ valorFinal + Σ valorBV).
  - `rankingDecorador(rows)`.
  - `valorPorClassificacao(rows)`, `vendasPorTipoEvento(rows)`.
  - `compararAnos(rows, anoA, anoB, baseFilters)` — série trimestral + tabela (vendas, qtde, ticket, desconto).
  - `uniqueValues(rows, getter)`.

Mudança real: ajustar `rankingCerimonial` para incluir `bv` (hoje retorna só valor), conforme pedido. Demais funções já estão corretas — confirmar exports e remover qualquer código morto.

### B) Migration — `public.comercial_metas`

```sql
CREATE TABLE public.comercial_metas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano int NOT NULL,
  mes int NOT NULL CHECK (mes BETWEEN 1 AND 12),
  classificacao text NOT NULL,
  valor_meta numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ano, mes, classificacao)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comercial_metas TO authenticated;
GRANT ALL ON public.comercial_metas TO service_role;

ALTER TABLE public.comercial_metas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comercial pode ler metas"
  ON public.comercial_metas FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'comercial'));

CREATE POLICY "admin comercial gerencia metas"
  ON public.comercial_metas FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'comercial'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'comercial'));

CREATE TRIGGER set_updated_at_comercial_metas
  BEFORE UPDATE ON public.comercial_metas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

### C) Aba "Metas"

1. **`src/routes/comercial.dashboard.tsx`** — acrescentar ao array `TABS` (após Propostas):
   `{ to: "/comercial/dashboard/metas", label: "Metas" }`.

2. **`src/routes/comercial.dashboard.metas.tsx`** (nova):
   - `createFileRoute("/comercial/dashboard/metas")`.
   - Gate: `isComercialAdmin = isAdmin || modulos.some(m => m.slug==="comercial" && m.is_admin)`. Não-admin: exibir Card "Acesso restrito — somente admin do comercial pode editar metas" (read-only ok como melhoria futura; nesta versão, bloqueio simples).
   - Estado: `ano` (default `new Date().getFullYear()`), Select com últimos 5 anos + próximos 2.
   - `useQuery(["comercial-metas", ano])` → `supabase.from("comercial_metas").select("*").eq("ano", ano)`.
   - Estado local `valores: Record<"mes-classificacao", number>` inicializado a partir da query.
   - Grade: tabela 12 linhas (Janeiro..Dezembro) × 4 colunas (Cenografia, Social, Stand, Corporativo) usando `MoneyInput`. Última coluna = total da linha; última linha = total da coluna; canto inferior direito = total geral.
   - Botão "Salvar metas" → `supabase.from("comercial_metas").upsert(rows, { onConflict: "ano,mes,classificacao" })` com todas as 48 células; `toast.success` + `qc.invalidateQueries(["comercial-metas", ano])`.

### Não fazer

- Não construir Painel/Relatórios/Vendedores/Indicadores (próximos passos).
- Não tocar Propostas, Estoque, Compras, Patrimônio.
- Não recalcular valores de venda.

### Validação

- Aba "Metas" aparece e abre a grade.
- Admin do comercial salva (ex: Social/Janeiro = R$ 50.000), recarrega e os valores persistem; totais corretos.
- `vendas-metrics.ts` compila com todas as exports listadas.
- Abas existentes (placeholders + Propostas) seguem funcionando.
