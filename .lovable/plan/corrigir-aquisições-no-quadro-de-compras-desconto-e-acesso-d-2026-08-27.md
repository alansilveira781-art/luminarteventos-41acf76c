# Corrigir aquisições no Quadro de Compras, desconto % e acesso do Natanael

## 1. Aquisições travadas para quem só tem o módulo Compras (causa confirmada)

Ao encerrar o módulo Aquisições, ele foi marcado como inativo no banco. As regras de acesso das aquisições (tabelas de aquisições, itens, pagamentos e anexos, além dos arquivos no armazenamento) ainda exigem acesso ao módulo Aquisições — e um módulo inativo deixa de conceder acesso.

Resultado prático confirmado: o Natanael tem apenas o módulo Compras ativo, então ele deixou de enxergar/editar/salvar cards de aquisição (DEMANDA-XXX). É exatamente isso que faz parecer que a demanda "foi para o quadro de aquisições": o card existe, mas fica invisível/bloqueado para ele no Quadro de Compras.

Correção: as regras de acesso das aquisições passam a aceitar **quem tem o módulo Compras** (mantendo os acessos já existentes de Estoque, Patrimônio, Financeiro Operacional e do próprio criador/solicitante). Assim as aquisições continuam existindo como tipo de card, mas o ciclo inteiro acontece no Quadro de Compras.

Nada de dado é apagado e o módulo Aquisições continua desativado e invisível no menu.

## 2. Desconto em percentual não aplicado

Hoje o desconto % só recalcula o valor unitário quando o campo **Cotação** é preenchido. Quem digita direto o **Valor unit.** e depois o desconto % não vê efeito nenhum.

Passa a funcionar assim, nos cards de Compra e de Aquisição:

- Com Cotação preenchida: valor unitário = cotação − percentual (como hoje).
- Sem Cotação: o percentual é aplicado sobre o valor unitário informado, usando esse valor como preço cheio de referência.
- Alterar o percentual depois recalcula sempre a partir do preço cheio, sem "descontar em cima de desconto".
- O subtotal e o valor total do card seguem sendo recalculados automaticamente.

## 3. Edição de cards que ele tem autorização

Com o item 1 resolvido, o bloqueio ao salvar/editar cards de aquisição deixa de existir. Além disso será verificado, com o card aberto, se a edição dos cards de compra sob responsabilidade dele (Solicitação, Análise, Aprovada, Em Andamento, Finalizado — status onde ele é o responsável configurado) está liberada, e qualquer trava restante na interface será corrigida.

## Detalhes técnicos

- Migração: adicionar/ajustar políticas em `demandas`, `demanda_itens`, `demanda_pagamentos`, `demanda_anexos` e nas políticas do bucket `demanda-anexos` para incluir `has_module_access(auth.uid(),'compras')` junto das condições atuais.
- `src/components/CompraDialog.tsx` e `src/components/DemandaDialog.tsx`: em `updateCotacaoOrDesconto`, usar a cotação quando houver e, na ausência dela, o valor unitário como base bruta (guardando a base para não acumular descontos sucessivos).
- Verificação final no navegador com um card DEMANDA e um card COMPRA de status sob responsabilidade do Natanael.
