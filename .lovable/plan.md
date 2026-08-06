# Ajustes: formulário público de solicitação + relatórios de Patrimônio

## 1. Botão "Avançar" travado no formulário público

Causa confirmada em `src/routes/solicitar.tsx`: na etapa de detalhes, o botão só é habilitado se **todos** os itens estiverem completos. Quando a pessoa clica em "Adicionar item" e deixa a linha em branco (como na imagem), o botão fica desabilitado sem nenhuma mensagem explicando o motivo.

O que será feito:
- Linhas de item completamente vazias passam a ser ignoradas (não bloqueiam e não são enviadas).
- O botão deixa de ficar desabilitado silenciosamente: ao clicar com algo pendente, mostra um aviso claro e destaca em vermelho os campos que faltam.
- Botão para remover a linha em branco fica sempre visível.

## 2. Despesa sem campo de valor

Hoje a solicitação de despesa não tem nenhum campo de valor — o registro entra sem valor. Será adicionado na etapa de detalhes, conforme o tipo de despesa escolhido:

- **Tipos com distribuição por itens** (Fardamento, Material de Limpeza, Material de Escritório, Imobilizado, Reposição de Estoque): aparece a mesma grade de itens já usada na compra (descrição, quantidade, unidade, valor unitário), com o **total calculado automaticamente** pela soma dos itens.
- **Demais tipos de despesa** (estacionamento, alimentação, manutenções, frete, etc.): aparece um campo único "Valor total".

O envio passa a gravar o valor total da despesa e, quando for tipo com itens, também os itens correspondentes — que é o que alimenta o recebimento em Estoque/Patrimônio.

## 3. Aba de Relatórios no módulo Patrimônio

Nova aba "Relatórios" dentro de Patrimônio com:
- Filtros por Categoria e Subcategoria (além de período e busca por texto).
- Prévia em tela com totais (quantidade de itens, unidades e valor total).
- Botão **Exportar PDF**: relatório estruturado (não print de tela) em A4, com cabeçalho "Grupo Luminart — Relatório de Patrimônio", filtros aplicados, data/hora de geração, tabela com Código, Item, Categoria, Subcategoria, Localização, Estado, Quantidade, Valor unitário e Valor total, subtotais por categoria/subcategoria, total geral e numeração de páginas.

## Detalhes técnicos

- `src/routes/solicitar.tsx`: ajustar `canAdvance`/`submit` para ignorar linhas vazias e exibir motivo; extrair a grade de itens em componente reutilizado por compra e despesa; usar `TIPOS_COM_ITENS` de `@/lib/demandas` para decidir entre grade de itens e campo único de valor.
- `src/routes/api/public/solicitar.ts`: aceitar `itens` também para `tipo: "demanda"`, calcular `valor_total` pela soma quando houver itens, e inserir em `demanda_itens`.
- Nova rota `src/routes/patrimonio.relatorios.tsx` lendo `pat_itens`, mais link na navegação do módulo.
- Novo `src/lib/patrimonio/relatorio-pdf.ts` usando `jspdf` + `jspdf-autotable` (já instalados), no mesmo padrão do relatório de diaristas.
- Sem mudanças de banco de dados.
