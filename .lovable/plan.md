## Módulo Jurídico — o que muda

### 1. Anexos (proposta + contrato) substituindo "Ref. proposta"
- Nova tabela `juridico_anexos` (mesmo padrão de `compra_anexos`): `contrato_id`, `nome`, `path`, `mime`, `size`, `tipo` ('proposta' | 'contrato' | 'outro'), `uploaded_by`, timestamps. GRANTs + RLS por dono/admin, análogas às de `compra_anexos`.
- Novo bucket privado `juridico-anexos` no Storage, com policies de leitura/escrita para membros do módulo.
- No card do quadro (`src/routes/juridico.index.tsx`) e no `NovoContratoDialog` (comercial): remover campo "Ref. proposta" da UI e substituir por área de upload/lista de anexos (reaproveitando o mesmo componente de upload usado em `CompraDialog`).
- Quando o card nasce do módulo Comercial via `NovoContratoDialog`, o PDF da proposta (se já existir no comercial) é anexado automaticamente ao criar o contrato; caso não haja PDF, o usuário anexa manualmente no dialog.

### 2. Histórico e comentários (igual módulo Compras)
- Novas tabelas `juridico_comentarios` e `juridico_historico` espelhando `compra_comentarios` / `compra_historico` (colunas, GRANTs, RLS e triggers idênticas).
- Trigger em `juridico_contratos` grava histórico automático: criação, mudança de status, alteração de valor/responsável, upload/remoção de anexo, edição de campos-chave.
- Substituir o `ContratoDialog` atual por um diálogo em abas ("Dados", "Anexos", "Comentários", "Histórico"), no mesmo modelo do `CompraDialog`.

### 3. Fluxo de criação: "Criar pelo modelo" vs "Anexar proposta pronta"
- No botão "Novo contrato" (e no "+ adicionar" das colunas), abrir um passo inicial com duas opções:
  - **Criar pelo modelo** — segue para o dialog normal e habilita seleção de modelo em `juridico_modelos` (já existe a rota `juridico.modelos`); ao salvar, o contrato gerado (PDF/Word) fica anexado como `tipo='contrato'`.
  - **Anexar proposta preenchida** — abre o dialog já focado na aba Anexos exigindo upload do arquivo (.pdf/.docx) antes de concluir.
- Em ambos os caminhos, o card exige pelo menos um anexo do contrato final antes de avançar para "Assinatura".

## Drag em qualquer área do card (Compras, Despesas, Jurídico)

Replicar o padrão já usado em `src/routes/comercial.index.tsx`:
- Mover `{...listeners} {...attributes}` do botão `⋮⋮` para o container externo do card em:
  - `src/routes/juridico.index.tsx` (função `Card`)
  - `src/routes/compras.index.tsx` (função de card das compras)
  - `src/routes/financeiro-op.quadro.tsx` (card do Quadro Financeiro/Despesas)
- Deixar `⋮⋮` só como indicador visual (`aria-hidden`).
- Envolver os botões de ação internos com `onPointerDown={(e) => e.stopPropagation()}` para preservar cliques.
- Em Compras e Quadro Financeiro, manter a checagem `disabled: !canMove/!podeMover` já existente (usuário sem permissão continua sem conseguir mover).

## Detalhes técnicos

- Storage: bucket `juridico-anexos` criado via tool (privado); policies em `storage.objects` restringindo por `bucket_id` e presença em `juridico_contratos` acessíveis ao usuário.
- Migração única cria as 3 tabelas + trigger de histórico + GRANTs + RLS.
- Remoção do campo `proposta_ref` da UI (mantido na coluna do banco por retrocompat; não removemos coluna nesta rodada).
- Nenhuma alteração em regras de negócio de outros módulos além da adição do upload automático quando o card é criado pelo `NovoContratoDialog`.
