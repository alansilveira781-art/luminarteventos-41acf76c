## Objetivo

Na aba **Análises** (`src/routes/financeiro-op.relatorios.tsx`), remover os filtros de **Ano** e **Mês**, tornar a **Categoria** obrigatória (sem opção "Todas") e trazer o total acumulado (sem recorte de período) de todos os centros de custo da categoria selecionada.

## Mudanças

### 1. Estado e filtros
- Remover `ano`, `mes`, `YEARS`, `MESES` e os dois `<Select>` correspondentes.
- Mudar `categoriaFiltro` de `"todas" | CategoriaCentroCusto` para `CategoriaCentroCusto`, com default `"corporativo"` (primeira da lista).
- Remover a opção "Todas" do `<Select>` de Categoria e o bloco especial de "Sem classificação" (só faz sentido no modo "todas").
- `filterKey` passa a depender só de `categoriaFiltro`.

### 2. Cálculo do DRE sem recorte temporal
- Na chamada de `calcularDRECaixa` (linha ~662), passar `ano = 0` e `mes = 0` — a função já trata `ano === 0` como "sem filtro de período" (mesmo comportamento usado hoje pela Análise Detalhada). Verificar isso em `src/lib/conta-azul/dre.ts` antes de finalizar; se necessário, adicionar um flag equivalente.

### 3. Renderização
- Manter o loop por `categoriasOrdenadas` mas ele agora renderiza sempre exatamente uma seção (a filtrada).
- Manter paginação de 4 eventos por página dentro da categoria.
- Empty state: "Nenhum evento com movimento financeiro nesta categoria."

### 4. Não mexer
- Cartões, Classificação de Eventos, `dre.ts` (só ler para confirmar o comportamento de `ano=0`), lógica de fetch de rateios/parents, layout dos cards.

## Verificação
- Selecionar cada categoria e confirmar que os cards mostram totais acumulados (todos os anos) dos centros de custo daquela categoria.
- Confirmar que Cartões e Classificação continuam intactos.
