## Objetivo
Reposicionar a seção "Formas de pagamento" no diálogo de compras para que fique imediatamente abaixo do campo "Data da compra", como bloco próprio e largura total, melhorando a leitura do fluxo de preenchimento.

## Escopo
- `src/components/CompraDialog.tsx`
- Opcionalmente `src/components/DemandaDialog.tsx` se o mesmo padrão de layout existir e o usuário quiser consistência (a confirmar).

## Alterações previstas
1. No `CompraDialog.tsx`, retirar o `<PagamentosGrid>` de dentro do grid de campos do `FormSection` (onde ele ocupa `md:col-span-2` entre outros campos).
2. Inserir o `<PagamentosGrid>` como bloco separado logo após o fechamento do `FormSection` que contém "Data da compra", mantendo largura total e o campo "Valor total (R$)" logo abaixo do grid, conforme já ajustado anteriormente.
3. Garantir que o estado `canEdit`, `totalCalc` e demais props continuem funcionando.
4. Verificar TypeScript e visual no preview.

## Não inclui
- Mudanças em regras de negócio, cálculos ou persistência de pagamentos.
- Alterações no `PagamentosGrid` interno (layout dos cartões já foi refatorado).

## Validação
- `bunx tsc --noEmit` ou build sem erros.
- Screenshot do diálogo de compra mostrando "Formas de pagamento" abaixo de "Data da compra".