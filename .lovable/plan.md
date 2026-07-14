## Mudanças no módulo Despesas — campo "Tipo de Despesa"

### 1. Novas opções
Adicionar em `src/lib/demandas.ts` → `TIPO_DEMANDA_OPTIONS`:
- `departamento_pessoal` → "Departamento Pessoal"
- `recursos_humanos` → "Recursos Humanos"

Ambos seguem o fluxo padrão (descritivo livre, sem grid de itens, sem passar por "A Receber").

### 2. Busca digitável no campo
Hoje o campo em `src/components/DemandaDialog.tsx` usa um `<Select>` puro do shadcn, que não filtra por digitação. Vou trocá-lo por um combobox pesquisável (mesmo padrão já usado no projeto — busca tolerante a acentos via `normalize()`), mantendo:
- as mesmas opções de `TIPO_DEMANDA_OPTIONS`
- a mesma lógica de troca de tipo (limpar itens/descritivo conforme `TIPOS_COM_ITENS`)
- o mesmo valor persistido em `tipo_demanda`

Não haverá criação inline (a lista de tipos é fixa no código), apenas filtro por texto.

### Fora do escopo
- Nenhuma migration (coluna `tipo_demanda` é texto livre).
- Nenhuma alteração em fluxo de estoque/patrimônio/a-receber.
- Nenhuma alteração em Compras.
