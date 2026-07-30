## Objetivo

Hoje, no Gantt (coluna "Evento"), um local adicional aparece apenas como `↳ RIOMAR RECIFE`, sem indicar a qual evento pertence. A linha deve ficar autoexplicativa.

## O que muda

Em `src/components/eventos/GanttEventos.tsx`, na coluna fixa da esquerda:

**Evento principal (pai)** — mantém o formato atual, mas com hierarquia visual mais clara:
- Linha 1: código do evento (ex. `20260920`) + nome do evento em destaque
- Linha 2: situação (badge) + produtor

**Local adicional (filho)** — passa a mostrar:
- Linha 1: `↳ RIOMAR RECIFE` (o local), recuado, em destaque
- Linha 2 (nova): nome do evento pai em texto pequeno/esmaecido, ex. `STAND KAIAK · 20260920`
- Linha 3: badge de situação (como hoje)
- Marcador visual de filiação: uma barra/guia vertical à esquerda ligando o filho ao pai, além do recuo
- `title` (tooltip) completo com evento + local + período

Para isso, o componente passa a resolver o registro pai a partir do agrupamento que já existe (`filhosPor` / lista de eventos), sem novas consultas ao banco.

## Ajustes de layout

- Altura da linha aumenta um pouco (de 64px para ~72px) para caber a linha extra sem cortar texto; ou, alternativamente, mantém 64px e o nome do pai fica em uma única linha truncada — vou usar 72px para não cortar.
- Coluna esquerda continua com 280px.
- Legenda e barras do gráfico permanecem inalteradas.

## Fora do escopo

Sem mudanças no banco, no dropdown de eventos (continua listando só os principais) ou nas regras de código de evento.
