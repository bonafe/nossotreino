# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O que é este projeto

Nosso Treino (nossotreino.com.br) — plataforma gratuita e de código aberto (AGPL-3.0) para treinos (musculação, aeróbico, outros), com princípio central de funcionar offline. Site estático (PWA) em português, sem build step e sem backend. Vanilla JS (ES modules), CSS puro, HTML por página. Roda 100% no navegador — o plano de treino de cada aluno nunca fica no código, só no IndexedDB de quem usa. A biblioteca de exercícios (nomes, vídeos, grupos musculares — não é dado pessoal) é o caso oposto: vem versionada no repositório e é buscada por `fetch`.

`index.html` é a página institucional (apresentação, princípios, doações, aviso legal) — não usa `TreinosStorage` além de registrar o service worker. `alunos.html`, um nível abaixo, é a tela de seleção/gestão de alunos (entrar, criar, editar, excluir, importar, backup). Dentro de um aluno, `planos.html?aluno=<id>` lista os planos/ciclos daquele aluno (entrar, criar, duplicar, excluir). O sistema de treino em si (seletor de treinos, engrenagem de configurações), sempre operando sobre o plano ativo no momento, vive em `sistema.html`, mais um nível abaixo.

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
  IndexedDB.
- **Aluno** (id, nome): entidade de primeira classe (loja `alunos`) — pra
  poder selecionar entre alunos e acompanhar o progresso de um mesmo
  aluno ao longo de vários planos/ciclos. Uso solo: um aluno só, o
  próprio. Uso por professor: um aluno por estudante. Gerido em
  `alunos.html`/`aluno_novo.html`.
- **Plano de treino** (dado pessoal: nome do professor, datas do ciclo,
  os treinos prescritos): fora do repo, nunca publicado. Um aluno pode
  ter vários planos ao longo do tempo (um por ciclo) —
  `planos.html?aluno=<id>` lista os planos daquele aluno e é onde se
  cria um do zero (`plano_novo.html?aluno=<id>`) ou duplica um existente
  (novo ciclo pro mesmo aluno). "Entrar" num plano grava só um ponteiro
  (`TreinosStorage.ativarPlano(id)`); todo o resto do código (inclusive
  `TreinosStorage.definirDadosTreinos()`/`carregarDadosTreinos()`) só
  enxerga "o plano ativo", sem saber que existem outros — ver seção 3 de
  `docs/armazenamento-local-especificacao.md`. Toda página de treino lê
  com `TreinosStorage.carregarDadosTreinos()` (rejeita se nenhum plano
  estiver ativo ainda). Telas de estatística (gráficos de sessões,
  progresso por exercício) somam o histórico de **todos os planos do
  aluno ativo**, não só do ciclo atual (`TreinosStorage.lerHistoricoAgregadoDoAluno`,
  seção 3.5 do mesmo documento). Única exceção a "nunca no código":
  `treinos-exemplo/*.json` (iniciante/intermediário/avançado/casa com
  halteres e banco/peso corporal, genéricos, sem dado pessoal de
  ninguém) — `js/treinos-exemplo.js` semeia um aluno "Meu perfil" com
  esses 5 planos na primeira visita a `alunos.html`, se o navegador
  estiver genuinamente vazio (seção 3.1.1
  de `docs/armazenamento-local-especificacao.md`).

Páginas que mostram nome/vídeo/grupo muscular de um exercício carregam os
dois em paralelo e cruzam por `exercicioId`.

Histórico de execução (séries, sessões concluídas, progresso em
andamento) é gravado no IndexedDB pelas próprias páginas via
`TreinosStorage`, endereçado por chaves relativas versionadas (`.v1`,
`.v2`...) — ver `js/storage.js` (`TreinosStorage.chaves`) e
`docs/armazenamento-local-especificacao.md` para a lista completa e a
convenção de nomes.

