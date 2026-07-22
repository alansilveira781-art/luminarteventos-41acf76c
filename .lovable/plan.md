## Objetivo

Na aba **Análise Detalhada** do Dashboard Financeiro (Conta Azul), ignorar completamente lançamentos das categorias:

- `CD - ACERVO DECORATIVO`
- `CD - Decoração`
- `CV - EPI INDIVIDUAL`
- `MAQUINÁRIO`
- `FARDAMENTO`

O **Painel Financeiro** (visão geral em regime de caixa) e demais telas permanecem inalterados.

## Escopo

Alteração isolada no componente `AnaliseDetalhada` dentro de `src/components/financeiro/ContaAzulDashboard.tsx`. Nada de mudanças em `dre.ts`, sync, banco ou outras abas.

## Implementação

1. Criar constante local no topo do componente `AnaliseDetalhada`:
   ```ts
   const CATEGORIAS_EXCLUIDAS_ANALISE = new Set([
     "cd - acervo decorativo",
     "cd - decoração",
     "cv - epi individual",
     "maquinário",
     "fardamento",
   ]);
   const isExcluida = (nome?: string | null) =>
     !!nome && CATEGORIAS_EXCLUIDAS_ANALISE.has(nome.trim().toLowerCase());
   ```
   Comparação case-insensitive + trim para tolerar variações de digitação; acentos preservados (nomes vêm do plano de contas do Conta Azul, sempre com a mesma grafia).

2. **Filtrar lançamentos do Conta Azul** antes de passar para `calcularDRECaixa`:
   - Derivar `pagarRowsFiltrados` / `receberRowsFiltrados` a partir de `pagarRows`/`receberRows`, descartando linhas cuja `categoria_external_id` mapeia (via `planoMap`) para um nome na lista de exclusão.
   - Usar essas variáveis filtradas no `useMemo` que calcula `{ totais, grupos }` (linha ~944) e no de `variacoes` (comparativo com ano anterior).

3. **Filtrar saídas de estoque** (`stockAgg`): quando o nome mapeado da categoria estiver na lista, ignorar a linha ao agregar. Assim o card "Saídas de Estoque" também respeita a exclusão.

4. **Reprocessar por categoria (`CategoryReprocessButton`)**: as categorias excluídas simplesmente não aparecem mais nas linhas do DRE da Análise Detalhada, então o botão some naturalmente para elas — sem trabalho extra.

## Validação

- Abrir a Análise Detalhada e conferir que nenhuma das 5 categorias aparece nas linhas do DRE nem no card "Saídas de Estoque".
- Painel Financeiro (aba anterior) continua mostrando todas as categorias normalmente.
- Comparativo com ano anterior recalculado sem essas categorias em ambos os períodos (base justa).
