# Bonificação: relatório de impressão organizado

Hoje o botão "Imprimir" só manda a tela para a impressora (vira um print da página, com selects e botões). Vamos trocar por um relatório real, gerado em uma janela limpa e formatado para A4.

## O que o relatório terá

Cabeçalho:
- Título "Distribuição de Bonificação"
- Período (ano/mês selecionado), data/hora de geração e, quando o mês estiver fechado, quem fechou e quando.

Tabela principal, uma linha por lançamento (evento + produtor):

| Nome do evento | Local | Data | Categoria | Produtor | Peso (complexidade) | Valor |

- Eventos com mais de um produtor aparecem com uma linha por produtor, agrupados sob o mesmo evento.
- Eventos sem produtor definido saem com "—" no produtor e valor zerado.
- Rodapé da tabela com o total geral.

Resumo final:
- Tabela "Total por produtor" (produtor, nº de lançamentos, total), ordenada do maior para o menor, encerrando com o total geral.

Formatação: A4 retrato, margens, cabeçalho da tabela repetido a cada página, zebra leve, valores alinhados à direita, sem cortar linhas no meio.

## Detalhes técnicos

- `src/components/financeiro/DistribuicaoBonificacao.tsx`:
  - Nova função `gerarRelatorio()` que monta um HTML autônomo (mesmo padrão já usado em `src/routes/contabil.relatorios.tsx`: `window.open` + `document.write` + `window.print()` no onload), com escape de texto.
  - Fonte dos dados: no mês aberto, `eventos` + `linhasPorEvento` (peso = `complexidade`, valor = `valorBonificacao(e, complexidade)`); no mês fechado, os itens do fechamento (`FechamentoReadonlyBody` passa os itens para a mesma função, usando `complexidade` e `valor_final`).
  - O botão "Imprimir" passa a chamar `gerarRelatorio()`; remover o CSS `@media print` da tela e as classes `print:hidden`/`hidden print:block` que existiam só para o print da página.
  - Aviso via toast quando o navegador bloquear pop-ups.
- Sem mudanças de banco de dados.