Toda leitura/escrita de dados de aluno/plano/histórico passa por `js/storage.js` — nunca chamar `indexedDB`/`localStorage` direto de uma página. Por baixo, `js/storage.js` guarda tudo em **IndexedDB** (banco `nossotreino`, motor de baixo nível em `js/armazenamento-indexeddb.js`): ao carregar, hidrata um instantâneo em memória (`await` no topo do módulo — nenhuma página começa a rodar antes disso terminar), leituras são síncronas sobre esse instantâneo, escritas mutam na hora e são enfileiradas pra gravação real em segundo plano (`TreinosStorage.aguardarEscritas()` nos poucos pontos que navegam logo depois de gravar). Falha de gravação nunca quebra a tela — mesma filosofia do antigo `try/catch` silencioso, agora assíncrona. Ver seção 2 de `docs/armazenamento-local-especificacao.md`.

**Toda mudança de formato de dado persistido exige migração — nunca abandone dado antigo em silêncio.** Isso vale nos três eixos de versão do projeto: esquema do banco (`VERSAO_BANCO`/`onupgradeneeded` em `armazenamento-indexeddb.js`), `schemaVersion` do plano (`MIGRACOES_PLANO` em `storage.js`) e `versao` do envelope de backup (`MIGRACOES_BACKUP` em `storage.js`). Cada mudança futura acrescenta uma função nova na tabela correspondente — nunca editar uma migração já publicada. O exemplo canônico do padrão a seguir (preguiçosa, idempotente, silenciosa, segura na falha) é `migrarAlunosApartirDePlanos`/`migrarBackupDe1Para2` em `storage.js`. Ver seção 2 de `docs/armazenamento-local-especificacao.md`.

`js/storage.js` também registra o service worker (`sw.js`) — é importado por toda página, então esse é o único lugar que faz isso. `js/versao.js` (também importado por `storage.js`, então roda em toda página) define `VERSAO_APP` — um número visível no rodapé, bumpado à mão, independente do `CACHE_NOME` do service worker — serve pra confirmar visualmente que um deploy chegou (ex.: no celular).

### Motor genérico + JSON de dados

Bicicleta, alongamento e musculação seguem o padrão "motor genérico recebe parâmetros de um JSON": nenhum treino específico tem HTML/JS próprio. Novo treino de bike = nova entrada em `treinosCardio` no plano (referenciando uma modalidade já cadastrada na biblioteca); novo treino de alongamento = nova entrada em `treinosAlongamento` (referenciando alongamentos de `bibliotecas.alongamentos`); novo treino de musculação = nova entrada em `treinos`. As três telas de criação (`treino_bicicleta_novo.html`, `treino_alongamento_novo.html`, `treino_musculacao_novo.html`) escrevem nessas coleções pela interface, sem precisar editar o JSON à mão. Um treino de musculação pode referenciar treinos de cardio/alongamento existentes como complemento via `treino.cardio[]`/`treino.alongamento[]` (arrays de `{ treinoCardioId|treinoAlongamentoId, momento }`) — ver seção 12.3 de `docs/especificacao-biblioteca-exercicios.md`. Ver `docs/treino-bicicleta-especificacao.md`, `docs/treino-alongamento-especificacao.md` e `docs/treino-exercicios-especificacao.md` para o esquema completo (`metadata`, `orientacoesGerais`, `treinos`, lista plana de exercícios com `superset`/`circuito`).

Atividade livre (`atividade_livre_menu.html`) é um quarto pilar, mas não segue esse padrão de motor genérico: não tem execução cronometrada nem prescrição, e não exige nenhum treino pré-cadastrado — é lançamento manual direto no histórico (data, hora, duração) classificado numa árvore local de tipos de atividade (`TreinosStorage.listarTiposAtividade()`/`criarTipoAtividade()`, loja `tiposAtividade` do IndexedDB, device-local — não é `DOMINIOS` de `js/dominios-biblioteca.js`, que é a biblioteca de exercícios). Serve pra qualquer atividade com data e duração que não tenha (ou não precise de) uma prescrição estruturada — pilates, natação, dança, artes marciais, ou mesmo alongamento avulso. Ver `docs/atividade-livre-especificacao.md`.

### Fluxos de tela

