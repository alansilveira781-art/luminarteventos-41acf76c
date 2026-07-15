## Diagnóstico

**1. "Só 2026" na Análise Detalhada**
Não é filtro de código — verifiquei em `AnaliseDetalhada` (`ContaAzulDashboard.tsx`) e não há restrição por ano; `calcularDRECaixa` é chamado com `ano=0` (aceita qualquer data). O problema é que o **banco realmente não tem dados de 2027**:

| Tabela | 2023 | 2024 | 2025 | 2026 | 2027 |
|---|---|---|---|---|---|
| `ca_contas_pagar` | 10.835 | 13.943 | 12.838 | 6.968 | **0** |
| `ca_contas_receber` | 713 | 830 | 722 | 514 | **0** |

O último sync foi rodado com `date_to = 2026-12-31`. Já atualizei o default do formulário de Carga Histórica para `hoje + 3y` na última mudança, mas o sync ainda precisa ser disparado uma vez com essa nova janela pra trazer 2027+.

**2. Impressão do demonstrativo**
As regras de `@media print` atuais são mínimas: só ajustam A4, escondem filtros e removem `max-h`. Problemas visuais na impressão:
- Layout usa `lg:grid-cols-5` (KPIs) e `lg:grid-cols-5` com `col-span-2 / col-span-3`. No modo impressão a largura fica < 1024px → tudo colapsa em coluna única e o PDF fica gigante.
- Backgrounds cinza dos cabeçalhos/somas somem (Chrome não imprime background por padrão).
- Sem quebra de página controlada — cabeçalho da tabela some nas páginas seguintes.
- Coluna "%" e "Valores" ficam apertadas.
- Grupos colapsados / grupos de parcelas colapsados imprimem sem detalhe.

## Escopo

### 1. Trazer 2027+ para o banco
Disparar imediatamente um sync de `contas_pagar` e `contas_receber` com `date_to = 2029-12-31` (a UI já tem o default correto; falta rodar). Após o sync:
- `ca_contas_pagar` e `ca_contas_receber` passam a conter 2027+.
- COMPRA-755 volta com as 10 parcelas.
- Nada é duplicado — reconciliação por `external_id` já está implementada.

### 2. Print-friendly demonstrativo (`ContaAzulDashboard.tsx` → `AnaliseDetalhada`)
Ampliar o bloco `<style>{@media print}</style>` já existente:
- `@page { size: A4 landscape; margin: 10mm; }` — paisagem cabe as 2 colunas + KPIs sem quebrar.
- `-webkit-print-color-adjust: exact; print-color-adjust: exact;` no root para imprimir fundos cinza (cabeçalhos, linhas de total).
- Forçar `grid-template-columns: 2fr 3fr` no wrapper das duas Cards no print, independente de breakpoint.
- Forçar `grid-template-columns: repeat(5, 1fr)` nos KPIs no print.
- `max-h-[600px]` já removido; adicionar `overflow: visible` nos containers e `page-break-inside: avoid` em cada linha da DRE e da tabela de lançamentos.
- `thead`/cabeçalho da tabela como `display: table-header-group` não se aplica aqui (é grid); em vez disso adicionar uma classe `.print-repeat-header` só visível em print que aparece no topo de cada Card, com `position: running(header)` fallback simples (repetir manualmente é complexo — solução prática: reduzir font-size e evitar quebras).
- Fonte reduzida (`font-size: 10pt`) e padding menor em modo print para caber mais linhas.
- Ao clicar "Imprimir": expandir automaticamente todos os grupos DRE (`collapsed = {}`) e todos os grupos de parcelamento (`expandedGroups[c] = true` para cada chave), para que o PDF mostre o detalhe completo. Após `window.print()` retornar (ou 500ms depois), restaurar o estado anterior.
- Cabeçalho de impressão (já existe em `hidden print:block`): incluir também o total do lucro (Rodapé) e a data de emissão. Manter Luminarte + centro.
- Esconder o botão "limpar" e demais controles interativos no print (`print:hidden`).

### 3. Fora de escopo
- KPIs, Painel Financeiro, DRE Caixa continuam intocados.
- Sem migração de banco.
- Sem alteração de lógica de agregação — só CSS + expansão automática + trigger de sync.

## Arquivos a editar

- `src/components/financeiro/ContaAzulDashboard.tsx` — ampliar bloco `<style>` de print, ajustar handler do botão Imprimir para expandir tudo antes de `window.print()`, garantir cabeçalho de impressão completo.
- Rodar sync manual (via botão do próprio app "Carga Histórica" com `to = 2029-12-31`) — **ação do usuário**; ou, se preferir, posso disparar direto na API interna do sync via server function.

## Verificação

1. `SELECT COUNT(*) FROM ca_contas_pagar WHERE data_vencimento >= '2027-01-01'` > 0 após o sync.
2. Na Análise Detalhada do projeto que tinha parcelamento longo, aparecem linhas em 2027.
3. Ctrl+P na Análise Detalhada abre preview em paisagem, com KPIs em 5 colunas, demonstrativo + lançamentos lado a lado, cabeçalhos cinza visíveis, todas as rubricas e parcelas expandidas.
