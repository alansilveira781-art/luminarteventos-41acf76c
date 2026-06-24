## Problema

O Natanael consegue arrastar o card no Quadro de Compras, mas ele "volta para o lugar de origem" segundos depois. Isto acontece porque o front-end permite o movimento (ele tem acesso liberado em `canMoveCompra` / `canEditCompra`), mas a regra de segurança do banco (RLS) da tabela `compras` **não inclui o Natanael** entre quem pode atualizar um card. Hoje só podem atualizar: o responsável do card, o criador, um usuário fixo específico, admins globais ou admins do módulo Compras/Estoque. O Natanael não é admin nem admin de módulo, então o update falha no servidor e o app desfaz o movimento (rollback otimista) → o card volta.

## Correção

Ajustar as políticas de UPDATE e DELETE da tabela `compras` para também liberar o Natanael (user_id `fd75a882-75fe-4e5b-935b-d650f050d6be`), do mesmo jeito que já está liberado o outro usuário fixo. Nenhuma outra regra muda — continua valendo responsável / criador / admins.

### Detalhes técnicos

Migration única reescrevendo as duas policies existentes:

- `compras_update_owner_or_admin` → adicionar `OR auth.uid() = 'fd75a882-75fe-4e5b-935b-d650f050d6be'::uuid` em `USING` e `WITH CHECK`.
- `compras_delete_owner_or_admin` → adicionar a mesma condição em `USING`.

Sem mudanças em código front-end: a lógica de permissão já trata o Natanael corretamente; o que falta é apenas o espelho disso no banco.

## Verificação

Após aplicar: logar como Natanael, arrastar um card entre colunas permitidas — deve persistir e continuar no destino após recarregar a página.