# Bonificação: eventos em andamento e linha de produtor sumindo

## 1. "ATIVAÇÃO RIOMAR DIA DOS PAIS" não aparece

Verificado no banco: o evento tem início 31/07/2026 e **fim 23/08/2026**. A lista de Bonificação só considera eventos cuja data final já passou (`data_fim <= hoje`), então ele fica de fora — mesmo tendo começado em julho.

Como resolver: o critério de "evento realizado" passa a ser a **data de início já ocorrida** (`data_inicio <= hoje`), mantendo o agrupamento por mês pela data de início. Assim, eventos que começaram no mês e ainda estão em andamento aparecem normalmente, com um indicador discreto "em andamento" ao lado do nome quando a data final ainda não passou.

## 2. Segunda linha de produtor some ao salvar

Reproduzido na lógica: ao adicionar uma segunda linha de produtor e salvar a primeira, o recarregamento dos dados **substitui todas as linhas do evento** pelas que estão gravadas no banco, apagando a segunda linha que ainda não tinha sido salva. Confirmado no banco: nenhum evento tem hoje duas linhas de produtor gravadas.

Como resolver: o recarregamento passa a **mesclar** — as linhas já gravadas são atualizadas/inseridas pelo id, e as linhas em edição ainda não salvas permanecem na tela. Salvar uma linha também passa a marcar essa linha com o id retornado, para não duplicar num segundo salvamento.

## Detalhes técnicos

- `src/lib/comercial/bonificacao.ts` (`useEventosRealizados`): trocar o filtro `dataFim <= hoje` por `dataInicio <= hoje`; adicionar `emAndamento: boolean` (`dataFim > hoje`) ao tipo `EventoRealizado`.
- `src/components/financeiro/DistribuicaoBonificacao.tsx`:
  - `EventoBonif` ganha `emAndamento`; badge "em andamento" ao lado do nome.
  - Reescrever o merge no `useEffect`: para cada evento, reconciliar por `bonifId` (mantendo linhas locais sem `bonifId` e sem duplicar as vindas do banco) em vez de `next[eid] = linhasSalvas`.
  - `useBonificacaoEventoMutations.upsert` retorna o `id` da linha gravada; `salvarLinha` grava esse `bonifId` no estado local.
- Sem mudanças de banco de dados.
