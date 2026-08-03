# Adicionar tipos de despesa: Manutenção Estrutura e Manutenção Equipamentos

## Objetivo
Incluir dois novos tipos de despesa no módulo **Despesas**, disponíveis no seletor de tipo de despesa e em todos os lugares que consomem a lista de tipos (formulário, dashboard, filtros, etc.).

## O que será feito
1. **Adicionar opções em `src/lib/demandas.ts`**
   - `manutencao_estrutura` → "Manutenção Estrutura"
   - `manutencao_equipamentos` → "Manutenção Equipamentos"
   - Inserir junto aos demais tipos de manutenção para manter agrupamento lógico.

2. **Comportamento padrão**
   - Os novos tipos serão tratados como despesa descritiva/livre, igual a "Manutenção do Galpão", "Manutenção de Veículos" e "Manutenção de Maquinário".
   - Não entrarão em `TIPOS_COM_ITENS`, `TIPOS_QUE_VAO_PARA_ESTOQUE` nem `TIPOS_QUE_VAO_PARA_PATRIMONIO`, a menos que o usuário peça um comportamento diferente.

3. **Verificação**
   - Confirmar que as novas opções aparecem no `<Select>` de tipo de despesa (`DemandaDialog` / `solicitar.tsx`).
   - Confirmar que os labels aparecem corretamente no dashboard financeiro e nos filtros.

## Não será feito nesta tarefa
- Nenhuma alteração no banco de dados (a coluna `tipo_demanda` já é `text`).
- Nenhuma mudança em fluxos de estoque/patrimônio ou permissões específicas para esses tipos.
