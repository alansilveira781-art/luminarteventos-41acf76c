## Objetivo
Fazer as saídas de estoque aparecerem na aba "Análise Detalhada" do Conta Azul quando um evento/projeto é selecionado, afrouxando o casamento por texto e adicionando log de diagnóstico.

## Mudanças (apenas em `src/components/financeiro/ContaAzulDashboard.tsx`)

### 1. `rowMatchesText` (~linha 84) — casamento majoritário
Substituir a exigência de `tokens.every(...)` por um limiar de 60%:

```ts
function rowMatchesText(c: any, needle: string): boolean {
  if (!needle) return true;
  const hay = normTxt(
    [c.descricao, c.observacoes, c.fornecedor_nome, c.cliente_nome].filter(Boolean).join(" | "),
  );
  if (hay.includes(needle)) return true;
  const tokens = needleTokens(needle);
  if (tokens.length === 0) return false;
  const hits = tokens.filter((t) => hay.includes(t)).length;
  return hits / tokens.length >= 0.6;
}
```

Atalho `hay.includes(needle)` preservado — nenhum caso que casava antes deixa de casar (every ≥ 60%).

### 2. Diagnóstico em `stockAgg` (~linha 801)
Após montar o `agg`, adicionar um `console.log` com:
- nome do centro selecionado
- `needle` calculado
- total de linhas em `saidasEstoque.data`
- quantas passaram no filtro de texto
- quantas foram descartadas por `valor_total === 0`

Contadores calculados no mesmo loop que gera `agg`, sem alterar o resultado.

### 3. Sem outras alterações
Lógica do Conta Azul intocada. Nenhuma mudança de estilo, layout ou schema.

## Teste
Selecionar um evento com saídas de estoque conhecidas e conferir no console qual cenário ocorre (nenhuma linha casou o nome × casaram mas custo zero).