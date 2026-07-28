## Diagnóstico (verificado no banco)

**1. Anexos invisíveis para a equipe de Compras**

A regra de leitura de `compra_anexos` (e de `compra_comentarios`) hoje só libera para: administrador geral, administrador do módulo compras/estoque, ou quem criou / é responsável / é solicitante daquela compra. Hoje o módulo Compras tem 4 usuários, sendo apenas 1 administrador de módulo — ou seja, os outros 3 não enxergam anexos de cards que não sejam deles. As permissões do arquivo em si (storage) já liberam para qualquer membro de compras/estoque; o bloqueio está na tabela.

**2. Demora do Estoque › A Receber**

- As despesas (`demandas`) não estão publicadas em tempo real e o sincronizador de tempo real do estoque não escuta essa tabela — só compras, itens e movimentações. Resultado: um card que vira "A Receber" no módulo Despesas só aparece no Estoque quando o usuário recarrega ou volta o foco na aba.
- As consultas `compras-receber` e `demandas-receber` da tela não têm atualização periódica nem revalidação ao focar configurada explicitamente.

## O que será feito

### Banco de dados (migração)
- Ajustar a leitura de `compra_anexos` e `compra_comentarios`: liberar para qualquer usuário com acesso ao módulo compras ou estoque (mantendo escrita/exclusão restrita ao dono, responsável e administradores, como está hoje).
- Publicar `demandas`, `demanda_itens` e `demanda_anexos` no tempo real, para o Estoque receber as mudanças na hora.

Sem afetar as regras já endurecidas anteriormente para dados sensíveis (comissões, vendas, jurídico).

### Frontend
- `src/hooks/useEstoqueRealtimeSync.ts`: passar a escutar `demandas` e `demanda_itens`, invalidando `demandas-receber`, `demanda-a-receber-info`, `compras-receber` e afins.
- `src/routes/estoque.a-receber.tsx`: nas consultas `compras-receber` e `demandas-receber`, ativar revalidação ao voltar o foco da janela e uma atualização periódica leve (rede de segurança caso o tempo real caia).

## Detalhes técnicos
- Migração: `DROP POLICY` + `CREATE POLICY` de SELECT em `public.compra_anexos` e `public.compra_comentarios` usando `has_module_access(auth.uid(),'compras') OR has_module_access(auth.uid(),'estoque') OR is_admin(...)`; `ALTER PUBLICATION supabase_realtime ADD TABLE ...` para as três tabelas de demandas.
- `refetchOnWindowFocus: true` + `refetchInterval` (~60s) nas duas queries da aba A Receber.

## Fora do escopo
Nenhuma alteração em regras de escrita, nem revisão de outros módulos — se quiser, faço depois uma varredura equivalente em Despesas, Patrimônio e Jurídico.
