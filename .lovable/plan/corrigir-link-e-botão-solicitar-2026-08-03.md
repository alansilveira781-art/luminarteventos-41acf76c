# Corrigir link e botão "Solicitar"

## Problema encontrado

O botão de atalho no topo do painel aponta para um endereço fixo do domínio antigo:
`https://luminarteventos.lovable.app/solicitar` (em `src/components/AppSidebar.tsx`).

Como o app agora é publicado em outro endereço (`grupoluminart.lovable.app`), esse link leva para um site que não é mais o atual — por isso o botão "não funciona".

O formulário em si (`/solicitar`) e o endpoint público continuam existindo e liberados sem login; o problema é só o endereço fixo.

## O que será feito

1. Trocar o link fixo do botão "Solicitar demanda" no cabeçalho por um caminho relativo (`/solicitar`), abrindo em nova aba. Assim ele sempre acompanha o domínio atual (preview, publicado ou domínio próprio no futuro).
2. Adicionar um botão "Copiar link" do formulário de solicitação (mesmo componente já usado no Jurídico), para compartilhar o endereço público correto sem digitar o domínio.
3. Conferir que nenhum outro ponto do app ainda usa o domínio antigo.

## Detalhes técnicos

- `src/components/AppSidebar.tsx`: `href="https://luminarteventos.lovable.app/solicitar"` → `href="/solicitar"` (mantendo `target="_blank"`).
- Reuso de `CopiarLinkButton` (`path="/solicitar"`), que monta a URL a partir de `window.location.origin`.
- Nenhuma mudança de banco de dados ou de regras de acesso.
