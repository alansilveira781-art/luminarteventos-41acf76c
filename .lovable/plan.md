# Histórico de faturamento da Luminart Tecnologia + faturamento automático pela Apuração

A declaração enviada pela contabilidade traz o faturamento mês a mês da Luminart Tecnologia para Eventos LTDA (12/2025 a 07/2026). Esse histórico vai para a base da Projeção Tributária, e a partir de 08/2026 o faturamento mensal deixa de ser digitado: passa a ser lido das notas lançadas na Apuração de Impostos.

## 1. Histórico lançado (12/2025 a 07/2026)

Gravar em Faturamento fiscal da Luminart Tecnologia, exatamente como na declaração:

| Competência | Receita bruta |
|---|---|
| 12/2025 | R$ 0,00 |
| 01/2026 | R$ 43.881,78 |
| 02/2026 | R$ 43.881,78 |
| 03/2026 | R$ 0,00 |
| 04/2026 | R$ 415.829,89 |
| 05/2026 | R$ 280.000,00 |
| 06/2026 | R$ 35.390,00 |
| 07/2026 | R$ 379.487,50 |

Total R$ 1.198.470,95 — confere com a declaração. Folha bruta fica zerada até que seja informada.

Também completo o cadastro fiscal da empresa com o CNPJ 64.203.161/0001-65 da declaração.

## 2. A partir de 08/2026 — faturamento vem da Apuração

Hoje a Projeção Tributária só enxerga o que foi digitado na tela de faturamento. Passa a funcionar assim:

- Cada empresa fiscal ganha um vínculo com a empresa usada na Apuração (Luminart Eventos / Planejados / Tecnologia).
- Para competências a partir de 08/2026, a receita do mês é a soma das notas emitidas naquele mês na Apuração de Impostos (por data de emissão), ignorando rascunhos e canceladas.
- Meses até 07/2026 continuam vindo do histórico lançado (fonte: declaração contábil).
- Se um mês a partir de 08/2026 tiver lançamento manual, o manual prevalece — serve como correção pontual.

Na tela de Configurar empresas e faturamento, cada linha mostra de onde veio o número: "Declaração/manual" ou "Apuração (X notas)". Na memória de cálculo da projeção, o RBT12 passa a declarar a origem de cada competência.

## Detalhes técnicos

- Migração: coluna `empresa_ref text` em `fiscal_empresas` (valores "Luminart Eventos", "Luminart Planejados", "Luminart Tecnologia") e `cnpj` preenchido para a Tecnologia.
- Inserção das 8 competências em `fiscal_faturamento` (empresa Tecnologia), via tool de dados.
- Corte configurável por constante `FATURAMENTO_AUTO_A_PARTIR_DE = "2026-08-01"`.
- `src/routes/contabil.projecao.tsx` e `contabil.projecao-empresas.tsx`: além de `fiscal_faturamento`, buscar `contabil_notas_fiscais` (empresa, `data_emissao`, `valor_bruto`, `status`) e mesclar por competência antes de chamar o motor.
- `src/lib/fiscal/engine.ts` permanece puro; recebe a série já mesclada, com o rótulo de origem para a memória de cálculo.
