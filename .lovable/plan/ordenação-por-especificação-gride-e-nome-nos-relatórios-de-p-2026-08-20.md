# Ordenação por Especificação (Gride) e Nome nos Relatórios de Patrimônio

Ajustar a aba Relatórios do módulo Patrimônio para que os itens sejam organizados primeiro por **Especificação** ("Gride") e depois por **Nome**, em todos os modos de visualização e nas exportações PDF.

## O que muda

- Modo **Detalhado**: a listagem na tela passa a ser ordenada por `especificacao` (crescente, nulos/vazios por último ou primeiro de forma consistente) e depois por `nome`.
- Modos **Consolidado por nome** e **Conferência**: as linhas consolidadas (já agrupadas por `nome + especificacao`) passam a ser ordenadas por `especificacao` e depois por `nome`.
- Seletor "Ordenar por": ganha a opção **Especificação (Gride) → Nome** como padrão quando os modos consolidado/conferência estão ativos; a opção "Nome (A–Z)" passa a considerar `especificacao` como segundo critério.
- PDFs detalhado, consolidado e folha de conferência: respeitam a mesma ordenação por especificação → nome dentro de cada grupo/página.

## Detalhes técnicos

- `src/routes/patrimonio.relatorios.tsx`:
  - Adicionar helper `compareEspecThenNome(a, b)` usando `localeCompare("pt-BR")` e tratando valores nulos/vazios de forma previsível.
  - Aplicar a ordenação no `filtrados` exibido no modo detalhado (antes do `.slice(0, 300)`).
  - No `useMemo` `consolidado`, substituir a lógica de sort para usar especificação → nome como ordenação padrão, vinculada ao novo estado de ordenação.
  - Atualizar o seletor de "Ordenar por" para incluir a opção de especificação.
- `src/lib/patrimonio/relatorio-pdf.ts`:
  - `gerarRelatorioPatrimonioPdf`: ordenar `lista` dentro de cada grupo por `especificacao` → `nome`.
  - `gerarRelatorioPatrimonioConsolidadoPdf` e `gerarFolhaConferenciaPatrimonioPdf`: ordenar `params.linhas` pelo mesmo critério.
- Sem mudanças de banco de dados: o campo `especificacao` já existe em `pat_itens`.
