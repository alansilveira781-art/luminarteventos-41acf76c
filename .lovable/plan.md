
# Módulo Operações

Substitui o RH no menu (RH apenas desativado, dados preservados). Baseado nos padrões existentes: `has_module_access`, `is_module_admin`, `is_admin`, `set_updated_at`, e o trio anexos/comentários/histórico usado em `demanda_*`.

## Princípios inegociáveis

- Nada é excluído: `modulos.ativo = false` para `rh`. Tabela `rh_vagas` intacta.
- Link público `/solicitar` continua idêntico. Degrau de aprovação vale só para `origem = 'operacao'`.
- Diaristas (`financeiro-op.diaristas.*`) não é RH — não tocar.
- Permissão granular por pessoa **fica para depois**. Agora: `user_modulos` + `is_module_admin` + "responsável do setor".

## Entrega em blocos (validar cada um antes do próximo)

### Bloco 1 — Desativação RH + registro do módulo

Migração:
- `UPDATE modulos SET ativo=false WHERE slug='rh'`
- `INSERT modulos (slug='operacao', nome='Operações', icone='Factory', rota='/operacao', ordem=90, ativo=true)`
- `INSERT user_modulos` para Jefferson Nascimento com `is_admin=true` no módulo `operacao`

Verificar: RH some do menu, `/rh` continua acessível para admin master (rota existe), preview não quebra.

### Bloco 2 — Setores e etapas configuráveis

Tabelas (com RLS + GRANT authenticated/service_role + `set_updated_at`):

- `op_setores` (id, nome, slug UNIQUE, ativo, ordem, responsavel_id → auth.users, timestamps)
- `op_setor_etapas` (id, setor_id → op_setores CASCADE, nome, ordem, ativo, created_at)

Seed dos 9 setores (Costura, Usinagem, Metalurgia, Estrutura, Comunicação Visual, Marcenaria, Almoxarifado, Iluminação, Pintura) e etapas conforme levantamento (Estrutura, Marcenaria, Com. Visual, Costura, Almoxarifado, Usinagem, Iluminação, Metalurgia, Pintura), incluindo o macro-fluxo "Item 03" (Fabricação → Pré-montagem → Embalagem → Montagem → Desmontagem → Finalizado) inserido como etapas nos setores que produzem peça física.

RLS:
- SELECT: `has_module_access(auth.uid(),'operacao')`
- INSERT/UPDATE/DELETE: `is_module_admin(auth.uid(),'operacao') OR is_admin(auth.uid())`

### Bloco 3 — Ordens, apontamentos, acervo, trio de apoio

Sequence: `op_ordens_numero_seq`.

Tabelas:

- `op_ordens` (numero, setor_id, titulo, descricao, tipo_unidade `'peca'|'item_inteiro'`, quantidade, evento_ref, origem `'avulsa'|'proposta'`, proposta_id → comercial_propostas SET NULL, proposta_item_id text, etapa_atual_id → op_setor_etapas SET NULL, status `'aberta'|'em_producao'|'finalizada'|'cancelada'` default `'aberta'`, responsavel_id, prazo, acervo_id → op_acervo SET NULL, ordem int, created_by, timestamps). Índices em setor_id, status, proposta_id, evento_ref.
- `op_ordem_apontamentos` (ordem_id CASCADE, etapa_id, iniciado_em default now, finalizado_em nullable, executado_por, observacoes). Índices em ordem_id, etapa_id, iniciado_em.
- `op_acervo` (codigo UNIQUE, nome, descricao, categoria, dimensoes, estado default 'BOM', localizacao, quantidade default 1, imagem_url, observacoes, ativo, timestamps). **Separado de `pat_itens`** — controle novo.
- `op_ordem_anexos`, `op_ordem_comentarios`, `op_ordem_historico` — mesmos formatos de `demanda_*`.

Trigger de histórico em `op_ordens` (criação, mudança status/etapa/responsável) espelhando `demandas_log_status_change`.

Bucket privado `op-anexos` via `supabase--storage_create_bucket`, com policies em `storage.objects` restritas a `has_module_access(auth.uid(),'operacao')`.

