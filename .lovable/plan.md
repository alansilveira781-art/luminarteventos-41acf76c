## 1. Quadro Financeiro sempre com 4 colunas lado a lado

Arquivo: `src/routes/financeiro-op.quadro.tsx`

- Trocar o container das colunas de `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4` para `flex gap-4 overflow-x-auto pb-2`.
- No componente `Coluna`, adicionar `min-w-[280px] shrink-0` ao wrapper para garantir largura fixa e permitir scroll horizontal em telas estreitas.
- Manter DndContext, cards, placeholder "Sem cards" e contador intactos.

## 2. Migrar Compra → Despesa (só em "Solicitação de Compra")

### Botão no card
Em `src/routes/compras.index.tsx`, no componente do card do Kanban:
- Renderizar um botão discreto "Migrar para Despesa" (ícone + label) apenas quando `compra.status === "solicitacao"` **e** `canEditCompra(...)` for verdadeiro (mesma lógica já usada para outras ações do card).
- Em outros status, o botão não aparece.

### Dialog de escolha do tipo
Novo componente inline (ou arquivo `src/components/MigrarCompraDialog.tsx`):
- Select com as opções de `TIPO_DEMANDA_OPTIONS` (de `@/lib/demandas`).
- Botões "Cancelar" e "Confirmar migração".

### Fluxo de migração (sequencial e seguro)
Ao confirmar:

1. **Buscar itens da compra** (`compra_itens` por `compra_id`).
2. **Criar a demanda** em `demandas` copiando campos comuns:
   - `titulo, fornecedor, fornecedor_id, solicitante, solicitante_id, valor_total, observacoes, data_solicitacao, responsavel_id, responsavel_nome, numero_nf, numeros_nf, tem_nf, parcelamento, condicao_pagamento, documento, created_by`
   - `tipo_demanda = <tipo escolhido>`, `status = 'solicitacao'`.
   - Não copiar: `tipo_compra, empresa_faturada, data_servico`.
3. **Itens vs descritivo** — decidir por `TIPOS_COM_ITENS.includes(tipoEscolhido)`:
   - **Com itens:** inserir em `demanda_itens` (`demanda_id`, `descricao`, `quantidade`, `unidade`, `valor_unitario`).
   - **Sem itens:** gerar texto tipo `"2x Cabo HDMI — R$ 50,00; 1x Fonte — R$ 120,00"` a partir dos itens da compra, concatenar com `observacoes` existentes e atualizar/gravar no campo descritivo da demanda.
4. **Só depois** excluir `compra_itens` e a `compra` original.
5. Se qualquer passo antes da exclusão falhar → abortar, não excluir a compra, mostrar `toast.error`.

### Feedback
- `toast.success("Compra migrada para Despesa")`.
- Invalidar queries: quadro de compras e listas de demandas.

## Fora de escopo
- Não alterar o fluxo normal dos outros status de compras.
- Não mudar nenhuma outra tela.

## Confirmação necessária
Verificar durante a implementação o nome exato do campo "descritivo" em `demandas` (provavelmente `descritivo` ou `descricao`) lendo o schema antes de escrever; se não existir campo dedicado, concatenar tudo em `observacoes`.
