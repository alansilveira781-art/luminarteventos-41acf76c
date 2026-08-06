# Filtros avançados nos Relatórios de Estoque

Adicionar novos filtros na aba **Estoque → Relatórios** e levar os mesmos filtros para a prévia de movimentação do item (botão de histórico na lista de estoque).

## Novos filtros (aparecem conforme o relatório selecionado)

- **Evento/Projeto** — mesmo componente usado na Saída (busca combinada de eventos do calendário + planilha, com digitação para filtrar). Aplica-se aos relatórios de Saídas, Saídas por evento e Devoluções.
- **Tipo** — lista suspensa com os mesmos tipos de saída usados no lançamento (evento, empréstimo, consumo, perda, quebra, manutenção, transferência, EPI/fardamento, produção de novos itens, outros). Aplica-se aos relatórios de Saídas e Saídas por evento.
- **Solicitante** — lista suspensa dos solicitantes cadastrados. Aplica-se a Saídas e Devoluções.
- **Fornecedor** — lista suspensa dos fornecedores; aparece apenas quando o relatório escolhido é de **Entradas** (e Gastos por mês/categoria, que também usam entradas).

Regras gerais:
- Todos os filtros são opcionais; em branco significa "todos".
- Os filtros ficam junto do período e do seletor de itens já existente, escondendo-se automaticamente quando não fazem sentido para o relatório escolhido.
- Um resumo dos filtros aplicados entra no cabeçalho do PDF e na exportação CSV, para o relatório ficar autoexplicativo.

## Prévia de movimentação do item

Na tela aberta pelo botão de histórico (ícone de relógio) da aba Estoque, hoje aparece a lista de entradas, saídas e devoluções sem nenhum filtro. Serão adicionados:
- Filtro por **tipo de movimento** (entrada / saída / devolução / todos).
- Filtros por **evento/projeto**, **tipo de saída**, **solicitante** e **fornecedor**, com a mesma lógica de exibição condicional.
- Filtro de período (de/até), já que a lista pode ficar longa.
- Contador de registros exibidos após a filtragem.

## Detalhes técnicos

- `src/routes/relatorios.tsx`: novos estados de filtro (`eventoProjeto`, `saidaTipo`, `solicitanteId`, `fornecedorId`) incluídos na `queryKey` e repassados para `loadReport`, que aplica `.eq()` nas consultas de `movimentacoes` correspondentes. Reaproveitar `EventoSheetCombobox` (`src/components/EventoSheetCombobox.tsx`) para o campo de evento e carregar solicitantes/fornecedores via `fetchAllRows`.
- Labels de tipo de saída vêm de `saidaTipoLabels` (`src/lib/labels.ts`), garantindo paridade com a tela de Saídas.
- `src/routes/estoque.$itemId.tsx`: incluir `evento_projeto`, `solicitante_id` e `fornecedor_id` no select e aplicar a filtragem em memória sobre a lista já carregada.
- Nenhuma alteração de banco de dados é necessária — todas as colunas já existem em `movimentacoes`.
