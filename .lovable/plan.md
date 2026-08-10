# Corrigir rotinas que "somem" do calendário ao navegar entre as abas

## O que está acontecendo

A rotina é salva corretamente no banco (frequência Semanal, segunda, 08:00, Ativa). O problema é só de exibição.

A aba **Validações** carrega uma lista de rotinas reduzida (apenas identificador e título) usando a mesma "gaveta de cache" da lista principal. Ao abrir essa aba, os dados completos são substituídos pela versão reduzida. Quando você volta para Tabela ou Calendário:

- Frequência, Hora e Período aparecem em branco
- O status vira "Pausada" (porque o campo sumiu)
- O Calendário fica vazio, já que ele só mostra rotinas ativas

## Correção

Dar uma chave de cache própria à consulta enxuta da aba Validações (por exemplo, uma lista "nomes de rotinas"), sem tocar na consulta principal. Assim as duas abas convivem sem sobrescrever uma à outra.

Aplicar em ambas as telas de rotinas, que hoje são cópias praticamente idênticas:

- `src/routes/financeiro.rotinas.tsx` (linha ~1214)
- `src/routes/financeiro-op.rotinas.tsx` (linha ~1168)

Também revisar as invalidações relacionadas para que a nova chave seja atualizada quando necessário.

## Verificação

Criar/abrir uma rotina, percorrer Tabela → Calendário → Execução → Validações → Tabela e confirmar que frequência, hora, período e status continuam preenchidos e que a rotina segue aparecendo no calendário.
