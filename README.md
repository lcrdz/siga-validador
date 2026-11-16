# SIGA – Validador de Despesas

Extensão do Chrome (Manifest V3) que confere todas as despesas da tela **Tesouraria › Despesa › Consulta** do SIGA contra a nota fiscal anexada a cada lançamento.

Para cada lançamento ela verifica:

| Critério           | SIGA                                       | Nota                           |
| ------------------ | ------------------------------------------ | ------------------------------ |
| Valor              | `Valor` do lançamento                      | "Valor a pagar" da NFC-e       |
| CNPJ do consumidor | configurável (padrão `61.526.398/0001-99`) | Consumidor da NFC-e            |
| Forma de pagamento | configurável (padrão `Dinheiro`)           | Forma(s) de pagamento da NFC-e |
| Data               | `Data Documento`                           | Data de emissão                |
| Número             | `Nº Documento`                             | Número da NFC-e                |

Também avisa quando o CNPJ do emitente da nota é diferente do fornecedor cadastrado no lançamento.

## Como funciona

1. Lê todos os lançamentos carregados na grade (inclusive os de outras páginas), direto do DataTables do SIGA.
2. Para cada um, abre o detalhe (`TES00804.aspx`), lista os anexos (`GED/ArquivoWS.asmx/Selecionar`) e baixa o PDF pelo mesmo caminho da lupa de pré-visualização do SIGA (`GED/GED99902.aspx`, que traz a autorização de acesso ao arquivo). Se esse caminho falhar, tenta o link de download (`GED/GED99901.aspx`).
3. Extrai a imagem do PDF escaneado e lê o **QR Code da NFC-e** (API nativa `BarcodeDetector` do Chrome, com `jsQR` como reserva).
4. Abre a **consulta pública da SEFAZ-SP** apontada pelo QR Code e lê os dados oficiais da nota.
5. Compara e mostra o resultado num painel lateral, destacando as linhas na grade do SIGA.

Tudo é somente leitura: a extensão não altera nenhum lançamento. Ela usa a sessão do SIGA já aberta no navegador e não envia dados para nenhum outro lugar além do próprio SIGA, do armazenamento de anexos do SIGA (Azure Blob) e da SEFAZ-SP.

## Setup para desenvolvimento

O código fica em `src/`, em ES modules. O `npm run build` empacota (esbuild) os três pontos de entrada em scripts únicos e monta a extensão em `dist/`, que é a pasta carregada no Chrome. Fora o `jsqr` (embutido no bundle), as dependências do `package.json` são de desenvolvimento.

### Ambiente

| Item                    | Para quê                                                                                                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google Chrome (recente) | Rodar e depurar a extensão. No macOS o QR Code é lido pela API nativa `BarcodeDetector`; em outros sistemas a extensão usa o `jsQR` (dependência npm, embutida no bundle). |
| Acesso ao SIGA          | Uma conta com acesso a **Tesouraria › Despesa** para testar com dados reais.                                                                                               |
| Node.js 20+ e npm       | Build, testes, lint e formatação.                                                                                                                                          |
| `zip`                   | Empacotar a extensão para distribuir.                                                                                                                                      |

### Comandos

Rodar na raiz do projeto.

```bash
npm install              # instala as dependências de desenvolvimento
npm run build            # gera a extensão em dist/
npm run dev              # gera dist/ e refaz a cada alteração em src/, icons/ ou manifest.json
npm test                 # roda todos os testes uma vez
npm run test:watch       # roda os testes a cada alteração
npm run test:coverage    # testes + relatório de cobertura (coverage/index.html)
npm run lint             # ESLint (npm run lint:fix corrige o que for automático)
npm run format           # formata com Prettier (npm run format:check só confere)
npm run typecheck        # checa os tipos (JSDoc) com o TypeScript: domínio, infra, casos de uso e service worker
npm run check            # checa a sintaxe dos scripts e o manifest.json
npm run verify           # tudo que a CI roda: check, lint, format:check, typecheck, test e build
npm run package          # build + ../siga-validador-<versão>.zip com o conteúdo de dist/
```

A CI (`.github/workflows/ci.yml`) roda o `verify` a cada push e pull request.

### Testes

