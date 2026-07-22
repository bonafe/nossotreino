# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O que é este projeto

Nosso Treino (nossotreino.com.br) — plataforma gratuita e de código aberto (AGPL-3.0) para treinos (musculação, aeróbico, outros), com princípio central de funcionar offline. Site estático (PWA) em português, sem build step e sem backend. Vanilla JS (ES modules), CSS puro, HTML por página. Roda 100% no navegador — o plano de treino de cada aluno nunca fica no código, só no `localStorage` de quem usa. A biblioteca de exercícios (nomes, vídeos, grupos musculares — não é dado pessoal) é o caso oposto: vem versionada no repositório e é buscada por `fetch`.

`index.html` é a página institucional (apresentação, princípios, doações, aviso legal) — não usa `TreinosStorage` além de registrar o service worker. `planos.html`, um nível abaixo, é a tela de seleção/gestão de planos (entrar, criar, duplicar, importar, excluir — ver seção acima). O sistema de treino em si (seletor de treinos, engrenagem de configurações), sempre operando sobre o plano ativo no momento, vive em `sistema.html`, mais um nível abaixo.

## Comandos

```
python3 serve.py        # sobe em http://localhost:8000
python3 serve.py 8934   # porta customizada
```

Sem servidor de dev, o site já funciona abrindo os `.html` direto (`file://`), exceto o service worker (exige HTTPS/`localhost`, ver `docs/pwa-offline-especificacao.md`). Não há linter, bundler, testes automatizados ou `package.json` — é stdlib Python + arquivos estáticos.

## Arquitetura

### Fluxo de dados: dois documentos, dois mecanismos

Existem dois documentos JSON, carregados de formas opostas (ver
`docs/especificacao-biblioteca-exercicios.md` seção 2 para o esquema
completo):

