# Histórico de movimentações: tirar filtros e mostrar o saldo

## O que muda

Na tela aberta pelo botão de histórico (ícone de relógio) da aba Estoque:

1. **Remover todos os filtros** adicionados recentemente (Movimento, Evento/Projeto, Tipo de saída, Solicitante, Fornecedor, De/Até) e o contador de registros. A tela volta a mostrar simplesmente a lista completa de movimentações do item.

2. **Nova coluna "Saldo"** na tabela, ao lado da quantidade. Ela mostra quanto ficou no estoque daquele item depois de cada movimento — entrada, saída, devolução ou ajuste.

Exemplo de leitura (do mais recente para o mais antigo, como já é hoje):

```text
Data        Tipo       Qtd     Saldo
06/08 14:00 Saída      -10     40
05/08 09:00 Entrada    +50     50
04/08 16:00 Saída      -5      0
```

## Como o saldo é calculado

O cálculo parte do saldo atual do item e desfaz movimento a movimento, de cima para baixo, seguindo as mesmas regras do estoque:

- entrada e ajuste somam;
- saída subtrai;
- devolução soma (exceto condição "perdido", que não retorna ao estoque).

Assim, a primeira linha da lista sempre bate com a "Quantidade atual" exibida nos cartões no topo da página.

## Detalhes técnicos

- `src/routes/estoque.$itemId.tsx`: remover os estados `fTipo`, `fEvento`, `fSaidaTipo`, `fSolicitante`, `fFornecedor`, `fIni`, `fFim`, os `useMemo` de listas disponíveis, `movsFiltrados` e o bloco JSX de filtros; voltar a renderizar `movs` diretamente.
- Adicionar um `useMemo` que percorre `movs` (já ordenado do mais recente para o mais antigo) acumulando o saldo a partir de `item.quantidade_atual`, gravando o saldo posterior de cada movimento; nova coluna "Saldo" no `<thead>`/`<tbody>` com formatação tabular.
- Nenhuma alteração de banco de dados nem nos filtros da aba Relatórios (esses continuam como estão).
