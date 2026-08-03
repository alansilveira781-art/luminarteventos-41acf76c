# Impressão da apuração — tabela de impostos completa e rodapé

Hoje o PDF/impressão da apuração mostra a tabela de impostos apenas com duas colunas (Imposto e Valor) e um rodapé genérico. A tela mostra bem mais informação. O objetivo é fazer a impressão refletir exatamente o que aparece na tela, incluindo as notas abaixo da tabela.

## O que muda na impressão

Tabela de impostos passa a ter as mesmas colunas da tela:
Imposto | Base | Alíq. | Valor | Adic. | Total, com a linha final "Total a pagar".

Também passa a mostrar, acima da tabela, "Base presumida (32%)" com o valor.

Abaixo da tabela, incluir as informações que hoje só existem na tela:

- Linha de detalhe do IRPJ: apurado, limite mensal, excedente e adicional (com a alíquota do adicional).
- Aviso de alíquotas não configuradas para a empresa, quando for o caso.
- Manter a nota "Documento de rascunho — não possui valor fiscal." e "Gerado em".

## Exportação Excel

A aba "Impostos" do Excel recebe as mesmas colunas (Base, Alíq., Valor, Adicional, Total) e as linhas de detalhe do IRPJ abaixo do total, para ficar consistente com o PDF.

## Detalhes técnicos

- Arquivo: `src/routes/contabil.apuracoes.tsx`, funções `exportarPDF` e `exportarExcel`.
- Usar `apuracao.itens` (campos `base`, `aliquota`, `valor`, `adicional`, `total`), `apuracao.basePresumida`, `apuracao.totalImpostos` e `apuracao.irpjDetalhe`.
- Sem mudanças de banco de dados nem de layout da tela.
