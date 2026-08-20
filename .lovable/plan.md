# Impressão seletiva de colaboradores (RH)

Hoje o botão "Imprimir" em RH > Colaboradores gera o relatório com **todos os registros que passam pelos filtros**, e o filtro de Departamento aceita apenas um valor por vez. As caixas de seleção da tabela existem, mas hoje só servem para edição em lote.

## O que muda

1. **Imprimir somente os selecionados**
   - Se houver colaboradores marcados nas caixas de seleção, o relatório sai apenas com eles.
   - Se não houver nenhum marcado, mantém o comportamento atual (imprime a lista filtrada).
   - O botão passa a indicar isso: "Imprimir (N selecionados)" quando houver seleção.
   - Na barra de ações em lote (que aparece quando há seleção) entra também um botão "Imprimir selecionados".

2. **Filtro de Departamento com múltipla escolha**
   - O seletor de departamento vira um menu com caixas de seleção, permitindo marcar vários departamentos ao mesmo tempo (ex.: Produção + Administrativo).
   - Rótulo do botão: "Todos departamentos", o nome do departamento quando for um só, ou "N departamentos" quando forem vários.
   - Opção "Limpar" para voltar a todos.
   - A lista da tabela e o relatório respeitam a seleção múltipla.

3. **Cabeçalho do relatório**
   - Os chips de filtro passam a listar os departamentos escolhidos.
   - Quando a impressão for de itens marcados, o subtítulo indica "Seleção manual · N registro(s)".

## Detalhes técnicos

- Arquivo: `src/routes/rh.colaboradores.tsx`.
- `fDep: string` vira `fDeps: string[]` (vazio = todos); ajustar `filtrados` e `imprimirRelatorio`.
- Seletor múltiplo com `Popover` + `Checkbox` (componentes já usados no projeto), substituindo o `Select` de departamento.
- `imprimirRelatorio` recebe a lista a imprimir: `selected.size > 0 ? filtrados/rows marcados : filtrados`.
- Sem alterações de banco de dados nem de permissões.