```
index.html (institucional)
   └─> alunos.html (selecionar/criar/editar/excluir aluno; importar; backup) → aluno_novo.html
          └─> planos.html?aluno=<id> (planos/ciclos do aluno) → plano_novo.html?aluno=<id>
                 └─> sistema.html (plano ativo)
                        ├─> treino_bicicleta_menu.html → treino_bicicleta_novo.html
                        │                              └─> treino_bicicleta.html?treino=<treinoCardioId>[&origem=<id>]
                        ├─> treino_alongamento_menu.html → treino_alongamento_novo.html
                        │                                └─> treino_alongamento_exercicios.html?treino=<treinoAlongamentoId>[&origem=<id>]
                        │                                       └─> treino_alongamento.html?treino=<treinoAlongamentoId>[&alongamento=<id>][&origem=<id>]
                        │                                              └─> treino_alongamento_progresso.html?alongamento=<id>&treino=<treinoAlongamentoId>
                        │                                └─> biblioteca.html?dominio=alongamento (📚, ver/criar/editar alongamentos)
                        ├─> treino_musculacao_menu.html → treino_musculacao_novo.html
                        │                              │  └─> treino_musculacao_exercicios.html?treino=<id> → treino_execucao.html?treino=<id>
                        │                              │                                              └─> treino_exercicio_progresso.html?exercicio=<id>&treino=<id>
                        │                              └─> biblioteca.html?dominio=musculacao (📚, ver/criar/editar exercícios)
                        └─> atividade_livre_menu.html → atividade_livre_novo.html
                                                       └─> atividade_livre_tipo_novo.html (aba nova, criar tipo/subtipo)
```

`treino_musculacao_novo.html`, `treino_alongamento_novo.html` e `biblioteca.html` linkam pra `exercicio_novo.html?dominio=<id>[&id=<id>][&voltar=<url>]` (criar/editar exercício ou alongamento personalizado, ver seção 26 de `docs/especificacao-biblioteca-exercicios.md`) sempre **numa aba nova**, pra não perder um treino em construção só guardado em memória na aba de origem.

Os três fluxos (bike / alongamento / musculação) são independentes — cada um tem seu próprio menu, motor e tela de criação. Cardio e alongamento são "treinos" de primeira classe (coleções `treinosCardio`/`treinosAlongamento` no plano, irmãs de `treinos`, cada uma com `id`/`nome` próprios) que também podem ser **referenciados** como complemento de um treino de musculação via `treino.cardio[]`/`treino.alongamento[]` (arrays de `{ treinoCardioId|treinoAlongamentoId, momento }`) — o card complementar linka para `treino_bicicleta.html?treino=<treinoCardioId>&origem=<id>` / `treino_alongamento_exercicios.html?treino=<treinoAlongamentoId>&origem=<id>`, onde `origem` é o treino de musculação de onde veio (usado só pro botão de voltar, ver seção 5.2.1 de `docs/treino-bicicleta-especificacao.md` e seção 5.3/6.1 de `docs/treino-alongamento-especificacao.md`).

`treino_execucao.html` é a tela mais complexa do projeto: monta uma fila sequencial de "slots" a partir da lista plana `treino.exercicios` (superset/circuito não são respeitados ainda, tudo roda sequencial — simplificação deliberada, ver seção 8.1 da especificação de exercícios), trata exercício substituto (`alternativas[]`), cronômetro de série/descanso, sinal sonoro e persiste o progresso — endereçado por `exercicioId`, não por índice posicional — a cada passo para poder retomar depois de fechar o navegador.

### Vídeos via torrent (WebTorrent), não hospedagem paga

Vídeos de exercício (`bibliotecas.exercicios[id].midia.videoMagnet`, magnet URIs) são distribuídos por torrent, não por link externo — princípio de plataforma comunitária/sem custo de hospedagem (ver `index.html`). `js/videos-torrent.js` encapsula o cliente WebTorrent (`webtorrent.min.js` vendorizado, mesmo padrão do `d3.v7.min.js`), com cache em `Cache API` (`treinos-videos.v1`, chaveado pelo infohash — nunca localStorage/IndexedDB, vídeo é Blob binário). `js/video-player-modal.js` é o player embutido compartilhado (`#videoOverlay`/`#videoPlayer`), usado por `treino_musculacao_exercicios.html` e `treino_execucao.html`. O download de **todos** os vídeos da biblioteca é disparado assim que ela é buscada por `fetch` (`sistema.js`, reforçado em `alunos.js` depois de importar um plano/backup) — não depende do plano de treino estar carregado, nem é por treino visitado. Ver `docs/torrent-videos-especificacao.md` para a estratégia completa (trackers, seed fixo, sem fallback externo).

