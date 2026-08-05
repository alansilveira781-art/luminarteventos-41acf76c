# Relatório de Cartões — por que faltam lançamentos

Verifiquei no banco o cartão do print (Cartão Final 2186). Existem 17 lançamentos ligados a esse cartão, mas o relatório mostra apenas 3. Os outros somem por dois motivos, ambos no filtro da consulta.

## Causa 1 — Lançamentos sem "data da compra" nunca aparecem

10 dos 17 lançamentos do cartão 2186 estão com a data da compra em branco (ex.: COMPRA-82 "Manutenção Sorento" R$ 1.837,41, COMPRA-81 "Oxford Preto" R$ 1.246,44, COMPRA-224 "Jantar Produtor", COMPRA-278/279/283/284/285/286). Como o filtro de período compara sempre a data da compra, tudo que está sem data é descartado — em qualquer mês escolhido.

## Causa 2 — Só entram status "Finalizado" e "A receber"

O relatório hoje só considera esses dois status. Ficam de fora Em andamento, Pendente de aprovação, Solicitação e Negada. No cartão 2186 isso derruba 6 lançamentos (5 pendentes de aprovação + 1 em solicitação).

Isso vale para todos os cartões: no total do banco há dezenas de lançamentos nessas situações (ex.: Cartão 1713 com 2 em andamento e 2 pendentes; Cartão 1592 com 3 em andamento).

## O que proponho mudar

1. **Data alternativa**: quando a data da compra estiver vazia, usar a data de solicitação como referência do período (e, se também faltar, a data de criação do card). Assim nenhum lançamento fica invisível.
2. **Filtro de status visível na tela**: um seletor com padrão "Finalizado + A receber" (comportamento atual), com opções para incluir Em andamento / Pendente de aprovação / Solicitação, e "Todos". Negada fica fora por padrão.
3. **Aviso de conferência**: uma linha discreta abaixo da tabela informando quantos lançamentos do cartão ficaram fora do período/status selecionados, para o usuário saber que existem e ajustar o filtro.
4. A coluna Parcelamento e os totais continuam iguais; o PDF exportado passa a refletir os mesmos filtros.

## Detalhes técnicos

- Arquivo: `src/routes/financeiro-op.relatorios.tsx`, componente `CartoesReport`.
- Buscar `data_solicitacao` e `created_at` junto de `data_compra` em `compras`/`demandas` e filtrar o período em memória por `data_compra ?? data_solicitacao ?? created_at`, em vez de `.gte/.lte` no banco (as listas já vêm filtradas por IDs de pagamento do cartão, volume pequeno).
- Substituir a constante fixa `STATUS_INCLUIDOS` por estado do componente, incluído na `queryKey`.
- Contagem de "fora do filtro" = total de IDs vindos de `compra_pagamentos`/`demanda_pagamentos` menos as linhas exibidas.
