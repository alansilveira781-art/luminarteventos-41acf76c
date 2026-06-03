## 1. Entradas — campos numéricos com vírgula e seleção ao tabular

Arquivo: `src/routes/entradas.tsx` (e onde houver formulários de entrada/edição com Desconto, Frete, IPI, Outros custos, Valor unitário).

- Trocar os `<Input type="number">` de Desconto, Frete, IPI e Outros custos pelo `MoneyInput` já existente (`src/components/MoneyInput.tsx`), que usa o formato "centavos as you type" com vírgula automática (igual ao Valor unitário). O state armazenará number em vez de string.
- Valor unitário: continuar com `MoneyInput`, mas adicionar a opção de **4 casas decimais** (novo prop `decimals?: 2 | 4`, default 2). O formatter passará a usar `minimumFractionDigits/maximumFractionDigits = decimals` e o cálculo `centavos = digits / 10^decimals`. Aplicar `decimals={4}` apenas nos campos de custo unitário (entradas, edição de item, etc.).
- Ao mudar de campo com Tab/seta, o conteúdo já fica selecionado pelo browser. O problema do "digitar não substitui" vem do `MoneyInput` ignorar a tecla quando há seleção. Ajustar o `onKeyDown`: se `selectionStart !== selectionEnd` (ou seleção cobre o input inteiro) e o usuário digita um dígito, **resetar `digits` para o dígito apertado** em vez de concatenar. Mesmo tratamento para Backspace com seleção total → zerar.

## 2. Persistir filtros ao recarregar a página (global)

Hoje todos os filtros (busca, período, ocultar zerados, ordenação, página) ficam em `useState` local e somem no F5.

Padrão a aplicar: mover esses estados para a **URL via search params do TanStack Router** (`validateSearch` + `zodValidator` + `fallback`), conforme já documentado. Vantagens: sobrevive ao reload, é compartilhável e mantém o histórico.

Escopo desta entrega (telas mais usadas):
- `/estoque` (busca `q`, `hideZero`, `sort`, `periodo`, `page`)
- `/entradas`, `/saidas`, `/devolucoes`
- `/compras` (quadro + filtros)
- `/financeiro` (quadro de demandas)
- `/comercial` (quadro de vendas, propostas, clientes)
- `/patrimonio` (inventário, entradas, saídas, devoluções)
- `/contabil/notas` e `/contabil/recebimentos`

Para cada uma:
1. Definir schema Zod com `fallback(...).default(...)` para cada filtro.
2. `Route.useSearch()` substitui o `useState`.
3. Mudanças nos filtros chamam `navigate({ search: prev => ({ ...prev, ... }) })`.
4. Adicionar `stripSearchParams(defaults)` para não poluir a URL quando o filtro está no valor padrão.

## 3. Reduzir o delay ao trocar de módulo/aba

Investigações já mapeadas:
- Várias páginas (ex.: `/estoque`) carregam **todas as linhas em loop paginado de 1000** no momento que entram. Vamos:
  - Manter o React Query com `staleTime` maior (ex.: 60s) e `placeholderData: keepPreviousData` nas listas, para o retorno à tela ser instantâneo.
  - Habilitar `defaultPreloadStaleTime` no router e `preload="intent"` nos `<Link>` da sidebar, para começar o fetch no hover.
  - Onde a tabela tem paginação, buscar apenas a página atual via `range()` + `count: 'exact'` em vez de paginar tudo no cliente.
- Code-split: garantir que rotas pesadas (Comercial, Financeiro, Patrimônio) sejam carregadas sob demanda (já são por arquivo, mas validar que nenhum import "puxa" tudo via barrel).

Entregável: ajustes nos `queryKey`/opções das listas grandes e no `<Link>` da sidebar; sem mudar comportamento funcional.

## 4. Sidebar — só mostrar grupos do módulo atual

Arquivo: `src/components/AppSidebar.tsx`.

Hoje o componente já filtra `items` pelo contexto (módulo da rota atual), mas o `groups.map` na linha 213 **renderiza o título de TODOS os grupos** mesmo quando não há item naquele grupo — então aparecem rótulos como "Compras", "Despesas", "Comercial" etc. no menu lateral, mesmo na Início.

Correção:
- Filtrar `groups` para apenas aqueles que têm pelo menos um item visível em `items`.
- Resultado: em `/` (Início) só aparece "Visão geral › Início". Dentro de `/estoque`, só aparece o grupo "Estoque" com seus itens. E assim por diante — exatamente o pedido.

## Pontos técnicos resumidos

```text
MoneyInput
  ├─ prop decimals (default 2)
  ├─ trata seleção total: dígito substitui, backspace zera
  └─ usado em valor_unitario / desconto / frete / ipi / outros_custos

Filtros persistidos
  └─ validateSearch + zodValidator(fallback().default()) + stripSearchParams

Performance
  ├─ staleTime: 60_000 + keepPreviousData
  ├─ defaultPreloadStaleTime no router
  └─ <Link preload="intent">

Sidebar
  └─ groups.filter(g => items.some(i => i.group === g))
```

## Fora de escopo

- Não vou mexer em lógica de negócio (cálculo de custo médio, status de estoque, RLS, etc.).
- Persistência de filtros nas telas administrativas e em relatórios secundários fica para um próximo ciclo, se quiser.
