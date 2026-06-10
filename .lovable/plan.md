## Objetivo

Na tela **Estoque → Conferir estoque (Egestor)**, permitir ajustar o saldo do sistema para igualar ao saldo do Egestor com **um clique por linha** (ou em lote). Cada ajuste gera uma **movimentação de ajuste** registrada no histórico do item, mantendo a rastreabilidade.

## Comportamento

Para cada linha com `status = "divergente"`:

- `diferenca = saldo_sistema − saldo_egestor`
- Se `diferenca > 0` → estoque do sistema está **acima** do Egestor → lançar **ajuste negativo** (saída de correção) de `|diferenca|`.
- Se `diferenca < 0` → estoque do sistema está **abaixo** do Egestor → lançar **ajuste positivo** (entrada de correção) de `|diferenca|`.

Como a tabela `movimentacoes` já tem `tipo = 'ajuste'` e o trigger `apply_movement` aplica `delta := NEW.quantidade` para ajustes, vou usar **quantidade assinada** (positiva ou negativa) no próprio campo `quantidade`, com `tipo = 'ajuste'`. Isso já é o padrão usado pelas funções `reconciliar_estoque`/`apply_movement` do projeto.

Linhas com status `so_egestor` (item não existe no sistema) e `so_sistema` (não veio na planilha) **não** terão botão de ajuste — só divergências reais.

## Mudanças na UI (`ConferenciaEgestorDialog.tsx`)

1. **Nova coluna "Ação"** na tabela de resultado, só para divergentes:
   - Botão `Ajustar` por linha, que abre confirmação inline mostrando: "Vai gerar ajuste de {±N} no item {nome}".
2. **Seleção em lote**:
   - Checkbox por linha (apenas divergentes) + checkbox no header.
   - Botão **"Ajustar selecionados (N)"** no topo da tabela quando há seleção.
3. **Estado de processamento** por linha: spinner enquanto grava; ao concluir, a linha vira `ok` (verde, diferença 0) e some do filtro "Divergentes".
4. **Toast de resumo** ao final: "X ajustes lançados, Y falhas".
5. **Texto explicativo** no topo do diálogo atualizado: deixa claro que ajustar **sim** altera saldo, mas só nas linhas escolhidas e sempre via lançamento de ajuste rastreável.

## Lançamento no banco

Insert em `movimentacoes` por linha ajustada:

```ts
{
  tipo: 'ajuste',
  item_id: <id do item>,
  quantidade: saldo_egestor - saldo_sistema, // assinado
  data: <hoje>,
  observacoes: 'Ajuste por conferência Egestor (saldo anterior: X, novo: Y)',
  // demais campos opcionais ficam null
}
```

O trigger `apply_movement` já cuida de:
- atualizar `itens.quantidade_atual` com o delta,
- chamar `refresh_item_status`.

E o hook `useEstoqueRealtimeSync` já invalida as queries de estoque/movimentações automaticamente — o saldo na tela atrás aparece atualizado sem reload.

## Não vou mexer

- Schema do banco (nenhuma migration necessária).
- Parser do Egestor, filtros, busca e exportação (já funcionam).
- Outros módulos (patrimônio, compras, financeiro).
- Itens "só no Egestor" não criam item automaticamente — fora de escopo desta tarefa; o usuário cadastra manualmente.

## Arquivo

- `src/components/estoque/ConferenciaEgestorDialog.tsx` — único arquivo editado.
