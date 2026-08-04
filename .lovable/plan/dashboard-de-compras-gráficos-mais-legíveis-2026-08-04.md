# Dashboard de Compras — gráficos mais legíveis

Ajustes visuais em `src/routes/compras.dashboard.tsx`. Nenhuma mudança de dados ou de regra de negócio.

## 1. "Compras por categoria" e "Compras por condição de pagamento"

Hoje são pizzas com rótulos numéricos sobrepostos e legendas gigantes.

Trocar as duas por **gráficos de barras horizontais** (mesma leitura do "Compras por fornecedor"):
- Barras ordenadas do maior para o menor valor.
- Nome da categoria/condição no eixo esquerdo, com largura maior (180px) e truncamento com reticências para nomes longos.
- Valor em R$ exibido no fim de cada barra e no tooltip.
- Sem legenda (o eixo já nomeia cada barra).
- Altura dinâmica (~28px por barra) para nunca comprimir os rótulos; limite dos 12 maiores + agrupamento "Outros" quando houver mais.

## 2. "Compras por status (qtd)"

Ordenar as barras conforme a sequência real do quadro (Solicitação → Análise → Pendente Aprovação → Aprovada → Em Andamento → A Receber → Finalizado → Negada), usando a ordem já definida em `COMPRA_STATUSES`, incluindo status com zero para manter o passo a passo visível. Rótulos do eixo X em duas linhas em vez de inclinados, e cor de cada barra igual à cor do status no quadro.

## 3. "Saving por fornecedor"

Nomes longos se empilham e colidem. Corrigir com:
- Largura do eixo de 120 para 200px e truncamento em ~28 caracteres com reticências (nome completo no tooltip).
- Altura dinâmica por número de barras, com espaçamento mínimo entre elas.

## Detalhes técnicos

- Substituir os dois `PieChart` por `BarChart layout="vertical"` com `<LabelList>` formatado em BRL.
- Criar um pequeno helper local `truncate(nome, n)` e um `tickFormatter` no `YAxis`.
- Reaproveitar `COMPRA_STATUSES` (`src/lib/compras.ts`) para ordem e cores; converter as classes `bg-*` para os hex correspondentes num mapa local.
- Remover os imports `PieChart`/`Pie`/`Cell` se ficarem sem uso.
