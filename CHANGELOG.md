# Changelog

Todas as mudanças relevantes da extensão **SIGA – Validador de Despesas** ficam registradas aqui.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto usa [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## Não lançado

### Adicionado

- Suíte de testes automatizados (Vitest + jsdom) com 140 testes cobrindo todos os scripts de `src/`, sem alterar o código da extensão: leitura do SIGA, download dos anexos, extração do QR Code, parser e cache da SEFAZ, regras de validação, fila e bloqueio no service worker, painel (incluindo "Revalidar só os erros" e exportação CSV) e consistência do `manifest.json`.
- `package.json` com os scripts `test`, `test:watch`, `test:coverage`, `check` e `package`.
- Repositório git.
- ESLint e Prettier (`npm run lint`, `npm run format`).
- Build para `dist/` (`npm run build`, `npm run dev` com atualização automática); o Chrome passa a carregar `dist/`.
- CI no GitHub Actions rodando checagem, lint, formatação, testes e build; o mesmo conjunto roda localmente com `npm run verify`.
- Teste de ponta a ponta dos bundles gerados (`tests/bundle.test.js`).
- Camada de domínio (`src/domain/`) com regras puras, contratos em JSDoc e erros tipados; checagem de tipos com TypeScript 6 (`npm run typecheck`), também na CI.
- Leitura da chave de acesso com dígito verificador; o QR Code passa a informar tipo de emissão e contingência.
- Painel mais conciso: 6 colunas em vez de 12 (sem uma coluna por critério; as divergências continuam detalhadas na linha), linhas OK que abrem com um clique para mostrar os critérios conferidos, configuração recolhida com resumo, ações como ícones, lembrete curto nas linhas com SEFAZ em pausa e largura de 720 px, deixando a grade do SIGA visível. Tokens visuais alinhados ao azul do SIGA.
- Código reorganizado em camadas (`domain`, `infra`, `app`, `background`, `content`, `entries`, `ui`), com as constantes em `src/config.js`, casos de uso com dependências injetadas e provedores de SEFAZ por estado (SP por enquanto). Sem mudança de comportamento.

### Alterado

- Código em inglês (identificadores, arquivos, classes CSS, comentários e testes); a interface continua em português. A configuração e o cache da SEFAZ salvos pelas versões anteriores continuam sendo lidos.
- `npm run package` passa a gerar o zip a partir de `dist/`.
- Código formatado com Prettier (sem mudança de comportamento).
- Código de `src/` convertido para ES modules e empacotado com esbuild: o `dist/` passa a ter três scripts (`content.js`, `bridge.js`, `background.js`) no lugar da pasta `src/` e de `vendor/`.
- `jsQR` passa a vir do npm (`jsqr` 1.4.0, mesmo arquivo de antes) em vez de `vendor/`; a licença é copiada para `dist/licenses/`.

### Corrigido

- NFC-e emitida em contingência cujo QR Code é recusado pela SEFAZ ("Digest Value inconsistente") passa a ficar como **Manual**, com a chave de acesso formatada para conferir no portal, em vez de **Erro** (que "Revalidar só os erros" não resolvia).
- Quando o firewall da SEFAZ responde com um desafio em JavaScript (em vez da página de consulta), a extensão passa a tratar como bloqueio e pausar as consultas, em vez de mostrar "A SEFAZ não devolveu os dados da nota: (function(){ window.GFXs…".

## 0.1.4 - 2026-11-07

### Alterado

- Lançamento sem nota anexada passa a ser classificado como **Divergente** (antes era **Manual**).

## 0.1.3 - 2026-11-07

### Adicionado

- Botão **Revalidar só os erros**, que confere de novo apenas os lançamentos com erro (ex.: SEFAZ bloqueada) e mantém os demais resultados.

## 0.1.2 - 2026-11-07

### Alterado

- Consultas à SEFAZ feitas uma por vez, com intervalo de ~1,5–2 s, mantendo os cookies do firewall entre as consultas.
- Resultado da SEFAZ guardado por chave de acesso por 60 dias: "Validar novamente" não consulta a mesma nota de novo.

### Corrigido

- Bloqueio do firewall da SEFAZ-SP ("The requested URL was rejected") por excesso de consultas. Ao primeiro bloqueio, a extensão para de consultar por 15 minutos e avisa no painel.

## 0.1.1 - 2026-10-19

### Corrigido

- Erro 404 ao baixar anexos em localidades onde os arquivos ficam com acesso restrito no armazenamento. Agora o download usa o caminho autenticado da pré-visualização do SIGA (`GED99902`), com o link de download (`GED99901`) como alternativa.

### Alterado

- Leitura do QR Code mais robusta em fotos de celular (recortes e ampliação da imagem).

## 0.1.0 - 2026-10-19

### Adicionado

- Primeira versão: confere as despesas da tela Tesouraria › Despesa contra a NFC-e anexada (valor, CNPJ do consumidor, forma de pagamento, data e número), lendo o QR Code e a consulta pública da SEFAZ-SP.
- Painel lateral com resumo, filtros, visualizador da nota, links para SEFAZ e SIGA e exportação em CSV.
- Destaque dos lançamentos na grade do SIGA conforme o resultado.
