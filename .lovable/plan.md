# Reativação e ampliação do módulo RH

Reativa o módulo RH (coexistindo com Operações) e adiciona duas novas abas — Colaboradores e EPIs — mantendo o Quadro de Contratação existente.

## Dependência

A geração da ficha PDF de EPI depende do cadastro de empresas (`admin_empresas`), que ainda não existe no projeto. Vou implementar tudo até o passo 5 agora e deixar o passo 6 (ficha PDF) preparado com um dropdown que, temporariamente, usa a lista fixa `EMPRESAS` de `src/lib/empresas.ts` — quando `admin_empresas` for criada em spec futura, basta trocar a fonte do dropdown. Se preferir, aguardo aquela spec antes de gerar a ficha.

## Passo 1 — Reativar módulo (migração)

- `UPDATE public.modulos SET ativo = true WHERE slug = 'rh';`
- Nada mais muda: `rh_vagas`, guard `RhLayout` e a rota `/rh` já existem. O Quadro de Contratação reaparece na sidebar automaticamente.

## Passo 2 — Tabela `rh_colaboradores` (migração)

Campos: `id`, `nome`, `departamento`, `funcao`, `tipo_contratacao` (`diarista|clt|pj`), `tipo_documento` (`cpf|cnpj`), `documento` (só dígitos), `user_id` (opcional), `ativo`, `created_at`, `updated_at`.

- Índices: `(ativo)`, `(departamento)`.
- Trigger `set_updated_at`.
- RLS: leitura/escrita a quem tem `has_module_access(auth.uid(),'rh')`; delete/admin apenas `is_module_admin(...,'rh') OR is_admin(...)`.
- GRANT `SELECT/INSERT/UPDATE/DELETE` a `authenticated` (sem `anon`).
- CPF/CNPJ nunca exposto fora do módulo.
- Seed inicial: preciso da relação de colaboradores (PDF nov/2025). Como não tenho o arquivo, deixo a tabela vazia e ofereço um botão "Importar CSV" na tela ou aguardo você me enviar a lista para incluir na migração.

## Passo 3 — Tela Colaboradores

Nova rota `/rh/colaboradores` + navegação por abas dentro de `/rh` (Colaboradores | EPIs | Quadro de Contratação). CRUD com:
- Lista com filtros por departamento e tipo de contratação, busca por nome.
- Dialog de criar/editar com máscara CPF/CNPJ conforme `tipo_documento`.
- Toggle ativo/inativo.
- Campo opcional para vincular a um usuário do sistema (Select carregando `profiles`).

## Passo 4 — Tabela `rh_epi_entregas` (migração)

Campos conforme spec: `id BIGINT IDENTITY`, `colaborador_id`, `tipo_contratacao` (snapshot), `epi_descricao`, `quantidade`, `motivo` (`entrega | devolucao_desgaste_normal | devolucao_desgaste_anormal | perda | desligamento`), `ca`, `data`, `observacoes`, `created_by`, `created_at`.

- Índices em `(colaborador_id)`, `(data)`, `(motivo)`.
- RLS igual às demais `rh_*`.
- GRANT a `authenticated`.

## Passo 5 — Tela EPIs

Rota `/rh/epis`:
- Tabela de entregas com filtros (colaborador, motivo, período).
- Dialog "Novo movimento": busca de colaborador, EPI, quantidade, motivo (select), CA, data, observações. `tipo_contratacao` é capturado do colaborador no momento do registro.
- Botão "Gerar ficha" por colaborador (leva ao passo 6).

## Passo 6 — Ficha PDF (jspdf via `import()` dinâmico)

- Dialog "Gerar ficha": seleciona colaborador + empresa (dropdown, inicialmente `EMPRESAS`).
- Layout do modelo: cabeçalho da empresa, título "FICHA DE CONTROLE INDIVIDUAL EPI / EPC", identificação (nome, matrícula, função), termo de responsabilidade (NR-06 / Portaria 3.214/78 / art. 482 CLT com a razão social selecionada), tabela de EPIs entregues, data/local e linha de assinatura.
- Matrícula: campo preenchível (não confundir com id sequencial). Deixo default vazio até definição.

## Passo 7 — Navegação

- `AppSidebar.tsx`: reincluir grupo "Recursos Humanos" com Colaboradores, EPIs e Quadro de Contratação (sem remover o grupo Operação).
- `/rh` (index) redireciona para `/rh/quadro` (novo caminho) ou mostra as abas. Atual `rh.index.tsx` (kanban) vira `/rh/quadro.tsx`.

## Detalhes técnicos

- Migrações separadas: (a) reativar módulo; (b) `rh_colaboradores`; (c) `rh_epi_entregas`. Cada `CREATE TABLE` seguido de GRANTs → `ENABLE RLS` → `CREATE POLICY`, na ordem.
- Policies usam `has_role`, `has_module_access`, `is_module_admin` já existentes.
- Componentes reutilizam `PageHeader`, `Dialog`, `Select`, `Input`, `Combobox`, e `EMPRESAS` do projeto.
- Nenhuma alteração no Operações.

## Perguntas rápidas

1. Posso deixar `rh_colaboradores` vazio no seed (você me envia CSV depois) ou você prefere colar a relação para eu embutir na migração?
2. Sigo com `EMPRESAS` fixo no dropdown da ficha PDF por enquanto, ou aguardo a spec de `admin_empresas`?
