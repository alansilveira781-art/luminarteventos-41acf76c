# Adicionar "Iluminação" ao departamento dos diaristas

## O que será feito
Incluir a opção **Iluminação** na lista de departamentos do módulo Diaristas, tanto no cadastro/configurações quanto nos filtros de apontamento e fechamento.

## Onde alterar
- `src/routes/financeiro-op.diaristas.configuracoes.tsx`
  - Atualizar a constante `DEPARTAMENTOS` de `["Marcenaria", "Estrutura"]` para `["Marcenaria", "Estrutura", "Iluminação"]`.
- `src/routes/financeiro-op.diaristas.index.tsx`
  - Atualizar a constante `DEPARTAMENTOS_DIARISTA` de `["Marcenaria", "Estrutura"]` para `["Marcenaria", "Estrutura", "Iluminação"]`.

## Impacto
Nenhuma mudança de banco de dados é necessária — a coluna `departamento` em `public.diaristas` é do tipo `text`. A nova opção passa a aparecer automaticamente no cadastro, nos filtros e no relatório PDF (que já consome a mesma constante).

## Validação
Verificar visualmente nos selects de cadastro e de filtros que "Iluminação" aparece como opção e que diaristas salvos com esse departamento são filtrados corretamente.
