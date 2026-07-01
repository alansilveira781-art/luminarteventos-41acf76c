## 1. Enquadramento das pizzas "Ano A / Ano B" (Indicadores)

Arquivo: `src/routes/comercial.dashboard.index.tsx` (bloco linhas ~718–760).

Ainda há corte porque o rótulo externo sai do container quando a fatia está próxima da borda direita e a legenda ocupa 45% à direita.

Ajustes:

- Reduzir `outerRadius` de 90 para 78.
- Deslocar a pizza mais à esquerda: `cx="35%"`.
- Aumentar margens do `PieChart`: `margin={{ top: 24, right: 32, bottom: 24, left: 24 }}` para o `labelLine` respirar.
- Reduzir a largura da legenda para `maxWidth: "40%"` e truncar nomes longos com `whiteSpace: "nowrap"; overflow: "hidden"; textOverflow: "ellipsis"`.
- Aplicar `paddingAngle={2}` e `minAngle={4}` para fatias pequenas não sumirem sob o rótulo.

Nenhuma mudança de dados — só props visuais do Recharts.

## 2. Controles de zoom (+/−) na prévia de arquivos

Arquivos:

- `src/components/PdfPreview.tsx` — adicionar estado `scale` (default 1), botões `+`, `−` e "100%" no topo (barra sticky), passando `scale={scale}` para cada `<Page>` e removendo `width={760}` fixo (usar `scale`). Limitar entre 0.5 e 3, incrementos de 0.25.
- `src/components/AnexoViewer.tsx` — para imagens, envolver `<img>` num container com o mesmo controle de zoom (`transform: scale(...)` + `overflow: auto`). Reaproveitar uma pequena barra de controles compartilhada.

Como `AnexoViewer` é o visualizador único usado em todos os módulos (compras, estoque, patrimônio, financeiro, comercial), a mudança propaga para qualquer local com prévia.

## 3. Módulo Estoque → Devoluções → imprimir formulário

Arquivo: `src/components/patrimonio/Devolucoes.tsx` (Dialog "Nova devolução", linhas ~205+).

Adicionar:

- Botão "Imprimir formulário" dentro do dialog (ao lado dos botões Cancelar/Salvar).
- Ao clicar, gerar uma janela `window.open` com HTML formatado contendo:
  - Cabeçalho (empresa, data, número da saída/requisição selecionada, responsável).
  - Tabela dos itens da saída com colunas: código, descrição, qtde saída, qtde devolvida (campo vazio para preencher à mão), condição, observação.
- Disparar `window.print()` automaticamente após o load.

Assim o usuário imprime, confere fisicamente.

## 4. Módulo Compras — Natanael movendo cards livremente

Sintoma: Natanael move cards e a mudança não fixa no status correto (provavelmente porque ele está com papel de admin do módulo Compras/Estoque, então `isAdmin=true` bypassa `statusResponsavelId`, mas ao mesmo tempo a trigger do banco `trg_validate_compra_status_transition` reverte a mudança — daí o card "volta").

Correção em duas frentes:

**a) Banco de dados** — remover a role de admin do Natanael nos módulos `compras` e `estoque` (mantendo apenas acesso comum), via `DELETE FROM public.user_roles WHERE user_id = <id_natanael> AND role IN ('admin', ...)` filtrado pelo módulo. Isso o coloca sob a mesma regra dos demais usuários: só move para status cujo `statusResponsavelId` seja o próprio id dele.

**b) Front — mensagem clara**: em `src/routes/compras.index.tsx`, quando `canMoveCompra` retorna false, já existe `moveBlockedMessage`; garantir que o `onDragEnd` faça **rollback visual imediato** (setar de volta o status anterior no estado local) para o card não parecer que "aceitou" o drop antes do refetch.

Não altera a lógica geral do Pedro nem dos demais.

## Técnico

- Recharts: `outerRadius`, `cx`, `paddingAngle`, `minAngle`, `Legend.wrapperStyle`.
- Zoom: `useState<number>(1)`, `transform: scale(scale)` + `transformOrigin: 'top center'` para imagens; `react-pdf` `<Page scale={scale} />` para PDF.
- Print: `window.open("", "_blank")` + `document.write` de um HTML autocontido com `@media print` e `window.onload = () => window.print()`.
- Compras: query no `public.user_roles` para identificar e remover as roles do Natanael; ajuste local de estado no `onDragEnd` para restaurar `status` original quando `canMoveCompra=false`.