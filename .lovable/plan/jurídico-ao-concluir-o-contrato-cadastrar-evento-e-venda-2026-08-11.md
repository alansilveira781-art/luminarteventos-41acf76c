# Jurídico: ao concluir o contrato, cadastrar Evento e Venda

## O que muda

Hoje, ao arrastar um card de contrato para a coluna **Concluído**, ele apenas muda de status. Passa a abrir um assistente de duas etapas, com os dados já preenchidos a partir do contrato:

**Etapa 1 — Cadastro no calendário (Eventos)**
- Formulário pré-preenchido com: nome do evento (título do contrato), tipo/categoria do contrato (Stand → Stand, Social, Corporativo, Cenografia), datas de início e fim do evento, montagem e desmontagem (e horários), cidade/UF do cliente, local e observações.
- O usuário revisa, corrige o que quiser e confirma. O evento é criado na tabela de eventos (situação "Em Aprovação", origem jurídico) — as mesmas regras de código automático do cadastro manual.
- Se o contrato não tiver datas, os campos ficam em branco e são obrigatórios como no cadastro normal.

**Etapa 2 — Cadastro na aba Vendas (Comercial)**
- Formulário pré-preenchido com: data de registro (hoje), data do evento, nome do evento, local, cidade, estado, categoria/classificação, empresa, responsável do contrato como consultor (quando existir no cadastro de vendedores) e valor da proposta = valor do contrato.
- Comissão, BV e valor final são calculados automaticamente, como no cadastro manual de vendas.
- O usuário revisa e confirma; a venda é gravada.

**Regras do fluxo**
- O card só é movido para Concluído após a confirmação da Etapa 1. Se o usuário cancelar no início, o card volta para a coluna anterior.
- Cada etapa tem um botão "Pular" para quem não quiser criar evento ou venda naquele momento; o card ainda assim é concluído.
- Se o contrato já tiver gerado evento/venda antes, o assistente avisa e não duplica.

## Detalhes técnicos

- Novo componente `src/components/juridico/ConcluirContratoWizard.tsx` com duas etapas (Progress + Voltar/Avançar), no mesmo padrão de `NovoContratoDialog.tsx`.
- Em `src/routes/juridico.index.tsx`, no `onDragEnd`: quando `status === "concluido"`, em vez de atualizar direto, abrir o wizard (estado `concluirCard`), aplicando o `update` de status apenas após a Etapa 1 ser confirmada ou pulada.
- Etapa 1 reaproveita a lógica de `EventoDialog` (`src/routes/eventos.index.tsx`): mesmos campos, comboboxes IBGE de UF/Cidade, geração de código via trigger/`proximo_codigo_evento` e inserção em `eventos`. Para evitar duplicação, extrair o corpo do formulário para um componente reutilizável (`EventoFormFields`) usado pelo dialog atual e pelo wizard.
- Etapa 2 reaproveita `FormState`, `buildDbPayload` e `calcularDerivados` de `src/routes/comercial.vendas.tsx` / `src/lib/comercial/comissao.ts`; extrair o corpo do formulário de venda para `src/components/comercial/VendaFormFields.tsx` e usá-lo nos dois lugares. Insert em `comercial_vendas` com `source: "juridico"`.
- Mapeamento categoria do contrato → tipo do evento / classificação da venda em um helper local (`stand|corporativo|social|cenografia`).
- Vínculo/idempotência: gravar em `juridico_contratos` as colunas novas `evento_id` (uuid) e `venda_id` (uuid) para saber o que já foi criado — única alteração de banco necessária (migration com as duas colunas nullable).
- Após concluir, invalidar as queries de eventos e de vendas e recarregar o quadro.
