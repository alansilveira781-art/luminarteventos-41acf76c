# Impostos e Uber na Análise Detalhada

Na aba Financeiro > Análise Detalhada, ao selecionar um evento no dropdown, passam a entrar dois blocos novos, somados ao DRE do evento:

## 1. Impostos em "(-) Deduções da Receita"

- Base: os recebimentos registrados na aba Contábil (Contábil > Recebimentos), filtrados pelo **evento** informado em cada registro e pela **empresa** de cada recebimento.
- Para cada empresa, aplicam-se as alíquotas ativas cadastradas em Contábil > Configuração (mesma fórmula já usada na Apuração, incluindo o adicional de IRPJ quando houver).
- Resultado: 4 linhas separadas dentro de Deduções da Receita — **IRPJ**, **CSLL**, **PIS**, **COFINS** — com o valor apurado do evento.
- Quando um evento tem recebimentos de mais de uma empresa, os valores são calculados por empresa e somados por imposto.
- Ao clicar em uma dessas linhas, a lista de lançamentos abaixo mostra o detalhamento: um item por recebimento (data, NF, empresa, valor do imposto).

## 2. Uber em "(-) Custos Diretos"

- Uma linha chamada **Uber** dentro de Custos Diretos, com o total gasto nas corridas cujo projeto casa com o evento selecionado.
- Sem filtro de período — considera todas as corridas do evento, igual às saídas de estoque.
- Clicando na linha, os lançamentos listam cada corrida (data, nome do passageiro, trajeto/serviço, valor).

## Observações

- Os percentuais verticais, os cards de indicadores e o total de Lucro passam a considerar esses valores automaticamente.
- A impressão/PDF da Análise Detalhada segue funcionando com as novas linhas.
- Nada muda no Painel Financeiro, nos Indicadores nem na aba Contábil — o cálculo é só de leitura.

## Detalhes técnicos

- Arquivo principal: `src/components/financeiro/ContaAzulDashboard.tsx` (componente `AnaliseDetalhada`), reaproveitando o padrão já existente do merge de saídas de estoque (`stockAgg` → `grupos`/`totais`).
- Novas queries no componente:
  - `contabil_recebimentos` (empresa, nome_evento, valor_recebido, data_recebimento, numero_nf, nota_id) + `contabil_notas_fiscais` para o nome do evento quando o recebimento não tiver;
  - `contabil_configuracao_aliquotas` (ativas, por empresa);
  - `uber_corridas` (data_solicitacao, nome, sobrenome, servico, projeto, valor, endereços).
- Casamento com o evento pelo mesmo `centroNeedle` + `rowMatchesText` usado no estoque (tolerante a prefixo de data/número e acentos).
- Cálculo dos impostos via `calcularImpostosPresumido` de `src/lib/contabil/calculo.ts`, agrupando os recebimentos do evento por empresa.
- Chaves sintéticas de rubrica no padrão já usado (`stock:`): `imposto:IRPJ`, `imposto:CSLL`, `imposto:PIS`, `imposto:COFINS` no grupo `DR`, e `uber:total` no grupo `CD`, com rótulos injetados em `planoMapExt`.
- As linhas de detalhe entram em `lancamentos` para alimentar a lista clicável, com sinal negativo.
