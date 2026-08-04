# Corrigir erro ao criar ordem e implementar projeto (Operações)

## O que está acontecendo

A tabela de ordens de produção ainda usa as regras de validação antigas (de antes do novo Quadro de Produção). Três valores que a tela envia hoje são rejeitados pelo banco:

| Onde | Valor enviado pela tela | O banco só aceita |
|---|---|---|
| Nova ordem — tipo de unidade | `un` (padrão do formulário) | `peca`, `item_inteiro` |
| Implementar projeto — origem | `evento` | `avulsa`, `proposta` |
| Mover card / avançar setor — situação | `em_andamento` | `aberta`, `em_producao`, `finalizada`, `cancelada` |

Por isso "Nova ordem" e "Implementar projeto" falham, e mover um card entre setores também falharia pelo mesmo motivo.

## Correção

Uma migração de banco ajustando as três regras de validação da tabela de ordens para aceitar o vocabulário atual da tela:

- tipo de unidade: passa a aceitar também `un` (mantendo `peca` e `item_inteiro`)
- origem: passa a aceitar também `evento`
- situação: passa a aceitar também `em_andamento`

Nenhum dado existente é alterado e nenhuma tela precisa mudar de comportamento.

## Detalhes técnicos

Migração única em `public.op_ordens`:

- `DROP`/`ADD` de `op_ordens_tipo_unidade_check` → `('peca','item_inteiro','un')`
- `DROP`/`ADD` de `op_ordens_origem_check` → `('avulsa','proposta','evento')`
- `DROP`/`ADD` de `op_ordens_status_check` → `('aberta','em_andamento','em_producao','finalizada','cancelada')`

Depois da migração, valido criando uma ordem de teste e verificando que o card aparece na coluna Preparação.
