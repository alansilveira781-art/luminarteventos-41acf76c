# Dashboard Comercial não mostra vendas — parecer e plano

## Parecer (o que está acontecendo)

Confirmado por reprodução com Playwright autenticado no ambiente real:

- O banco tem **1.001 vendas** e as RLS estão OK (checa `has_module_access(auth.uid(), 'comercial')`).
- A server function `listVendasDb` **está sendo chamada e responde com todas as vendas** (payload de ~1MB contendo o array `rows`).
- A aba **/comercial/vendas funciona** (mesmo `listVendasDb`, mesma query key raiz).
- Só **/comercial/dashboard** exibe `0 vendas carregadas · 0 no filtro atual`, mesmo com a resposta chegando com sucesso, sem erros de console e sem `data.error`.

### Causa raiz

O `DashboardCtx` (React Context) é **criado e exportado dentro de um arquivo de rota** (`src/routes/comercial.dashboard.tsx`) e **consumido por outro arquivo de rota irmão** (`src/routes/comercial.dashboard.index.tsx`) via `import { useDashboard } from "./comercial.dashboard"`.

Com o code-splitting do TanStack Start, cada arquivo de rota vira um chunk separado. Nesse cenário, o módulo `comercial.dashboard.tsx` acaba sendo avaliado em duas instâncias (uma para o layout, outra puxada pelo import do filho), o que cria **dois `createContext` distintos**. Resultado:

- O layout preenche o `Provider` de um Context A com `rows` cheio.
- O `useDashboard()` do `index` lê de um Context B (nunca “providado”), cai no fallback `return { rows: [], ... }` e mostra `0`.

Isso é consistente com o comportamento observado: sem erro no console, resposta HTTP com todas as linhas, mas UI zerada só na página que consome via contexto.

## Plano de correção

Extrair o Context para um arquivo comum, fora de `src/routes/`.

### 1. Criar `src/lib/comercial/dashboard-context.ts`
- Mover para lá:
  - `type Ctx`
  - `DashboardCtx = createContext<Ctx | null>(null)`
  - `useDashboard()` (com o mesmo fallback atual)
  - Reexportar `filtrosIniciais` daqui se preciso, ou continuar importando de `vendas-metrics`.

### 2. Ajustar `src/routes/comercial.dashboard.tsx`
- Remover a criação local do `DashboardCtx` e `useDashboard`.
- Importar `DashboardCtx` de `@/lib/comercial/dashboard-context`.
- Manter todo o resto (query, realtime, effect de correção de ano, Provider e Outlet) igual.

### 3. Ajustar `src/routes/comercial.dashboard.index.tsx`
- Trocar `import { useDashboard } from "./comercial.dashboard"` por `import { useDashboard } from "@/lib/comercial/dashboard-context"`.

### 4. Validar
- Rodar novamente o Playwright autenticado em `/comercial/dashboard` e confirmar:
  - `1.001 vendas carregadas · 1.001 no filtro atual`
  - Card “Vendas Totais” com valor > 0
- Confirmar que `/comercial/vendas` continua funcionando.

### Observação
Nenhuma mudança de schema, RLS ou lógica de negócio é necessária — é apenas um refactor de onde o Context vive. As outras subrotas do dashboard (`painel`, `vendedores`, `propostas`, `indicadores`, `relatorios`) que também consomem `useDashboard` passam a funcionar corretamente pelo mesmo motivo.
