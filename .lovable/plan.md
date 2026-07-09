Ajustar a capa do PDF em `src/lib/comercial/pdf.ts` para corrigir a cor da onda, reduzir a logo e compactar o bloco de campos.

### Alterações

1. **Cor da onda dourada**
   - Em `drawCoverWaves`, garantir que a onda sobreposta use `GOLD` (verificar/substituir caso ainda esteja vermelho).

2. **Tamanho da logo**
   - Em `drawCover`, reduzir os limites da logo:
     - `maxW`: 150 → 105
     - `maxH`: 150 → 70
   - A logo continua visível e centralizada, mas ocupa menos altura na capa.

3. **Compactação do bloco de campos**
   - Subir os elementos para garantir que os 6 campos fiquem acima da onda:
     - Linha dourada: Y 96 → 92
     - Subtítulo "Seu Sonho, Nosso Projeto": Y 106 → 102
     - Texto ORC: Y 114 → 110
     - Traços do ORC: Y 113 → 109
     - Início do bloco de campos: Y 130 → 124
     - Espaçamento entre linhas: lineH 9 → 11

### Validação

- Rodar `bun run typecheck` para garantir que não há erros de compilação.
- Gerar um PDF de teste a partir da tela de propostas/validações e confirmar:
  1. A onda inferior está dourada, não vermelha.
  2. A logo aparece grande, mas com folga vertical para o conteúdo.
  3. Os 6 campos (Nome do Evento, Cliente, Local, Período, Data do Orçamento, Consultor Responsável) aparecem inteiros e legíveis, com espaço livre antes da onda.