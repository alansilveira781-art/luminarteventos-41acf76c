## Objetivo

Transformar o formulário de solicitação de contratos em uma página **pública**, acessível por link, sem login e sem o layout interno (sidebar/topo) — exatamente como funciona o `/solicitar` de compras hoje.

## Como fica

- Novo endereço público: **`/solicitar-contrato`**
- Qualquer pessoa com o link preenche e envia; a solicitação cai na coluna **Entrada** do quadro do Jurídico, com os anexos.
- Mesmos campos já definidos: Solicitação (tipo, empresa, objeto, valor, data), Dados da Empresa, Responsável Legal, anexos obrigatórios (Proposta e Cartão CNPJ) e observações.
- Tela de sucesso mostrando o número gerado (ex.: CONTRATO-42).
- Proteção contra abuso: limite de 5 envios por minuto por IP, limite de 10 MB por arquivo, validação de todos os campos no servidor.
- A aba **Jurídico › Configurações** (lista de usuários liberados) deixa de existir, junto com a rota interna `/juridico/solicitar`. O link é copiável a partir de um card na tela de Contratos.

## Detalhes técnicos

1. **Nova página** `src/routes/solicitar-contrato.tsx` — reaproveita o formulário atual de `juridico.solicitar.tsx`, sem `useAuth`/`useJuridicoSolicitante`, com `head()` próprio (título/descrição). Envia `multipart/form-data` (payload JSON + arquivos) via `fetch`.
2. **`src/routes/__root.tsx`** — incluir `/solicitar-contrato` na lista de rotas que renderizam só o `<Outlet />` (sem shell autenticado).
3. **Novo endpoint** `src/routes/api/public/solicitar-contrato.ts` — espelha `api/public/solicitar.ts`: CORS + `OPTIONS`, rate limit por IP, validação Zod (nome/documento/e-mail/telefone obrigatórios nas duas seções), insert em `juridico_contratos` com `status: 'entrada'`, `created_by: null`, e upload dos anexos no bucket `juridico-anexos` + registros em `juridico_anexos` com `tipo` `proposta`/`cartao_cnpj`, usando `supabaseAdmin` dentro do handler.
4. **Limpeza**: remover `src/routes/juridico.solicitar.tsx`, `src/routes/juridico.configuracoes.tsx`, `src/hooks/useJuridicoSolicitante.ts`, referências em `src/routes/juridico.tsx` e no `AppSidebar`.
5. **Banco**: migração para remover a tabela `juridico_solicitantes` e a função `pode_solicitar_contrato`, e ajustar as políticas de `juridico_contratos`/`juridico_anexos` que dependiam delas (escrita pública passa a ocorrer apenas pelo endpoint com service role — nada de política aberta para `anon`).
6. **Link**: card com botão "Copiar link" em Jurídico › Contratos apontando para `/solicitar-contrato`.
