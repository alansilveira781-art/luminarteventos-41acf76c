# Formulário de retirada no celular

O formulário público `/solicitar-saida` foi montado pensando no desktop. No celular a linha de materiais é dividida em 12 colunas fixas, então a descrição fica espremida, a quantidade quase some e o botão de excluir encosta na borda. Os campos de data/solicitante e o cabeçalho também ficam apertados.

## O que será ajustado (só visual, sem mudar o funcionamento)

1. **Linhas de materiais empilhadas no celular**
   - Descrição em largura total, com o rótulo sempre visível (hoje só aparece na primeira linha).
   - Quantidade e botão de excluir lado a lado, embaixo da descrição.
   - A partir de telas médias volta ao formato atual em uma linha só.
   - Cada linha ganha um leve cartão/separador para ficar claro onde começa e termina cada material.

2. **Campos do topo**
   - Data, solicitante, "É para um evento?" e evento/finalidade em uma coluna no celular, duas colunas no desktop (já é assim, mas com espaçamentos e alturas de toque maiores).
   - Campos e botões com altura mínima confortável para o dedo.

3. **Cabeçalho e espaçamentos**
   - Título e texto de apoio com tamanho reduzido no celular e sem estouro de largura.
   - Padding menor nos cartões em telas pequenas.

4. **Botão de envio**
   - Largura total no celular, fixo no fim do formulário; alinhado à direita no desktop.

5. **Combobox de evento**
   - Garantir que o seletor de evento/projeto ocupe a largura total e que o painel de busca não estoure a tela no celular.

## Detalhes técnicos

- Arquivo principal: `src/routes/solicitar-saida.tsx`.
- Trocar `grid grid-cols-12` das linhas de material por `flex flex-col gap-2 sm:grid sm:grid-cols-12`, com `min-w-0` nos contêineres de texto e `shrink-0` no botão de excluir.
- Rótulos passam a ser renderizados em toda linha no mobile (`sm:hidden` para os repetidos) em vez de só em `i === 0`.
- Ajustes de `p-4 sm:p-5`, `text-xl sm:text-2xl`, `w-full sm:w-auto` no submit.
- Verificar `src/components/EventoPublicCombobox.tsx` para largura/popover responsivos; ajustar apenas se necessário.
- Nenhuma mudança em banco de dados, endpoint público ou regras de validação.
