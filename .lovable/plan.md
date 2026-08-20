# Ordenação Família → Nome → Medida (Relatórios de Patrimônio)

Hoje a ordenação usa a especificação inteira como texto, então dentro de "GRIDE Q25" os itens ARCO e PEÇA ficam intercalados conforme a medida. A ordenação passa a separar a especificação em duas partes.

## O que muda

- A especificação é dividida em **família** (o que vem antes do `|`, ex.: "GRIDE Q25") e **medida** (o que vem depois, ex.: "3,00M").
- A ordenação passa a ser: **Família → Nome do item → Medida (numérica)**.
  - Ex.: GRIDE Q25 → ARCO (3,00M, 8,00M) → MEIO CUBO (0,20M) → PEÇA (0,50M, 0,75M, 1,00M, 1,50M...) → depois GRIDE Q30.
- Itens sem especificação continuam agrupados e ordenados por nome, ficando no fim da lista de forma consistente.
- Vale para a tela (modos Detalhado, Consolidado e Conferência) e para os três PDFs.
- O rótulo do seletor "Ordenar por" passa a ser "Especificação (Gride) → Nome → Medida".

## Detalhes técnicos

- `src/routes/patrimonio.relatorios.tsx`: reescrever `compareEspecThenNome` para extrair `familia`/`medida` via split no `|` (fallback: regex que separa o primeiro trecho numérico com unidade), comparando família com `localeCompare(pt-BR, {numeric:true})`, depois nome, depois medida parseada como número (com fallback textual). Vazios ordenados por último.
- `src/lib/patrimonio/relatorio-pdf.ts`: usar o mesmo comparador nos geradores detalhado, consolidado e folha de conferência — extrair o helper para um módulo compartilhado (ex.: `src/lib/patrimonio/ordenacao.ts`) e importar nos dois arquivos.
- Sem mudanças de banco de dados.
