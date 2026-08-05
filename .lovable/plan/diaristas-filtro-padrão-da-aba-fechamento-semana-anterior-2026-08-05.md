# Diaristas: filtro padrão da aba Fechamento = semana anterior

## O que muda

Na aba **Financeiro > Diaristas > Fechamento**, o filtro de período passa a iniciar sempre como a **semana anterior completa** (segunda-feira a domingo), em vez do mês atual.

Exemplo dado pelo usuário:
- Hoje = 05/08/2026 (quarta-feira) → período padrão = 27/07/2026 a 02/08/2026.
- Quando for 10/08/2026 → período padrão = 03/08/2026 a 09/08/2026.

O usuário ainda pode alterar manualmente os campos **De** e **Até** depois de entrar na tela.

## Detalhes técnicos

**Arquivo:** `src/routes/financeiro-op.diaristas.index.tsx`

- Ajustar o import do `date-fns` para incluir `startOfWeek`, `endOfWeek` e `subDays`.
- No componente `FechamentoTab`, substituir a inicialização:
  ```tsx
  const hoje = new Date();
  const [de, setDe] = useState<string>(format(startOfMonth(hoje), "yyyy-MM-dd"));
  const [ate, setAte] = useState<string>(format(endOfMonth(hoje), "yyyy-MM-dd"));
  ```
  por:
  ```tsx
  const hoje = new Date();
  const inicioSemanaAnterior = subDays(startOfWeek(hoje, { weekStartsOn: 1 }), 7);
  const fimSemanaAnterior = endOfWeek(inicioSemanaAnterior, { weekStartsOn: 1 });
  const [de, setDe] = useState<string>(format(inicioSemanaAnterior, "yyyy-MM-dd"));
  const [ate, setAte] = useState<string>(format(fimSemanaAnterior, "yyyy-MM-dd"));
  ```

- Sem alterações no banco de dados, RLS ou outros componentes.
