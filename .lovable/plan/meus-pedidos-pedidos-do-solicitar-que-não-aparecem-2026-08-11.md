# Meus Pedidos: pedidos do /solicitar que não aparecem

## O que está acontecendo

Verifiquei os dados reais. A tela "Meus Pedidos" só consegue mostrar um pedido quando ele guarda **o e-mail** (ou o id) do solicitante — é assim tanto na consulta da tela quanto na regra de segurança do banco.

No formulário público `/solicitar` o e-mail é **opcional**: hoje só o nome é obrigatório. Resultado: pedidos enviados sem e-mail ficam sem qualquer vínculo com a conta.

Números atuais do banco:
- Compras: 216 no total, 16 sem e-mail e sem vínculo de usuário.
- Despesas/demandas: 175 no total, 47 sem e-mail e sem vínculo de usuário.

Exemplo real: várias solicitações com solicitante "JEFFERSON" chegaram sem e-mail — nenhuma delas aparece em Meus Pedidos, para ninguém.

Um segundo caso: quem digita um e-mail diferente do e-mail da conta (pessoal, com erro de digitação) também não vê o pedido.

## O que vou fazer

1. **E-mail obrigatório no `/solicitar`**
   Campo passa a ser exigido, com validação de formato antes de avançar/enviar.

2. **Preencher automaticamente quando a pessoa já está logada**
   Se houver sessão ativa ao abrir o formulário, nome e e-mail vêm preenchidos com os dados da conta, e o pedido é gravado já vinculado ao usuário. Assim não depende de digitação.

3. **Aviso quando o e-mail não é de uma conta do sistema**
   Ao enviar com um e-mail que não existe entre os usuários, mostro um aviso claro de que o pedido não vai aparecer em "Meus Pedidos" (o pedido é registrado normalmente).

4. **Recuperar os pedidos antigos órfãos**
   Migração que tenta casar os pedidos sem e-mail com um usuário pelo nome do solicitante (comparação normalizada com o nome cadastrado do usuário) e preenche e-mail/vínculo. Casos ambíguos ou sem correspondência ficam como estão e eu listo quais são, para decidirmos manualmente.

## Detalhes técnicos

- `src/routes/solicitar.tsx`: tornar `solicitante_email` obrigatório na validação da etapa (hoje em `validateStep`, linha ~216); usar `supabase.auth.getSession()` no mount para pré-preencher `solicitante_nome`/`solicitante_email` e enviar `solicitante_id` no payload quando logado.
- `src/routes/api/public/solicitar.ts`: exigir `solicitante_email` no `baseSchema` (hoje `.optional()`); manter a resolução de `solicitante_id` por `profiles.email` e retornar no JSON um sinal `vinculado: boolean` para o formulário exibir o aviso.
- Migração SQL de backfill: `update compras/demandas set solicitante_email, solicitante_id` a partir de `profiles` quando `unaccent(lower(solicitante))` casar com `unaccent(lower(display_name))` de exatamente um perfil, restrito às linhas com `solicitante_email is null`.
- Sem mudança nas policies: `compras_select_owner` e `demandas_select_owner` já cobrem `solicitante_id` e `solicitante_email` — com os dados preenchidos os pedidos passam a aparecer.