- **Biblioteca de exercícios** (`biblioteca-exercicios/biblioteca-exercicios.json`,
  versionada, não é dado pessoal — a pasta `biblioteca-exercicios/` também
  guarda as imagens geradas, uma subpasta por categoria (`imagens/musculacao/`,
  `imagens/alongamento/`): buscada por `fetch` a cada
  página via `carregarBiblioteca()` (`js/biblioteca-exercicios.js`),
  cacheada pelo service worker pra funcionar offline. Nunca passa por
  `localStorage`.
- **Plano de treino** (dado pessoal do aluno: nome do professor, do
  aluno, datas do ciclo, os treinos prescritos): fora do repo, nunca
  publicado. Um mesmo navegador pode guardar vários planos ao mesmo
  tempo (um professor pode ter um por aluno) — `planos.html` é a
  primeira tela depois de `index.html`, lista os planos salvos e é onde
  se cria um do zero (`plano_novo.html`), duplica um existente como
  template, importa um recebido/backup (ícone 📂 no cabeçalho) ou
  exclui. "Entrar" num plano grava só um ponteiro
  (`TreinosStorage.ativarPlano(id)`); todo o resto do código (inclusive
  `TreinosStorage.definirDadosTreinos()`/`carregarDadosTreinos()`) só
  enxerga "o plano ativo", sem saber que existem outros — ver seção 3 de
  `docs/armazenamento-local-especificacao.md`. Toda página de treino lê
  com `TreinosStorage.carregarDadosTreinos()` (rejeita se nenhum plano
  estiver ativo ainda).

Páginas que mostram nome/vídeo/grupo muscular de um exercício carregam os
dois em paralelo e cruzam por `exercicioId`.

Histórico de execução (séries, sessões concluídas, progresso em
andamento) é gravado direto no `localStorage` pelas próprias páginas, com
chaves versionadas (`.v1`, `.v2`...) — ver `js/storage.js`
(`TreinosStorage.chaves`) e `docs/armazenamento-local-especificacao.md`
para a lista completa e a convenção de nomes.

Toda leitura/escrita de `localStorage` passa por `js/storage.js` — nunca chamar `localStorage` direto de uma página. Escritas são protegidas por `try/catch` silencioso (quota cheia, modo privado etc. não devem quebrar a tela).

`js/storage.js` também registra o service worker (`sw.js`) — é importado por toda página, então esse é o único lugar que faz isso.

### Motor genérico + JSON de dados

Bicicleta, alongamento e musculação seguem o padrão "motor genérico recebe parâmetros de um JSON": nenhum treino específico tem HTML/JS próprio. Novo treino de bike = nova entrada em `treinosCardio` no plano (referenciando uma modalidade já cadastrada na biblioteca); novo treino de alongamento = nova entrada em `treinosAlongamento` (referenciando alongamentos de `bibliotecas.alongamentos`); novo treino de musculação = nova entrada em `treinos`. As três telas de criação (`treino_bicicleta_novo.html`, `treino_alongamento_novo.html`, `treino_novo.html`) escrevem nessas coleções pela interface, sem precisar editar o JSON à mão. Um treino de musculação pode referenciar treinos de cardio/alongamento existentes como complemento via `treino.cardio[]`/`treino.alongamento[]` (arrays de `{ treinoCardioId|treinoAlongamentoId, momento }`) — ver seção 12.3 de `docs/especificacao-biblioteca-exercicios.md`. Ver `docs/treino-bicicleta-especificacao.md`, `docs/treino-alongamento-especificacao.md` e `docs/treino-exercicios-especificacao.md` para o esquema completo (`metadata`, `orientacoesGerais`, `treinos`, lista plana de exercícios com `superset`/`circuito`).

### Fluxos de tela

```
index.html (institucional)
   └─> planos.html (selecionar/criar/duplicar/importar/excluir plano) → plano_novo.html
          └─> sistema.html (plano ativo)
                 ├─> treino_bicicleta_menu.html → treino_bicicleta_novo.html
                 │                              └─> treino_bicicleta.html?treino=<treinoCardioId>[&origem=<id>]
                 ├─> treino_alongamento_menu.html → treino_alongamento_novo.html
                 │                                └─> treino_alongamento.html?treino=<treinoAlongamentoId>[&origem=<id>]
                 └─> treino_exercicios_menu.html → treino_novo.html
                                                 └─> treino_exercicios.html?treino=<id> → treino_execucao.html?treino=<id>
                                                                                              └─> treino_exercicio_progresso.html?exercicio=<id>&treino=<id>
```

Os três fluxos (bike / alongamento / musculação) são independentes — cada um tem seu próprio menu, motor e tela de criação. Cardio e alongamento são "treinos" de primeira classe (coleções `treinosCardio`/`treinosAlongamento` no plano, irmãs de `treinos`, cada uma com `id`/`nome` próprios) que também podem ser **referenciados** como complemento de um treino de musculação via `treino.cardio[]`/`treino.alongamento[]` (arrays de `{ treinoCardioId|treinoAlongamentoId, momento }`) — o card complementar linka para `treino_bicicleta.html?treino=<treinoCardioId>&origem=<id>` / `treino_alongamento.html?treino=<treinoAlongamentoId>&origem=<id>`, onde `origem` é o treino de musculação de onde veio (usado só pro botão de voltar, ver seção 5.2.1 de `docs/treino-bicicleta-especificacao.md` e seção 5.3 de `docs/treino-alongamento-especificacao.md`).

`treino_execucao.html` é a tela mais complexa do projeto: monta uma fila sequencial de "slots" a partir da lista plana `treino.exercicios` (superset/circuito não são respeitados ainda, tudo roda sequencial — simplificação deliberada, ver seção 8.1 da especificação de exercícios), trata exercício substituto (`alternativas[]`), cronômetro de série/descanso, sinal sonoro e persiste o progresso — endereçado por `exercicioId`, não por índice posicional — a cada passo para poder retomar depois de fechar o navegador.

### Vídeos via torrent (WebTorrent), não hospedagem paga

Vídeos de exercício (`bibliotecas.exercicios[id].midia.videoMagnet`, magnet URIs) são distribuídos por torrent, não por link externo — princípio de plataforma comunitária/sem custo de hospedagem (ver `index.html`). `js/videos-torrent.js` encapsula o cliente WebTorrent (`webtorrent.min.js` vendorizado, mesmo padrão do `d3.v7.min.js`), com cache em `Cache API` (`treinos-videos.v1`, chaveado pelo infohash — nunca localStorage/IndexedDB, vídeo é Blob binário). `js/video-player-modal.js` é o player embutido compartilhado (`#videoOverlay`/`#videoPlayer`), usado por `treino_exercicios.html` e `treino_execucao.html`. O download de **todos** os vídeos da biblioteca é disparado assim que ela é buscada por `fetch` (`sistema.js`, reforçado em `planos.js` depois de importar um plano/backup) — não depende do plano de treino estar carregado, nem é por treino visitado. Ver `docs/torrent-videos-especificacao.md` para a estratégia completa (trackers, seed fixo, sem fallback externo).

### Organização de arquivos

- `js/paginas/*.js` — um controller por página HTML (`treino-execucao.js` ↔ `treino_execucao.html`), carregado via `<script type="module">`.
- `js/*.js` (fora de `paginas/`) — utilitários compartilhados entre páginas: `storage.js` (localStorage), `biblioteca-exercicios.js` (fetch da biblioteca), `prescricao-formatadores.js`, `formatadores.js`, `cronometro.js`, `sinal-sonoro.js`, `grafico-barras.js`/`grafico-linha.js` (D3), `videos-torrent.js`/`video-player-modal.js` (vídeos por torrent), `imagem-exercicio.js` (imagens de exercício geradas por IA).
- `css/paginas/*.css` — estilos específicos de cada página; `css/base.css` e `css/componentes.css` são compartilhados.
- `biblioteca-exercicios/` (json + `imagens/musculacao/` + `imagens/alongamento/`) / `d3.v7.min.js` / `webtorrent.min.js` — vendorizados/versionados na raiz (não CDN, não gitignorado), pra continuar funcionando offline.
- `docs/*-especificacao.md` — as specs vivas de cada área (armazenamento local, PWA/offline, bike, alongamento, exercícios, biblioteca de exercícios, apoio ao projeto). Ao mudar comportamento coberto por uma spec, atualize o documento junto.

### Convenções

- Nomes de variáveis, funções, classes e comentários em português (mesmo padrão do resto do código).
- Chaves de `localStorage` sempre com sufixo de versão (`.v1`) — mudança de formato = nova versão, sem migração da antiga.
- Sem frameworks, sem bundler: manter o padrão de ES modules nativos + CSS simples.
