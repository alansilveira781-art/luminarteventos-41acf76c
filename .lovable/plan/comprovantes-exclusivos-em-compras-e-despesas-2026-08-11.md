# Comprovantes exclusivos em Compras e Despesas

## O que muda

- Nos cards de **Compra** e **Despesa**, a aba de arquivos passa a ter duas áreas separadas:
  - **Anexos** (como hoje: orçamentos, fotos, etc.)
  - **Comprovantes** (área exclusiva, vários arquivos permitidos)
- Em **Meus Pedidos**, cada pedido ganha uma seção **Comprovantes**, somente leitura, com botões de **Visualizar** e **Baixar**. Se não houver comprovante, mostra "Nenhum comprovante".

## Como funciona

- O upload de comprovante é feito na própria aba do card, no bloco "Comprovantes", igual ao fluxo atual de anexos (arrastar/selecionar arquivos, listar, baixar, excluir).
- Quem já podia ver os anexos do card continua vendo tudo; o solicitante do pedido passa a ver os comprovantes na tela Meus Pedidos.
- Comprovantes ficam separados dos anexos comuns: não se misturam nas listas.

## Detalhes técnicos

**Banco**
- Adicionar coluna `tipo text not null default 'anexo'` (valores `anexo` | `comprovante`, com CHECK) em `compra_anexos` e `demanda_anexos`. Registros existentes permanecem como `anexo`.
- `demanda_anexos` hoje não tem política de leitura para o solicitante (só financeiro/estoque/patrimônio). Adicionar política de SELECT permitindo o dono do pedido (`created_by`, `solicitante_id` ou e-mail do solicitante igual ao do usuário) — sem isso os comprovantes de Despesa não aparecem em Meus Pedidos.
- As políticas de storage de `demanda-anexos` já cobrem `created_by`/`solicitante_id`; verificar apenas o caso de vínculo por e-mail e alinhar com a política da tabela.

**Frontend**
- `src/components/CompraDialog.tsx` e `src/components/DemandaDialog.tsx`: parametrizar os componentes `Anexos`/`PendingAnexos` por `tipo`, renderizando dois blocos ("Anexos" e "Comprovantes") na mesma aba, gravando `tipo` no insert e filtrando as queries por `tipo`.
- `src/routes/meus-pedidos.tsx`: nova query em `compra_anexos`/`demanda_anexos` filtrando `tipo = 'comprovante'`, exibindo a lista com `AnexoViewer` (visualizar) e `baixarAnexo` (baixar) dos buckets `compra-anexos` / `demanda-anexos`.
