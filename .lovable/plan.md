Criar uma nova migration SQL que executa exatamente o conteúdo do arquivo colado (`pasted-2026-07-02T13-17-14-603Z.txt`, 1017 linhas):

1. `BEGIN;`
2. `TRUNCATE TABLE public.comercial_vendas;`
3. `INSERT INTO public.comercial_vendas (...) VALUES (...)` — 1006 registros
4. `COMMIT;`

Não haverá alterações em:
- Schema/colunas da tabela `comercial_vendas`
- Políticas RLS, GRANTs, triggers
- Qualquer outra tabela ou código da aplicação

A migration será submetida via ferramenta de migração para sua aprovação antes de rodar.