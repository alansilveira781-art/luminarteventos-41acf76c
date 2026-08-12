# Diaristas: blocos de horário com vários projetos e opção Empeleita

## O que muda

### 1. Blocos de horário com mais de um projeto
No lançamento de apontamento, o modo "informar os horários de cada evento" passa a trabalhar por **blocos de horário**. Cada bloco tem início, fim e intervalo e pode ter **um ou mais projetos**.

Exemplo do dia citado:
- Bloco 1 — 08:00 às 14:00 — Projeto A
- Bloco 2 — 14:00 às 17:00 — Projeto B e Projeto C

As 6h do bloco 1 vão inteiras para o Projeto A. As 3h do bloco 2 são divididas meio a meio: 1h30 e metade do valor para cada projeto. Se um bloco tiver três projetos, divide em três partes iguais, e assim por diante.

As horas do dia continuam sendo a soma dos blocos (sem contar duas vezes o mesmo horário), e o rateio por evento nas listagens, no fechamento e nos relatórios passa a refletir essa divisão.

### 2. Opção "Empeleita"
No mesmo formulário entra um switch **Empeleita**. Quando ligado:
- O lançamento **não gera valor** (diária, extra e refeições ficam zerados no fechamento e nos relatórios).
- Os horários continuam sendo registrados e exibidos normalmente, apenas para acompanhamento visual.
- A linha aparece com um selo "Empeleita" nas listagens, no fechamento e no PDF, com valor R$ 0,00.

## Detalhes técnicos

**Banco (migração):**
- `diarista_apontamentos`: nova coluna `empeleita boolean not null default false`.
- `diarista_apontamento_eventos`: nova coluna `bloco integer not null default 0` — eventos com o mesmo `bloco` compartilham o mesmo horário e dividem as horas/valor em partes iguais. Registros existentes recebem `bloco = ordem` (comportamento atual preservado: um evento por bloco).

**Frontend:**
- `src/lib/diaristas-calc.ts`: `calcularApontamentoComEventos` agrupa os eventos por `bloco` no modo `horarios`, calcula os minutos de cada bloco uma única vez e divide entre os projetos do bloco; quando `empeleita` for verdadeiro, força `diaria`, `extra`, `refeicoes`, `total` e todos os valores do rateio para 0, mantendo horas e horários. `intervaloExibicao` continua usando a menor entrada e a maior saída dos blocos.
- `src/routes/financeiro-op.diaristas.index.tsx`: formulário do apontamento reorganizado em blocos (início/fim/intervalo + lista de projetos por bloco, com "Adicionar projeto" e "Adicionar bloco"); switch Empeleita; gravação/leitura de `bloco` e `empeleita`; selo "Empeleita" e valores zerados nas linhas, sublinhas por evento e resumos.
- `src/lib/diaristas-pdf.ts`: coluna/indicação de "Empeleita" nos itens do relatório e totais já zerados por vir do cálculo.
