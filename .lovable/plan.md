## Objetivo

Padronizar a seção **"Itens recebidos"** do diálogo de **Despesa** (`ReceberDemandaDialog`) para ficar idêntica à de **Compra** (`ReceberDialog`), como no print enviado: um card por item, com descrição em destaque, linha "Pedido: qtd unidade", campos inline **QTD RECEBIDA / CUST. UNIT. / DESCONTO / FRETE / IPI / OUTROS / TOTAL LINHA** e o bloco tracejado de associação (**Selecionar item existente** / **Cadastrar novo item**) quando o item da despesa ainda não estiver vinculado a um item de estoque.

## Escopo (apenas UI/estado local)

Arquivo: `src/routes/estoque.a-receber.tsx` — função `ReceberDemandaDialog`.

### 1. Trocar o modelo de estado
- Remover `linhas`/`setLinhas`, `LinhaRecDem`, `novaLinhaRecDem`, `adicionarLinha`, `removerLinha` e o botão "Adicionar item".
- Iterar diretamente sobre `demandaItens` (a mesma fonte já usada hoje), no mesmo padrão do compra: um card por linha da despesa, com `descricao`, `quantidade` e `unidade` vindos do próprio item.
- Introduzir os mesmos hooks locais do compra:
  - `extras: Record<demanda_item_id, { quantidade?, valor_unitario?, desconto, frete, ipi, outros_custos }>` + helpers `getExtra` / `setExtra`, inicializados a partir de `demandaItens` (mesma lógica atual de pré-preencher qtd e valor).
  - `itemMap: Record<demanda_item_id, item_id>` para itens ainda não associados, mais o toggle "Desfazer associação" (idêntico ao compra).

### 2. Layout do card do item (espelho exato do compra)
Para cada `it` de `demandaItens`, renderizar o mesmo bloco das linhas 557-657 (`ReceberDialog`), adaptando apenas os nomes dos handlers:
- Título: `it.descricao`.
- Subtítulo: `Pedido: {qtd} {unidade}`.
- Se `it.evento_projeto` existir, mostrar `EVENTO/PROJETO:` (em despesas hoje não há esse campo — omitir se não houver).
- Linha de campos: `Qtd recebida`, `Cust. unit.` (MoneyInput, 4 casas), `Desconto`, `Frete`, `IPI`, `Outros`, `Total linha` (calculado).
- Bloco de associação idêntico ao do compra: quando `!it.item_id && !itemMap[it.id]`, mostrar caixa tracejada com **Selecionar item existente** (`ItemSearchSelect`) e **Cadastrar novo item** (`CadastrarItemInline`, já existente no arquivo). Quando associado, mostrar mensagem de sucesso + "Desfazer associação".

### 3. Ajuste da mutation `finalizar`
- Continuar iterando pelos itens da despesa, mas usando `extras` para os valores editáveis e `it.item_id ?? itemMap[it.id]` como destino no estoque.
- Só criar `movimentacoes` para linhas com `item_id` resolvido e `quantidade > 0` (mesmo critério do compra em `linhasInvalidas`).
- Persistir a associação em `demanda_itens.item_id` quando vier de `itemMap` (já acontece hoje, apenas re-adaptado à nova estrutura).
- Manter validações atuais (fornecedor, empresa, data, status `a_receber`) e mensagens de erro.
- Mantém `origem = DESPESA-<numero>` já implementado.

### 4. Rodapé/Total
- Recalcular `totalRecebimento` a partir de `demandaItens` + `extras`, mesma fórmula do compra.
- Botão "Finalizar recebimento" fica desabilitado quando não houver nenhuma linha válida (qtd > 0 e item associado), espelhando `linhasInvalidas`.

### 5. Não alterar
- Cabeçalho, banner de status bloqueado, dados gerais (data/empresa/fornecedor/NF), seção de anexos, comportamento de fechar/invalidar queries.
- Nenhuma mudança em banco, RLS, tipos gerados, ou em `ReceberDialog` (compra).

## Validação

1. Abrir uma despesa em `/estoque/a-receber` e conferir visual idêntico ao card do compra do print.
2. Item sem `item_id`: aparece o bloco tracejado; associar via busca ou "Cadastrar novo item" funciona; "Desfazer associação" volta o estado.
3. Alterar qtd/custo/desconto/frete/IPI/outros atualiza `Total linha` e o total geral do recebimento.
4. Finalizar gera entrada em `movimentacoes`, marca `demanda_itens.recebido = true` e finaliza a demanda.
5. Anexos continuam aparecendo e abrindo no `AnexoViewer`.