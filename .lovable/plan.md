# Diaristas: acesso delegado e lançamento por evento

## O que muda

### 1. Liberação de acesso pelas Configurações
Na página **Financeiro > Diaristas > Configurações** (visível só para admins do Financeiro) entra uma nova seção **"Quem pode lançar diárias"**: uma lista dos usuários do sistema com um botão para liberar/remover o acesso.

Quem for liberado passa a ver a aba **Diaristas** no menu Financeiro, mesmo sem ter o módulo Financeiro completo.

### 2. O que o lançador vê
- Só os apontamentos que ele mesmo lançou (pode editar e excluir os próprios).
- Sem valores em R$: as colunas R$/h, diária, extra e total ficam ocultas para ele, e a aba **Fechamento** não aparece.
- Ele pode cadastrar novos diaristas usando a mesma tela/interface de cadastro que já existe (nome, valor/hora, Pix, ativo).
- Admins do Financeiro continuam vendo tudo, com valores e fechamento.

### 3. Lançamento com dois ou mais eventos no mesmo dia
No formulário de apontamento entra a opção **"Trabalhou em mais de um evento?"** com dois modos:

- **Informar horários** — o lançador adiciona cada evento com seu horário inicial, final e intervalo. As horas e o valor de cada evento são calculados pelo horário informado.
- **Dividir igualmente** — o lançador informa apenas o horário total do dia e lista os eventos; o valor total do dia é rateado em partes iguais entre os eventos.

Quando não há divisão, o lançamento segue exatamente como é hoje (um evento/projeto só).

Nas listagens e no fechamento, um dia dividido aparece como uma linha principal expansível mostrando cada evento com sua parte de horas e valor, de modo que o rateio por evento fique disponível nos relatórios.

## Detalhes técnicos

**Banco (migração):**
- Nova tabela `diarista_lancadores (user_id, created_at)` com GRANTs e RLS: leitura para autenticados, escrita só para admin/admin do módulo `financeiro_op`; função `public.pode_lancar_diaria(_user_id)` (security definer) usada nas policies.
- `diarista_apontamentos`: novas colunas `modo_divisao text default 'unico'` (`unico` | `horarios` | `igual`), `created_by` já existe e passa a ser preenchido por trigger.
- Nova tabela `diarista_apontamento_eventos (id, apontamento_id, evento_id, evento_nome, hora_inicial, hora_final, intervalo_minutos, ordem)` com cascade, GRANTs e RLS espelhando as do apontamento pai.
- RLS de `diarista_apontamentos`/`diaristas`: além do acesso atual do módulo, permitir INSERT/UPDATE/DELETE quando `pode_lancar_diaria(auth.uid())` e `created_by = auth.uid()` (nos apontamentos); em `diaristas`, permitir SELECT/INSERT/UPDATE para lançadores.

**Frontend:**
- `src/lib/diaristas-calc.ts`: nova função `calcularApontamentoComEventos()` devolvendo o total do dia mais o rateio por evento (por horas ou parte igual).
- `src/lib/diaristas-acesso.ts` (novo): hook `useDiaristaAcesso()` com `podeLancar`, `isFinAdmin`, `verValores`.
- `src/routes/financeiro-op.diaristas.index.tsx`: filtro por `created_by` para lançador, colunas de valor condicionais, aba Fechamento condicional, linhas expansíveis por evento e o novo bloco de divisão no diálogo (usando `EventoSheetCombobox` já existente).
- `src/routes/financeiro-op.diaristas.configuracoes.tsx`: seção de liberação de usuários (lista de `profiles` + switch) e liberação de acesso ao cadastro de diaristas para lançadores.
- `src/components/AppSidebar.tsx`: item "Diaristas" também visível quando `podeLancar`.
