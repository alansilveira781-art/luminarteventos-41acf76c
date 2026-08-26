# Produtores unificados + relatório PDF do Uber

## 1. Produtores no calendário de Eventos

Hoje existem duas listas de produtores: a de Eventos > Configurações (só "Matheus Fernandes") e a de Financeiro > Bonificação ("Romulo Manoel" e "Matheus Fernandes"). O formulário do evento lê a lista da Bonificação, então quem é cadastrado em Eventos > Configurações não aparece — é essa a causa do problema.

Unificação escolhida: a lista da Bonificação passa a ser a única fonte.

- A tela Eventos > Configurações continua existindo, mas passa a criar, editar e excluir os produtores da mesma lista da Bonificação. O que for cadastrado ali aparece imediatamente no calendário e na Bonificação, e vice-versa.
- Os nomes hoje existentes só na lista antiga são copiados para a lista única (sem duplicar nomes iguais).
- Eventos já salvos mantêm o nome do produtor; onde o nome bater com a lista única, o vínculo é reaproveitado.
- O checkbox de produtor terceirizado (PJ) continua funcionando como está.

## 2. Relatório do Uber em PDF

A seção Uber (Financeiro > Dashboard e página Uber) hoje usa a impressão do navegador. Passa a gerar um PDF real, no mesmo padrão do relatório do Painel Financeiro:

- Cabeçalho com logo Luminart, título "Relatório Uber", período filtrado e data de emissão.
- Paleta Grafite + Âmbar, rodapé com numeração de páginas.
- Conteúdo: cards de indicadores (total gasto, nº de corridas, ticket médio, usuários), gráficos de evolução convertidos em imagem, e tabelas de ranking (por colaborador, por cidade/tipo) com quebras de página corretas.
- Botão "Imprimir" vira "Exportar PDF"; as regras de `@media print` antigas do Uber são removidas.

## Detalhes técnicos

- `src/routes/eventos.configuracoes.tsx`: trocar as queries/mutações da tabela `produtores` por `comercial_produtores` (campos `nome`, `ativo`), invalidando também `comercial-produtores-ativos`.
- `src/routes/eventos.index.tsx`: manter a leitura de `comercial_produtores`, filtrando `ativo`.
- Migração de dados (`run_sql`): inserir em `comercial_produtores` os nomes de `produtores` ainda inexistentes; preencher `eventos.produtor_id` por casamento de nome quando estiver nulo e não for terceirizado. A tabela `produtores` fica intacta (sem uso na UI).
- Novo `src/lib/uber/uber-pdf.ts` com jsPDF + autotable, reaproveitando o cabeçalho/paleta de `src/lib/conta-azul/painel-pdf.ts` e `src/lib/financeiro/chart-colors.ts`; gráficos capturados dos containers Recharts via canvas.
- `UberDashboard.tsx` e `UberAnalises.tsx`: substituir `window.print()` e os blocos `@media print` pela chamada do novo gerador.
