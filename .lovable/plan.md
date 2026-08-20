# Empresa some ao editar uma entrada

## O que está acontecendo

Não é o salvamento em si: a função do banco grava a empresa normalmente.

O problema está na montagem da entrada agrupada na tela de Entradas. Quando as linhas de uma requisição são agrupadas em um único registro (REQ-XXXX), o grupo copia data, fornecedor, tipo, nota fiscal, observações e responsável — mas **não copia a empresa**.

Consequência em cadeia:

1. Ao abrir "Editar", o campo Empresa aparece vazio ("Selecione…"), mesmo que a entrada tenha empresa gravada.
2. Se o usuário salvar sem escolher de novo, a edição grava empresa vazia e **apaga** a empresa que estava registrada.

Isso explica tanto o campo em branco da imagem quanto a impressão de que "a empresa atualizada não aparece".

## Como corrigir

- Incluir a empresa nos dados do grupo de entrada, para que o formulário de edição já abra com a empresa correta selecionada.
- Tornar o campo Empresa obrigatório de verdade na edição (bloquear o salvamento sem empresa), evitando que uma edição sem querer limpe o dado.
- Se a empresa gravada não estiver na lista fixa de empresas (registros antigos ou importados com nome diferente), ela passa a aparecer como opção adicional no seletor, em vez de sumir silenciosamente.

## Detalhes técnicos

Arquivo: `src/routes/entradas.tsx`

1. No `useMemo` de `grupos`, adicionar `empresa: m.empresa` ao objeto criado para cada requisição.
2. No `EntradaForm`, o seletor de Empresa passa a incluir o valor de `prefill.empresa` na lista quando ele não constar em `EMPRESAS`.
3. Validar no `onSubmit` que `meta.empresa` está preenchido antes de enviar (mensagem em português via toast).

Sem mudanças no banco: a função `estoque_editar_entrada` já persiste `empresa` corretamente.
