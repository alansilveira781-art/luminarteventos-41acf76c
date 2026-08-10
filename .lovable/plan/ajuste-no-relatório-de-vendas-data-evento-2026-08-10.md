# Ajuste no relatório de vendas — Data Evento

## Objetivo
No módulo Comercial → Vendas, o relatório PDF exportado deve exibir a coluna **"Data Evento"** (campo `dataEvento`) como primeira coluna, em vez de **"Data registro"**.

## Estado atual confirmado
- A tabela da tela (`src/routes/comercial.vendas.tsx`) já lista "Data do Evento" primeiro e "Data de Registro" em segundo.
- O CSV exportado pela tela também começa com "Data do Evento".
- O relatório PDF (`src/lib/comercial/vendas-relatorio.ts`) foi alterado anteriormente para mostrar "Data registro" e usar `dataRegistro`.

## Mudanças
1. Em `src/lib/comercial/vendas-relatorio.ts`:
   - Alterar o cabeçalho da primeira coluna de `"Data registro"` para `"Data Evento"`.
   - Alterar o corpo da tabela para usar `fmtData(l.dataEvento)` em vez de `fmtData(l.dataRegistro)`.
   - Manter o `colSpan` do rodapé (8 colunas) e as larguras já ajustadas anteriormente.

## Fora de escopo
- Não alterar a listagem na tela nem o CSV (já estão corretos).
- Não alterar formulários, RLS, banco de dados ou outros relatórios.
