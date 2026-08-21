# Tipos de despesa personalizáveis

Hoje a lista de tipos no quadro de despesas é fixa no código. A ideia é permitir que administradores criem novos tipos direto no campo, sem depender de alteração de sistema.

## Como vai funcionar

- No card de despesa, o campo "Tipo de despesa" ganha a opção **+ Novo tipo** no final da lista (visível somente para administradores gerais ou admins do módulo Despesas).
- Ao clicar, abre um mini-formulário com:
  - **Nome do tipo** (ex.: "Marketing")
  - **Exige lista de itens?** (mostra a grade de itens com cotação, desconto, IPI, frete etc.)
  - **Gera recebimento?** Nenhum / Estoque / Patrimônio
- Ao salvar, o tipo já fica selecionado no card e passa a aparecer para todos os usuários (inclusive no formulário público `/solicitar`, nos filtros do quadro, no dashboard e nas telas de "A receber").
- Os tipos atuais continuam existindo e funcionando igual; os novos apenas se somam à lista.
- Uma tela simples de gestão não está incluída neste escopo — os tipos criados podem ser desativados depois se você pedir.

## Detalhes técnicos

- Nova tabela `demanda_tipos`: `id`, `slug` (gerado do nome), `label`, `exige_itens` (bool), `destino_recebimento` (`nenhum` | `estoque` | `patrimonio`), `ativo`, `ordem`, `created_at`.
  - GRANTs: SELECT para `authenticated`, escrita restrita a administradores; ALL para `service_role`.
  - RLS: leitura para usuários autenticados; INSERT/UPDATE apenas para `is_admin()` ou `is_module_admin(auth.uid(), 'despesas')`.
  - Migração faz seed com os tipos fixos atuais (mesmos slugs) para virar fonte única.
- Novo hook `useTiposDespesa()` (React Query) que lê a tabela e devolve: lista de opções, `tiposComItens`, `tiposParaEstoque`, `tiposParaPatrimonio`.
- `src/lib/demandas.ts` mantém os arrays atuais como fallback e ganha helpers que aceitam os tipos dinâmicos (`proximoStatusDemanda` passa a receber os conjuntos vindos do hook).
- Telas atualizadas para consumir o hook em vez da constante: `DemandaDialog.tsx`, `compras.index.tsx`, `financeiro.dashboard.tsx`, `estoque.a-receber.tsx`, `patrimonio.a-receber.tsx` e `solicitar.tsx` (esta última via lista pública lida por policy `anon` de leitura).
- Validação com zod no formulário: nome obrigatório, até 60 caracteres, slug único (erro amigável se já existir).
