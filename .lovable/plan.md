
## Diagnóstico

**Por que só 7/10 parcelas do COMPRA-755 estão no banco?**
Não é filtro por status. O sync do Conta Azul usa um range `date_from → date_to` sobre a **data de vencimento**. O último sync foi rodado com `date_to = 2026-12-31`, então as parcelas 8, 9 e 10 (vencimento jan/fev/mar 2027) nunca foram trazidas. O default do formulário de Carga Histórica é `to = ontem`, o que é ruim para compromissos parcelados com vencimentos futuros.

## Escopo

### 1. Estender o horizonte de sincronização (backend + UI)

- Em `src/routes/financeiro-op.conta-azul.tsx` (e `financeiro.conta-azul.tsx`), mudar o default de `to` no `CargaHistoricaCard` para **hoje + 3 anos**, garantindo que parcelamentos longos sejam trazidos por padrão.
- Adicionar uma nota curta no card: "Inclua datas futuras para trazer parcelas ainda não vencidas."
- Rodar imediatamente uma sincronização de `contas_pagar` e `contas_receber` com `to = 2029-12-31` para trazer as 3 parcelas faltantes do COMPRA-755 (e qualquer outro parcelamento longo). Essa sincronização também aproveita a reconciliação já implementada, então nada será duplicado.

### 2. Agrupar parcelamentos ao clicar em rubrica

Aplica-se **somente** na tabela de lançamentos exibida na "Análise Detalhada" do `ContaAzulDashboard.tsx` — KPIs e Painel Financeiro continuam contando parcela a parcela (competência/caixa).

**Regra de agrupamento** (via descrição, já que o CA não expõe um id de parcelamento):
- Regex de detecção: `^(\d+)\/(\d+) - (.+?) \1\/\2$` na `descricao`.
- Se casar → chave de grupo = `${fornecedor_nome}||${descricao_base}||${valor_arredondado}` (o valor pode variar em centavos entre parcelas; arredondar para agrupar).
- Se não casar → o lançamento fica sozinho (não agrupa).

**Linha agregada exibida:**
- **Descrição**: `descricao_base` + badge cinza `10x` (mostra o `M` do padrão N/M).
- **Valor**: soma de **todas** as parcelas encontradas no banco. Se `linhas.length < M` (faltam parcelas no banco), badge amarelo `Faltam N parcelas` para o usuário saber que o horizonte de sync não cobriu tudo.
- **Data**: range `10/06/2026 → 10/03/2027` (primeira → última parcela).
- **Status agregado**:
  - Todas pagas → verde "Pago"
  - Todas em aberto → cinza "Em aberto"
  - Misto → azul `X/M pagas`
- **Expansível**: clicar na linha revela as parcelas individuais (mantém rastreabilidade).

### 3. Fora de escopo

- Não alterar KPIs, Painel Financeiro, DRE Caixa, gráficos — todos continuam somando parcela a parcela pela data de vencimento/pagamento.
- Não mexer em `contas_receber` para agrupamento (mesma lógica pode ser adicionada depois; aplicando o mesmo padrão de descrição).

## Detalhes técnicos

- Novo helper `agruparParcelamentos(rows)` em `src/lib/conta-azul/agrupar-parcelas.ts` (função pura, testável, sem side effects).
- No `ContaAzulDashboard.tsx`, apenas a tabela detalhada por rubrica passa `rows` pela função antes de renderizar. Um `useMemo` cuida disso.
- A linha agregada usa um id sintético `grp:${chave}` para o `key` do React; ao expandir, mapeia para os `external_id` originais.
- Não requer migração de banco.

## Arquivos a editar

- `src/routes/financeiro-op.conta-azul.tsx` — default `to = hoje + 3y`, nota no card.
- `src/routes/financeiro.conta-azul.tsx` — idem.
- `src/lib/conta-azul/agrupar-parcelas.ts` — novo helper.
- `src/components/financeiro/conta-azul/ContaAzulDashboard.tsx` (ou onde estiver a tabela da Análise Detalhada) — aplicar agrupamento + linha expansível.

## Verificação

1. Após rodar o sync com `to = 2029-12-31`, `SELECT COUNT(*) FROM ca_contas_pagar WHERE descricao ILIKE '%COMPRA-755%'` deve retornar **10**.
2. Na Análise Detalhada, ao clicar na rubrica "Móveis planejados", aparece **1 linha** "Móveis planejados - Armários - COMPRA-755" com valor R$ 12.370,58, range jun/2026 → mar/2027, badge "1/10 paga".
3. Expandindo a linha, aparecem as 10 parcelas originais.
