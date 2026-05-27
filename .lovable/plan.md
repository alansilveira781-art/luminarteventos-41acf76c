# Plano de ajustes

## 1. Estoque — histórico de movimentação do item

**Bug raiz:** a query em `src/routes/estoque.$itemId.tsx` lê apenas `movimentacoes` filtrando por `item_id`. Mas saídas/devoluções com vários itens são gravadas em `movimentacao_itens` (filhos) com `movimentacoes.item_id = NULL`. Por isso essas operações não aparecem no histórico.

**Correção:**
- Buscar movimentações onde `item_id = X` **OU** que tenham linha em `movimentacao_itens` com aquele `item_id`.
- Trazer a quantidade efetiva: se vier de `movimentacao_itens`, usar a quantidade do item; caso contrário, `movimentacoes.quantidade`.
- Adicionar **coluna "Requisição"** exibindo `requisicao_numero` (link para a movimentação quando aplicável).
- Garantir refresh após nova saída/devolução: invalidar `["item-movs", itemId]` e `["item", itemId]` (já é feito globalmente, mas conferir no diálogo de saída/devolução para invalidar essas chaves específicas).

**Arquivo:** `src/routes/estoque.$itemId.tsx` + invalidações em `src/routes/saidas.tsx` e `src/routes/devolucoes.tsx`.

## 2. Compras — Dashboard cruzamento Fornecedor × Itens comprados

Em `src/routes/compras.dashboard.tsx`, adicionar uma seção nova:
- Campo de busca por nome de fornecedor (com debounce).
- Ao selecionar/digitar, listar os itens já comprados desse fornecedor (origem: `movimentacoes` tipo `entrada` com `fornecedor_id` + join com `itens`), agregando: quantidade total comprada, último valor unitário, última data de compra, nº de compras.
- Tabela ordenável.

**Arquivo:** `src/routes/compras.dashboard.tsx`.

## 3. Comercial

### 3a. Novo status "Orçamento Validado" entre Projeto e Orçamento Enviado
- Em `src/lib/comercial/types.ts` adicionar `{ key: "orcamento_validado", label: "Orçamento Validado", color: "bg-violet-500" }` entre `projeto` e `orcamento_enviado`.
- Regra: ao **criar** proposta o card vai para `orcamento_validado` (antes ia para `orcamento_enviado` via aprovação). Só ao **validar/aprovar** a proposta o card avança para `orcamento_enviado`.
- Ajustar `aprovarProposta` em `src/lib/comercial/store.ts` (ele continua movendo para `orcamento_enviado` quando a proposta é aprovada — manter, mas `createProposta` agora move o card para `orcamento_validado`, não diretamente para `orcamento_enviado`).

### 3b. Filtros no Quadro de Vendas
- Em `src/routes/comercial.index.tsx` adicionar barra de filtros: vendedor (responsável), período (de/até em `eventoDataInicio`), tipo de negócio (`TIPOS_EVENTO`).
- Filtrar `cards` antes de agrupar por status.

### 3c. Versionamento de propostas
- Adicionar campos em `Proposta` (types.ts):
  - `parentId?: string | null` — id da proposta original
  - `version: number` (default 1)
- Nova ação `criarNovaVersao(propostaId)` no store: clona a proposta, incrementa version, mantém o mesmo `parentId` (ou usa o id da raiz), e:
  - move o card vinculado de volta para `projeto` → depois quando aprovada vai para `orcamento_validado` → quando enviada vai para `orcamento_enviado`.
- No drawer/listagem de propostas (`comercial.propostas.tsx` e `DetalhesDrawer.tsx`): mostrar histórico de versões da proposta (todas que compartilham `parentId`/raiz), com botão "Nova versão" quando status estiver em negociação.
- Helper `getVersoesProposta(rootId)` para listar versões ordenadas.

**Arquivos:** `src/lib/comercial/types.ts`, `src/lib/comercial/store.ts`, `src/routes/comercial.index.tsx`, `src/routes/comercial.propostas.tsx`, `src/components/comercial/DetalhesDrawer.tsx`, `src/components/comercial/PropostaWizard.tsx` (para gerar nova versão a partir da existente).

## 4. Formulário público `/solicitar` — opção Reembolso

Em `src/routes/solicitar.tsx`:
- Adicionar checkbox/switch **"É um reembolso?"**.
- Quando marcado:
  - Mostrar campo obrigatório **"Nome de quem será reembolsado"**.
  - **Ocultar** os campos relativos a "foi pago" / condições de pagamento já preenchidas (manter dados de produto/valor).
- Persistir no payload (tipo de demanda = reembolso ou flag dedicada). Verificar endpoint `src/routes/api/public/solicitar.ts` para aceitar os novos campos e gravá-los em `observacoes`/`tipo_demanda` ou colunas equivalentes em `demandas`.

**Sem mudanças de schema obrigatórias:** usar `tipo_demanda = "reembolso"` e armazenar o nome no campo `observacoes` ou `descritivo` da tabela `demandas` (já existem). Se preferível, adiciono coluna `reembolsar_para text` em `demandas` via migração — confirme se quer essa coluna dedicada.

---

## Resumo de arquivos a editar
- `src/routes/estoque.$itemId.tsx` (histórico + coluna requisição)
- `src/routes/saidas.tsx`, `src/routes/devolucoes.tsx` (invalidações)
- `src/routes/compras.dashboard.tsx` (cruzamento fornecedor × itens)
- `src/lib/comercial/types.ts`, `src/lib/comercial/store.ts`
- `src/routes/comercial.index.tsx` (filtros + novo status)
- `src/routes/comercial.propostas.tsx`, `src/components/comercial/DetalhesDrawer.tsx`, `src/components/comercial/PropostaWizard.tsx` (versionamento)
- `src/routes/solicitar.tsx`, `src/routes/api/public/solicitar.ts` (reembolso)

## Pontos a confirmar
1. Para reembolso em `/solicitar`: prefere coluna dedicada `reembolsar_para` em `demandas` (migração) ou guardo no campo `observacoes`/`descritivo`?
2. Versionamento: quando criar nova versão, o card volta para **"projeto"** (como você descreveu) e depois segue o fluxo normal (projeto → orçamento validado → orçamento enviado). Confirma?
