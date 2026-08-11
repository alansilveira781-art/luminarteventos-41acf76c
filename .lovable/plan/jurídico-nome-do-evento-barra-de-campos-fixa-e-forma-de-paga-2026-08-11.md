# Jurídico: nome do evento, barra de campos fixa e forma de pagamento

## 1. Nome do evento

- Novo campo **Nome do evento** (obrigatório) no link público de solicitação de contrato, logo acima do período do evento.
- Mesmo campo disponível no card do contrato (diálogo interno), para ajuste depois.
- Nova variável de modelo **[evento_nome]** (com apelido `nome_evento`), listada nos "Campos automáticos" do editor de modelos.

## 2. Barra de campos automáticos sempre visível

Hoje a lista de campos rola junto com o conteúdo e some ao descer no editor. A barra de ferramentas + a lista de campos passam a ficar fixas no topo da área de edição, com o corpo do contrato rolando por baixo — assim dá para inserir variáveis em qualquer ponto do texto sem voltar ao topo.

## 3. Forma de pagamento

- O bloco de Pagamento (forma, parcelas, vencimentos) fica disponível já na etapa **Entrada**, para ser preenchido por vocês.
- A variável **[forma_pagamento]** passa a gerar sempre o mesmo formato, uma parcela por linha:

```text
R$ 1.000,00 com vencimento em 10/09/2026;
R$ 1.000,00 com vencimento em 10/10/2026;
R$ 1.000,00 com vencimento em 10/11/2026.
```

- Pagamento em parcela única gera uma linha só, no mesmo formato.
- Sem parcelas informadas, o campo continua marcado como pendente no contrato.

## Detalhes técnicos

- Migração: `ALTER TABLE public.juridico_contratos ADD COLUMN evento_nome text;` (a coluna `forma_pagamento` já existe e não será usada; o texto sai das parcelas).
- `src/routes/api/public/*` (endpoint de solicitação de contrato) e `src/routes/solicitar-contrato.tsx`: novo campo com validação obrigatória e envio no payload.
- `src/routes/juridico.index.tsx`: campo `evento_nome` no formulário do card; `PagamentoEditor` exibido também no status entrada.
- `src/lib/juridico/modelo-render.ts`: `evento_nome`/`nome_evento` no mapa de variáveis e em `CAMPOS_SUGERIDOS`; `forma_pagamento` passa a usar um novo `pagamentoTexto(parcelas)` (`fmtMoeda + " com vencimento em " + fmtData`, separadas por `<br>`, última com ponto final) e entra em `CAMPOS_HTML` do render.
- `src/routes/juridico.modelos.tsx`: editor com cabeçalho fixo (`sticky`) e corpo em contêiner com rolagem própria.
