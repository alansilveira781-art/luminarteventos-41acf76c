# Bonificação: filtrar pelo mês de início do evento e permitir salvar sem produtor

## O que muda

1. **Listagem por data de início**
   Hoje a lista usa a data final do evento para decidir a que mês/ano ele pertence. Passa a usar a **data de início**: no mês escolhido aparecem apenas os eventos que **começaram** naquele mês (mesmo que terminem no mês seguinte). O critério de "evento já realizado" continua sendo a data final já passada.

2. **Salvar mesmo com eventos sem produtor**
   O botão Salvar (fechar o mês) hoje bloqueia quando existe evento sem produtor. Esse bloqueio é removido: o mês fecha normalmente e os eventos sem produtor entram no fechamento com produtor em branco (sem valor). Em vez do erro, aparece apenas um aviso informando quantos eventos ficaram sem produtor.

## Detalhes técnicos

- `src/lib/comercial/bonificacao.ts`, `useEventosRealizados`:
  - manter o filtro `dataFim <= hoje` (evento realizado);
  - adicionar `dataInicio` (`data_evento`) ao objeto e derivar `ano`/`mes` de `dataInicio` (fallback para `dataFim` quando nulo);
  - `EventoRealizado` ganha `dataInicio: string | null`.
- `src/components/financeiro/DistribuicaoBonificacao.tsx`:
  - remover o `return` que impede fechar o mês quando há eventos sem produtor; trocar por `toast.warning` informativo;
  - no monte de itens do fechamento, gravar também uma linha por evento sem produtor (`produtor_id`/`produtor_nome` nulos, complexidade nula) para o evento constar no fechamento;
  - manter a validação por linha individual (botão "Salvar" da linha continua exigindo produtor).
- Sem mudanças de banco de dados (colunas de produtor já aceitam nulo).
