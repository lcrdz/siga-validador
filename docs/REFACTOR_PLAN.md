# Plano de refatoração

Plano para deixar o código da extensão mais estruturado **sem mudar o comportamento**. Cada fase termina com `npm test` verde; a suíte de testes de caracterização (140 testes em `tests/`) é a rede de segurança.

## Situação atual

São ~1.270 linhas em 9 scripts "clássicos" que se enxergam por variáveis globais (`U`, `Siga`, `Nota`, `Sefaz`, `Validacao`, `UI`), na ordem definida no `manifest.json`.

| Problema                                                            | Onde                                                                                                                                                                        | Consequência                                                                                                       |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Dependências implícitas por variável global e ordem de carregamento | todos                                                                                                                                                                       | Difícil de testar (os testes precisam de um carregador especial) e fácil de quebrar ao reordenar o manifest.       |
| Arquivos com várias responsabilidades                               | `siga.js` (HTTP + parse de HTML + download), `validacao.js` (orquestração + regras + configuração), `ui.js` (464 linhas: CSS, estado, renderização, CSV, destaque na grade) | Mudanças pequenas mexem em arquivos grandes; regras de negócio misturadas com DOM e rede.                          |
| Formato do resultado implícito                                      | `validacao.js` → `ui.js`                                                                                                                                                    | Campos opcionais (`mensagem`, `aviso`, `sefazBloqueada`, `checks: null`) sem contrato; status como strings soltas. |
| Erros classificados por texto                                       | `validacao.js`, `sefaz.js`, `background.js`                                                                                                                                 | O caso "QR Code inválido" (contingência) cai como Erro genérico; difícil dar tratamento específico.                |
| Protocolo de mensagens ad hoc                                       | `util.js` ↔ `background.js`                                                                                                                                                 | `{ tipo: 'buscar', url, como, cabecalhos }` sem tipo nem validação; arquivos trafegam em base64.                   |
| Constantes espalhadas                                               | vários                                                                                                                                                                      | Intervalo da SEFAZ, validade do cache, concorrência, URLs e `'TES.Despesa'` em lugares diferentes.                 |
| SEFAZ-SP fixa no código                                             | `sefaz.js`, `nota.js`                                                                                                                                                       | Adicionar outro estado exige mexer no fluxo principal.                                                             |
| Sem lint/format e sem CI                                            | —                                                                                                                                                                           | Estilo e erros simples dependem de revisão manual.                                                                 |

## Arquitetura alvo

Camadas com dependência em um sentido só (`ui → app → domínio`, `app → infra`), em ES modules empacotados por um bundler.

```
src/
  domain/                 regras puras, sem DOM, rede ou chrome.*
    chave-acesso.js       parse da chave de 44 dígitos + dígito verificador
    qrcode-nfce.js        interpretação da URL do QR (online e contingência)
    regras.js             comparar(lançamento, nota, config) -> checks
    resultado.js          tipos de status e montagem do resultado
    erros.js              SessaoExpirada, AnexoIndisponivel, QrInvalido, SefazBloqueada...
    csv.js                geração do CSV
  infra/                  acesso ao mundo externo
    siga/cliente.js       fetch das telas e serviços do SIGA
    siga/parsers.js       TES00804, GED99902/99901, grade
    sefaz/cliente.js      consulta via service worker
    sefaz/parser.js       Consulta Resumida NFC-e (e futuros estados)
    pdf/imagens.js        extração de JPEG do PDF
    qr/leitor.js          BarcodeDetector + recortes + jsQR
    storage/config.js     configuração do usuário
    storage/cache-sefaz.js
    mensagens.js          protocolo content ↔ background (tipos + validação)
  app/                    casos de uso
    validar-lancamento.js pipeline: detalhe → anexos → QR → SEFAZ → regras
    validar-mes.js        lote com concorrência, revalidação parcial
  ui/
    estado.js             estado do painel e transições
    painel.js             renderização (sem regra de negócio)
    grade-siga.js         destaque das linhas na grade
    estilos.css
  background/
    index.js              roteador de mensagens
    fila-sefaz.js         intervalo mínimo entre consultas
    bloqueio-sefaz.js     pausa após bloqueio do firewall
  entries/
    content.js            ponto de entrada do content script
    bridge.js             ponte no contexto da página
  config.js               constantes (URLs, intervalos, validade do cache, concorrência)
dist/                     saída do build (é esta pasta que se carrega no Chrome)
```

## Fases

Cada fase é um conjunto de commits pequenos; nenhuma muda o que o usuário vê.

### Fase 1 – Fundação (sem tocar em `src/`) ✅ concluída

- `git init`, primeiro commit com o estado atual e a suíte de testes.
- ESLint + Prettier, com `npm run lint`.
- GitHub Actions (ou equivalente) rodando `npm run check`, `npm run lint` e `npm test` a cada push.
- Build gerando `dist/` (`scripts/build.js`, por enquanto só copia `manifest.json`, `src/`, `vendor/` e `icons/`; o esbuild entra na Fase 2, quando houver módulos para empacotar). O Chrome passa a carregar `dist/`, e `node_modules`/`tests` saem da pasta da extensão.

### Fase 2 – ES modules (mecânica) ✅ concluída

