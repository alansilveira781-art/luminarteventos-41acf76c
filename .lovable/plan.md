## Objetivo

1. Substituir o campo livre "Evento" por um seletor padronizado (mesmo `EventoSheetCombobox` já usado em Estoque/Compras/Demandas) nas telas de **Notas Fiscais** e **Recebimentos** do módulo Contábil.
2. Criar um cadastro de **Tomadores** com tabela dedicada no banco, e permitir vincular a nota fiscal a um tomador cadastrado com 1 clique (ou preencher manualmente e salvar).

---

## 1. Padronizar campo Evento

Trocar o `<Input>` de "Evento" por `<EventoSheetCombobox>` em:
- `src/routes/contabil.notas.tsx` (form `NotaForm`, campo `nome_evento`)
- `src/routes/contabil.recebimentos.tsx` (form `RecebimentoForm`, campo `nome_evento`)

O valor salvo continua sendo o `codigo_evento` (string), mantendo compatibilidade com o que já existe hoje e com o relatório de rascunho da apuração.

---

## 2. Cadastro de Tomadores

### Banco de dados (migração)
Criar `public.contabil_tomadores`:
- `id`, `created_at`, `updated_at`
- `nome` (obrigatório), `documento` (CNPJ/CPF, único), `email`, `telefone`, `endereco`, `inscricao_municipal`, `observacoes`
- GRANT para `authenticated` e `service_role`
- RLS ligado, políticas permitindo qualquer usuário autenticado ler/gravar (segue padrão das demais tabelas contábeis)
- Trigger `set_updated_at`

### Nova rota: `/contabil/tomadores`
`src/routes/contabil.tomadores.tsx` — lista com busca, criar/editar/excluir (mesmo padrão de `contabil.recebimentos.tsx`).

Adicionar link no menu do módulo Contábil (`src/routes/contabil.tsx`).

### Integração com a Nota Fiscal
Em `NotaForm` (`src/routes/contabil.notas.tsx`):
- Adicionar um seletor `EntitySearchSelect` "Tomador cadastrado" no topo do bloco de tomador.
- Ao selecionar um tomador da lista → preenche automaticamente `tomador_nome`, `tomador_documento`, `tomador_email`.
- Se o tomador desejado não existir, o usuário preenche manualmente os campos e salva (comportamento atual mantido).
- Botão "Salvar como tomador" ao lado dos campos: se o documento não estiver cadastrado, cria um novo registro em `contabil_tomadores` a partir do que foi digitado.

Nada muda no schema de `contabil_notas_fiscais` — a nota continua guardando `tomador_nome/documento/email` denormalizados (evita quebrar histórico e mantém apuração/rascunho funcionando).

---

## Arquivos afetados

- **Migração nova**: `contabil_tomadores` (tabela + RLS + GRANT + trigger)
- **Nova rota**: `src/routes/contabil.tomadores.tsx`
- **Editar**: `src/routes/contabil.notas.tsx` (seletor de evento + seletor/salvar tomador)
- **Editar**: `src/routes/contabil.recebimentos.tsx` (seletor de evento)
- **Editar**: `src/routes/contabil.tsx` (link "Tomadores" no menu)

Sem alterações em apuração/rascunho — eles continuam lendo `nome_evento` como string.
