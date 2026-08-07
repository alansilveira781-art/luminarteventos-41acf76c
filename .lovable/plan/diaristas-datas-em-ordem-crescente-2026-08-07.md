# Diaristas: datas em ordem crescente

## O que muda

Hoje os apontamentos de diaristas são carregados da data mais nova para a mais antiga.
Passam a aparecer da mais antiga para a mais recente (ordem crescente), tanto na lista de
apontamentos quanto no fechamento e no relatório em PDF.

## Detalhes técnicos

Arquivo: `src/routes/financeiro-op.diaristas.index.tsx` (consulta de apontamentos, ~linha 230).
Trocar `.order("data", { ascending: false }).order("created_at", { ascending: false })` por
`ascending: true` em ambos. O fechamento (`linhas`) e o PDF (`diaristas-pdf.ts`) consomem
essa mesma lista na ordem recebida, então herdam a ordenação crescente sem outras mudanças.

Sem mudanças de banco de dados.
