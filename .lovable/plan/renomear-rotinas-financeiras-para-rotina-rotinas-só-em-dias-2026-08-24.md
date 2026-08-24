# Renomear "Rotinas Financeiras" para "Rotina", rotinas só em dias úteis, e "Despesas" para "Aquisições"

## 1. Rotinas

- O menu lateral e o título das telas passam a exibir apenas **Rotina** (hoje "Rotinas Financeiras").
- As rotinas passam a ocorrer **somente de segunda a sexta**:
  - No calendário e na aba Execução, sábado e domingo nunca exibem rotinas.
  - Na escolha de dias da semana do formulário, Sáb e Dom ficam desabilitados; seleções antigas de fim de semana são ignoradas.
  - O cálculo automático de próxima data pula fim de semana (empurra para a segunda-feira seguinte).
- Rotinas esporádicas (sob demanda) continuam podendo ser registradas em qualquer data, pois não têm agenda fixa.

## 2. Despesas passa a se chamar Aquisições

Troca do nome em todo o sistema, mantendo os endereços atuais das páginas (nenhum link antigo quebra):

- Menu lateral: grupo "Despesas" vira **Aquisições**; "Quadro de Despesas" vira **Quadro de Aquisições**.
- Nome do módulo no cadastro de permissões (Administração > Módulos) passa a ser **Aquisições**.
- Códigos exibidos: `DESPESA-123` passa a `AQUISIÇÃO-123` (mesma numeração), em todas as telas onde aparece: quadro de aquisições, patrimônio (a receber), estoque (a receber), meus pedidos, relatórios e exportações.
- Formulário público de solicitação (`/solicitar`): textos "despesa" passam a "aquisição" (tipo de solicitação, mensagens de validação e confirmação).
- Demais rótulos visíveis: diálogo de cadastro/edição, tipos de despesa ("Tipo de aquisição"), abas de dashboard, migração de card de compra, relatórios e ferramentas de consulta.

O que **não** muda de nome: o módulo Financeiro (Financeiro Operacional), o Dashboard financeiro/Conta Azul e os grupos contábeis do DRE ("Despesas Administrativas", "Despesas Tributárias" etc.), que são termos contábeis.

## Detalhes técnicos

- Telas de rotinas (`src/routes/financeiro.rotinas.tsx` e `src/routes/financeiro-op.rotinas.tsx`, hoje quase idênticas): `occursOn()` retorna `false` para `getDay() === 0 || 6`; chips de dias da semana desabilitados para 0 e 6; título via `PageHeader`.
- Migração: atualizar as funções `primeira_data_rotina` e `calcular_proxima_data_rotina` para avançar a data quando cair em sábado/domingo.
- Migração de dados: `update modulos set nome = 'Aquisições' where slug = 'financeiro'`; limpar índices 0 e 6 de `financeiro_rotinas.dias_semana`.
- Renomeação de textos apenas em camada de apresentação: `AppSidebar.tsx`, `financeiro-op.quadro.tsx`, `patrimonio.a-receber.tsx`, `estoque.a-receber.tsx`, `meus-pedidos.tsx`, `solicitar.tsx`, `DemandaDialog.tsx`, `NovoTipoDespesaDialog.tsx`, `useTiposDespesa.ts`, `src/lib/demandas.ts`, relatórios/exportações e ferramentas MCP (`listar-despesas` mantém o nome técnico da ferramenta, muda a descrição).
- Tabelas, colunas, rotas e slugs de módulo permanecem como estão (`demandas`, `demanda_itens`, `/financeiro`, slug `financeiro`) para não quebrar dados e integrações.

## Verificação

Abrir Rotina (calendário e execução) e confirmar ausência de sábados/domingos; abrir o Quadro de Aquisições, um card, patrimônio a receber e o formulário público e confirmar o código `AQUISIÇÃO-nnn` e os novos rótulos.
