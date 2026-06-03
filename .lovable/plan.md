## Observação importante sobre a fonte de dados

Você escolheu **Extrato bancário (ca_extrato)** como fonte de verdade. Conferindo o banco agora: **a tabela `ca_extrato` está vazia** (0 linhas). A Conta Azul só está liberando para a API o que está em `ca_contas_pagar` e `ca_contas_receber`.

Proposta equivalente (regime de caixa, que é o que o extrato representaria):
- Usar `ca_contas_pagar` e `ca_contas_receber` com `status = 'pago'` e `data_pagamento` no período.
- Excluir transferências bancárias (já implementado em `isTransferencia`).
- Se quiser ligar a sincronia do extrato depois, o painel passa a usar `ca_extrato` sem reescrever nada (basta trocar a função de leitura).

Se em vez disso você quiser conciliar 100% com o relatório oficial do Conta Azul, me envie um print de uma linha da DRE oficial (ex.: Receita Bruta 2025 com as 6 categorias detalhadas) para eu calibrar exatamente.

## Layout (igual à imagem)

````text
┌─────────────────────────────────────────────────────────────────┐
│ Painel Financeiro                            [Ano ▾] [Mês ▾]    │
├──────────┬──────────┬──────────┬──────────┬─────────────────────┤
│ Receita  │ Pot.     │ Despesas │ Custos   │ Lucro               │
│ Bruta 🐷 │ Vendas 👥│   🏢     │   📈     │   🌱                │
│ R$ ...   │ R$ ...   │ R$ ...   │ R$ ...   │ R$ ...              │
│ %Receita │ %PV      │ %Despesa │ %Custos  │ %Lucro              │
│  vs LY   │ vertical │ vertical │ vertical │ vertical            │
├──────────┴──────────┴────┬─────┴──────────┴─────────────────────┤
│ Demonstrativo  Valores % │ Data | Fornec/Cliente | Descr | Vlr  │
│ (+) Receita Bruta        │ ────────────────────────────────────  │
│    Cenografia            │ (lista filtra ao clicar numa          │
│    Corporativos          │  categoria do Demonstrativo)          │
│    ...                   │                                       │
│ (-) Deduções da Receita  │ Total: R$ ...                         │
│    ...                   │                                       │
└──────────────────────────┴───────────────────────────────────────┘
````

## Mudanças (frontend apenas)

**`src/components/financeiro/ContaAzulDashboard.tsx`** — reescrever o componente `PainelFinanceiro`:

1. **Filtros no topo direito:** `Ano` (2023…ano atual) e `Mês` (Todos, Janeiro…Dezembro). Default: último ano com dados.

2. **5 cards superiores** com ícones (lucide: `PiggyBank`, `Users`, `Building2`, `BarChart3`, `Sprout`). Cada card mostra o valor grande e um subtexto com %:
   - **Receita Bruta** = RB. Subtexto: `% Receita LY: (RB_ano − RB_anoAnterior) / RB_anoAnterior` (verde se ≥0, vermelho se <0).
   - **Pot. de Vendas** = −(AC + DM + DC). Subtexto: `% PV: PV / RB` (vertical).
   - **Despesas** = −(DS + DA + DT). Subtexto: `% Despesa: Despesas / RB`.
   - **Custos** = −(CV + CD + CI). Subtexto: `% Custos: Custos / RB`.
   - **Lucro** = linha `LU` do DRE. Subtexto: `% Lucro: Lucro / RB`.

3. **Tabela Demonstrativo (esquerda, ~40% da largura):**
   - 3 colunas: `Demonstrativo | Valores | %` (% vertical em relação a RB).
   - Linhas de grupo expansíveis com `+/−` (Receita Bruta, Deduções, AC, DM, DC, CV, CD, CI, DS, DA, DT, RF, DF, OE, OS, IN) listando categorias por baixo.
   - Linhas de subtotal calc (Receita Líquida, Resultado Venda, Operação, Gerencial, Financeiro, Não Operacional, Negócio, Lucro) em negrito, sem expandir.
   - Sem `max-height` interno na tabela (rolagem natural da página).

4. **Lista lateral (direita, ~60% da largura):**
   - Colunas: `Data movimento | Nome do fornecedor/cliente | Descrição | Valor Total`.
   - Mostra todos os lançamentos do período (pagar+receber, `status='pago'`, por `data_pagamento`, excluindo transferências) quando nada está selecionado.
   - Ao clicar numa **categoria filha** no Demonstrativo, filtra por `categoria_external_id`. Clicar de novo (ou em outra) troca/limpa a seleção. Header visual destacando o filtro ativo + botão `× limpar`.
   - Linha `Total` fixa no rodapé somando o que está visível.

5. **Cálculos:** reaproveitar `montarDRE` em modo `realizado`, e ler `totais.RB`, `totais.LU`, etc. Para o card "ano anterior" (Receita LY), chamar `montarDRE` uma segunda vez com `{ ano: ano−1, mes }`.

6. **Queries:** uma `useQuery` por tabela (planos, pagar, receber) — já existe `useContaAzulData`; só preciso garantir que `pagar`/`receber` tragam `fornecedor_nome`/`cliente_nome`, `data_pagamento`, `categoria_external_id` e `descricao` (já estão no tipo).

## Detalhes técnicos

- **Comparação YoY:** se `RB_anterior = 0`, mostrar `—` em vez de `∞%`.
- **Cores dos %:** verde `text-emerald-600` para ≥0 no card Receita; vermelho `text-rose-600` para <0. Demais % verticais sempre em cinza neutro.
- **Ordem do detalhamento por categoria** dentro de cada grupo: ordem alfabética (igual à imagem: Cenografia, Corporativos, Móveis Planejados, …).
- **Sem alteração no `dre.ts`** — só leitura de `totais` já expostos.
- Cards de auditoria de "Transferências ignoradas" e "Conferência vs Extrato" continuam abaixo do bloco principal (não afetam a paridade visual com a imagem).

## Fora de escopo neste ciclo

- Sincronizar `ca_extrato` (precisa de ajuste no `sync.server.ts` da Conta Azul).
- Aba "Análise Detalhada" e "Fluxo de Caixa" — ficam como estão.
- Drill-down por grupo (apenas categoria filha filtra a lista lateral).