### Feedback da comunidade sobre a biblioteca (crítica via WhatsApp)

Princípio central do projeto (ver `index.html`, seção "Nossos princípios"): a biblioteca é gerada com apoio de IA e às vezes alucina — o retorno de quem usa é o mecanismo de correção. Todo item mostrado (exercício de musculação, alongamento — extensível a outros domínios no futuro) tem um botão de crítica que abre o WhatsApp com uma mensagem pré-preenchida contendo uma tag de referência greppável (`[ref:<dominio>:<id>:<categoria>]`). `js/critica-comunidade.js` concentra a lógica (mensagem, modal de categoria Erro/Sugestão/Outro, número de WhatsApp). O mecanismo é genérico por `dominio`/`id`/`nome` (mesmo vocabulário de `caminhoImagemExercicio`/`ligarImagemExercicio` em `js/imagem-exercicio.js`), pronto pra cardio/dança no futuro sem reescrever. Esqueleto de backend (webhook estilo WhatsApp Business Cloud API da Meta) em `src/python/whatsapp/`. Ver `docs/critica-comunidade-especificacao.md` para o desenho completo.

### Analytics de uso (Google Analytics, opt-in)

O site não coleta estatística de uso por padrão — `js/consentimento-analytics.js` mostra, na primeira visita a qualquer página, um banner não bloqueante perguntando se a pessoa autoriza o Google Analytics; só depois de "Aceitar" o script `gtag.js` é carregado. Recusar (ou não responder) não tira nenhuma funcionalidade do site. A escolha fica em `localStorage` (`nossoTreinoConsentimentoAnalytics`) — único uso de `localStorage` puro no projeto, deliberadamente fora de `TreinosStorage`/IndexedDB, porque é preferência de navegador, não dado de domínio (ver seção 7 de `docs/armazenamento-local-especificacao.md`). Como toda página importa `js/storage.js`, e este importa `consentimento-analytics.js` antes do seu próprio `await` de hidratação (mesmo truque de `versao.js`), o banner cobre o site inteiro sem precisar editar cada HTML. Dado de aluno/plano/histórico nunca passa pelo Analytics — só pageview padrão do GA4. Ver `docs/analytics-especificacao.md` para o desenho completo.

### Organização de arquivos

- `js/paginas/*.js` — um controller por página HTML (`treino-execucao.js` ↔ `treino_execucao.html`), carregado via `<script type="module">`.
- `js/*.js` (fora de `paginas/`) — utilitários compartilhados entre páginas: `storage.js` (API de domínio sobre aluno/plano/histórico) + `armazenamento-indexeddb.js` (motor IndexedDB de baixo nível, sem regra de negócio), `versao.js` (versão visível no rodapé), `consentimento-analytics.js` (banner de consentimento + Google Analytics opt-in), `biblioteca-exercicios.js` (fetch da biblioteca), `prescricao-formatadores.js`, `formatadores.js`, `cronometro.js`, `sinal-sonoro.js`, `grafico-barras.js`/`grafico-linha.js` (D3), `videos-torrent.js`/`video-player-modal.js` (vídeos por torrent, Cache API — não passa por `storage.js`), `imagem-exercicio.js` (imagens de exercício geradas por IA).
- `css/paginas/*.css` — estilos específicos de cada página; `css/base.css` e `css/componentes.css` são compartilhados.
- `biblioteca-exercicios/` (json + `imagens/musculacao/` + `imagens/alongamento/`) / `d3.v7.min.js` / `webtorrent.min.js` — vendorizados/versionados na raiz (não CDN, não gitignorado), pra continuar funcionando offline.
- `docs/*-especificacao.md` — as specs vivas de cada área (armazenamento local, PWA/offline, bike, alongamento, exercícios, biblioteca de exercícios, apoio ao projeto). Ao mudar comportamento coberto por uma spec, atualize o documento junto.

### Convenções

- Nomes de variáveis, funções, classes e comentários em português (mesmo padrão do resto do código).
- Toda mudança de formato de dado persistido (banco, plano, backup) exige uma função de migração — ver seção "Fluxo de dados" acima e seção 2 de `docs/armazenamento-local-especificacao.md`. Nunca abandonar dado antigo em silêncio.
- Sem frameworks, sem bundler: manter o padrão de ES modules nativos + CSS simples.
