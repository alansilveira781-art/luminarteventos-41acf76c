# Diaristas: fechamento efetivo e controle de pagamento

## O que muda

### Aba Fechamento
- Cada linha de diarista ganha uma **coluna Status**: `Pago` (verde) ou `Em aberto` (âmbar). O status vem do fechamento: diária vinculada a um fechamento pago = Pago.
- Caixa de seleção por diarista (e "selecionar todos"), permitindo fechar o período inteiro ou só algumas pessoas.
- Novo botão **Fechar e marcar como pago**: abre uma confirmação com período, quantidade de pessoas, dias, horas e valor total; ao confirmar, cria o fechamento e marca as diárias selecionadas do período como pagas.
- Campos opcionais na confirmação: data do pagamento (padrão hoje) e observação.
- Novo filtro **Situação**: Todas / Em aberto / Pagas — para poder fechar apenas o que ainda não foi pago.
- Diárias já pagas não podem ser fechadas de novo (ficam desmarcáveis) e ficam bloqueadas para edição/exclusão na aba Apontamento, salvo reabertura.

### Aba Relatórios
- Nova área **Fechamentos realizados**: lista os fechamentos salvos (período, filtros aplicados, pessoas, dias, horas, valor total, data do pagamento, quem fechou).
- Ao clicar em um fechamento, o relatório abaixo carrega exatamente aquele conjunto de diárias (período e pessoas do fechamento), com a mesma formatação atual (consolidação por evento) e as mesmas exportações PDF / Excel / CSV.
- Administradores do Financeiro podem **reabrir** um fechamento (desfaz o pagamento e libera as diárias).
- A coluna Status também aparece no relatório e no PDF gerado.

## Detalhes técnicos

Banco (uma migração):
- Nova tabela `public.diarista_fechamentos`: `periodo_inicio`, `periodo_fim`, `filtros` (jsonb), `total_dias`, `total_minutos`, `total_valor`, `data_pagamento`, `observacao`, `created_by`, `created_at`, `updated_at`. GRANTs para `authenticated`/`service_role`; RLS: leitura para quem tem acesso ao módulo financeiro, criação/edição/exclusão restrita a admins do financeiro (`is_admin` / `is_module_admin`).
- Nova coluna `fechamento_id uuid` em `diarista_apontamentos` referenciando `diarista_fechamentos(id) ON DELETE SET NULL`, com índice. `fechamento_id IS NOT NULL` = pago.
- Ajuste nas policies de update/delete de `diarista_apontamentos` para impedir alteração de diária já vinculada a fechamento por não-admin.

Frontend:
- `src/routes/financeiro-op.diaristas.index.tsx`: `FechamentoView` ganha props `permitirFechar` (aba Fechamento) e `fechamentoId` (aba Relatórios); seleção por diarista, filtro de situação, coluna Status e diálogo de confirmação; mutations de fechar/reabrir invalidando `diarista_apontamentos`.
- Novo hook/consulta `useFechamentos()` e novo componente de lista de fechamentos usado no topo da aba Relatórios.
- `src/lib/diaristas-pdf.ts`: aceita `status` por grupo e imprime a marcação Pago/Em aberto no bloco de cada pessoa.
- Sem mudanças nos cálculos de horas e valores.
