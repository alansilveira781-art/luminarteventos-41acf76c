# Associação Plano de Contas × Estrutura do DRE

Hoje 18 contas do plano não têm prefixo (`XX -`) e caem como "Sem classificação". Vou adicionar um override por nome em `src/lib/conta-azul/dre.ts` para classificá-las nas linhas corretas do DRE conforme suas respostas.

## Mapeamento confirmado

| Conta no Plano | Linha DRE |
|---|---|
| IRRF | DT — Despesas Tributárias |
| ISS | DT |
| PIS/COFINS/CSLL | DT |
| Impostos retidos em vendas | DT |
| Descontos incondicionais concedidos | DR — Deduções da Receita |
| Descontos incondicionais obtidos | OE — Outras Entradas |
| Descontos financeiros concedidos | DF — Despesas Financeiras |
| Descontos financeiros obtidos | RF — Receitas Financeiras |
| Juros pagos | DF |
| Juros recebidos | RF |
| Tarifas | DF |
| Multas pagas | DF |
| Multas recebidas | OE |
| Fretes pagos | OS — Outras Saídas |
| Fretes recebidos | OE |
| Perdas | CD — Custos Diretos |
| Compra | OS |
| Receitas a Identificar | OE |

## Alterações técnicas

**`src/lib/conta-azul/dre.ts`**
1. Criar `NOME_OVERRIDE: Record<string, DreGroupId>` com os 18 nomes acima (chave normalizada em lowercase/trim, sem acentos).
2. Atualizar `grupoDoPlanoNome(nome)`:
   - normalizar `nome` (trim + lowercase + remover acentos);
   - se existir em `NOME_OVERRIDE`, retornar esse grupo;
   - senão, manter o comportamento atual (extrair prefixo `^([A-Z]{2,3})\s*-`).
3. Manter `isTransferencia()` como está (continua filtrando transferências/saldo inicial antes da classificação).

Nenhuma mudança no schema do banco, nem na UI do Dashboard — o reflexo será imediato no DRE e na Conferência vs Extrato.

## Validação após implementar

- Conferir que a linha "(?) Sem classificação" do DRE fica vazia (ou só com contas realmente não previstas).
- Conferir que DT, DF, RF, OE, OS, CD, DR variam após o override.
