# Valor/hora no resumo do Fechamento (Diaristas)

## O que muda

Na linha de resumo de cada diarista (a que hoje mostra "5 dias | 48h trabalhadas" com o total à direita), passa a exibir também o valor/hora da pessoa:

`5 dias · 48h trabalhadas · Fortaleza R$ 25,00/h · Fora R$ 30,00/h`

Regras:
- Mostra "Fortaleza R$ X/h" sempre que o cadastro tiver valor.
- Mostra "Fora R$ Y/h" apenas quando o cadastro tiver valor de fora preenchido (> 0).
- Se nenhum dos dois estiver preenchido, a linha continua como hoje.

Aplicado nos dois lugares:
1. Relatório PDF de fechamento (linha de cabeçalho de cada diarista, conforme a imagem).
2. Tabela de Fechamento na tela, como texto discreto abaixo/ao lado do nome.

## Detalhes técnicos

- `src/lib/diaristas-pdf.ts`: acrescentar `valorHoraFortaleza?: number` e `valorHoraFora?: number` ao tipo de grupo e concatenar os trechos formatados em BRL na linha de subtítulo já existente (junto de dias/horas trabalhadas).
- `src/routes/financeiro-op.diaristas.index.tsx` (`FechamentoTab`): os valores já estão disponíveis via `diaristasMap`/`tarifaDe`; passar `valor_hora_fortaleza` e `valor_hora_fora` para `gerarRelatorioDiaristasPdf` e renderizar o mesmo texto na célula do nome da tabela consolidada.
- Sem mudança de banco, de cálculo de totais ou das exportações Excel/CSV.
