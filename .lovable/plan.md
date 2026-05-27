
## Diagnóstico

**1. Tabela cortando valores**
A tabela "Impostos apurados" está dentro de um grid de 2 colunas (`lg:grid-cols-2`) em viewport de ~1090px. Com 6 colunas (Imposto, Base, Alíq., Valor, Adicional, Total) e padding `px-4`, valores em BRL como "R$ 21.600,00" não cabem e ficam quebrando/cortando. Isso só piora quando há adicional de IRPJ.

**2. "Registrar apuração" — onde vai?**
Hoje o botão grava na tabela `contabil_consultas_impostos` (histórico interno). Aparece logo abaixo, no card **"Apurações registradas"** na mesma tela. **Não** envia para Financeiro/Contas a Pagar, **não** gera boleto/DARF, **não** notifica ninguém. É apenas um registro/histórico consultável.

---

## Plano

### A) Corrigir corte de valores na tabela

1. Reduzir padding horizontal das células de `px-4` para `px-2` (ou `px-3`) na tabela de impostos.
2. Encolher o cabeçalho ("Alíq." já está abreviado; abreviar "Adicional" para "Adic." em telas estreitas).
3. Permitir scroll horizontal de segurança: envolver a tabela em `<div className="overflow-x-auto">` e adicionar `whitespace-nowrap` nas células numéricas para evitar quebra.
4. Como alternativa para telas médias, fazer o grid colapsar mais cedo: trocar `lg:grid-cols-2` por `xl:grid-cols-2` para que abaixo de 1280px as duas tabelas fiquem uma embaixo da outra (cada uma com largura total) — assim os valores cabem com folga.
5. Manter a linha "Total a pagar" destacada e legível.

### B) Esclarecer/melhorar o "Registrar apuração"

1. Adicionar um texto curto ao lado do botão (ou tooltip) explicando: *"Salva esta apuração no histórico abaixo (Apurações registradas)"*.
2. Após salvar, dar scroll/realce no card de histórico para deixar visível que a linha foi adicionada.
3. (Opcional, confirmar com você) Acrescentar na lista de **Apurações registradas** as colunas **Competência** e **Vencimento** (que já são salvos em `parametros`/`resultado`), para ficar claro o mês de pagamento.

### Pergunta para decidir antes de implementar

Sobre o destino da apuração registrada, quer que eu:
- (a) Mantenha só como histórico interno (situação atual, apenas com os ajustes visuais acima), **ou**
- (b) Também gere automaticamente uma **conta a pagar** (uma por imposto: PIS, COFINS, IRPJ+adicional, CSLL) com vencimento no mês seguinte, para aparecer no módulo Financeiro?

### Arquivos afetados
- `src/routes/contabil.apuracoes.tsx` (ajustes de layout da tabela, textos, colunas do histórico)
- Se opção (b): nova migration + integração com `ca_contas_pagar` (ou tabela própria de obrigações fiscais).
