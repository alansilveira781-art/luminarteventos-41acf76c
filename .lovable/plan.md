## Diagnóstico

A funcionalidade de exclusão com motivo (diálogo + tabela `compras_exclusoes` + RLS permitindo o responsável do status) já existe. Confirmei no banco que o Natanael é responsável por 6 dos 7 status (todos, exceto `pendente_aprovacao` — do Maicon).

O sintoma "não abre o diálogo de motivo" tem uma causa muito provável no `CompraDialog.tsx`:

```
const statusRespId = responsavelDoStatus(form.status);
const canDelete = canDeleteCompra(form as any, user?.id, isAdmin, statusRespId);
```

O `canDelete` é calculado com base em `form.status` — o valor **atual do formulário**, não o status persistido no banco. Dois problemas decorrem disso:

1. Se o Natanael abre um card em `pendente_aprovacao` (Maicon), o botão fica desabilitado — mas ele *deveria* poder excluir se fosse responsável do status real do card. (No caso `pendente_aprovacao` seguirá bloqueado — regra correta.)
2. Se ele abre um card em qualquer status dele (ex.: `analise`) e altera o dropdown de Status no formulário para outro valor antes de clicar em Excluir, `form.status` muda e o botão desabilita silenciosamente — o clique nada faz porque `disabled` engole o evento. Esse é o cenário "não abre o diálogo".

Além disso, `statusDefaults` é carregado via `useQuery` assíncrono; no primeiro render `statusRespId` volta `null` e o botão nasce desabilitado até a lista chegar.

## Correção

Ajustar apenas `src/components/CompraDialog.tsx`:

1. Guardar o **status original** do card (o que veio do banco quando o diálogo abriu) em um `useRef`/estado, resetado a cada `compraId` carregado.
2. Calcular `canDelete` usando esse status original, não `form.status`.
3. Enquanto `statusDefaults` ainda estiver carregando (`isLoading`), tratar o botão como "carregando" (ainda desabilitado, mas com tooltip "carregando permissões…") em vez de "sem permissão", para evitar confusão.
4. Manter todo o resto do fluxo intacto: diálogo de motivo obrigatório, snapshot em `compras_exclusoes`, limpeza de `compra_itens`/`compra_comentarios`/`compra_historico` e `DELETE` em `compras`.

Nenhuma mudança de banco ou RLS é necessária — a política já permite `auth.uid() IN (responsáveis do status atual do card)`.

## Validação

- Natanael abre um card em status dele (ex.: Análise ou Compra Em Andamento) → botão "Excluir" habilitado → clique abre o diálogo pedindo motivo → confirmar grava em `compras_exclusoes` e apaga o card.
- Natanael abre um card em `pendente_aprovacao` → botão continua desabilitado com tooltip "Sem permissão".
- Mudar o dropdown Status no formulário sem salvar não afeta mais a permissão de excluir.
