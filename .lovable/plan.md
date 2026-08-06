# Deixar /solicitar-contrato totalmente público

## O que muda

O link do formulário de contrato volta a abrir para qualquer pessoa, sem login:

1. Quem abrir o link vê o formulário direto, sem passar pela tela de entrada.
2. O envio funciona sem conta — não é preciso estar logado.
3. Se por acaso a pessoa já estiver logada no sistema, o e-mail dela continua sendo registrado como "Enviado por"; para visitantes anônimos esse campo fica em branco.
4. Continuam valendo as proteções contra abuso: limite de envios por IP, validação de todos os campos e limite de 10 MB por anexo.

Campos, PF/PJ, anexos, parcelas, testemunhas e responsáveis legais permanecem iguais.

## Detalhes técnicos

- `src/routes/__root.tsx`: incluir `/solicitar-contrato` de volta na lista de rotas públicas do `AppShell` (antes da checagem de sessão) e remover da lista de rotas autenticadas sem sidebar.
- `src/routes/solicitar-contrato.tsx`: manter `useAuth()` apenas como opcional — enviar o header `Authorization` somente quando houver sessão, sem bloquear o envio quando não houver.
- `src/routes/api/public/solicitar-contrato.ts`: tornar a verificação do token opcional — se vier um Bearer válido, grava `created_by` e `solicitante_email`; se não vier, segue o fluxo gravando esses campos como nulos, em vez de retornar 401.
- Sem mudanças de banco de dados ou de RLS (o endpoint já grava via chave de serviço).
