# Adicionar tipo de despesa "Combustível"

## Objetivo
Incluir a opção **Combustível** no seletor de tipo de despesa do módulo **Despesas**, disponível no formulário, dashboard e filtros.

## O que será feito
1. **Adicionar opção em `src/lib/demandas.ts`**
   - `combustivel` → "Combustível"
   - Inserir junto aos demais tipos de manutenção/veículo para manter agrupamento lógico.

2. **Comportamento padrão**
   - Será tratado como despesa descritiva/livre, igual a "Manutenção de Veículos", "Manutenção do Galpão", "Pro Labore", etc.
   - Não entrará em `TIPOS_COM_ITENS`, `TIPOS_QUE_VAO_PARA_ESTOQUE`, `TIPOS_QUE_VAO_PARA_PATRIMONIO` nem `TIPOS_QUE_VAO_PARA_RECEBIMENTO`.

3. **Verificação**
   - Confirmar que a nova opção aparece no `<Select>` de tipo de despesa (`DemandaDialog` / formulário de solicitação).
   - Confirmar que o label aparece corretamente no dashboard e nos filtros.

## Não será feito nesta tarefa
- Nenhuma alteração no banco de dados (a coluna `tipo_demanda` já é `text`).
- Nenhuma mudança em fluxos de estoque/patrimônio, permissões ou regras específicas para esse tipo.
