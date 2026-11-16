# Fixtures

Páginas usadas pelos testes. Foram **reconstruídas** a partir da estrutura observada nas telas reais
(ids, classes e textos que o código lê), com dados fictícios. Se o SIGA ou a SEFAZ mudarem o layout,
atualize a fixture com uma captura real (sem dados pessoais) e rode os testes.

- `siga/tes00804.html` – detalhe do lançamento (Tesouraria › Despesa › Visualizar).
- `siga/ged99902.html` – visualizador de anexo (lupa), com URL do Azure Blob e cabeçalhos assinados.
- `siga/ged99901.html` – link de download do anexo (aponta para o Blob sem autorização).
- `sefaz/nfce-ok.html` – Consulta Resumida NFC-e (SEFAZ-SP), pagamento em dinheiro, consumidor CNPJ.
- `sefaz/nfce-mixed-payment.html` – mesma página com dinheiro + cartão e consumidor CPF.
- `sefaz/invalid-qrcode.html` – resposta para NFC-e em contingência com Digest Value inconsistente.
- `sefaz/blocked.html` – página do firewall (F5) quando bloqueia por excesso de consultas.
- `sefaz/js-challenge.html` – desafio em JavaScript que o firewall às vezes devolve antes de bloquear (trecho inicial real, resto abreviado).
