## Objetivo
Melhorar a visualização do grid de formas de pagamento nos diálogos de Compra e Despesa, deixando o valor total calculado como a última informação apresentada, evitando o layout confuso atual onde o total fica ao lado ou misturado aos campos do grid.

## Escopo
- `src/components/PagamentosGrid.tsx`
- `src/components/CompraDialog.tsx`
- `src/components/DemandaDialog.tsx`

## Passos

### 1. Reorganizar o rodapé do `PagamentosGrid`
- Manter o cabeçalho do grid (Forma / Parcelamento / Data prevista / Valor / Pago / Ações) e as linhas de pagamento na parte superior.
- Remover a linha de resumo atual que fica imediatamente abaixo das linhas de pagamento e é apenas texto corrido.
- Adicionar, no final do componente, uma linha de totais em destaque com:
  - "Soma das formas" à esquerda;
  - "Valor total" centralizado ou à direita, em destaque (fonte maior/negrito);
  - "Diferença" somente quando houver divergência, em cor de alerta.
- Usar um container com fundo sutil (`bg-muted/40` ou `border-t`) para separar visualmente o total das linhas de pagamento.

### 2. Reposicionar o campo "Valor total (R$)" no `CompraDialog`
- O campo "Valor total (R$)" (com label "CALCULADO PELOS ITENS") deve ser renderizado **depois** do `PagamentosGrid`, ocupando a largura total da seção (`md:col-span-2 lg:col-span-3`) para não ficar ao lado do grid.
- Garantir que a ordem visual seja: grid de pagamentos → resumo do grid → campo de valor total calculado pelos itens.

### 3. Alinhar layout no `DemandaDialog`
- Verificar se o `PagamentosGrid` e o campo de valor total (se existir) seguem a mesma ordem proposta.
- Se houver campo de valor total na despesa, aplicar a mesma largura total e posicionamento abaixo do grid.
- Se não houver campo equivalente, apenas garantir que o grid ocupe a largura total e o resumo fique no final.

## Resultado esperado
- O usuário vê primeiro as formas de pagamento cadastradas, depois o resumo consolidado e, por fim, o valor total calculado, sem informações cortadas ou deslocadas para o lado.
- Layout mais próximo do padrão de formulário vertical, facilitando a leitura e conferência.