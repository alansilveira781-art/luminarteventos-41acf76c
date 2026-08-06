# Evento em destaque, análise por período e Prazo com semáforo

## 1. Seção "Evento" no card de Compras

No formulário de compra, hoje o evento/projeto é informado item a item. Quando pelo menos um item tiver evento preenchido, aparece uma nova seção **Evento** (fica oculta quando não há evento):

- Nome/código do evento
- Local e cidade/UF
- Período do evento: data de início → data de fim (destacado)
- Montagem e desmontagem, quando existirem
- Produtor

Os dados vêm da mesma fonte já usada no seletor de eventos (calendário + planilha). A mesma seção aparece na visualização do card (detalhe), não só na edição.

## 2. Análise "Compras x período do evento" no Dashboard de Compras

Nova seção no dashboard onde se seleciona um evento. As compras vinculadas a esse evento são classificadas em três grupos, pela data da compra (ou data de solicitação quando não houver data de compra):

- **Antes do evento** — anterior ao início (ou ao início da montagem, quando houver)
- **Durante o evento** — dentro do período início → fim
- **Depois do evento** — posterior ao fim (ou ao fim da desmontagem)

Exibição: três cartões com quantidade e valor total por grupo, um gráfico de barras comparativo e a lista das compras de cada grupo com número, fornecedor, data e valor.

## 3. Campo Prazo com indicador em bolinha

Novo campo **Prazo** (data) em:

- Formulário público `/solicitar`
- Quadro de Despesas (demandas)
- Quadro de Compras

Indicador no card (bolinha colorida, com tooltip mostrando a data e os dias restantes):

- **Vermelha** — prazo já vencido
- **Amarela** — faltam 2 dias ou menos
- **Verde** — falta mais tempo
- Sem bolinha quando não há prazo informado

O indicador aparece nos cards do Kanban de Compras, do Quadro de Despesas e no Quadro Financeiro, além do campo editável no detalhe do card.

## Detalhes técnicos

- Migração: adicionar coluna `prazo date` em `public.compras` e `public.demandas` (nullable). Sem mudança de RLS.
- Endpoint público `src/routes/api/public/solicitar.ts`: aceitar e validar `prazo` no payload; `src/routes/solicitar.tsx` ganha o input de data.
- Helper novo `src/lib/prazo.ts`: `prazoStatus(prazo)` → `vencido | proximo | ok | null` (comparação em fuso de Brasília via `src/lib/datetime.ts`) e componente `PrazoDot`.
- Cards: `src/routes/compras.index.tsx`, quadro de despesas e `src/routes/financeiro-op.quadro.tsx` renderizam `PrazoDot`.
- Seção Evento: novo componente `src/components/compras/EventoInfoCard.tsx`, alimentado pelas queries já existentes (`listEventos` da planilha + tabela `eventos`), reutilizando o casamento por código/nome já usado no combobox.
- Dashboard: nova seção em `src/routes/compras.dashboard.tsx` com seletor de evento reutilizando `EventoSheetCombobox` e agregação client-side sobre as compras já carregadas (join por `compra_itens.evento_projeto`).
