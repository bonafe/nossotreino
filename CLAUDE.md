# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O que é este projeto

Nosso Treino (nossotreino.com.br) — plataforma gratuita e de código aberto (AGPL-3.0) para treinos (musculação, aeróbico, outros), com princípio central de funcionar offline. Site estático (PWA) em português, sem build step e sem backend. Vanilla JS (ES modules), CSS puro, HTML por página. Roda 100% no navegador — os dados do plano de treino nunca ficam no código, só no `localStorage` de quem usa.

`index.html` é a página institucional (apresentação, princípios, doações, aviso legal) — não usa `TreinosStorage` além de registrar o service worker. O sistema de treino em si (seletor de treinos, engrenagem de configurações) vive em `sistema.html`, um nível abaixo.

## Comandos

```
python3 serve.py        # sobe em http://localhost:8000
python3 serve.py 8934   # porta customizada
```

Sem servidor de dev, o site já funciona abrindo os `.html` direto (`file://`), exceto o service worker (exige HTTPS/`localhost`, ver `docs/pwa-offline-especificacao.md`). Não há linter, bundler, testes automatizados ou `package.json` — é stdlib Python + arquivos estáticos.

## Arquitetura

### Fluxo de dados: localStorage, nunca fetch

`dados/dados_treinos.json` (fora do repo, no `.gitignore` — dados pessoais do aluno) é a única fonte do plano de treino. Nenhuma página faz `fetch` desse arquivo (falharia em qualquer versão publicada). Em vez disso:

- O aluno cola/escolhe o JSON uma vez em `importar_dados.html`, que grava em `localStorage` via `TreinosStorage.definirDadosTreinos()`.
- Toda página de treino lê com `TreinosStorage.carregarDadosTreinos()` (rejeita se nada foi carregado ainda).
- Histórico de execução (séries, sessões concluídas, progresso em andamento) é gravado direto no `localStorage` pelas próprias páginas, com chaves versionadas (`.v1`, `.v2`...) — ver `js/storage.js` (`TreinosStorage.chaves`) e `docs/armazenamento-local-especificacao.md` para a lista completa e a convenção de nomes.

Toda leitura/escrita de `localStorage` passa por `js/storage.js` — nunca chamar `localStorage` direto de uma página. Escritas são protegidas por `try/catch` silencioso (quota cheia, modo privado etc. não devem quebrar a tela).

`js/storage.js` também registra o service worker (`sw.js`) — é importado por toda página, então esse é o único lugar que faz isso.

### Motor genérico + JSON de dados

Tanto bicicleta quanto musculação seguem o padrão "motor genérico recebe parâmetros de um JSON": nenhum treino específico tem HTML/JS próprio. Novo treino de bike = nova entrada em `cardios` no JSON; novo treino de musculação = nova entrada em `treinos`. Ver `docs/treino-bicicleta-especificacao.md` e `docs/treino-exercicios-especificacao.md` para o esquema completo do JSON (`metadata`, `guia`, `exercicios`, `cardios`, `treinos`, blocos/itens/slots).

### Fluxos de tela

```
index.html (institucional)
   └─> sistema.html
          ├─> treino_bicicleta_menu.html → treino_bicicleta.html?cardio=<id>
          └─> treino_exercicios_menu.html → treino_exercicios.html?treino=<id> → treino_execucao.html?treino=<id>
                                                                                     └─> treino_exercicio_progresso.html?exercicio=<id>&treino=<id>
```

Os dois fluxos (bike / musculação) são independentes, mas um treino de musculação pode ter um `cardioId` complementar que linka para `treino_bicicleta.html?cardio=<id>&treino=<id>` — o parâmetro `treino=` extra existe só para o botão de voltar saber para onde ir (ver seção 5.2.1 de `docs/treino-bicicleta-especificacao.md`).

`treino_execucao.html` é a tela mais complexa do projeto: monta uma fila sequencial de "slots" a partir de `treino.blocos` (superset/circuito não são respeitados ainda, tudo roda sequencial — simplificação deliberada, ver seção 8.1 da especificação de exercícios), trata exercício substituto, cronômetro de série/descanso, sinal sonoro e persiste o progresso a cada passo para poder retomar depois de fechar o navegador.

### Organização de arquivos

- `js/paginas/*.js` — um controller por página HTML (`treino-execucao.js` ↔ `treino_execucao.html`), carregado via `<script type="module">`.
- `js/*.js` (fora de `paginas/`) — utilitários compartilhados entre páginas: `storage.js` (localStorage), `formatadores.js`, `cronometro.js`, `sinal-sonoro.js`, `grafico-barras.js`/`grafico-linha.js` (D3).
- `css/paginas/*.css` — estilos específicos de cada página; `css/base.css` e `css/componentes.css` são compartilhados.
- `d3.v7.min.js` — D3 vendorizado na raiz (não CDN), para os gráficos funcionarem offline.
- `docs/*-especificacao.md` — as specs vivas de cada área (armazenamento local, PWA/offline, bike, exercícios). Ao mudar comportamento coberto por uma spec, atualize o documento junto.

### Convenções

- Nomes de variáveis, funções, classes e comentários em português (mesmo padrão do resto do código).
- Chaves de `localStorage` sempre com sufixo de versão (`.v1`) — mudança de formato = nova versão, sem migração da antiga.
- Sem frameworks, sem bundler: manter o padrão de ES modules nativos + CSS simples.
