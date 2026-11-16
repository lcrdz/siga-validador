# Problemas conhecidos

Limitações e problemas conhecidos da extensão **SIGA – Validador de Despesas**, com o comportamento atual e o caminho de solução quando houver.

Ao corrigir um item, remova-o daqui e registre a correção no [CHANGELOG.md](CHANGELOG.md).

Versão de referência: 0.1.4

## Tipos de nota

### NF-e modelo 55 (DANFE A4) não é consultada

- **Comportamento atual:** o lançamento fica como **Manual**.
- **Causa:** o DANFE não tem QR Code. A consulta no Portal Nacional da NF-e exige captcha (resumida) ou certificado digital (completa).
- **Possível solução:** OCR da chave de acesso impressa, para conferir localmente número, emitente, mês, CNPJ do destinatário, data e valor, e um botão para abrir a consulta no portal com a chave preenchida.

### NFC-e emitida em contingência com QR Code inconsistente

- **Comportamento atual:** a SEFAZ responde "QR Code inválido – Assinatura do documento (Digest Value) inconsistente". Desde a Fase 3 da refatoração o lançamento fica como **Manual**, com a chave de acesso formatada e o link da consulta (que leva à consulta pela chave, com captcha). Antes ficava como **Erro** e "Revalidar só os erros" não resolvia.
- **Causa:** a nota foi emitida em contingência offline (tipo de emissão 9 na chave) e o sistema de caixa do emitente transmitiu à SEFAZ um arquivo diferente do impresso. Visto em notas do Shalom Mini Preço Ltda.
- **Falta:** conferir automaticamente valor, data e número com os dados que o próprio QR offline traz (dia e valor estão no QR; número e mês, na chave).

### NFC-e de outros estados

- **Comportamento atual:** fica como **Manual**, com o link da consulta.
- **Causa:** só a página de consulta da SEFAZ de São Paulo é lida automaticamente.

## Anexos

### PDFs sem imagem JPEG

- **Comportamento atual:** fica como **Manual**.
- **Causa:** a leitura do QR Code extrai as imagens JPEG do PDF. PDFs gerados com texto, ou scans em preto e branco (CCITT/JBIG2), não têm essa imagem.

## SEFAZ

### Bloqueio por excesso de consultas

- **Comportamento atual:** o firewall da SEFAZ-SP bloqueia temporariamente quem consulta demais. A extensão consulta uma nota por vez (~2 s cada), guarda os resultados por 60 dias e, ao primeiro bloqueio, pausa as consultas por 15 minutos.
- **Impacto:** a primeira validação do mês é mais lenta. As seguintes usam o resultado guardado.
- **Observado em 16/11/2026 (após a Fase 2):** muitos lançamentos terminaram com "A SEFAZ bloqueou temporariamente as consultas automáticas (excesso de acessos)…", com pausa até 13:11. O cache de 60 dias provavelmente estava vazio, porque o Chrome passou a carregar a extensão de `dist/` e uma extensão sem compactação muda de ID (e perde o `chrome.storage`) quando muda de pasta. Assim todas as notas do mês foram consultadas de novo, em sequência.
- **Observado em 16/11/2026 (13h):** antes da página de bloqueio, o firewall passou a devolver um desafio em JavaScript; a extensão mostrava "A SEFAZ não devolveu os dados da nota: (function(){ window.GFXs…". Desde a Fase 3 isso é tratado como bloqueio. Na mesma hora a consulta aberta direto no navegador também estava bloqueada.
- **A revisar depois da refatoração** (ver [ROADMAP.md](ROADMAP.md)), sempre respeitando o limite da SEFAZ e sem tentar contornar o firewall:
  - fixar o ID da extensão (campo `key` no `manifest.json`) para o cache e a configuração sobreviverem a mudanças de pasta e reinstalações;
  - medir o limite real (quantas consultas e em quanto tempo disparam o bloqueio) e calibrar o intervalo, hoje de ~1,5–2,2 s;
  - ritmo adaptativo: aumentar o intervalo depois de um bloqueio e voltar aos poucos;
  - consultar em lotes menores, com pausas entre eles, e mostrar o progresso/estimativa no painel;
  - evitar consultas desnecessárias: pular lançamentos já conferidos no mês e não consultar quando o QR não é consultável;
  - comparar com abrir a consulta numa aba do navegador (como o usuário faria) em vez de `fetch` pelo service worker;
  - revisar a pausa de 15 minutos e a mensagem para o usuário.

## Dependências externas

### Mudanças de layout no SIGA ou na SEFAZ

- **Risco:** se o SIGA mudar as telas `TES00801`/`TES00804` ou os endpoints do GED, ou se a SEFAZ mudar a página de consulta, a leitura dos dados quebra.
- **Onde ajustar:** `src/infra/siga/parsers.js` (SIGA) e `src/infra/sefaz/sp.js` (SEFAZ-SP); endereços em `src/config.js`.
