# Diaristas: nova seção Relatórios

## O que muda

No módulo Financeiro > Diaristas entra uma terceira aba **Relatórios**, ao lado de Apontamento e Fechamento.

Nela é possível gerar relatórios filtrando por:
- **Período** (De / Até) — padrão: mês atual;
- **Pessoa** (diarista) — Todos ou um diarista específico;
- **Departamento** — Todos / Marcenaria / Estrutura / Iluminação / Sem departamento;
- **Local** (Fortaleza / Fora) mantido como filtro auxiliar, igual ao Fechamento.

A apresentação segue exatamente a formatação da aba Fechamento:
- tabela consolidada por pessoa (Diarista, Chave Pix, Dias, Total de horas, Total a pagar), com valor/hora sob o nome;
- linha expansível com o detalhamento diário (Data, Projeto, Local, Horário, Horas, Diária, Extra, Refeições, Total);
- rodapé com totais gerais;
- exportação em **PDF (relatório)**, **Excel (.xlsx)** e **CSV**, usando o mesmo gerador já existente, com os filtros aplicados impressos no cabeçalho do PDF.

Nada muda no cálculo de horas e valores, nem nas abas existentes.

## Detalhes técnicos

- `src/routes/financeiro-op.diaristas.index.tsx`:
  - extrair o corpo atual de `FechamentoTab` para um componente reutilizável `FechamentoView` que recebe props de período inicial e título/rótulo do arquivo exportado (`fechamento-diaristas` vs `relatorio-diaristas`);
  - `FechamentoTab` passa a renderizar `FechamentoView` com o período padrão da semana anterior (comportamento atual preservado);
  - novo `RelatoriosTab` renderiza `FechamentoView` com período padrão do mês atual;
  - adicionar `<TabsTrigger value="relatorios">Relatórios</TabsTrigger>` e o `TabsContent` correspondente.
- Reuso integral de `calcularApontamento`/`calcularApontamentoComEventos`, `useApontamentos`, `useDiaristas` e `src/lib/diaristas-pdf.ts` — sem novos arquivos e sem mudanças de banco.
- Acesso: a aba Relatórios segue a mesma regra de visibilidade já aplicada à aba Fechamento.
