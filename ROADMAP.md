# Roadmap

Próximas evoluções planejadas da extensão **SIGA – Validador de Despesas**.

Ao entregar um item, marque-o com `[x]` (ou remova-o) e registre a mudança no [CHANGELOG.md](CHANGELOG.md).

## Correções de problemas conhecidos

Detalhes de cada problema no [KNOWN_ISSUES.md](KNOWN_ISSUES.md).

- [x] NFC-e em contingência com QR Code inconsistente: classificar como Manual, com a chave de acesso para conferir no portal.
- [ ] NFC-e em contingência: conferir valor, data e número com os dados do próprio QR offline.
- [ ] NF-e modelo 55: OCR da chave de acesso e dos campos do DANFE para conferência sem SEFAZ, com atalho para a consulta no portal.
- [ ] Bloqueio da SEFAZ por excesso de consultas: revisar a estratégia de consulta depois da refatoração (ID fixo da extensão para preservar o cache, limite real, ritmo adaptativo, lotes menores). Detalhes e ideias no KNOWN_ISSUES.

## Melhorias

- [ ] Lembrar a última validação do mês, para não refazer tudo ao reabrir a tela.
- [ ] Marcar lançamentos como "conferido" num relatório mensal.
