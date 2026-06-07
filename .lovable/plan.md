## Objetivo

Levar a estrutura da planilha (`Estrutura.xlsx`) para o banco de dados e fazer o **DRE / Resumo Gerencial** (aba "Conta Azul" do módulo Financeiro) ler diretamente do banco, em vez de um array fixo no código.

A estrutura tem 24 linhas, na ordem oficial: Receita Bruta → Deduções → Receita Líquida → Aquisição de Clientes → Marketing → Comerciais → Resultado de Venda → Custos Variáveis/Diretos/Indiretos → Resultado da Operação → Despesas com Sócio/Administrativas/Tributárias → Resultado Gerencial → Receitas/Despesas Financeiras → Resultado Financeiro → Outras Entradas/Saídas → Resultado Não Operacional → Resultado do Negócio → Investimentos → Lucro.

Cada linha tem: código (RB, DR, AC, DM, DC, CV, CD, CI, DS, DA, DT, RF, DF, OE, OS, IV), rótulo, tipo (soma ou cálculo de subtotal), sinal (+/-) e, quando for subtotal, a fórmula (lista de códigos somados).

## O que vai mudar

### 1. Nova tabela `ca_dre_estrutura`
- Campos: ordem, código, label, tipo (`sum` | `calc`), sinal (+1/-1), prefixos do plano de contas (array), fórmula (array de códigos), ativo.
- Acesso de leitura para qualquer usuário autenticado; escrita só para admin.
- Seed com as 24 linhas exatamente como na planilha.

### 2. Leitura no app
- `src/lib/conta-azul/dre.ts`: a função `montarDRE` passa a aceitar a estrutura como parâmetro (em vez de usar a constante fixa). A constante atual vira **fallback** caso o banco esteja vazio/offline.
- Novo hook `useDreEstrutura()` em `src/hooks/` que busca as linhas via React Query e devolve no formato esperado.
- `ContaAzulDashboard.tsx` passa a usar o hook e injeta a estrutura no `montarDRE`. O cálculo, a expansão por categoria e os percentuais continuam iguais.

### 3. Sem mudanças visuais
- Mesmo layout, mesma ordem, mesmos rótulos. A diferença é só a fonte (banco em vez de código). Se no futuro alguém quiser ajustar um rótulo ou inativar uma linha, isso pode ser feito direto no banco.

## Detalhes técnicos

```text
ca_dre_estrutura
├── id (uuid, pk)
├── ordem (int, unique)         -- 1..24
├── codigo (text, unique)       -- "RB","DR","RL","AC",...,"LU"
├── label (text)                -- "(+) Receita Bruta", etc.
├── tipo (text)                 -- "sum" | "calc"
├── sinal (int)                 -- 1 ou -1 (ignorado p/ calc)
├── prefixos (text[])           -- ex.: {"RB"} ou {"OE","OR"}
├── formula (text[])            -- ex.: {"RB","DR"} para RL
├── ativo (bool, default true)
├── created_at / updated_at
```

RLS:
- `SELECT` para `authenticated`
- `INSERT/UPDATE/DELETE` apenas para admin (`is_admin(auth.uid())`)
- `GRANT SELECT … TO authenticated; GRANT ALL … TO service_role`

Seed (24 linhas) reproduz exatamente o conteúdo atual de `DRE_STRUCTURE` em `src/lib/conta-azul/dre.ts`.

## Fora do escopo

- Editor de estrutura na UI (pode ser feito depois).
- Alterações em Contas a Pagar/Receber, plano de contas, extrato ou sincronização Conta Azul.
- Mudanças no mapeamento por nome (overrides como "IRRF" → DT continuam no código por ora).
