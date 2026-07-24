## Ajustes em RH › Colaboradores

### 1. Filtro Ativos/Desligados
Adicionar novo `Select` no cabeçalho de filtros ao lado de Departamento/Vínculo:
- Opções: **Todos**, **Ativos**, **Desligados**
- Default: **Ativos**
- Aplica sobre o campo `status` (ou equivalente) de `rh_colaboradores`
- O filtro também é respeitado pelo botão **Imprimir** (já reflete filtros ativos)

### 2. Seleção múltipla + Edição em lote
- Adicionar coluna de checkbox na tabela (com checkbox master no header para selecionar/desmarcar todos os visíveis)
- Estado `selectedIds: Set<string>` no componente
- Quando `selectedIds.size > 0`, exibir uma **barra de ações em lote** acima da tabela mostrando:
  - "N colaboradores selecionados"
  - Botão **Editar em lote** → abre `EdicaoLoteDialog`
  - Botão **Limpar seleção**

### 3. Dialog de Edição em Lote
Novo componente com três campos opcionais (só atualiza os preenchidos):
- **Vínculo** (Select: CLT, PJ, Autônomo, Estagiário, etc — mesmas opções do cadastro)
- **Departamento** (Select com valores existentes + input livre)
- **Função/Cargo** (input texto)

Cada campo tem um switch "Alterar este campo" para deixar claro o que será sobrescrito. Ao confirmar, faz `UPDATE ... WHERE id IN (...)` via supabase client, invalida o React Query e limpa seleção.

### Arquivos afetados
- `src/routes/rh.colaboradores.tsx` — filtro status, checkboxes, barra de ações, integração
- `src/components/rh/EdicaoLoteDialog.tsx` (novo) — dialog de edição múltipla

### Fora de escopo
- Sem alterações de schema (usa colunas existentes de `rh_colaboradores`)
- Sem mudanças no PDF além de refletir o novo filtro naturalmente