Ao concluir etapa (server function ou lógica de front): fechar `finalizado_em` do apontamento atual, inserir próximo, atualizar `etapa_atual_id`/`status` da ordem.

### Bloco 4 — Degrau de aprovação do Jefferson

Escolha: **flag separado**, não novo valor do enum (evita risco no fluxo de compras).

Migração em `demandas` e/ou `compras` (conforme o formulário de `/solicitar` alimenta hoje — verificar `src/routes/api/public/solicitar.ts` antes de escrever a migração):
- `origem text NOT NULL default 'link'` (valores: `'link' | 'operacao' | 'interno'`)
- `op_ordem_id uuid NULL REFERENCES op_ordens(id) ON DELETE SET NULL`
- `aprovacao_operacao text NULL` (valores: `'pendente' | 'aprovada' | 'recusada'`)
- `aprovacao_operacao_motivo text NULL`, `aprovacao_operacao_por uuid`, `aprovacao_operacao_em timestamptz`

Regras:
- Solicitações via `/api/public/solicitar` continuam com `origem='link'` e `aprovacao_operacao=NULL` → fluxo atual sem alteração.
- Botão "Solicitar compra (falta material)" na ordem cria registro com `origem='operacao'`, `op_ordem_id=...`, `aprovacao_operacao='pendente'`.
- Queries de Compras filtram `aprovacao_operacao IS DISTINCT FROM 'pendente'`.
- Nova aba "Aprovações" em `/meus-pedidos` para o Jefferson: lista `origem='operacao' AND aprovacao_operacao='pendente'`, aprovar → `'aprovada'` (entra em Compras), recusar com motivo → `'recusada'` (volta ao solicitante para editar).

### Bloco 5 — Front mínimo para operar

Rota base `/operacao` com layout de guarda (`hasModule('operacao') || isAdmin`).

Abas:
1. **Quadro** (kanban) — ordens por status/etapa, drag-and-drop no padrão dos outros kanbans; filtros setor/evento/responsável; botões "Nova ordem avulsa" e "Importar da proposta" (importar fica placeholder até Bloco 8).
2. **Nova ordem avulsa** — formulário independente do Comercial.
3. **Apontamento** — tela mobile-first: lista as ordens do setor do usuário com botões grandes "Iniciar etapa" / "Concluir etapa".

### Bloco 6 — Acervo, Setores & Etapas, Relatório de gargalo

- CRUD `op_acervo` (com upload de foto no bucket existente ou novo `op-acervo-photos`).
- Configuração de setores/etapas (só admin do módulo/master) — criar setor, reordenar etapas, ativar/desativar.
- Relatório de gargalo: tempo médio por etapa/setor a partir de `op_ordem_apontamentos`, ordens paradas há mais tempo, throughput por período. Recharts lazy conforme padrão.

### Bloco 7 — Fila de aprovação do Jefferson em `/meus-pedidos`

Nova aba/seção "Aprovações" só visível para Jefferson (admin do módulo `operacao`).

### Bloco 8 — Importar da proposta (só quando Comercial estiver alimentando o sistema)

Seletor de proposta aprovada → lê `comercial_propostas.ambientes` (jsonb) → gerente escolhe item + setores → cria uma ordem materializada por setor (copiando título/descrição/quantidade; guardando `proposta_id` + `proposta_item_id` como rastro). Materialização, não referência viva.

## Fora de escopo desta rodada

- Permissão granular por pessoa.
- Exclusão de RH ou de `rh_vagas`.
- Alteração de `/solicitar` público.
- Telas de diaristas.
- Automação da criação de ordens a partir da proposta.

## Pontos que quero validar antes de escrever migração

1. `src/routes/api/public/solicitar.ts` e o schema alvo (`compras` vs `demandas`) — para saber onde adicionar `origem`, `op_ordem_id`, `aprovacao_operacao`.
2. `user_id` do Jefferson Nascimento (para o `INSERT` em `user_modulos`) — posso descobrir por `profiles.email` na hora da migração do Bloco 1.
3. Se você quer que Operações herde alguma cor/ícone específico além de `Factory`.

Confirma que começo pelo **Bloco 1** (desativar RH + registrar módulo + Jefferson admin) e paro para você validar antes de seguir?
