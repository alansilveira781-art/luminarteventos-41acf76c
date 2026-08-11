# Evento / Projeto obrigatório nas compras

## O que muda

1. **O evento enviado pelo formulário `/solicitar` aparece preenchido no card**
   Hoje o card de compra decide sozinho se o evento é "de lista" ou "texto livre": quando o código enviado pelo formulário não é encontrado na lista carregada (planilha + calendário), ele cai no modo texto e o seletor aparece vazio. Com a remoção do modo livre (item 2), o valor gravado passa a ser sempre exibido no seletor de Evento / Projeto do item.

2. **Fim do "É para um evento? Sim / Não" no card de compras**
   No diálogo da compra, cada item passa a ter apenas o seletor de Evento / Projeto (lista do calendário/planilha), marcado como obrigatório. O mesmo vale para o formulário público `/solicitar`: sem a opção "Não", só a lista de eventos.

3. **Trava na passagem Análise → Pendente Aprovação**
   O card só avança (arrastando ou pelo botão de avançar) se **todos** os itens listados tiverem Evento / Projeto preenchido. Caso contrário, aparece um aviso dizendo que falta o evento em X item(ns) e a movimentação é cancelada.

4. **Migração Compra → Despesa** passa a levar o evento de cada item (hoje esse campo é perdido).

## Detalhes técnicos

- `src/components/CompraDialog.tsx`: remover `itemLivreMode` / `setModoLivre` / `eventosValidosSet` e o `Select` Sim-Não; renderizar sempre `EventoSheetCombobox` com rótulo "Evento / Projeto *". Ao salvar, se algum item estiver sem evento e a compra já estiver em análise ou adiante, mostrar aviso (o bloqueio duro fica na movimentação).
- `src/routes/solicitar.tsx`: remover `evento_livre` do `ItemRow` e o bloco Sim/Não; manter só `EventoPublicCombobox`; incluir evento na validação de itens obrigatórios antes de avançar/enviar.
- `src/routes/compras.index.tsx`:
  - nova consulta leve dos itens (`compra_itens: compra_id, evento_projeto`) para o quadro, com cache do React Query;
  - em `advanceToStatus`, antes de qualquer chamada de RPC: se `status === "pendente_aprovacao"`, verificar itens sem `evento_projeto` (e itens inexistentes) e bloquear com `toast.error`;
  - `MigrarCompraDialog`: incluir `evento_projeto` no `select` dos itens e no insert em `demanda_itens`.
