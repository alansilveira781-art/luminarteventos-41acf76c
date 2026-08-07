# Apelido do diarista

## O que muda

**Configurações — Diaristas**
- O cadastro passa a ter dois campos: **Apelido** (como a pessoa é chamada no dia a dia) e **Nome do diarista** (nome completo, já existente).
- Nova coluna "Apelido" na tabela de diaristas cadastrados.
- Apelido é opcional; quando vazio, o sistema usa o nome completo.

**Onde o apelido aparece**
- Listas de seleção do apontamento e filtros: mostra o apelido com o nome completo ao lado, para não perder a identificação.
- Aba Fechamento e relatório PDF: mostra o apelido (quando houver), com o nome completo no resumo do diarista.

## Situação atual do banco (verificada)

- `diaristas`: id, nome, valor_hora_fortaleza, valor_hora_fora, chave_pix, ativo, created_at, updated_at — **falta apenas o apelido**.
- `diarista_config`: valores de almoço e janta já registrados.
- `diarista_apontamentos`: já possui data, horários, intervalo, projeto, local, almoço, janta, modo de divisão e extras.

Ou seja, as demais informações usadas nas telas já têm coluna correspondente; a única alteração de banco necessária é o apelido.

## Detalhes técnicos

1. Migração: `ALTER TABLE public.diaristas ADD COLUMN apelido text;` (sem alteração de RLS/GRANTs, que já existem).
2. `src/routes/financeiro-op.diaristas.configuracoes.tsx`: campo Apelido no diálogo (acima ou ao lado do Nome), incluído no insert/update e nova coluna na tabela.
3. `src/routes/financeiro-op.diaristas.index.tsx`: tipo `Diarista` ganha `apelido`; helper `nomeExibicao(d) = apelido || nome` usado nos selects, listagem e agrupamento do fechamento.
4. `src/lib/diaristas-pdf.ts`: usa o nome de exibição no cabeçalho de cada diarista, com o nome completo entre parênteses quando houver apelido.
