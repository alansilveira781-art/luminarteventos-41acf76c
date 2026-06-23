## Diagnóstico

A aba "Vendas" do módulo Comercial diverge da planilha `MODELO VENDAS.xlsx` porque a tabela `comercial_vendas` está com dados defasados em relação à aba "Base de Dados":

| Métrica | Planilha (Base de Dados) | Banco (`comercial_vendas`) |
|---|---|---|
| Linhas válidas | ~1.001 (1.008 brutas, ~7 vazias/lixo) | 1.050 |
| Soma `Valor Final` | R$ 33.728.127,02 | R$ 34.696.997,88 |
| Soma `Valor BV` | R$ 727.921,14 | R$ 537.264,22 |
| Soma `Valor Comissão` | (consultor) R$ 728.978,12 | 0 |

Ou seja: o banco tem ~49 linhas a mais, valores finais inflados em ~R$ 1M, BV defasado em ~R$ 190K e comissão zerada. O schema do banco já tem todas as colunas necessárias (`status_bv_rt`, `cont_cerimonial`, `cont_decorador`, `valor_comissao`), então não precisa de migration.

## Plano

1. **Limpar dados sujos da planilha em memória** — descartar linhas onde `Tipo`, `Empresa`, `Ano` ou `Valor Final` são `" "` (string em branco) ou todos NaN, sem `Nome do Evento` e sem `Valor Final`.
2. **Truncar `comercial_vendas`** (a tabela é derivada da planilha — não há dados de origem aplicacional a preservar).
3. **Reimportar 100% das linhas** da aba "Base de Dados" usando o parser que já existe em `src/lib/comercial/vendas-parse.server.ts`, mas reforçando o mapeamento das colunas novas:
   - `Cont. Cerimonial` → `cont_cerimonial`
   - `Cont. Decorador` → `cont_decorador`
   - `Status BV/RT` → `status_bv_rt`
   - `Comissão Consultor` → `comissao_consultor` (numérico; quando vier `False`/`True`, gravar 0/1 mantendo o comportamento atual)
   - Derivar `valor_comissao` = `comissao_consultor` quando ele for um valor monetário (>1), senão 0 — isso é o que zera hoje no banco e quebra o ranking de comissões.
4. **Recalcular `mes_evento`, `ano_evento`, `trimestre_evento`** a partir de `data_evento` (fallback `data_registro`).
5. **Invalidar caches do React Query** das duas queryKeys (`["comercial-vendas-db"]` da aba Vendas e `["comercial-vendas-db-dashboard"]` do Dashboard) — apenas instrução; nenhuma alteração de código de front é necessária se a importação for feita server-side.

## Como executar a reimportação

Opção A (recomendada, sem alterar UI): rodar a importação via script único usando o parser existente:
- Copiar o XLSX para `/tmp`, ler com o mesmo `parseVendasXlsx`, gerar `INSERT` em lote em `comercial_vendas` após `TRUNCATE`.

Opção B: usar a tela de importação que já existe no módulo (se houver botão "Importar planilha" na aba Vendas) — confirma com você qual prefere.

## Detalhes técnicos

- A constraint `comercial_vendas_chave_unica (nome_evento, data_evento, data_registro)` evita duplicatas no reimport.
- O parser atual em `vendas-parse.server.ts` já normaliza headers com `trim()` e converte datas seriais do Excel — só falta tratar `Comissão Consultor` quando vem como número (hoje só lê `toNum` que aceita; ok) e popular `valor_comissao` quando o valor for monetário.
- Não há migration nem mudança de RLS. Não há mudança de UI.

## Confirmações necessárias

1. Confirma que a planilha enviada (`MODELO VENDAS.xlsx`, aba "Base de Dados", 1.008 linhas) é a fonte da verdade e devo **substituir 100%** do conteúdo de `comercial_vendas` por ela? (As 49 linhas a mais do banco serão apagadas.)
2. Confirma a regra para `valor_comissao`: quando `Comissão Consultor` for um número > 1, esse é o valor da comissão; quando for `True`/`False`/`0`/`1`, é só uma flag e `valor_comissao` fica 0?
