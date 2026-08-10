# Rotinas: remover Validações, criar Atividades e rotinas esporádicas

## 1. Remover a aba Validações

- Some a aba "Validações" e todo o painel de aprovação/rejeição.
- Some também o campo "Exige validação" do formulário de rotina — sem a aba, ele não teria efeito.
- As execuções já registradas continuam intactas; nada é apagado do banco.

## 2. Nova aba "Atividades"

Cadastro simples de atividades com **título** e **descritivo** (como executar a atividade, passo a passo).

- Lista com criar, editar e excluir.
- Campo de busca por título.

## 3. Atividade vinculada à rotina

No formulário de nova/editar rotina:

- Nova lista suspensa **Atividade** (opcional), com as atividades cadastradas.
- Ao selecionar, o descritivo da atividade aparece logo abaixo, em bloco de leitura, para conferência.
- Na tabela de rotinas e no detalhe/execução, mostra o nome da atividade e o descritivo, para quem for executar saber o que fazer.

## 4. Rotinas esporádicas (sob demanda)

- Nova frequência **Esporádica (sob demanda)**.
- Sem dias da semana e sem cálculo de próxima data.
- Não aparece no Calendário (não tem data fixa).
- Na aba **Execução** ganha um grupo próprio "Sob demanda", sempre disponível para registrar execução na data de hoje ou em data escolhida — quantas vezes for necessário.
- Na Tabela aparece com o rótulo "Esporádica" no lugar da frequência/hora.

## Detalhes técnicos

- Migração: nova tabela `financeiro_atividades` (`titulo`, `descricao`, `ativo`, timestamps) com GRANTs e RLS (leitura para autenticados; escrita para admin global ou admin do módulo financeiro).
- Migração: coluna `atividade_id uuid references financeiro_atividades(id) on delete set null` em `financeiro_rotinas`.
- Migração: ampliar o CHECK de `frequencia` para incluir `esporadica`.
- Código: as duas telas hoje são cópias quase idênticas e recebem as mesmas mudanças — `src/routes/financeiro.rotinas.tsx` e `src/routes/financeiro-op.rotinas.tsx`.
- `occursOn()` retorna `false` para `esporadica`; `proxima_data` fica nula nesse caso.
- Cada consulta nova usa chave de cache própria (`financeiro-atividades`), sem reaproveitar a chave da lista de rotinas.
