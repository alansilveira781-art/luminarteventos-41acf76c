# Empreitada por bloco de horário (Diaristas)

Hoje a marcação de "Empreitada (empeleita)" existe apenas para o dia inteiro do apontamento. A ideia é permitir marcar **um bloco de horário específico** como empreitada, mantendo os demais blocos com pagamento normal.

## Como vai funcionar

- No lançamento de horas, quando o dia é dividido em blocos de horário, cada bloco ganha uma chave "Empreitada".
- Bloco marcado: as horas continuam registradas e visíveis, mas ele não gera valor e fica fora do cálculo do dia (não entra na diária mínima de 8h nem em horas extras).
- O valor do dia passa a ser calculado somente com as horas dos blocos normais; o rateio por evento distribui o valor apenas entre esses blocos.
- Blocos de empreitada aparecem com um selo "empreitada" no formulário, na listagem/detalhe do apontamento e nos relatórios em PDF, com valor R$ 0,00.
- A chave de empreitada do dia inteiro continua existindo e, quando ligada, zera tudo como hoje.

## Detalhes técnicos

- Migração: coluna `empeleita boolean not null default false` em `diarista_apontamento_eventos`.
- `src/lib/diaristas-calc.ts`: `EventoApontamento` recebe `empeleita`. No modo `horarios`, separar blocos pagos de blocos de empreitada — o total de minutos usado em `montarResultado` considera apenas os blocos pagos; blocos de empreitada entram no rateio com seus minutos e `valor: 0`. `intervaloExibicao` continua usando todos os blocos.
- `src/routes/financeiro-op.diaristas.index.tsx`: `EventoLinha` ganha `empeleita`; switch por bloco (aplicado a todas as linhas do bloco via `setBlocoHoras`), gravação/leitura no insert e no carregamento (`useApontamentoEventos`), e selo visual no card/detalhe.
- `src/lib/diaristas-pdf.ts` e o fechamento: rateio já traz `valor: 0` para esses blocos, então basta exibir o selo e garantir que os totais fechem.
