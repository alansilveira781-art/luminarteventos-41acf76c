## Objetivo
No quadro de Lançamentos da aba Análise Detalhada, as saídas de estoque devem aparecer como linhas próprias e exibir o número da requisição (REQ) na descrição, para identificar a origem do valor selecionado.

## Escopo
Alterações apenas em `src/components/financeiro/ContaAzulDashboard.tsx`. Nenhuma mudança no casamento por evento/projeto, na lógica do Conta Azul nem no schema do banco (a coluna `requisicao_numero` já existe em `movimentacoes`).

## Mudanças

### 1. Enriquecer a busca de saídas de estoque (`saidasEstoque`, ~linha 674)
- **Saídas simples (`movimentacoes`):**
  - Adicionar `requisicao_numero`, `data_movimento` e `observacoes` ao `select`.
  - Expandir o embed `itens(...)` para também trazer `nome`.
- **Saídas compostas (`movimentacao_itens`):**
  - Expandir o embed `movimentacoes!inner(...)` para incluir `requisicao_numero` e `observacoes`.
  - Expandir o embed `itens(...)` para incluir `nome`.
- **Tipo TypeScript da linha (`rows`):** incluir:
  - `requisicao_numero: number | null`
  - `item_nome: string | null`
  - `quantidade: number`
  - `observacao: string | null`
  - `data_movimento: string | null`
  - `categoria: string | null`
- **Preenchimento no `rows.push`:**
  - Simples: `requisicao_numero` de `m.requisicao_numero`; `item_nome` de `m.itens?.nome`; `observacao` de `m.observacoes`; `quantidade` de `m.quantidade`; `data_movimento` de `m.data_movimento`; `categoria` de `m.itens?.categoria`.
  - Composto: `requisicao_numero` de `mi.movimentacoes?.requisicao_numero ?? null`; `item_nome` de `mi.itens?.nome`; `observacao` de `mi.movimentacoes?.observacoes ?? null`; `quantidade` de `mi.quantidade`; `data_movimento` de `mi.movimentacoes?.data_movento` (ou campo equivalente); `categoria` de `mi.itens?.categoria`.

### 2. Adicionar saídas de estoque ao `lancamentos` (~linha 890)
- Depois de empurrar as linhas do Conta Azul (`push(receberRows)` e `push(pagarRows)`), iterar sobre as saídas de estoque que casaram com o evento/projeto selecionado (reaproveitando o mesmo `rowMatchesText` usado em `stockAgg`).
- Para cada saída, criar um `LancRow` com:
  - `data`: `m.data_movimento`
  - `nome`: `null` (ou algo genérico como "Estoque")
  - `descricao`: formatada conforme item 3
  - `valor`: `-m.valor_total` (custo, portanto negativo)
  - `categoria_external_id`: o `external_id` do plano de contas casado por categoria, ou `stock:<categoria>` para sem classificação — mesmo identificador usado nos detalhes do DRE.
- Ordenar o resultado final por data, mantendo o comportamento atual.

### 3. Formato da descrição com REQ (~linha 936)
Montar a descrição exatamente no padrão solicitado:

```ts
const reqTag = m.requisicao_numero != null ? `REQ ${m.requisicao_numero}` : null;
const partes = [
  reqTag,
  m.item_nome ? `${m.item_nome} × ${m.quantidade}` : `Saída × ${m.quantidade}`,
  catNome ? `(${catNome})` : "",
  m.observacao ?? "",
].filter(Boolean);
const descricao = `[Estoque] ${partes.join(" — ")}`;
```

Resultado esperado: `[Estoque] REQ 142 — Pinus 2x3 × 10 — (Madeiramento)`.

## Teste
1. Selecionar um evento/projeto que tenha saídas de estoque conhecidas.
2. Clicar em uma categoria de estoque no DRE.
3. Verificar no quadro de Lançamentos que as saídas aparecem com o prefixo `[Estoque]` e com o número da REQ quando existir.
4. Confirmar que as linhas do Conta Azul continuam funcionando normalmente.