Os testes ficam em `tests/` e rodam no Node com [Vitest](https://vitest.dev/) e jsdom, sem abrir o Chrome nem acessar o SIGA ou a SEFAZ:

- Os testes seguem as camadas (`tests/domain`, `tests/infra`, `tests/app`, `tests/background`, `tests/ui`). Casos de uso e clientes recebem as dependências por parâmetro, então os testes passam versões simuladas sem precisar de `vi.mock`; módulos com efeito ao carregar (`entries/bridge.js`, `background/index.js`, `content/init.js`) são reimportados com `vi.resetModules()`.
- `tests/ui/panel.test.js` monta o painel com `content/init.js` e o SIGA/validação simulados.
- `tests/bundle.test.js` gera os bundles e roda `dist/bridge.js` + `dist/content.js` numa página simulada do SIGA, validando um lançamento de ponta a ponta.
- `tests/helpers/files.js` lê fixtures e arquivos do projeto.
- `tests/helpers/fakes.js` simula `fetch`, `chrome.*` e PDFs escaneados.
- `tests/fixtures/` tem páginas do SIGA e da SEFAZ reconstruídas a partir das telas reais, com dados fictícios (veja o README da pasta).
- `tests/setup.js` completa o jsdom com o que o Chrome tem e ele não (`innerText`, `postMessage` com `source`, `URL.createObjectURL`).

O que não é coberto: a leitura real do QR Code numa imagem (depende de `BarcodeDetector`/canvas do navegador) e a integração com o SIGA e a SEFAZ de verdade. Antes de publicar uma versão, valide um mês real no SIGA.

### Convenções

- **Código em inglês:** nomes de variáveis, funções, arquivos, classes CSS, comentários e nomes de testes. Siglas e termos do domínio sem tradução boa ficam como são: `cnpj`, `nfce`, `sefaz`, `siga`, `uf`.
- **Português para quem usa:** textos da interface, mensagens de erro mostradas ao usuário, documentação (README, CHANGELOG...) e mensagens de commit.
- Glossário: lançamento → `entry`, nota fiscal → `invoice`, chave de acesso → `accessKey`, fornecedor → `supplier`, emitente → `issuer`, consumidor → `consumer`, forma de pagamento → `paymentMethod`, valor → `amount`, anexo → `attachment`, conferido/divergente → `ok`/`divergent`.

### Ciclo de desenvolvimento

1. Rode `npm run dev` e deixe o terminal aberto.
2. Carregue a pasta **`dist/`** em `chrome://extensions` (veja [Instalação](#instalação-modo-desenvolvedor)).
3. Depois de alterar o código, o `dist/` é atualizado sozinho: clique em **recarregar** (↻) no card da extensão e recarregue a aba do SIGA.
4. Logs e erros:
   - painel e leitura do SIGA (`content.js`): DevTools da aba do SIGA;
   - consultas à SEFAZ e downloads (`background.js`): em `chrome://extensions`, link **service worker** no card da extensão.
5. Antes de fechar uma versão: rode `npm run verify`, atualize `version` no `manifest.json` **e** no `package.json` (um teste confere que são iguais) e registre as mudanças no [CHANGELOG.md](CHANGELOG.md).

## Instalação (modo desenvolvedor)

1. Rode `npm install` e `npm run build` na pasta do projeto, ou descompacte o `.zip` gerado por `npm run package` numa pasta fixa.
2. Abra `chrome://extensions` e ative **Modo do desenvolvedor** (canto superior direito).
3. Clique em **Carregar sem compactação** e escolha a pasta **`dist/`** (ou a pasta onde descompactou o `.zip`).
4. Fixe o ícone da extensão na barra, se quiser.

## Interface

O painel abre por cima da tela de despesas, do lado direito, sem cobrir a grade do SIGA (que fica destacada com a cor do resultado de cada linha). Ele usa tokens visuais próprios (`--sv-*` em `src/ui/styles.js`: cores, espaçamento, raio e fonte), com o azul dos botões do SIGA, e acompanha o modo escuro do sistema.

Não há biblioteca de componentes: o painel roda num content script, que no Chrome executa num "mundo isolado" sem `customElements`, então bibliotecas de Web Components (Shoelace/Web Awesome, Lit…) não funcionam sem polyfill. O Shadow DOM isola o CSS do painel e o do SIGA.

## Uso

1. Entre no SIGA e abra **Tesouraria › Despesa** com o mês de trabalho desejado.
2. Clique no botão **Validar despesas** (canto inferior direito) ou no ícone da extensão.
3. Clique em **Validar lançamentos**. Em ~10 s os 20–30 lançamentos do mês estão conferidos.
4. Use os filtros (chips) ou "Mostrar só o que precisa de atenção". Os botões de cada linha abrem a imagem da **Nota**, a consulta da **SEFAZ** e o lançamento no **SIGA**.
5. Se algum lançamento der **Erro** (ex.: SEFAZ fora do ar ou bloqueada), use **Revalidar só os erros** para conferir de novo só esses.
6. **Exportar CSV** gera a planilha da conferência (abre direto no Excel).

### Status

- **OK**: os cinco critérios conferem.
- **Divergente**: algum critério não bate (a linha de detalhe mostra o valor do SIGA e o da nota) ou o lançamento não tem nota anexada.
- **Manual**: há anexo, mas não há como consultar automaticamente (recibo, NF-e modelo 55, QR ilegível, NFC-e de outro estado ou QR Code recusado pela SEFAZ em notas emitidas em contingência). Use o botão **Nota** para conferir na hora; no caso do QR recusado, a mensagem traz a chave de acesso para a consulta no portal.
- **Erro**: falha técnica (sessão expirada, SEFAZ fora do ar etc.). A mensagem diz o motivo.

## Problemas conhecidos

Veja o [KNOWN_ISSUES.md](KNOWN_ISSUES.md).

## Estrutura

```
manifest.json
CHANGELOG.md          histórico de versões
KNOWN_ISSUES.md       limitações e problemas conhecidos
ROADMAP.md            próximas evoluções planejadas
docs/REFACTOR_PLAN.md plano de refatoração do código
src/
  config.js           constantes: endereços, ritmo das consultas, validade do cache
  domain/             regras puras, sem DOM, rede ou chrome.*
    types.js            contratos em JSDoc (Entry, SefazInvoice, Result...)
    formats.js          números, CNPJ e textos
    access-key.js       chave de acesso de 44 dígitos com dígito verificador
    nfce-qrcode.js      interpretação do QR Code da NFC-e
    rules.js            critérios, configuração padrão e comparação
    result.js           status, mensagens e montagem do resultado
    errors.js           erros conhecidos e o status de cada um
    csv.js              exportação em CSV
  infra/              acesso ao mundo externo
    siga/client.js      requisições ao SIGA (grade, detalhe, anexos, download)
    siga/parsers.js     leitura das páginas do SIGA
    sefaz/client.js     consulta com cache e escolha da SEFAZ pelo QR Code
    sefaz/sp.js         leitura da Consulta Resumida NFC-e da SEFAZ-SP
    pdf/images.js       imagens JPEG de PDFs escaneados
    qr/reader.js        leitura do QR (BarcodeDetector + recortes + jsQR)
    storage/            configuração do usuário e cache da SEFAZ
    messages.js         protocolo content ↔ service worker
    text.js, bytes.js   utilidades de texto/HTML e bytes
  app/                casos de uso, com dependências recebidas por parâmetro
    validate-entry.js   detalhe → anexos → QR → SEFAZ → regras
    validate-batch.js   vários lançamentos com concorrência limitada
  content/init.js     monta o painel e liga os botões aos casos de uso
  ui/                 interface
    panel.js            painel lateral e visualizador da nota (renderização e eventos)
    state.js            estado do painel e transições (funções puras)
    styles.js           CSS do painel (tokens --sv-*) e do destaque da grade
    icons.js            ícones SVG
    siga-grid.js        destaque das linhas na grade do SIGA
  background/         service worker
    index.js            roteador de mensagens e clique no ícone
    fetch.js            busca de URLs (SEFAZ e Azure Blob)
    sefaz-queue.js      uma consulta por vez, com intervalo
    sefaz-block.js      pausa depois de bloqueio
    firewall.js         reconhece bloqueio e desafio do firewall
  entries/            pontos de entrada do build: content.js e bridge.js (ponte no contexto da página)
icons/
tests/                testes (Vitest + jsdom) por camada, helpers e fixtures
scripts/build.js      empacota com esbuild e monta a extensão em dist/
dist/                 extensão pronta para o Chrome (gerada, fora do git)
.github/workflows     CI
package.json          dependências e scripts de desenvolvimento
eslint.config.js, .prettierrc.json, vitest.config.js, tsconfig.json  lint, formatação, testes e tipos
```

## Roadmap

Veja o [ROADMAP.md](ROADMAP.md).

## Histórico de versões

Veja o [CHANGELOG.md](CHANGELOG.md).
