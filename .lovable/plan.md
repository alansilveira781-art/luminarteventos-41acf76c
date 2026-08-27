# Retirar botão "Migrar para Aquisição" e encerrar o módulo Aquisições

## 1. Remover o botão de migração

- O ícone de migrar some dos cards do Quadro de Compras, tanto na coluna **Solicitação** quanto em **A Receber**.
- O diálogo de migração (com toda a cópia de itens, anexos, pagamentos e comentários) deixa de existir na interface.
- Nada muda nos cards já migrados anteriormente: os dados permanecem como estão.

## 2. Encerrar o módulo Aquisições

Confirmado hoje: existe o módulo cadastrado como **Aquisições** (rota `/financeiro`, ainda ativo) e 4 vínculos de usuários com ele. As telas legadas (`/financeiro`, `/financeiro/dashboard`, `/financeiro/configuracoes`, `/financeiro/rotinas`, `/financeiro/conta-azul`) hoje ficam acessíveis para administradores mestres.

Passa a ser assim:

- O módulo é marcado como **inativo** no cadastro, então:
  - some da tela inicial (hub) de qualquer usuário;
  - some do menu lateral;
  - deixa de aparecer como opção ao conceder acesso a usuários em Administração.
- Todas as rotas `/financeiro/*` passam a redirecionar para o Quadro de Compras, inclusive para administradores mestres — ninguém mais enxerga o quadro/telas antigas.
- Nenhum dado é apagado: as aquisições continuam na base e seguem visíveis no Quadro de Compras como cards `AQUISIÇÃO-...`.

## Detalhes técnicos

- `src/routes/compras.index.tsx`: remover `canMigrate`, a prop `onMigrar` do card, o estado `migrarCompra` e o componente `MigrarCompraDialog`.
- `src/routes/financeiro.tsx`: passa a redirecionar todas as rotas filhas para `/compras` (mantendo o repasse do parâmetro `id` como aquisição), sem exceção para master admin.
- `src/components/AppSidebar.tsx`: remover os itens do grupo legado que apontam para `/financeiro`.
- Migração de banco: `update public.modulos set ativo = false where slug = 'financeiro';` — os vínculos em `user_modulos` são preservados, apenas ficam sem efeito.
