## Contexto
O usuário visualizou a aba Itens do card de Compra e notou que os campos estão apertados em uma única linha (9 colunas). Ele quer uma distribuição mais espaçosa em duas linhas.

## Objetivo
Reorganizar os campos de cada item de compra no `CompraDialog` para melhor legibilidade e uso do espaço.

## Alteração
Arquivo: `src/components/CompraDialog.tsx` (seção "Itens", dentro do mapeamento de `itens`).

Atualmente os campos estão em um único grid de 9 colunas:
```
Qtd | Unidade | Cotação | Desc. % | Valor unit. | IPI | Frete | Outros | Subtotal
```

Novo layout em duas linhas:

### Linha 1 — campos principais de quantidade/preço
```
Qtd | Unidade | Cotação | Desc. % | Valor unit.
```
- Grid responsivo: 5 colunas em telas grandes, ajustando para 2–3 colunas em telas menores.
- Campos permanecem com os labels e handlers atuais.

### Linha 2 — campos de acréscimos e subtotal
```
IPI | Frete | Outros | Subtotal
```
- Grid de 4 colunas em telas grandes, ajustando para 2 colunas em telas menores.
- Subtotal continua somente leitura (`readOnly`, `bg-muted/50`).

## NÃO FAZER
- Não alterar cálculos de subtotal, desconto, IPI, frete ou outros.
- Não alterar validações, permissões ou lógica de salvamento.
- Não alterar labels de campos ou comportamento de foco.
- Não alterar outros módulos ou telas.

## Validação
- Verificar visualmente no preview que os campos aparecem em duas linhas.
- Confirmar que valores e cálculos continuam funcionando normalmente.