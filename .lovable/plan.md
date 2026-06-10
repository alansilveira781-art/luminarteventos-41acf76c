## 1) Estoque → Conferência (Egestor): cabeçalho transparente

Em `src/components/estoque/ConferenciaEgestorDialog.tsx` o `<thead>` usa `bg-muted/40 sticky top-0`, então ao rolar o conteúdo aparece atrás. Trocar por um fundo opaco (`bg-background` + `border-b` + `z-10`) para o cabeçalho ficar sólido ao rolar.

## 2) Comercial → Dashboard: "Something went wrong"

Causa: `useDashboard()` lança erro quando a sub-rota (Painel/Relatórios/Vendedores/Indicadores) renderiza fora do `DashboardCtx.Provider` (acontece nos estados de loading/erro do fetch da planilha, ou quando o fetch falha no browser por CORS do Dropbox).

Correções:
- Tornar `useDashboard()` tolerante: retornar um valor default vazio (rows/filtered/previous = []) em vez de `throw`, para a sub-rota só mostrar "Sem dados" ao invés de quebrar o boundary.
- Garantir que `listVendasDropbox` rode como server function real (`createServerFn`) — confirmar que o arquivo é `vendas.functions.ts` e está sendo invocado via RPC; reforçar tratamento de erro retornando `{ rows: [], error }` sem lançar.
- Cada sub-rota (`painel/relatorios/vendedores/indicadores`) renderiza estado vazio quando `rows.length === 0`.

## 3) Estoque (abas Estoque, Saídas, Entradas, Devoluções)

### 3a) Busca por combinação de termos
Hoje o filtro usa `normalize(haystack).includes(normalize(query))` — busca a frase inteira. Mudar para tokenização: dividir a query por espaços e exigir que **todos** os tokens estejam presentes no haystack (qualquer ordem).

Implementar utilitário em `src/lib/utils.ts`:
```ts
export function matchTokens(haystack: string, query: string): boolean {
  const h = normalize(haystack);
  return normalize(query).split(/\s+/).filter(Boolean).every(t => h.includes(t));
}
```
Aplicar em:
- `src/routes/estoque.index.tsx` (filtro principal)
- `src/routes/saidas.tsx` (busca geral e filtro de item)
- `src/routes/entradas.tsx` (busca geral e filtro de item)
- `src/routes/devolucoes.tsx` (já usa split em um trecho — padronizar usando `matchTokens`)

Resultado: digitar `6MM` traz "BROCA ESPECIAL 6MM"; digitar `BROCA 6MM` também traz.

### 3b) Paginação 100 → 50
Trocar `const PAGE_SIZE = 100` por `50` em:
- `src/routes/estoque.index.tsx`
- `src/routes/saidas.tsx`
- `src/routes/entradas.tsx`
- `src/routes/devolucoes.tsx`

## Escopo
Apenas o que foi pedido. Sem mudanças visuais adicionais.