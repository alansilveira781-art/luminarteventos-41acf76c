## Contexto

A base de dados e o pipeline já estão prontos do trabalho anterior:

- Tabela `comercial_vendas` com 35 colunas mapeando a aba **"Base de Dados"** da planilha (Data de Registro, Ano, Mês, Tipo, Quantidade, Nome do Evento, Local, Estado, Cidade, Salão, Tipo de Evento, Classificação, Data do Evento, Consultor, Gestor, Cerimonial, Decorador, Empresa, Valor da Proposta, Desconto, Valor Final, Valor BV, Comissão Gestor/Consultor, etc.). Já tem 972 linhas (mesma planilha que veio agora).
- Tabela auxiliar `comercial_vendas_sync` com histórico de cargas.
- Server functions: `listVendasDb`, `syncVendasFromDropbox` (botão), `syncVendasFromUpload` (upload .xlsx), `getLastSync`.
- Cron diário 03:00 chamando o endpoint público de sync.

**Não precisa recriar tabela nem reimportar.** Só falta a tela e o item de menu.

## O que será feito

### 1. Item de menu "Vendas" (admin-only) na sidebar do Comercial
Em `src/components/AppSidebar.tsx`, adicionar entrada:
```
{ title: "Vendas", url: "/comercial/vendas", icon: DollarSign,
  group: "Comercial", module: "comercial", moduleAdminOnly: "comercial" }
```
A flag `moduleAdminOnly: "comercial"` faz o item aparecer só para admin global ou admin do módulo Comercial (mesma regra já usada em "Validações" e "Configurações").

### 2. Rota `/comercial/vendas` — nova tela de listagem
Arquivo `src/routes/comercial.vendas.tsx`:

- **Cabeçalho** com título "Vendas" + indicador de última sincronização (`getLastSync`).
- **Ações** (mesmas do dashboard, reaproveitando as server fns existentes):
  - Botão **Sincronizar agora** (Dropbox)
  - Botão **Importar .xlsx** (upload manual)
  - Botão **Atualizar**
- **Filtros**: Empresa · Ano · Mês · Consultor · Classificação (selects derivados dos próprios dados).
- **Busca** por nome do evento / local / cidade.
- **Tabela paginada** (50/página) com colunas:
  Data Evento · Nome do Evento · Empresa · Local/Cidade · Consultor · Cerimonial · Decorador · Classificação · Qtde · Valor Final · Desconto.
- **Rodapé**: total de registros filtrados + soma de Valor Final + soma de Desconto.
- **Exportar CSV** dos registros filtrados (client-side).
- Loading/erro/empty states consistentes com o Dashboard.

A tela só lê de `comercial_vendas` via `listVendasDb` (já paginada server-side). Não há edição manual de linhas — a fonte da verdade é a planilha do Dropbox / upload.

### 3. Permissão na rota (defesa em profundidade)
Além de esconder no menu, o componente da rota verifica `useAuth()` e renderiza um aviso "Acesso restrito a administradores" caso `!isAdmin && !modulos.find(m => m.slug==='comercial' && m.is_admin)`. RLS da tabela continua como está (já restrito a usuários autenticados).

## Fora do escopo (mantido como está)
- Schema da tabela `comercial_vendas` — sem alterações.
- Reimportação dos dados — os 972 registros já estão lá; um clique em **Sincronizar agora** atualiza.
- Dashboard Comercial — segue funcionando lendo da mesma tabela.
