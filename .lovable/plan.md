## Ajuste do adicional de IRPJ

### Nova regra
Adicional incide sobre o **valor do IRPJ apurado** que ultrapassar **R$ 20.000** no mês:

```
IRPJ_normal  = base_presumida × 15%
excedente    = max(0, IRPJ_normal − 20.000)
IRPJ_adicional = excedente × aliquota_adicional   (padrão 10%)
IRPJ_total   = IRPJ_normal + IRPJ_adicional
```

### 1. Cálculo (`src/lib/contabil/calculo.ts`)
- Substituir a lógica atual (que aplica o adicional sobre `basePresumida − 20.000`) pela nova fórmula acima.
- Ler do array de alíquotas dois parâmetros configuráveis:
  - `IRPJ` → alíquota normal (padrão 15%).
  - `IRPJ_ADICIONAL` → alíquota adicional (padrão 10%).
- Limite mensal continua R$ 20.000 (também configurável, ver item 3).

### 2. Configuração — alíquotas (`src/routes/contabil.configuracao.tsx`)
- Garantir que cada empresa de regime presumido tenha, além das linhas atuais (PIS / COFINS / IRPJ / CSLL), uma linha extra `imposto = "IRPJ_ADICIONAL"` com `aliquota = 10`.
- Ajustar o botão "Criar impostos padrão" para já incluir essa linha.
- Exibir o IRPJ adicional na tabela com rótulo amigável (ex.: "IRPJ — Adicional (acima de R$ 20.000)").

### 3. Configuração — limite mensal
Como o limite (R$ 20.000) também pode mudar por empresa, salvá-lo no campo `observacoes` da linha `IRPJ_ADICIONAL` no formato `limite=20000`, e ler isso no cálculo. Sem migração de banco.
- Default: 20.000 quando não informado.
- Campo editável na tela de configuração junto com a alíquota adicional.

### 4. Tela de Apurações (`src/routes/contabil.apuracoes.tsx`)
- Continuar mostrando uma linha "IRPJ" com a coluna **Adicional** preenchida (já existe a coluna). A diferença é só no valor calculado.
- Acrescentar abaixo da tabela um detalhamento curto: "IRPJ apurado R$ X — Excedente sobre R$ 20.000: R$ Y — Adicional 10%: R$ Z".

### 5. Seed
Recalcular e atualizar via `supabase--insert` as duas apurações de exemplo (Mar/2026 e Abr/2026 de Luminart Eventos) com a nova regra, e inserir a linha `IRPJ_ADICIONAL` (10%, limite 20000) para Luminart Eventos e Luminart Planejados.

### Arquivos afetados
- `src/lib/contabil/calculo.ts` — nova fórmula + leitura de `IRPJ_ADICIONAL` e limite.
- `src/routes/contabil.configuracao.tsx` — campo adicional + seed padrão.
- `src/routes/contabil.apuracoes.tsx` — pequeno detalhamento textual do adicional.
- Sem migração de schema.

### Validação rápida com os exemplos
- **Mar/2026** — faturamento R$ 31.000 → base presumida R$ 9.920 → IRPJ R$ 1.488 → não ultrapassa R$ 20.000 → **adicional = 0**.
- **Abr/2026** — faturamento R$ 70.000 → base presumida R$ 22.400 → IRPJ R$ 3.360 → também não ultrapassa R$ 20.000 → **adicional = 0**.

Como nenhum dos dois exemplos atuais aciona o adicional pela nova regra, vou trocar o segundo exemplo por um mês com faturamento alto o bastante para disparar o adicional (ex.: **Maio/2026, R$ 450.000** → IRPJ R$ 21.600 → excedente R$ 1.600 → adicional R$ 160), assim você consegue medir a eficiência das duas situações: uma sem e outra com adicional.
