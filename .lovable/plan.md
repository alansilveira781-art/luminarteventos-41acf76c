## Objetivo

Dentro de Financeiro › Dashboard › aba **Uber**, criar subseções (como no Financeiro/Conta Azul): **Painel** (o dashboard atual) e **Análises** (novo relatório imprimível).

## Subseção Análises

Filtros no topo: período (de/até, com atalhos mês atual / últimos 3 meses / ano), solicitante e projeto — reaproveitando os filtros já existentes no componente Uber.

**Granularidade automática pelo tamanho do período:**

```text
até  14 dias   -> por dia
até  ~10 semanas (70 dias) -> por semana (seg–dom, rótulo "Sem 01/06–07/06")
até  ~3 anos   -> por mês  ("Maio/2026")
acima          -> por ano
```
Ex.: 01/05/2026 a 30/07/2026 (91 dias) cai em **mensal**. Um seletor manual "Automático / Dia / Semana / Mês" fica disponível para sobrepor.

**Cards de totais do período:** valor total, nº de corridas, ticket médio, solicitantes únicos, projetos distintos, média por período (mês/semana), maior período e menor período (com valor e rótulo), variação % do último período vs. anterior.

**Gráficos e tabelas:**
- Evolução no tempo: barras de valor + linha de quantidade de corridas (eixo duplo), por bucket.
- Rank por pessoa: barras horizontais top 10 por valor, mais tabela completa com corridas, total, ticket médio e % do total.
- Rank de projetos solicitados: barras horizontais top 10 + tabela com corridas, total e %.
- Índices de solicitação: quem/qual projeto mais solicita e quem/qual menos solicita (maior e menor por quantidade e por valor).
- Complementares: distribuição por serviço (pizza), top cidades, top destinos, distribuição por faixa de horário (madrugada/manhã/tarde/noite) e por dia da semana.

**Impressão:** botão "Imprimir" chamando `window.print()`, com cabeçalho de impressão (título, período, filtros aplicados, data de emissão), `@media print` em A4 retrato, filtros/tabs ocultos (`print:hidden`), quebras de página controladas entre blocos e tabelas legíveis em preto/branco — mesmo padrão já usado na Análise Detalhada do Conta Azul.

## Detalhes técnicos

- Novo arquivo `src/components/financeiro/UberAnalises.tsx` com toda a lógica de bucketização e agregações; helpers de bucket em `src/lib/uber/analises.ts` (puro, testável).
- `src/components/financeiro/UberDashboard.tsx` passa a renderizar `<Tabs>` com "Painel" e "Análises"; o conteúdo atual vai para a primeira aba sem alteração de comportamento. Os dados de `uber_corridas` continuam vindo do mesmo `useQuery` (`fetchAllRows`), compartilhados entre as subseções.
- Recharts já é usado no arquivo; nenhuma dependência nova. Nenhuma mudança de banco de dados.
