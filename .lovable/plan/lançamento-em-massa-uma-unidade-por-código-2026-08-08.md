# Lançamento em massa: uma unidade por código

O lançamento em massa já cria um registro separado para cada código informado (cada um com seu COD e ID sequencial próprio). Falta apenas ajustar a quantidade.

## Ajuste

- No modo "Lançar em massa", cada item criado passa a ter **quantidade 1**, independentemente do que estiver no formulário.
- O campo Quantidade fica oculto (ou desabilitado com aviso "1 por código") enquanto o modo em massa estiver ativo, para não gerar confusão.
- O lançamento único e a edição continuam iguais.

## Detalhe técnico

- Em `src/routes/patrimonio.index.tsx`, no envio do `ItemDialog` em modo massa, forçar `quantidade: 1` no payload e esconder o campo de quantidade quando `bulk` estiver ativo.
