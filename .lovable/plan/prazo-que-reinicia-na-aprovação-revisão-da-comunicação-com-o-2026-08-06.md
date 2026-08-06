# Prazo que reinicia na aprovação + revisão da comunicação com o banco

## 1. Prazo reinicia ao aprovar a compra

Hoje o card de compra tem um único campo de prazo, preenchido lá no início (solicitação) e mantido até o fim. A regra nova:

- Ao mover de **Pendente Aprovação → Compras Aprovada**, o prazo atual deixa de valer.
- Nesse momento aparece uma janela pedindo o **novo prazo** (obrigatório) — o prazo que vale até o card chegar em **Finalizado**.
- Sem informar esse novo prazo, o card não é aprovado (nem por arrastar, nem pelo botão "Avançar").
- O prazo antigo não some: fica registrado no histórico do card como "prazo da fase de aprovação", junto de quem aprovou e quando.
- A bolinha (vermelha/amarela/verde) passa a refletir o novo prazo a partir da aprovação.

Cards já aprovados hoje continuam com o prazo que têm; ninguém é forçado a repreencher retroativamente.

## 2. Revisão da comunicação com o banco

Verifiquei o que já está no ar e encontrei estes pontos pendentes:

**Prazo — está completo.** A coluna existe em compras e despesas, é lida nas telas de Compras, Despesas e Quadro Financeiro, e é gravada pelo formulário público de solicitação. Nada faltando aqui além da regra nova acima.

**Atualização em tempo real com furos.** Cinco tabelas têm "escuta" ativa no app, mas não estão habilitadas para transmitir mudanças no banco — ou seja, a tela só atualiza ao recarregar:

- `compra_anexos` (anexos de compra)
- `comercial_vendedores`, `comercial_cerimoniais`, `comercial_decoradores`, `comercial_classificacoes` (cadastros do Comercial)

Correção: habilitar essas tabelas para transmissão em tempo real, para que a escuta que já existe no código volte a funcionar.

## Detalhes técnicos

1. Migração:
   - `ALTER TABLE public.compras ADD COLUMN prazo_aprovacao date` (prazo pós-aprovação) — o campo `prazo` original passa a representar o prazo da fase de solicitação/aprovação; a exibição usa `COALESCE(prazo_aprovacao, prazo)` a partir de `aprovada`.
   - `ALTER PUBLICATION supabase_realtime ADD TABLE public.compra_anexos, public.comercial_vendedores, public.comercial_cerimoniais, public.comercial_decoradores, public.comercial_classificacoes;` (com `REPLICA IDENTITY FULL` onde faltar).
2. `move_compra_status`: aceitar parâmetro `p_prazo date` e, na transição `pendente_aprovacao → aprovada`, exigir valor não nulo (exceção com mensagem clara), gravar em `prazo_aprovacao` e registrar linha em `compra_historico`.
3. `src/routes/compras.index.tsx`: em `advanceToStatus`, quando `compra.status === 'pendente_aprovacao' && status === 'aprovada'`, abrir um `PrazoAprovacaoDialog` (novo, em `src/components/compras/`) antes de chamar a RPC; passar o prazo escolhido.
4. `src/lib/prazo.ts` / `PrazoDot`: helper `prazoVigente(compra)` para escolher entre `prazo` e `prazo_aprovacao` conforme o status; usar em compras.index, CompraDialog e financeiro-op.quadro.
5. `CompraDialog`: mostrar os dois prazos (fase de aprovação, somente leitura após aprovado; prazo de execução editável).
