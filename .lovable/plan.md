## Objetivo

Ao avançar um card (no Quadro de Vendas e no Quadro de Compras), atribuir um **responsável** (usuário do sistema) e notificá-lo dentro da ferramenta. Melhorar o sino de notificações para listar recentes, abrir página completa, marcar como concluída/pendente e navegar direto ao card.

---

## 1. Quadro de Compras (`/compras`)

Hoje a função `moveStatus` em `src/routes/compras.index.tsx` apenas troca o `status` no banco. O `notify.ts` já notifica por *módulo*, mas não por pessoa específica.

**Mudanças:**
- Ao soltar um card em uma nova coluna, abrir um **mini-diálogo** "Avançar para {status}" pedindo:
  - Responsável (combobox com usuários do sistema — `profiles`)
  - Observação opcional
- Salvar `responsavel_id` + `responsavel_nome` no card (novas colunas em `compras`) e registrar entrada em `compra_historico` com o responsável.
- Criar 1 notificação direcionada ao responsável escolhido (`notificacoes` com `user_id = responsavel_id`, `link = /compras?id={compraId}`).
- Manter a notificação por módulo já existente como fallback opcional (ou remover — ver pergunta abaixo).
- O `CompraDialog` deve abrir automaticamente quando a URL tiver `?id=...` (já abre via state; só garantir).

## 2. Quadro de Vendas (`/comercial`)

Hoje os cards vivem em **localStorage** (`src/lib/comercial/store.ts`). Notificar outro usuário exige persistência no banco.

**Opção escolhida (proposta):** Manter os cards em localStorage, mas, ao avançar de coluna, abrir o mesmo mini-diálogo de "Responsável" e gravar **apenas a notificação** em `notificacoes` (tabela já existente) com `link = /comercial?card={cardId}`. O card em si continua local; ao clicar na notificação, abre `/comercial` e expande o `DetalhesDrawer` do card via query param.

- Adicionar campo `responsavelUserId` no `ComercialCard` (localStorage) para histórico.
- `/comercial` lê `?card=...` e abre o drawer correspondente automaticamente.

## 3. Central de Notificações

Hoje o `NotificationBell` mostra até 20, marca todas como lidas. Falta: ver todas, marcar individual como concluída/pendente.

**Mudanças:**
- Adicionar coluna `concluida BOOLEAN DEFAULT false` em `notificacoes` (separado de `lida`).
- No popover do sino: mostrar 8 mais recentes + link **"Ver todas"** que abre nova rota `/notificacoes`.
- Nova rota `/notificacoes` com tabela completa: filtro por status (todas / não lidas / pendentes / concluídas), checkbox "concluída" por linha, botão para abrir o link.
- Ao clicar em uma notificação: marca como lida + navega para `link`.
- Botão "Marcar como concluída" / "Reabrir" em cada item (no popover e na página).

---

## Detalhes técnicos

**Migrations (em uma só):**
- `ALTER TABLE compras ADD COLUMN responsavel_id UUID, ADD COLUMN responsavel_nome TEXT;`
- `ALTER TABLE notificacoes ADD COLUMN concluida BOOLEAN NOT NULL DEFAULT false, ADD COLUMN concluida_em TIMESTAMPTZ;`

**Novo componente:** `src/components/AvancarCardDialog.tsx` — reusável (Compras e Vendas). Recebe `onConfirm({responsavelId, responsavelNome, observacao})`.

**Helper:** `notifyResponsavel(userId, titulo, mensagem, link)` em `src/lib/notify.ts`.

**Arquivos editados:**
- `src/routes/compras.index.tsx` — interceptar `onDragEnd` com diálogo
- `src/routes/comercial.index.tsx` — interceptar drag + abrir drawer via `?card=`
- `src/components/NotificationBell.tsx` — botão "ver todas", marcar concluída
- `src/components/AppSidebar.tsx` ou route tree — registrar `/notificacoes`
- `src/routes/notificacoes.tsx` — nova página
- `src/lib/notify.ts` — função `notifyResponsavel`
- `src/lib/comercial/types.ts` + `store.ts` — campo `responsavelUserId`

---

## Perguntas

1. **Lista de responsáveis**: usar todos os usuários da tabela `profiles`, ou filtrar por módulo (ex.: só quem tem acesso a `compras` para o Quadro de Compras)?
2. **Notificação por módulo** (genérica, já existente): manter junto com a notificação direcionada ao responsável, ou substituir completamente?
3. **Voltar card para coluna anterior** (drag pra trás): também pedir responsável, ou só pedir quando avança?
