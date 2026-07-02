## Estoque › Validação de Recebimento: total + agrupar por requisição

Alterações em **`src/routes/estoque.a-receber.tsx`** (arquivo único):

### 1. Calcular total do recebimento
Adicionar `useMemo` `totalRecebimento` após `linhasInvalidas` no `ReceberDialog`, somando `qtd * valor_unitario − desconto + frete + ipi + outros` de cada item (ignorando itens sem quantidade).

### 2. Agrupar itens sob um único `requisicao_numero`
Em `finalizar.mutationFn`, antes do `for (const it of itens)`:
- Chamar `sb.rpc("next_requisicao_numero")` uma vez.
- Passar o número obtido como `requisicao_numero` no `insert` de cada movimentação dentro do loop.

Resultado: todos os itens do recebimento entram como uma única requisição agrupada, igual à Entrada normal.

### 3. Exibir total no rodapé do dialog
Ajustar o `DialogFooter` para conter dois blocos:
- Esquerda: "Total do recebimento: R$ X" (formatado em BRL, `tabular-nums`).
- Direita: botões existentes (Devolver / Cancelar / Finalizar) inalterados.

### Fora de escopo
- Não alterar a RPC `next_requisicao_numero`, cálculo por item, lógica de status da compra, devolução, página Entradas ou outros módulos.
