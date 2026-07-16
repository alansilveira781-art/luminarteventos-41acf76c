## Objetivo
Criar uma página interna somente leitura `/meus-pedidos` onde o usuário logado acompanha suas solicitações (compras + demandas) em formato de timeline por status. Zero mutations, zero drag-and-drop, zero edição.

## Arquivos

### 1. `src/routes/meus-pedidos.tsx` (novo)
Rota criada com `createFileRoute("/meus-pedidos")`, seguindo o padrão de `compras.index.tsx`.

- `useAuth()` para obter `user`. Se `!user`, mostra card com aviso "Faça login para ver seus pedidos".
- Dois `useQuery` (compras + demandas) unidos numa lista `pedidos` com campo discriminador `tipo: "compra" | "demanda"`.

**Query compras** (filtro OR):
```
solicitante_id.eq.{user.id},created_by.eq.{user.id},solicitante.ilike.%{user.email}%,observacoes.ilike.%{user.email}%
```
Select: `id, numero, status, titulo, solicitante, fornecedor, valor_total, data_solicitacao, updated_at, tipo_compra, observacoes, motivo_negacao`.

**Query demandas**: mesmo filtro OR, select equivalente com `tipo_demanda` no lugar de `tipo_compra`.

Ambas ordenadas por `data_solicitacao desc`. Merge client-side e reordenação por data.

**Renderização**: grid de cards. Cada card:
- Header: `#numero` + título + Badge do tipo (Compra/Demanda) + Badge de status usando `COMPRA_STATUSES`/`DEMANDA_STATUSES` (cor + label).
- Meta: valor R$, data solicitação, fornecedor (se houver).
- Stepper horizontal (componente inline `StatusStepper`):
  - Sequência: `solicitacao → analise → pendente_aprovacao → aprovada → em_andamento → a_receber → finalizado`.
  - Etapas ≤ atual: círculo preenchido com a cor do status.
  - Etapa atual: anel/borda destacada, label em negrito.
  - Futuras: cinza (`bg-muted text-muted-foreground`).
  - Caso `status === "negada"`: mostra trilha até `pendente_aprovacao` + marcador vermelho "Negada" (tooltip com `motivo_negacao` se existir).
- Abaixo do stepper: "Solicitado em {data}" • "Última atualização {updated_at}" + texto pequeno "Datas intermediárias são aproximadas."
- Card clicável abre `PedidoDetalheDialog`.

**`PedidoDetalheDialog`** (componente inline no mesmo arquivo):
- `Dialog` read-only. Sem inputs.
- Mostra: título, tipo, fornecedor, solicitante, valor total, datas, status atual (badge), descritivo/observações.
- Para `tipo === "compra"`: `useQuery` em `compra_itens` (descricao, quantidade, unidade, valor_unitario, subtotal) numa `<Table>` com total.
- Para `tipo === "demanda"`: se tem itens em `demanda_itens`, mesma tabela; senão mostra observações.
- Único botão: "Fechar".

### 2. `src/components/AppSidebar.tsx` (editar)
Adicionar item de menu "Meus Pedidos" (ícone `ClipboardList` de lucide-react), visível a qualquer usuário logado (sem exigir módulo), apontando para `/meus-pedidos`.

## Fora de escopo
- Nenhuma mudança em compras, demandas, políticas RLS, ou lógica do formulário público.
- Nenhum `useMutation`, drag-and-drop, ou import de `canEditCompra`/`canMoveCompra`.
- Nenhuma alteração no `AuthContext` ou rotas existentes.

## Observação técnica
RLS atual em `compras`/`demandas` já filtra por acesso a módulo. Para pedidos vindos do `/solicitar` (público), o usuário pode não ter acesso ao módulo `compras` e portanto não veria nada. Se após implementar isso acontecer, precisaremos adicionar uma policy SELECT do tipo "authenticated pode ver pedidos que criou/onde é solicitante/onde email casa". Vou verificar durante a implementação e sinalizar antes de mexer em RLS.
