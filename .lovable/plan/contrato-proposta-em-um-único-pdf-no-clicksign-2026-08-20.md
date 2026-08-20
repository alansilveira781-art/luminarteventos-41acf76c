# Contrato + Proposta em um único PDF no Clicksign

## Objetivo
Ao enviar para assinatura, o documento gerado deve conter o contrato e, logo em seguida, a proposta anexada ao card — um único PDF "Contrato + Proposta".

## Comportamento
1. No envio para assinatura, o sistema busca o anexo do card com tipo `proposta` (o mesmo já obrigatório para avançar para Validação).
2. Gera o PDF do contrato como hoje e **anexa as páginas da proposta ao final**.
   - Proposta em PDF: todas as páginas são acrescentadas.
   - Proposta em imagem (JPG/PNG): vira uma página A4 ao final, com a imagem ajustada à página.
3. Se não houver proposta anexada, o envio é bloqueado com o aviso "Anexe a proposta antes de enviar para assinatura" (mesma regra do Kanban).
4. O diálogo de envio mostra o nome do arquivo da proposta que será unido, para conferência antes de enviar.
5. O nome do documento no Clicksign continua "EVENTO - LOCAL".

## Detalhes técnicos
- Adicionar a dependência `pdf-lib` (mescla de PDFs no navegador; o `jspdf` atual só gera).
- Em `src/lib/juridico/contrato-pdf.ts` (ou um novo `contrato-merge.ts`): função que recebe o PDF base64 do contrato e os bytes da proposta e devolve um base64 único, usando `PDFDocument.copyPages` para PDF e `embedJpg`/`embedPng` para imagem.
- Em `src/components/juridico/EnviarAssinaturaDialog.tsx`, dentro de `pdfDoContrato`: após gerar/obter o PDF do contrato, baixar o anexo `tipo = 'proposta'` mais recente do bucket `juridico-anexos` e mesclar antes de chamar `enviarParaAssinatura`.
- Sem alteração de schema, RLS ou do fluxo do Clicksign — apenas o binário enviado muda.
