## Problema encontrado

Os cadastros do Estoque **estão sim sendo salvos** corretamente no banco (verifiquei: 652 fornecedores e 46 solicitantes, todos com status "ativo"). O problema é apenas de **cache do navegador**: o formulário de Entradas/Saídas carrega a lista de fornecedores/solicitantes uma vez e nunca atualiza, mesmo depois que você cadastra uma pessoa nova na tela de cadastro.

Diagnóstico técnico (em uma frase): as queries `fornecedores-select` e `solicitantes-select` não têm `staleTime: 0` e as telas de cadastro invalidam chaves diferentes (`fornecedores` em vez de `fornecedores-select`), então o dropdown fica com dado velho até dar F5.

> Observação importante: as tabelas do **Estoque** (`fornecedores`, `solicitantes`) são **diferentes** das tabelas do módulo **Compras** (`compras_fornecedores`, `compras_solicitantes`). Hoje são cadastros separados de propósito (Compras tem 10 solicitantes e 36 fornecedores próprios). Este plano **não unifica** os dois — só corrige a sincronização dentro do Estoque. Se quiser unificar Estoque + Compras depois, podemos fazer em um segundo passo (é uma mudança maior, com migração de dados).

## O que vai mudar

1. **`src/routes/entradas.tsx`** — fazer o dropdown de fornecedor sempre buscar o que há de mais novo:
   - Adicionar `staleTime: 0` e `refetchOnMount: "always"` na query `fornecedores-select`.
2. **`src/routes/saidas.tsx`** — mesma coisa para o dropdown de solicitantes:
   - Adicionar `staleTime: 0` e `refetchOnMount: "always"` na query `solicitantes-select`.
3. **`src/routes/devolucoes.tsx`** — mesma correção para o dropdown de solicitantes.
4. **`src/routes/fornecedores.tsx`** (tela de cadastro) — quando criar/editar/excluir/importar, invalidar **também** a chave `fornecedores-select` (hoje só invalida `fornecedores`).
5. **`src/routes/solicitantes.tsx`** (tela de cadastro) — mesma coisa: invalidar **também** `solicitantes-select`.

## Resultado esperado

- Cadastrar fornecedor em **Estoque › Fornecedores** → abrir **Estoque › Entradas** → o fornecedor já aparece na lista sem precisar recarregar a página.
- Mesma coisa para Solicitantes em Saídas e Devoluções.
- Edições e exclusões também refletem na hora.

Não mexe em nada da lógica de negócio, nem do módulo Compras, nem do Financeiro/Conta Azul.