- Trocar os objetos globais por `export`/`import`, arquivo por arquivo, mantendo a mesma API pública.
- Content script, ponte e service worker viram bundles IIFE gerados pelo esbuild (content scripts não aceitam `import` direto; o service worker foi empacotado do mesmo jeito para manter um só formato).
- `jsQR` sai de `vendor/` e passa a vir do npm (`jsqr`), embutido no bundle; a licença vai em `dist/licenses/`.
- Testes passam a importar os módulos; `tests/helpers/carregar.js` é removido. Novo teste de ponta a ponta roda os bundles numa página simulada do SIGA.

### Fase 3 – Domínio puro ✅ concluída

- Extrair para `domain/`: regras de comparação, interpretação da chave/QR (com dígito verificador), status e montagem do resultado, CSV.
- Criar erros tipados e o mapa erro → status. Com isso o "QR Code inválido" vira **Manual** com mensagem própria (item do `KNOWN_ISSUES.md`).
- Documentar os contratos com JSDoc (`@typedef Lancamento`, `Nota`, `Resultado`) e `// @ts-check`.

Como ficou: `src/domain/` com `formatos`, `chave-acesso` (com dígito verificador), `qrcode-nfce`, `regras`, `resultado`, `erros`, `csv` e `tipos`. O domínio é checado com TypeScript 6 (`npm run typecheck`, JSDoc + `checkJs`, modo `strict`), sem compilar. `util.js`, `siga.js`, `sefaz.js`, `validacao.js` e `ui.js` passaram a usar o domínio; `validacao.js` só orquestra o fluxo. A mudança de comportamento (QR Code recusado → Manual) ficou num commit separado.

### Fase 4 – Infra e casos de uso ✅ concluída

- Separar clientes HTTP dos parsers de HTML no SIGA e na SEFAZ; parsers testados só com fixtures.
- Pipeline `validarLancamento` recebendo as dependências por parâmetro (injeção simples, sem framework).
- Service worker: roteador de mensagens + `FilaSefaz` + `BloqueioSefaz` como módulos testáveis; protocolo de mensagens tipado.
- `SefazProvider` por estado (SP primeiro), para abrir caminho a outros estados.

Como ficou: `src/infra/` (clientes e parsers do SIGA e da SEFAZ, PDF, QR, storage, protocolo de mensagens), `src/app/` (`criarValidador` e `validarLote`, com dependências por parâmetro), `src/background/` (roteador, fila, bloqueio, firewall, busca), `src/content/iniciar.js` + `src/entries/` (pontos de entrada) e `src/config.js` com as constantes. `siga.js`, `nota.js`, `sefaz.js`, `validacao.js`, `util.js`, `content.js` e `background.js` foram removidos. O "consultável" saiu do domínio: quem decide é o cliente da SEFAZ, pelo provedor do host do QR Code. A checagem de tipos passou a cobrir domínio, infra, casos de uso e service worker.

### Fase 5 – Interface ✅ concluída

- Separar estado (`ui/estado.js`, funções puras de transição) da renderização (`ui/painel.js`).
- CSS em arquivo próprio, embutido no bundle.
- Destaque da grade do SIGA isolado em `ui/grade-siga.js`.

Como ficou: `src/ui/` com `estado.js` (funções puras, checadas pelo TypeScript), `painel.js` (`criarPainel()`, no lugar do singleton), `estilos.js` (tokens `--sv-*`), `icones.js` e `grade-siga.js`. Num commit separado, o painel ficou mais conciso (6 colunas em vez de 12, configuração recolhida, ações como ícones, 720 px de largura). Avaliação de design system: nenhum salvo na conta; bibliotecas de Web Components não funcionam em content scripts (sem `customElements` no mundo isolado), então ficaram tokens próprios alinhados ao SIGA.

### Fase 5b – Código em inglês ✅ concluída

- Identificadores, arquivos, classes CSS, comentários e nomes de testes em inglês, sem mudança de comportamento (renomeação feita por tokens do JavaScript, não por busca de texto, para não tocar em strings da interface).
- Mantidos: textos da interface e documentação em português, siglas do domínio (CNPJ, NFC-e, SEFAZ, SIGA) e campos de APIs externas (`origem`/`codigoOrigem` do GED, `aoData`/`_aData` do DataTables, `data-codigo` do SIGA).
- Compatibilidade: a configuração (`cnpjConsumidor`, `formaPagamento`) e o cache da SEFAZ gravados até a 0.1.4 continuam sendo lidos.
- Os nomes de arquivos citados nas fases anteriores são os da época; a estrutura atual está no README.

### Fase 6 – Opcional: TypeScript

- Com o bundler já existente, migrar para `.ts` aproveitando os JSDoc da Fase 3.

## Riscos e cuidados

- **Comportamento observado só no navegador real** (leitura do QR em imagem, cookies do firewall, CORS do Blob): ao fim de cada fase, validar um mês real no SIGA.
- **Fixtures reconstruídas**: antes da Fase 4, substituir por capturas reais anonimizadas das páginas do SIGA e da SEFAZ.
- **Versão**: `manifest.json` e `package.json` precisam continuar iguais (há teste para isso); com o build, o manifest de `dist/` deve sair da mesma fonte.

## Decisões em aberto

1. ~~JavaScript com JSDoc + `@ts-check` (Fase 3) ou TypeScript (Fase 6)?~~ Na Fase 3: JSDoc checado pelo TypeScript. Migrar para `.ts` continua opcional na Fase 6; dá para estender o `tsconfig.json` às outras camadas antes disso.
2. Onde ficará o repositório remoto (GitHub, GitLab...) e se haverá CI.
3. Ordem das fases 4–5 versus itens do `ROADMAP.md` (a NFC-e em contingência com QR recusado já foi tratada na Fase 3).
