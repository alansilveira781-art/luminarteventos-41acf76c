Plano de implementação

1. Editar `src/lib/demandas.ts`.
2. No array `TIPO_DEMANDA_OPTIONS`, inserir após o item `imobilizado`:
   - `{ value: "material_limpeza", label: "Material de Limpeza" }`
   - `{ value: "material_escritorio", label: "Material de Escritório" }`
3. Nenhuma migration será criada (coluna `tipo_demanda` é text livre).
4. Nenhum outro arquivo será alterado.