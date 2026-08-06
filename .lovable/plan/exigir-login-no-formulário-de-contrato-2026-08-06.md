# Exigir login no formulário de contrato

## O que muda

Hoje o link `/solicitar-contrato` abre direto, sem identificação. Passará a exigir login antes de mostrar o formulário:

1. Quem abrir o link sem estar logado é levado para a tela de entrada (`/auth`), que já tem Entrar, Criar conta e Entrar com Google.
2. Depois de entrar (ou criar conta), a pessoa volta automaticamente para o formulário de contrato.
3. Qualquer usuário logado pode preencher e enviar — não é preciso ter módulo Jurídico liberado.
4. O envio passa a registrar quem enviou (e-mail da conta usada), e esse dado aparece no card do contrato no Jurídico.

O formulário em si, os campos PF/PJ, anexos e parcelas continuam iguais.

## Detalhes técnicos

- `src/routes/__root.tsx`: remover `/solicitar-contrato` da lista de rotas públicas do `AppShell`, para cair no fluxo já existente de redirecionamento para `/auth?redirect=/solicitar-contrato`.
- A página continua com layout próprio (sem sidebar): tratar `/solicitar-contrato` como rota autenticada porém renderizada fora do shell, no mesmo padrão de `/.lovable/oauth/consent`.
- `src/routes/solicitar-contrato.tsx`: usar `useAuth()` para obter o usuário; enviar `solicitante_email` (e nome, quando houver) junto do payload e pré-preencher o campo de e-mail de contato.
- `src/routes/api/public/solicitar-contrato.ts`: continua aceitando o envio, agora com verificação do token da sessão enviado pelo formulário (rejeita chamadas sem usuário válido) e gravando o e-mail do solicitante.
- Banco: nova coluna `solicitante_email text` em `juridico_contratos` (sem mudança de RLS).
- `src/routes/juridico.index.tsx`: exibir "Enviado por" no card de detalhe.
