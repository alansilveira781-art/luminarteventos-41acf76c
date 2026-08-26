# Histórico de rotinas: só os últimos dias + consulta por período

## O que muda

Na aba Rotina (Financeiro Operacional), o bloco "Histórico recente" hoje lista as últimas 50 execuções, sem recorte de data.

1. **Histórico recente** passa a mostrar apenas execuções dos **últimos 2 dias** (data de referência entre anteontem e hoje). Se não houver nada no período, exibe "Nenhuma execução nos últimos 2 dias".
2. **Botão "Ver histórico"** ao lado do título abre um diálogo com:
   - seleção de período (data inicial e data final, pré-preenchidas com os últimos 30 dias) e atalhos rápidos: 7 dias, 30 dias, mês atual;
   - filtro opcional por rotina;
   - a mesma tabela (Rotina, Data ref., Executada por, Anexos, Observações), ordenada da mais recente para a mais antiga, com rolagem interna.

## Detalhes técnicos

- Arquivo: `src/routes/financeiro-op.rotinas.tsx`.
- A lista curta filtra o array `execucoes` já carregado por `data_referencia >= hoje - 2 dias`.
- O diálogo faz sua própria consulta a `financeiro_rotina_execucoes` com `gte`/`lte` em `data_referencia` (limite de 500 linhas), reaproveitando o componente `AnexosLinks`.
- Nenhuma mudança de banco de dados ou de permissões.
