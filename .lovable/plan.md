## Objetivo

Nos quadros Kanban (Comercial e Compras), o quadro deve caber **dentro da tela** (altura fixa), sem fazer a página inteira rolar verticalmente. Quando uma coluna tiver muitos cards, a rolagem vertical acontece **dentro da própria coluna**. A rolagem horizontal continua existindo, mas **apenas no quadro**, não no site todo.

## Mudanças

### `src/routes/comercial.index.tsx` e `src/routes/compras.index.tsx`
- Dar ao container do quadro uma **altura fixa** que ocupa o espaço restante da tela (ex.: `h-[calc(100dvh-Xpx)]`), com `overflow-x-auto` (rolagem horizontal entre colunas) e `overflow-y-hidden` (sem rolar o quadro verticalmente como um todo).
- Reestruturar o componente `Column` para:
  - usar `flex flex-col` com a mesma altura total da área do quadro;
  - manter o cabeçalho da coluna fixo no topo;
  - colocar a lista de cards em uma área com `flex-1 overflow-y-auto`, de modo que só os cards rolem verticalmente quando passarem da altura visível.

### `src/routes/__root.tsx`
- Manter a área principal com `h-dvh` para que páginas comuns ainda rolem normalmente, mas garantir que nas telas de Kanban o conteúdo não force rolagem vertical da página (o quadro se autocontém com altura fixa).

## Detalhes técnicos
- A altura do quadro será calculada descontando cabeçalho do topo, barra de busca/filtros e paddings (valor ajustado por teste visual).
- O cabeçalho de cada coluna fica `shrink-0`; o corpo recebe `overflow-y-auto` para a rolagem interna dos cards.
- Apenas ajustes de layout/CSS — sem alteração de lógica de negócio, dados ou backend.