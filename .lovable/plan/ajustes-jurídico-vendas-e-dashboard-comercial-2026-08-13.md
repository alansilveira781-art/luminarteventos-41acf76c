# Ajustes: Jurídico, Vendas e Dashboard Comercial

## 1. Jurídico — rolagem por coluna
Hoje o quadro de contratos tem uma única área de rolagem que move todas as colunas juntas.

- Cada coluna passa a ter altura fixa e sua própria barra de rolagem vertical.
- A linha de colunas mantém apenas a rolagem horizontal.
- O cabeçalho da coluna (nome, cor, contador) e o botão "+ adicionar" ficam fixos; só a lista de cards rola.

## 2. Comercial > Vendas — abrir detalhes do lançamento
- Clicar na linha do lançamento abre um painel lateral (drawer) com todas as informações da venda: datas, evento, local/cidade/estado, classificação, consultor, cerimonial, decorador, empresa, valores (proposta, desconto, final, BV, comissões).
- No rodapé do painel, botões **Editar** (abre o formulário atual já preenchido) e **Excluir** (com confirmação), reaproveitando as ações já existentes na tabela.
- Os ícones de editar/excluir da linha continuam funcionando; o clique na caixa de seleção e nos ícones não abre o painel.

## 3. Comercial > Dashboard — tooltips no tablet
Os gráficos hoje só mostram o balão de valores no hover do mouse.

- Habilitar o toque nos gráficos: ao tocar/segurar um ponto ou barra, o balão aparece e permanece até tocar fora.
- Aplicado a todos os gráficos das abas do dashboard comercial (Painel, Propostas e visão geral).

## Detalhes técnicos
- `src/routes/juridico.index.tsx`: mover `max-h`/`overflow-y-auto` do wrapper para o corpo do `Column` (`flex flex-col max-h-[calc(100vh-200px)]` na coluna + `overflow-y-auto` na área dos cards); wrapper externo fica `overflow-x-auto`.
- `src/routes/comercial.vendas.tsx`: novo estado `detalhe: VendaRow | null`, `onClick` na `<tr>` com `stopPropagation` nas células de ação/checkbox, e um `Sheet` (`VendaDetalheSheet`) reutilizando `openEdit` e `handleDeleteOne`.
- Recharts: adicionar `className="touch-none"` (touch-action: none) nos containers dos gráficos e `trigger` de tooltip compatível com toque via `onTouchStart`/`defaultIndex`; ajustes em `comercial.dashboard.index.tsx`, `comercial.dashboard.painel.tsx` e `comercial.dashboard.propostas.tsx`.
