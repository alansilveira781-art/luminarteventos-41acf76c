## Objetivo

Somar as **saídas de estoque** (`movimentacoes` tipo `saida`) ao DRE da Análise Detalhada por evento, agrupando cada saída no grupo do DRE via `grupoDoPlanoNome(item.categoria)` — sem tabela de mapeamento e sem tela de configuração. Nada muda no Conta Azul nem no rateio; as saídas são apenas somadas por cima.

Arquivo tocado: `src/components/financeiro/ContaAzulDashboard.tsx` (componente `AnaliseDetalhada`).

## Passos

### 1. Nova query de saídas de estoque (por evento)
Dentro de `AnaliseDetalhada`, após as queries de rateios/pais, adicionar `useQuery` habilitada quando `centroId` estiver selecionado:

- `sb.from("movimentacoes").select("valor_total, evento_projeto, itens(categoria)").eq("tipo","saida")` paginado com o `fetchPaged` já existente (mesmo motivo de truncamento).
- Sem filtro de data (a Análise Detalhada não tem período).
- `queryKey: ["mov-saidas-evento", centroId]`, `enabled: !!centroId`.

### 2. Filtro por evento reutilizando os helpers atuais
Calcular `needle = centroNeedle(centroSelNome)` (já existe). Uma saída pertence ao evento quando `rowMatchesText({ descricao: mov.evento_projeto }, needle)` — mesma lógica de tokens usada hoje para os lançamentos do Conta Azul. Nenhum casamento novo.

### 3. Agregar por grupo do DRE
Novo `useMemo` (`stockAgg`) que percorre as saídas filtradas e produz `Map<DreGroupId, Map<categoriaNome, number>>`:

- `grupo = grupoDoPlanoNome(mov.itens?.categoria, prefixIndex)` — mesma função do dashboard.
- Se `grupo` for `null`, cai em `"SC"` (grupo já existente em `GROUP_LABEL`/`DreGroupId`).
- Chave do detalhamento = `stock:${categoriaNome ?? "Sem categoria"}` para não colidir com `categoria_external_id` do Conta Azul.
- Valor somado = `Number(mov.valor_total || 0)` (positivo; o sinal é aplicado pelo `line.sign` na renderização, como já é feito no Conta Azul).

### 4. Somar por cima do resultado do Conta Azul
Substituir o `useMemo` atual de `{ totais, grupos }` por um wrapper que:

1. Chama `calcularDRECaixa(...)` como hoje (inalterada).
2. Faz merge do `stockAgg` no `grupos` retornado (concatena entradas por categoria).
3. Para cada `groupId` do `stockAgg` cuja linha é `kind: "sum"` no `dreEstrutura`, incrementa `totais[groupId]` em `soma * line.sign` (mantém a convenção existente: `sum` já vem com sinal aplicado; `grupos` guarda valor absoluto).
4. Recalcula as linhas `kind: "calc"` do `dreEstrutura` a partir das `formula`, para propagar o efeito nos subtotais (RV, RO, RG, RN, LU, etc.).

### 5. Grupo "Sem classificação" (SC) visível
`"SC"` existe em `DreGroupId` e em `GROUP_LABEL`, mas não em `DRE_STRUCTURE`. Se `stockAgg` tiver entradas no grupo `"SC"`, injetar em um `dreEstrutura` local (memoizado só neste componente) uma linha extra `{ id: "SC", kind: "sum", sign: -1, prefixes: [] }` para que apareça no `linhasDre`. Sem essa linha extra, o loop de renderização a ignora.

### 6. Nome da categoria no detalhamento
Extender o `planoMap` local com entradas sintéticas para as chaves `stock:...` (ex.: `Map` derivado que já contém `stock:Detergentes → { nome: "Detergentes (estoque)" }`) para que o `linhasDre` (linha 765) renderize o rótulo correto sem tocar no restante do fluxo.

### 7. Não mexer em
- `calcularDRECaixa` (assinatura preservada).
- Lançamentos listados no painel lateral (permanecem só do Conta Azul).
- Painel Financeiro e Fluxo de Caixa.
- Qualquer lógica de rateio ou de casamento por texto.

## Onde as saídas serão somadas (resposta pedida)

No `AnaliseDetalhada`, entre as linhas ~700 e ~705 de `ContaAzulDashboard.tsx`, no `useMemo` que hoje devolve `{ totais, grupos }`: ali entra o merge do `stockAgg` (calculado a partir da nova query + filtro por `centroNeedle`/`rowMatchesText` + `grupoDoPlanoNome`).

## Fora do escopo
- Não criar tabela de mapa categoria→grupo.
- Não criar tela de configuração.
- Não filtrar por data (a Análise Detalhada é do evento inteiro).
- Não alterar a lista de lançamentos (apenas o DRE).
