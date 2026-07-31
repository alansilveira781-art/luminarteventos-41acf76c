## Objetivo

1. Campo **Observações** passa a ficar entre a seção "Formas de pagamento" (+ Valor total) e a linha divisória de Comentários/Histórico.
2. O campo **Situação (Pago)** só aparece quando a forma de pagamento for **PIX** e o parcelamento for **maior que 1**.
3. Nesse caso (PIX parcelado), **Data prevista** e **Situação** passam a ser obrigatórias para salvar.

## Como fica

```text
[ Data da compra ]
──────────────────────────────
Formas de pagamento
  Forma 1  | Parcelamento | Data prevista | Valor  [ | Situação se PIX parcelado ]
  ...
Soma das formas / Valor total
──────────────────────────────
Observações  (largura total)
Motivo da negação (quando negada)
──────────────────────────────
Comentários | Histórico
```

## Detalhes técnicos

**`src/lib/pagamentos.ts`**
- Nova helper `parcelasDe(parcelamento)`: extrai o número de parcelas de textos como "1x", "3x", "3 vezes", "À vista" (à vista/vazio = 1).
- Nova helper `ehPix(forma)`: comparação sem acento/caixa, aceita "pix", "pix parcelado" etc.
- Nova helper `exigeControleParcelas(linha)` = `ehPix(forma) && parcelasDe(parcelamento) > 1`.
- Nova helper `validarPagamentos(linhas)` que retorna a lista de pendências (linha sem data prevista ou sem situação definida quando exige controle).

**`src/components/PagamentosGrid.tsx`**
- Renderiza o bloco "Situação" apenas quando `exigeControleParcelas(p)`; quando a forma deixa de ser PIX parcelado, o `pago`/`pago_em` da linha é limpo.
- Nessas linhas, "Data prevista" ganha marcação de obrigatória (asterisco) e destaque em vermelho quando vazia; a Situação vira um par de opções explícitas **Pago / Em aberto** (em vez de checkbox sem estado inicial), para que "preenchido" seja verificável.
- Nas demais linhas (à vista, cartão etc.) nada muda além da ausência da Situação.

**`src/components/CompraDialog.tsx` e `src/components/DemandaDialog.tsx`**
- Mover o `FormField` de "Observações" (e o de "Motivo da negação") para fora do `FormSection`, logo depois do bloco de pagamentos/valor total e antes da `div` com `border-t` das abas.
- No `handleSalvar`, além da checagem já existente de soma × total, bloquear o salvamento com toast quando `validarPagamentos` apontar pendências (mensagem: "Informe a data prevista e a situação de cada parcela do PIX parcelado").
