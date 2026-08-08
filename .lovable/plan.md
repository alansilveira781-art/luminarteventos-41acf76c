# Corrigir o prefixo do ID no Patrimônio (STR, não EST)

O ID é gerado pegando as 3 primeiras letras da categoria. Para "ESTRUTURAS" isso produz `EST-`, mas o padrão real do inventário é `STR-` (867 itens já usam STR). O mesmo problema existe em "ESTOQUE", cujo padrão real é `SKU-`.

## O que muda

1. **Tabela de prefixos por categoria** (fim do palpite pelas 3 primeiras letras):
   - ESTRUTURAS → STR
   - ESTOQUE → SKU
   - ACERVO → ACE, FERRAMENTAS → FER, ILUMINACAO → ILU, IMOBILIZADO → IMO, MAQUINARIOS → MAQ, VEICULOS → VEI
   - Categoria nova/desconhecida: mantém as 3 primeiras letras como hoje.

2. **Usado em todos os pontos de criação**: item único, lançamento em massa e a aba "A receber" (que hoje força `IMO-` fixo — passa a usar o prefixo da categoria escolhida).

3. **Correção dos 12 itens já gravados errado**: os registros `EST-0001`…`EST-0012` da categoria ESTRUTURAS são renumerados na sequência correta, continuando a partir de `STR-0867` (viram `STR-0868`…`STR-0879`).

## Detalhes técnicos

- Novo módulo `src/lib/patrimonio/prefixos.ts` com `prefixoCategoria(categoria: string): string` (normaliza acentos/caixa, consulta o mapa, faz fallback para `slice(0,3)`).
- `src/routes/patrimonio.index.tsx`: substituir as três ocorrências de `categoria.slice(0,3).toUpperCase()` pela função.
- `src/routes/patrimonio.a-receber.tsx`: trocar o `IMO-` fixo (busca do último e geração sequencial) pelo prefixo derivado da categoria de cada linha, com contador por prefixo.
- Migração de dados única para renumerar os 12 `EST-%`.
