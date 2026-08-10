# Relatório de Vendas: data de registro e coluna Decorador

## O que muda

No PDF do relatório de vendas (aba Vendas do módulo Comercial):

1. A primeira coluna passa de **Data evento** para **Data registro**, usando a data em que a venda foi registrada.
2. Nova coluna **Decorador**, ao lado de Cerimonial.
3. As larguras das colunas são recalculadas para que tudo continue cabendo em uma folha A4 paisagem, sem cortes.

## Detalhes técnicos

- `src/routes/comercial.vendas.tsx`: incluir `decorador` nas linhas enviadas ao gerador do PDF.
- `src/lib/comercial/vendas-relatorio.ts`:
  - tipo `VendaRelatorioLinha` ganha `decorador: string | null`;
  - cabeçalho: `Data registro` no lugar de `Data evento`, corpo usa `l.dataRegistro`;
  - nova coluna `Decorador` após `Cerimonial`; `colSpan` da linha TOTAL passa de 7 para 8;
  - `columnStyles` redistribuídos para somar os 273 mm úteis (redução leve em Evento, Local e Empresa para abrir ~19 mm ao Decorador).

Os resumos por consultor e por categoria no fim do PDF permanecem como estão.
