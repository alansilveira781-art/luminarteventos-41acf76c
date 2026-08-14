# Padronizar rolagem vertical no relatório de Cartões

## Problema
Na aba **Compras › Relatórios › Cartões**, a tabela de lançamentos cresce verticalmente sem limite quando há muitos registros, causando uma rolagem "quase infinita" na página. O usuário quer o mesmo padrão das outras telas: uma rolagem vertical contida dentro de uma área delimitada.

## Solução
Aplicar altura máxima e `overflow-y-auto` no wrapper da tabela em `CartoesReport.tsx`, seguindo o padrão usado em outras listagens do projeto (ex.: Compras, Estoque, Entradas/Saídas usam `max-h-[calc(100vh-180px)]`).

## Alterações
1. Em `src/components/compras/CartoesReport.tsx`, substituir o wrapper atual:
   ```tsx
   <div className="overflow-x-auto rounded-lg border">
   ```
   por:
   ```tsx
   <div className="overflow-auto rounded-lg border max-h-[calc(100vh-180px)]">
   ```
   Isso limita a altura da tabela ao viewport menos o espaço do header/filtros, mantendo o cabeçalho visível e a rolagem apenas na área da tabela.

## Critérios de aceitação
- A tabela de Cartões não estende a página indefinidamente.
- Aparece barra de rolagem vertical no corpo da tabela quando o conteúdo excede a altura máxima.
- O cabeçalho e os filtros permanecem fixos acora da tabela.
- O layout continua responsivo em telas menores.
