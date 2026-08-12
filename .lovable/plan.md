# Diaristas: visualização em cards por semana + filtro de situação

## O que muda (aba Apontamento)

### 1. Alternador de visualização
No topo da aba Apontamento entra um seletor **Tabela | Semana**. A tabela atual continua igual; "Semana" mostra a nova visão em cards.

### 2. Visão semanal em cards
- Navegação por semana (segunda a domingo) com setas "anterior / próxima" e botão "Semana atual"; o rótulo mostra o intervalo (ex.: 10/08 – 16/08).
- Um card por dia da semana (Segunda … Domingo), com a data e um resumo no cabeçalho: nº de diaristas, total de horas e total em R$ (o valor só aparece para quem tem permissão de ver valores, como já ocorre hoje).
- Dentro de cada card, a lista dos diaristas que têm apontamento naquele dia: nome/apelido, projeto(s), horário, horas e total. Cada linha traz um selo de situação — **Aberto**, **Pago** (quando já está em um fechamento) ou **Empreitada**.
- Clicando na linha do diarista abre um diálogo de detalhes com o apontamento completo: horários por bloco/evento, intervalo, almoço/janta, diária mínima, extra, observação e o rateio por evento. No diálogo ficam os botões **Editar** e **Excluir** (Editar abre o formulário já existente; ambos ocultos/bloqueados quando a diária já está paga, seguindo a regra atual).
- Dias sem apontamento aparecem como card vazio discreto ("Sem apontamentos").

### 3. Filtro de situação
Novo filtro **Situação** na barra de filtros, valendo para as duas visualizações:
- Todas
- Em aberto (sem fechamento)
- Pagas (com fechamento)
- Empreitada

Os filtros já existentes (diarista, departamento, local, projeto) continuam se aplicando. Na visão semanal, os campos De/Até dão lugar à navegação por semana.

## Detalhes técnicos

Arquivo: `src/routes/financeiro-op.diaristas.index.tsx` (componente da aba Apontamento).

- Novo estado `visao: "tabela" | "semana"` e `semanaRef: Date`; semana calculada com `startOfWeek/endOfWeek` (`weekStartsOn: 1`) do date-fns, já usado no projeto.
- Novo estado `fSituacao: "todas" | "aberto" | "pago" | "empeleita"` aplicado dentro do `useMemo` de `filtered` (usa `a.fechamento_id` e `a.empeleita`, colunas já existentes).
- Na visão semanal, `filtered` é agrupado por `data` (chave `AAAA-MM-DD`) nos 7 dias da semana; os totais por dia vêm de `calcDe(a)` (`calcularApontamentoComEventos`), sem nova lógica de cálculo.
- Novos componentes locais no mesmo arquivo: `SemanaCards` (grade responsiva de 7 cards) e `ApontamentoDetalheDialog` (somente leitura + ações), reaproveitando `nomeExib`, `intervaloExibicao` e o resultado do cálculo.
- Sem mudanças de banco de dados e sem alterações nas abas Fechamento e Relatórios.
