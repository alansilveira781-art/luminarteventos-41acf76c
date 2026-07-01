## Escopo

Criar uma aba **"A receber"** no módulo Patrimônio, no mesmo padrão de `/estoque/a-receber`: lista de despesas imobilizadas finalizadas, cada uma com botão "Validar recebimento" que abre um dialog e cria o item no patrimônio + movimentação de entrada + registro de vínculo.

## Estado atual verificado

- Dashboard do Patrimônio (`patrimonio.dashboard.tsx`) **já está limpo** — não há painel "Imobilizados Pendentes" nem `RegistrarPatrimonioDialog` para remover. Passo de reversão não é necessário.
- Tabela `demanda_patrimonio_registros` **não existe** — migration precisa ser aplicada.
- Tabela `demandas` tem apenas política `financeiro module access` — precisa adicionar SELECT para módulo `patrimonio` restrito a `tipo_demanda='imobilizado'`.
- Sidebar tem "Devoluções" do Patrimônio na linha 91; `PackageCheck` já está importado.

## Passos

### 1. Migration (banco)

Criar tabela `demanda_patrimonio_registros` (vínculo despesa→pat_item, UNIQUE por demanda) com RLS:
- `patrimonio` full access
- `financeiro` somente leitura

Adicionar política de SELECT em `public.demandas` para usuários do módulo `patrimonio`, restrita a `tipo_demanda='imobilizado'`, para que a nova página consiga listar as despesas.

GRANT padrão (`authenticated`, `service_role`) na nova tabela.

### 2. Nova rota `src/routes/patrimonio.a-receber.tsx`

- Query `patrimonio-a-receber`: busca `demandas` com `tipo_demanda='imobilizado'` e `status='finalizado'`, filtra localmente as que já têm registro em `demanda_patrimonio_registros`.
- Grid de cards mostrando título, `DESPESA-<numero>`, fornecedor, data de compra, valor.
- Botão "Validar recebimento" abre `ValidarRecebimentoDialog`.
- Dialog com formulário (nome, especificação, dimensões, quantidade, unidade, valor, estado, data compra, subcategoria, localização, observações). Ao confirmar:
  1. Revalida se ainda não foi registrado.
  2. Gera `id_item` `IMO-XXXX` (próximo da sequência existente).
  3. Insere em `pat_itens` (categoria `IMOBILIZADO`).
  4. Insere `pat_movimentacoes` tipo `entrada`.
  5. Insere `demanda_patrimonio_registros` (vínculo).
- Invalida queries: `patrimonio-a-receber`, `pat_itens`, `pat_movs`.

### 3. Sidebar `src/components/AppSidebar.tsx`

Adicionar item logo após "Devoluções" do Patrimônio (linha 91):
```tsx
{ title: "A receber", url: "/patrimonio/a-receber", icon: PackageCheck, group: "Patrimônio", module: "patrimonio" },
```

## Não fazer

- Não mexer no dashboard (já está limpo).
- Não alterar `DemandaDialog`, `financeiro.index.tsx`, nem outras abas do Patrimônio.
- Não criar automação — validação continua manual.
