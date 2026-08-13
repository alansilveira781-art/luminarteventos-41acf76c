# Relatórios de Compras — exportação Conta Azul

Nova seção **Relatórios** dentro do módulo Compras, com uma aba que monta exatamente a planilha modelo de importação do Conta Azul a partir dos cards de Compras e Despesas.

## Colunas da tabela (idênticas ao arquivo)

Data de Competência · Data de Vencimento · Data de Pagamento · Valor · Categoria · Descrição · Cliente/Fornecedor · CNPJ/CPF Cliente/Fornecedor · Centro de Custo · Observações

## Como cada coluna é preenchida

- **Data de Competência**: data da compra do card (na falta dela, data de solicitação).
- **Data de Vencimento**: data prevista da parcela. Quando o lançamento é parcelado e não há datas informadas, gera-se uma linha por parcela partindo da data da compra com intervalos de 30 dias (1ª = data da compra, 2ª = +30 dias, e assim por diante).
- **Data de Pagamento**: só preenchida quando a parcela está marcada como paga; caso contrário fica em branco.
- **Valor**: sempre negativo, com o valor da parcela (parcelados somam o total do card).
- **Categoria**: lista suspensa por linha, alimentada com as categorias ativas do Conta Azul (plano de contas sincronizado). Escolha manual, salva no card — ao voltar ao relatório a categoria já vem preenchida.
- **Descrição**: título do card concatenado com o ID (ex.: `Refletores LED - COMPRA-124`).
- **Cliente/Fornecedor** e **CNPJ/CPF**: fornecedor do card e o documento do cadastro de fornecedores quando existir.
- **Centro de Custo**: campo Evento / Projeto do card (nas compras, o evento dos itens; se não houver, fica em branco).
- **Observações**: observações do card.

Textos são higienizados conforme as orientações da planilha (sem caracteres especiais problemáticos) e as datas saem no formato aceito pelo Conta Azul.

## Filtros

- **Cartão / forma de pagamento**: lista montada com as formas realmente usadas nos cards (mesma normalização já usada no relatório do Financeiro, para "Pix" e "PIX" contarem como uma só), mais as opções "Todas" e "Sem forma informada".
- **Período**: intervalo de datas aplicado à data de competência (data da compra).

## Ações

- Tabela na tela com totalizador e contagem de linhas.
- Botão **Exportar Excel** que gera o arquivo no mesmo layout do modelo, pronto para importar no Conta Azul.

## Detalhes técnicos

- Nova rota `src/routes/compras.relatorios.tsx` (aba "Relatórios" no módulo Compras) e link na navegação do módulo.
- Fonte de dados: `compras` + `compra_pagamentos` + `compra_itens.evento_projeto`, `demandas` + `demanda_pagamentos` + `demandas.evento_projeto`, e `compras_fornecedores` para o documento.
- Categorias vindas de `ca_plano_contas` (`ativo = true`, tipo DESPESA), ordenadas por nome.
- Persistência da categoria: nova coluna `categoria_conta_azul` (texto) em `compras` e `demandas`, gravada ao selecionar na tabela — requer migração.
- Geração de linhas por parcela reaproveitando os helpers de `src/lib/pagamentos.ts`; a lógica de montagem das linhas fica em `src/lib/conta-azul/exportacao-cards.ts` para ficar testável.
- Exportação via `xlsx`, já usado no projeto.
