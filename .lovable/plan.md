## Diagnóstico: Transmissão de dados contábeis ao banco

Conferi cada tela do módulo Contábil contra a base. **Tudo o que é cadastrado pela UI está sendo gravado no banco.**

### Tabelas e registros atuais

| Tela | Tabela | Registros | Operações na UI |
|------|--------|-----------|-----------------|
| Notas Fiscais | `contabil_notas_fiscais` | 1 | insert/update/delete ✅ |
| Recebimentos | `contabil_recebimentos` | 1 | insert/update/delete ✅ |
| Configuração | `contabil_configuracao_aliquotas` | 11 | insert/update/delete ✅ |
| Apurações | `contabil_consultas_impostos` | 0 | insert/delete ✅ (ainda sem uso) |

### Exemplo real encontrado no banco
- Nota: ALAN SILVEIRA — Luminart Eventos — R$ 264.815,00 (líquido R$ 215.321,07) — impostos {IRPJ, CSLL, PIS, COFINS, ISS} — emitida 16/06/2026
- Recebimento vinculado: R$ 264.815,00 em 17/06/2026 (apontando para a nota acima)

### Conclusão
Não há bug de transmissão. Todas as gravações nas 4 telas (`contabil.notas`, `contabil.recebimentos`, `contabil.configuracao`, `contabil.apuracoes`) usam `supabase.from(...).insert/update/delete` direto nas tabelas reais, sem mock nem cache desconectado. A tabela `contabil_consultas_impostos` está zerada apenas porque nenhuma apuração foi salva ainda — não é falha.

### Próximo passo (se quiser)
Se você suspeita de algum campo específico que não está sendo salvo (ex.: `numero`, `tomador_documento`, `tomador_email`, `observacoes`), me diga **qual tela** e **qual campo** que eu investigo cirurgicamente o `payload` daquele formulário. Pelos dados atuais vejo, por exemplo, que a nota gravada está com `numero`, `tomador_documento` e `tomador_email` vazios — pode ser intencional (rascunho) ou indício de campo não mapeado.

**Nada a alterar neste momento. Aguardando você apontar um campo/tela específica se houver suspeita.**