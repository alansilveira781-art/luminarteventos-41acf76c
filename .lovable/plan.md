# Assistente de IA (Claude) restrito a administradores mestres

Um assistente conversacional dentro do sistema, com página própria no menu, que responde perguntas e faz análises sobre os dados do Luminart (eventos, compras, aquisições, estoque, financeiro). Acesso liberado apenas para administradores mestres — inicialmente você e o Maicon Viana.

## Sobre o Claude

O Claude não faz parte dos modelos inclusos na plataforma (lá temos Gemini e GPT). Para usar o Claude de verdade é necessária uma chave de API da Anthropic (conta paga, cobrança direta com eles). O plano assume o Claude com essa chave: na hora de implementar, eu peço a chave por um campo seguro e ela fica guardada só no servidor, nunca no navegador.

Se preferir não abrir conta na Anthropic, dá para usar o modelo já incluso na plataforma sem chave e sem custo extra — a tela e as permissões seriam exatamente as mesmas. É só avisar.

## Permissão "administrador mestre"

- Nova marcação de administrador mestre no banco, aplicada a você e ao Maicon.
- A tela de Administração > Usuários ganha um interruptor para conceder/remover essa marcação (visível só para admins mestres).
- A verificação acontece no servidor a cada mensagem enviada: quem não for admin mestre recebe recusa, mesmo que tente acessar o endereço direto.
- O item de menu "Assistente" só aparece para quem tem a permissão.

## A tela do assistente

- Página própria (`/assistente`) com conversa em tempo real (resposta aparecendo palavra a palavra).
- Histórico de conversas na lateral: criar nova conversa, renomear e excluir. Cada usuário vê só as suas.
- Sugestões prontas de perguntas ("Quanto gastamos em julho?", "Quais itens estão abaixo do mínimo?", "Compare os eventos do mês").
- Indicação de quais consultas o assistente fez para responder (transparência sobre a origem dos números).

## O que o assistente consegue consultar

Reaproveita as consultas já existentes no sistema, em modo somente leitura:

- Eventos por período, com locais, produtor e datas de montagem
- Compras e aquisições por status, período e busca livre
- Estoque: saldo, mínimo, itens abaixo do mínimo
- Resumo financeiro do período (compras + aquisições, totais e quebra por status)
- Indicadores do DRE / rateios por evento para análises comparativas

Ele não cria, move nem altera nada — apenas lê e analisa.

## Detalhes técnicos

- Migração: coluna/flag de admin mestre (via `user_roles` com novo valor de papel `master_admin`) + função `is_master_admin(_user_id)` security definer; tabelas `assistente_conversas` e `assistente_mensagens` com RLS por `auth.uid()` e GRANTs.
- Backend: `createServerFn` com `.middleware([requireSupabaseAuth])` que valida `is_master_admin` antes de qualquer chamada; para streaming, rota de servidor em `src/routes/api/assistente/chat.ts` com a mesma checagem de bearer token.
- Ferramentas de dados: reaproveitar os handlers em `src/lib/mcp/tools/*` como funções de leitura chamadas pelo modelo (tool calling), executadas com o contexto do usuário.
- Chave da Anthropic guardada como secret do servidor (`ANTHROPIC_API_KEY`), lida dentro do handler; nunca exposta ao cliente.
- Sidebar: novo item condicionado a `isMasterAdmin` em `AppSidebar.tsx`; rota protegida por layout que redireciona quem não tem permissão.
