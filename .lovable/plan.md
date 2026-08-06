# Relatório de Vendas (PDF/CSV) + Indicadores no Dashboard Financeiro

## 1. Comercial > Vendas — Exportar relatório

- O botão "Exportar CSV" vira **Exportar relatório**, com menu de duas opções: **PDF** e **CSV**.
- Exporta sempre o que está filtrado/ordenado na tela (período, empresa, consultor, classificação, busca).
- O CSV mantém o comportamento atual e passa a incluir a coluna **Comissão**.
- O PDF segue o layout padrão da empresa já usado nas propostas (cabeçalho com identidade, título, período e filtros aplicados, numeração de página, rodapé):
  - Tabela: Data, Evento, Local/Cidade, Empresa, Consultor, Cerimonial, Valor Proposta, Desconto, Valor Final, BV e **Comissão**.
  - Linha de totais gerais (valor final, BV, comissão).
  - Bloco de resumo final: **Total de comissões por consultor** (quantidade de vendas, valor final somado, comissão total e % médio).

## 2. Financeiro > Dashboard — nova seção "Indicadores"

Nova aba/seção ao lado das existentes, com filtros no topo:

- **Evento** — mesma lista suspensa da Análise Detalhada (centros de custo/eventos). Ao escolher, o sistema identifica o evento no calendário pelo nome e mostra a **categoria** dele.
- **Categoria** — filtro próprio; ao selecionar, consolida todos os eventos daquela categoria.
- **Ano** e **Mês** — padrão 2026 e mês atual.

Conteúdo:

- Cartões de indicadores: **Receita Bruta**, **Custos** (soma de todos os grupos de custo), **Despesas** (soma de todos os grupos de despesa) e **Lucro Líquido**, cada um com o percentual sobre a receita bruta e a variação vs. período anterior.
- **Gráfico de linha do tempo** com a evolução mensal de receita, custos, despesas e lucro no ano selecionado.
- **Comparativo de até 3 eventos** da categoria: você escolhe manualmente os eventos num seletor múltiplo (máx. 3) e o quadro mostra lado a lado receita, custos, despesas, lucro e os respectivos percentuais sobre a receita, com gráfico de barras agrupadas.
- Botão de impressão A4 no mesmo padrão dos demais relatórios do módulo.

## Detalhes técnicos

- Vendas: novo módulo `src/lib/comercial/vendas-relatorio.ts` gerando o PDF (mesma base visual de `src/lib/comercial/pdf.ts`); a rota `src/routes/comercial.vendas.tsx` troca o botão por um `DropdownMenu`. Comissão vem de `valor_comissao`, com fallback pelo percentual do cadastro (`calcularDerivados` em `src/lib/comercial/comissao.ts`).
- Indicadores: novo componente `src/components/financeiro/IndicadoresEventos.tsx` registrado na aba `Indicadores` de `ContaAzulDashboard.tsx`. Fonte de dados igual à Análise Detalhada: fatias de `ca_lancamento_rateios` por centro de custo + `ca_plano_contas`, classificadas pela estrutura DRE (`src/lib/conta-azul/dre.ts`). Custos = grupos CV/CD/CI; Despesas = AC/DM/DC/DS/DA/DT/DF/OS; Lucro = linha calculada `LU`.
- Categoria do evento: mesma regra da Bonificação — `comercial_vendas.tipo_evento` casado por nome flexível (`src/lib/eventos-info.ts`), com fallback em `eventos.tipo`.
- Nenhuma alteração de banco de dados é necessária.
