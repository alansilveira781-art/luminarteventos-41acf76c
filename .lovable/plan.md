## Objetivo
Fazer com que o Dashboard Comercial (`/comercial/dashboard`) exiba o **Painel de Vendas** no formato exato da imagem enviada, como conteúdo padrão da rota.

## Situação atual
- A rota `/comercial/dashboard/painel` (`src/routes/comercial.dashboard.painel.tsx`) já contém todo o painel exatamente como o mockup: 4 KPIs (Vendas Totais, Quantidade, Desconto, Ticket Médio) com "Período Anterior" + "% LY", Evolução por Trimestre, Ranking Consultores, Valor por Classificação, Ticket Médio com eixo duplo e Gauge Real vs Meta.
- A rota index (`/comercial/dashboard/`) hoje mostra apenas um card de "Vendas Totais" como stub — é o que o usuário está vendo agora.
- A sidebar aponta para `/comercial/dashboard`, então o usuário cai no stub.

## Mudança
Substituir o conteúdo do arquivo `src/routes/comercial.dashboard.index.tsx` pelo mesmo componente/layout do Painel de Vendas (aproveitando `kpis`, `evolucaoTrimestre`, `evolucaoTicketTrimestre`, `rankingConsultor`, `valorPorClassificacao`, `GaugeRealVsMeta`, `KpiCard`, `FiltrosBar` — tudo já existente).

Assim, ao entrar em **Comercial → Dashboard**, o usuário verá diretamente o Painel de Vendas com:
- Filtros no topo: Empresa, Ano, Mês
- 4 KPI cards (valor + Período Anterior + % LY)
- Evolução de Vendas [Trimestre] (linha)
- Evolução do Ticket Médio [Trimestre] (linha com eixo duplo Ticket × Quantidade)
- Ranking Consultores (barras horizontais)
- Valor Final por Classificação (barras horizontais)
- Real vs Meta (gauge semicircular)

Nenhum componente novo será criado; nenhum cálculo é alterado.

## Observação
A rota antiga `/comercial/dashboard/painel` continua existindo. Posso removê-la depois se você quiser, mas não é necessário para atender ao pedido.

## Confirmar
Ok fazer com que o Dashboard Comercial padrão já abra nesse Painel de Vendas?