# Assinatura interna (sem Clicksign) + fechar formulário ao salvar

## 1. Opção "Enviar pelo Clicksign?" no card

- Novo campo no contrato: `usar_clicksign` (padrão: sim).
- Onde escolher: no diálogo de edição do card (aba Dados) e visível como etiqueta no próprio card do Kanban ("Clicksign" ou "Assinatura interna"), com alternância rápida pelo card.

### Fluxo quando **Sim** (como hoje)
Ao mover para Assinatura, abre o envio para Clicksign com o PDF Contrato + Proposta; status e PDF assinado voltam pelo webhook.

### Fluxo quando **Não** (interno)
- Mover para Assinatura **não** abre o diálogo do Clicksign nem envia nada; o card apenas muda de coluna e registra a data de assinatura.
- Para sair de Assinatura e ir para **Concluído**, o card precisa ter os dois anexos:
  - um anexo do tipo `proposta`;
  - um anexo do tipo `contrato` (o contrato assinado, enviado na aba Anexos).
- Faltando algum, a movimentação é bloqueada com aviso claro ("Anexe o contrato assinado antes de concluir") e o card abre na aba Anexos.
- Com os dois anexos presentes, segue o processo normal: abre o assistente de conclusão com cadastro do evento no calendário e da venda no comercial.
- O botão "Enviar para assinatura" some do card e a badge de status Clicksign não aparece nesses cards.

### Voltar cards
Cards internos voltam sem aviso de cancelamento do Clicksign (nada foi enviado), mantendo o registro de motivo no histórico.

## 2. Formulário não fecha ao salvar

No diálogo de edição do contrato, "Salvar dados" atualiza e mostra o toast, mas não fecha. Passa a fechar o diálogo após salvar com sucesso (em caso de erro continua aberto).

## Detalhes técnicos

- Migração: `ALTER TABLE public.juridico_contratos ADD COLUMN usar_clicksign boolean NOT NULL DEFAULT true;` (sem mudança de RLS/grants).
- `src/routes/juridico.index.tsx`:
  - incluir `usar_clicksign` no tipo `Contrato`, no select e no payload de salvar;
  - em `onDragEnd`: pular `setAssinaturaCard` quando `usar_clicksign === false`; para `concluido` desses cards, validar anexos `proposta` e `contrato` via consulta ao banco (extensão da função `temProposta` para uma checagem por tipo) antes de abrir o `ConcluirContratoWizard`;
  - no card do Kanban: badge do modo + esconder o botão de envio/badges Clicksign quando interno;
  - `salvar()` do diálogo de edição chama `onClose()` após `onSaved()`;
  - `confirmarVolta`: `precisaCancelar` também exige `usar_clicksign`.
