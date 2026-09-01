# Jornada da diária por diarista (8h, 12h, etc.)

Hoje toda diária é calculada como valor/hora × 8, fixo. Alguns diaristas trabalham 08–17 (8h) e outros 08–20 (12h), então a jornada passa a ser cadastrada por pessoa.

## O que muda

**Cadastro do diarista (Configurações › Diaristas)**
- Novo campo "Horas da diária" (livre: 6, 8, 10, 12...), com padrão 8.
- A prévia deixa de dizer "Diária (8h)" e passa a mostrar "Diária (Xh): valor/hora × X" conforme o campo.

**Cálculo**
- Diária = valor/hora × jornada do diarista.
- Com "Garantir diária" ligado, o pagamento continua em diárias fechadas, agora arredondando pela jornada da pessoa: 13h com jornada de 12h = 2 diárias; 9h com jornada de 8h = 2 diárias.
- Com o botão desligado, nada muda: valor/hora × horas trabalhadas.
- Refeições, extra manual, empreitada e o rateio por evento continuam iguais.

**Onde reflete**
- Lançamento (resumo do cálculo), listagem, fechamento semanal, relatórios e PDFs — todos usam o mesmo cálculo, então acompanham automaticamente.
- O texto de apoio do switch passa a citar a jornada do diarista selecionado.

## Detalhes técnicos

1. Banco: `diaristas` ganha `horas_diaria numeric not null default 8`.
2. `src/lib/diaristas-calc.ts`: `DiaristaTarifa` recebe `horas_diaria?: number | null`; `montarResultado` passa a receber a jornada (fallback 8) e usa `Math.max(1, Math.ceil(horasTrab / jornada)) * valorHora * jornada` quando `diaria_minima` está ligada.
3. `src/routes/financeiro-op.diaristas.configuracoes.tsx`: campo no formulário, persistência no insert/update e coluna/prévia da diária calculada com a jornada.
4. `src/routes/financeiro-op.diaristas.index.tsx`: incluir `horas_diaria` no select do diarista e repassar no objeto de tarifa em todos os pontos de cálculo (lançamento, listagem, fechamento, relatórios, PDF).
5. Lançamentos antigos são recalculados na exibição com a jornada atual do diarista (o valor/hora já funciona assim hoje).
