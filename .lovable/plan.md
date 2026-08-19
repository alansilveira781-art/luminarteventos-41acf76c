# Voltar cards no Quadro Jurídico com registro

## O que muda

1. **Voltar card entre colunas (retroceder)**
   - Hoje arrastar para trás abre os diálogos de Criação/Conclusão ou simplesmente move. Passa a existir um fluxo explícito de retorno: ao arrastar um card para uma coluna anterior, abre uma confirmação pedindo o motivo (texto curto, opcional) antes de aplicar.
   - Toda mudança de coluna (para frente ou para trás) fica registrada no Histórico do contrato, com autor, data, coluna de origem, coluna de destino e o motivo informado.
   - Ao voltar, os diálogos de Criação e Conclusão não são disparados (eles continuam apenas para avanço).

2. **Voltar de Assinatura para Validação**
   - Além da confirmação normal, aparece um aviso destacado: "Tem certeza? Esta alteração excluirá o contrato enviado para assinatura no Clicksign, e o processo terá que ser reiniciado."
   - Confirmando: o documento é cancelado/excluído no Clicksign, os signatários registrados são removidos, os campos de assinatura do card são limpos (chave do documento, status, datas, erro) e o card volta para Validação.
   - O histórico registra "cancelou o envio para assinatura" com o motivo.
   - Se o Clicksign recusar o cancelamento (por exemplo, documento já finalizado), a operação é interrompida com mensagem explicativa e o card permanece em Assinatura.
   - Cards já concluídos/assinados não podem ser revertidos por esse caminho.

## Detalhes técnicos

- `src/routes/juridico.index.tsx`: em `onDragEnd`, detectar retrocesso pela ordem de `STATUSES`; novo componente `VoltarCardDialog` (motivo + aviso condicional para Assinatura → anterior). Registro em `juridico_historico` (`acao: "mudou_status"` com `status_anterior`/`status_novo` e `detalhe` = motivo); ajustar o painel Histórico para exibir o motivo.
- `src/lib/juridico/clicksign.server.ts`: nova função `cancelarDocumento(documentKey)` chamando o endpoint de cancelamento da API do Clicksign, tratando erros com a mesma tradução de mensagens já existente.
- `src/lib/juridico/clicksign.functions.ts`: nova server function `cancelarAssinatura` (com `requireSupabaseAuth`) que cancela no Clicksign, apaga `juridico_assinaturas` do contrato, limpa os campos `clicksign_*`, muda o status para `validacao` e grava o histórico.
