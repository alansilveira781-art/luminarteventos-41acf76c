# Liberar contratos do Jurídico para todos os usuários do módulo

## Causa confirmada

A regra de leitura da tabela de contratos jurídicos hoje só permite ver um contrato se o usuário for administrador do sistema, administrador do módulo Jurídico, ou o próprio criador do contrato. Como os contratos foram cadastrados por você, os usuários liberados no módulo abrem a aba e não veem nada.

O menu/rota do Jurídico já libera corretamente quem tem o módulo — o bloqueio é apenas nos dados.

## O que será feito

Ajustar as regras de acesso da tabela de contratos:

- Visualizar: qualquer usuário com acesso ao módulo Jurídico vê todos os contratos.
- Criar e editar: qualquer usuário com acesso ao módulo Jurídico.
- Excluir: continua restrito a administradores do sistema e administradores do módulo.

As tabelas auxiliares (anexos, comentários, histórico e modelos) já seguem a regra de "acesso ao módulo" e não precisam de mudança.

## Detalhes técnicos

Migração única em `public.juridico_contratos`:

- Substituir a policy `juridico_contratos read` por `USING (has_module_access(auth.uid(), 'juridico'))`.
- Substituir a policy `juridico_contratos update` por `USING`/`WITH CHECK` com `has_module_access(auth.uid(), 'juridico')`.
- Manter `juridico_contratos insert` e `juridico_contratos admin delete` como estão.

Observação de segurança: contratos contêm dados pessoais de clientes (CPF/CNPJ, endereço, valores). Com essa mudança, todo usuário liberado no módulo passa a ver esses dados — controle o acesso pela concessão do módulo em Administração > Usuários.

Nenhuma alteração de código de frontend é necessária.
