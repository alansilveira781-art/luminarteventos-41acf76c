# Unificar Aquisições dentro do Quadro de Compras

O módulo Aquisições deixa de existir para os usuários. Todo o fluxo passa a acontecer no Quadro de Compras, onde cada card é de um dos dois tipos: **Compra** ou **Aquisição**. Os dados atuais continuam intactos e acessíveis (a tela antiga fica visível só para os administradores mestres).

## 1. Novo card: escolher o tipo

- O botão "Nova compra" abre uma escolha rápida: **Compra** ou **Aquisição**.
- **Compra** → abre o card de compra atual, sem mudanças.
- **Aquisição** → abre exatamente o card de aquisição de hoje, com todos os comportamentos que ele já tem: tipos de aquisição, grade de itens com cotação/desconto/IPI/frete, anexos, pagamentos, evento/centro de custo, e o envio para Estoque / Patrimônio quando o tipo exige recebimento.
- Identificação: cards de compra continuam `COMPRA-01`; cards de aquisição aparecem como `DEMANDA-01` em todo o quadro, nas listagens, no detalhe e nas telas de recebimento.

## 2. Quadro unificado

- O Quadro de Compras passa a listar os dois tipos lado a lado nas mesmas colunas de status.
- Das aquisições vêm apenas os cards **não finalizados** (o histórico finalizado/negado permanece na tela antiga).
- Cada card mostra visualmente a qual tipo pertence (etiqueta COMPRA / DEMANDA), e a busca e os filtros do quadro funcionam para os dois.
- Mover, avançar, retornar, prazos (semáforo), notificações de responsável e regras de permissão continuam valendo — cada card segue as regras do seu próprio tipo.
- Toda a comunicação com Estoque e Patrimônio ("A Receber") continua igual: as aquisições que geram entrada seguem para as telas de recebimento como hoje.

## 3. Prévia de valor na seleção múltipla

- Ao marcar dois ou mais cards, a barra de ações em massa passa a exibir o **total somado** dos valores dos cards selecionados (e a quantidade), formatado em reais, atualizando conforme a seleção muda.

## 4. Acesso ao módulo antigo

- O grupo "Aquisições" no menu (Dashboard, Quadro de Aquisições, Configurações) fica visível **somente para administradores mestres**.
- As rotas correspondentes passam a bloquear quem não é administrador mestre, redirecionando para o início.
- Nada é apagado: todos os cards, itens, anexos e pagamentos continuam no banco e continuam consultáveis por você.

## Detalhes técnicos

- Sem migração de dados: os cards de aquisição continuam na tabela `demandas`; o quadro faz uma leitura adicional e normaliza os dois tipos num modelo comum com campo `origem: "compra" | "demanda"`.
- `src/routes/compras.index.tsx`: nova query de `demandas` (filtrando `status not in (finalizado, negada)`), tipo `QuadroCard` unificado, roteamento do clique para `CompraDialog` ou `DemandaDialog`, drop/avançar usando a mutation correta por origem (`compras` usa `move_compra_status`; `demandas` mantém o update atual do quadro de aquisições), e reaproveito de `canMoveCompra` / regras de `src/lib/demandas.ts` conforme a origem.
- Dialog de escolha de tipo antes de abrir o formulário; `DemandaDialog` é reutilizado sem alterações de comportamento.
- Barra de seleção: soma de `valor_total` dos ids selecionados, exibida em `BulkActionsBar` via nova prop opcional (`summary`), sem alterar os outros usos.
- Sidebar: itens do grupo "Aquisições" ganham condição de `isMasterAdmin`; `src/routes/financeiro.tsx` (layout) passa a exigir master admin.
- Realtime: `useEstoqueRealtimeSync` já invalida `demandas` e `compras`, então o quadro unificado atualiza sozinho.
