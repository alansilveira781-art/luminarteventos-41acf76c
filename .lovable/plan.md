# Almoço e janta no módulo Diaristas

## O que muda

**Apontamento (lançamento da diária)**
- Dois checkboxes no formulário: "Almoço" e "Janta", desmarcados por padrão.
- Quando marcados, o valor correspondente é somado ao total do dia daquele diarista.
- O resumo do cálculo no diálogo passa a mostrar a linha "Refeições" quando houver.

**Configurações — Diaristas**
- Novo bloco "Valores de refeição" (visível apenas para administradores do financeiro) com dois campos: valor do almoço e valor da janta.
- Valores gerais, aplicados a todos os diaristas.

**Listagem, Fechamento e PDF**
- O total por dia e o total do fechamento passam a incluir as refeições.
- Nova coluna/valor "Refeições" no detalhamento do fechamento e no relatório PDF.

## Detalhes técnicos

1. Banco:
   - `diarista_apontamentos`: colunas `almoco boolean not null default false` e `janta boolean not null default false`.
   - Nova tabela `diarista_config` (linha única) com `valor_almoco numeric default 0`, `valor_janta numeric default 0`, timestamps; GRANTs para `authenticated`/`service_role`, RLS: leitura para autenticados com acesso ao módulo, escrita apenas para admins do financeiro (mesmo padrão de `diarista_lancadores`).
2. `src/lib/diaristas-calc.ts`: `ApontamentoInput` ganha `almoco`/`janta`; `DiaristaTarifa` (ou parâmetro extra) recebe `valor_almoco`/`valor_janta`; `montarResultado` soma `refeicoes` e expõe o campo em `CalcResult`. O rateio por evento continua baseado somente nas horas — refeições ficam no total do dia.
3. `src/routes/financeiro-op.diaristas.index.tsx`: checkboxes no diálogo, persistência dos campos no insert/update, leitura da config via query, uso do novo total em listagem/fechamento e no mapeamento do PDF.
4. `src/routes/financeiro-op.diaristas.configuracoes.tsx`: card de configuração de valores com salvamento (upsert na linha única).
5. `src/lib/diaristas-pdf.ts`: coluna "Refeições" e ajuste das larguras para manter o A4 limpo.
