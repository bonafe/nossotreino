# Especificação — Armazenamento local (IndexedDB)

## 1. Objetivo

O site não tem backend: cada página HTML roda isolada no navegador de
quem usa. Esta especificação define como passamos a usar **IndexedDB**
(banco `nossotreino`, ver seção 2) do navegador para três propósitos:

1. **Alunos** — cada aluno tem um id próprio (loja `alunos`), pra poder
   selecionar entre eles e acompanhar o progresso de um mesmo aluno ao
   longo de vários planos/ciclos (seção 3.5). Uso solo: a pessoa cria um
   aluno (o próprio) e pronto. Uso por professor: um aluno por
   estudante, quantos precisar.
2. **Planos de treino** — dado pessoal (nome do professor, datas do
   ciclo, os treinos prescritos), nunca publicado junto com o site. Um
   aluno pode ter **vários** planos ao longo do tempo (um por ciclo) —
   a pessoa escolhe entre eles em [planos.html](../planos.html), que
   também é onde se cria um plano do zero ou se duplica um existente
   (novo ciclo pro mesmo aluno). **A biblioteca de exercícios
   (`biblioteca-exercicios.json`) não entra aqui** — não é dado pessoal,
   é um arquivo estático versionado no repositório e carregado por
   `fetch` a cada página, sem passar por IndexedDB (ver
   [especificacao-biblioteca-exercicios.md](./especificacao-biblioteca-exercicios.md)
   seção 2.1). Única exceção deliberada à regra de "plano nunca no
   código": `treinos-exemplo/*.json` (seção 3.1.1) — 5 planos
   **genéricos, não individualizados** (`metadata.carater:
   "exemplo-generico-nao-individualizado"`, sem nome de aluno/professor
   real) usados só pra popular a conta de quem nunca usou o site.
3. **Histórico de execução** — guardar, no próprio navegador de quem
   usa, o que foi realmente feito em cada treino (treinos de bike
   concluídos, séries de musculação com carga/repetições). Cada plano
   tem o seu próprio histórico, mas as telas de estatística somam o
   histórico de **todos os planos do aluno** (seção 3.5) — não só do
   ciclo ativo no momento.

**Por que IndexedDB e não `localStorage`:** (a) tem versionamento nativo
de esquema (`onupgradeneeded`, seção 2), que é o que torna sustentável a
política de "toda mudança de formato exige migração" (seção 2.1); (b)
guarda `Blob` nativamente, necessário pro dia em que o projeto passar a
guardar imagens/vídeos próprios (loja dedicada futura, ver seção 2.4).
**Isso não inclui os vídeos por torrent** (`js/videos-torrent.js`,
`treinos-videos.v1`) — esses continuam na **Cache API**, decisão separada
e já justificada em
[torrent-videos-especificacao.md](./torrent-videos-especificacao.md#6-armazenamento-local-cache-api-não-localstorage-nem-indexeddb):
vídeo é Blob binário vindo de uma origem sem `Response` HTTP real, e a
Cache API já é a API usada pelo `sw.js` pro app shell.

Isso cobre a parte de **dados** funcionando offline. A outra metade — as
**páginas em si** (HTML/CSS/JS) abrindo sem internet, inclusive num link
publicado — é responsabilidade do service worker, ver
[pwa-offline-especificacao.md](./pwa-offline-especificacao.md).

É usado por [alunos.html](../alunos.html), [aluno_novo.html](../aluno_novo.html),
[planos.html](../planos.html), [plano_novo.html](../plano_novo.html),
[sistema.html](../sistema.html),
[treino_bicicleta.html](../treino_bicicleta.html),
[treino_bicicleta_menu.html](../treino_bicicleta_menu.html),
[treino_bicicleta_novo.html](../treino_bicicleta_novo.html),
[treino_musculacao_menu.html](../treino_musculacao_menu.html),
[treino_musculacao_exercicios.html](../treino_musculacao_exercicios.html),
[treino_execucao.html](../treino_execucao.html),
[treino_exercicio_progresso.html](../treino_exercicio_progresso.html),
[treino_alongamento_menu.html](../treino_alongamento_menu.html),
[treino_alongamento.html](../treino_alongamento.html),
[treino_alongamento_novo.html](../treino_alongamento_novo.html),
[atividade_livre_menu.html](../atividade_livre_menu.html),
[atividade_livre_novo.html](../atividade_livre_novo.html) e
[atividade_livre_tipo_novo.html](../atividade_livre_tipo_novo.html) (ver
[treino-exercicios-especificacao.md](./treino-exercicios-especificacao.md),
[treino-bicicleta-especificacao.md](./treino-bicicleta-especificacao.md),
[treino-alongamento-especificacao.md](./treino-alongamento-especificacao.md) e
[atividade-livre-especificacao.md](./atividade-livre-especificacao.md)),
através de um script único e compartilhado:
[`storage.js`](../storage.js).

## 2. Esquema do banco e política de versionamento

Banco `nossotreino` (`js/armazenamento-indexeddb.js`), 9 object stores:

| Loja | `keyPath` | Índices | Registro |
|---|---|---|---|
| `alunos` | `id` | — | `{id, nome, criadoEm, atualizadoEm}` |
| `planos` | `id` | `porAluno`→`alunoId` | `{id, alunoId, professor, nome, criadoEm, atualizadoEm}` — `alunoId` referencia uma entrada de `alunos` |
| `planoDados` | `planoId` | — | `{planoId, dados}` — documento opaco, a composição inteira do plano (treinos, cardio, alongamento, `atividadesRecorrentes`, metadata — `metadata.aluno`/`metadata.professor` são cópias de exibição, ver seção 3.2); `dados.schemaVersion` é o eixo de versão do plano, seção 2.2 |
| `historico` | `id` (autoIncrement) | `porPlano`→`planoId`, `porPlanoETipo`→`[planoId, tipo]` | `{id, planoId, tipo, ...entrada}` — um registro por série/sessão concluída; `tipo` é um de `sessaoBicicleta`/`serieMusculacao`/`sessaoMusculacao`/`serieAlongamento`/`sessaoAlongamento`/`sessaoLivre` |
| `execucoes` | `[planoId, tipo, treinoId]` | `porPlano`→`planoId`, `porPlanoETipo`→`[planoId, tipo]` | `{planoId, tipo, treinoId, progresso}` — estado de um treino em andamento (`tipo` é `musculacao`/`alongamento`), pra retomar após fechar a página — endereçado por `exercicioId` dentro de `progresso`, não por índice posicional |
| `preferencias` | `chave` | — | `{chave, valor}` — inclui `planoAtivoId` (id do plano cujos dados escopados estão sendo lidos/escritos agora, ou `null`), e as preferências globais (`apoio.*`, `avisoIaAceito.v1`) que não dependem de plano nenhum |
| `meta` | `chave` | — | bookkeeping interno do próprio motor de armazenamento, nunca dado de usuário |
| `bibliotecaPersonalizada` | `[dominio, id]` | — | `{dominio, id, origem, baseadoEmVersao, entrada, criadoEm, atualizadoEm}` — exercícios/alongamentos novos ou editados localmente, escopo global (não por aluno/plano). Ver seção 26 de [especificacao-biblioteca-exercicios.md](./especificacao-biblioteca-exercicios.md) |
| `tiposAtividade` | `id` | `porPai`→`tipoAtividadePaiId` (vestigial — nenhum registro pós-migração tem esse campo, ver item 10 abaixo) | `{id, nome, categoriaIds, criadoEm}` — coleção local (multi-categoria, cada item pode ter 0+ vínculos) de tipos de atividade pra "atividade livre", escopo global (não por aluno/plano), semeada com duas raízes (`musculacao`, `alongamento`). Ver [atividade-livre-especificacao.md](./atividade-livre-especificacao.md) |

Não existe um "aluno ativo" global: qual aluno está sendo visto é só a
query string (`planos.html?aluno=<id>`) — nenhuma leitura/escrita de
dados de plano depende disso, só a navegação (seção 3.1/3.2).

Como o id do plano é parte da chave física em `historico`/`execucoes`,
dois planos diferentes podem ter um treino com o mesmo id (ex: ambos com
um treino `treino-a`) sem nenhum risco de um vazar/misturar com o outro.

Todo o código de página (`treino_execucao.html`, `treino_musculacao_novo.html` etc.)
continua lendo/escrevendo por uma **chave relativa** (`dados.v1`,
`historico.serieMusculacao.v1`, `execucao.musculacao.<treinoId>.v2` etc.)
via `TreinosStorage.lerJSON`/`salvarJSON`/`chaves.*` — essas strings são a
API pública que sobreviveu à troca de `localStorage` pra IndexedDB;
`storage.js` que resolve por baixo dos panos pra qual loja/registro cada
uma aponta, escopado ao plano ativo (`planoAtivoId`), sem que nenhuma
página precise saber que existe mais de um plano no navegador nem que o
backing store trocou (ver seção 3.4).

### 2.1 Regra de ouro: todo dado migrado, nunca abandonado

**Nenhuma mudança de formato de dado persistido entra no projeto sem a
função de migração correspondente.** Existem três eixos de versão
independentes, cada um com sua própria tabela de despacho:

| Eixo | Onde vive | Tipo | Tabela de despacho | Quando roda |
|---|---|---|---|---|
| Esquema do banco | `VERSAO_BANCO` em `armazenamento-indexeddb.js` | inteiro | `MIGRACOES_BANCO` | `onupgradeneeded`, ao abrir o banco numa versão nova |
| Plano | `dados.schemaVersion` (dentro de `planoDados`) | string (`"1.4"`) | `MIGRACOES_PLANO` em `storage.js` | ao importar um plano avulso (`importarPlano`) e ao restaurar um backup (`restaurarBackup`) |
| Backup | `versao` (envelope do arquivo baixado) | inteiro | `MIGRACOES_BACKUP` em `storage.js` | ao restaurar um backup (`restaurarBackup`) |

Cada tabela mapeia "versão de origem → função que migra pra próxima
versão"; a migração de um documento roda em cadeia até chegar na versão
atual (`migrarPlanoParaVersaoAtual`/`migrarBackupParaVersaoAtual` em
`storage.js`, `onupgradeneeded` percorrendo `oldVersion+1` até
`newVersion` pro banco). Se a versão de origem não tiver função
cadastrada (desconhecida, ou mais nova que a atual — ex.: um arquivo
baixado de uma versão futura do site), o documento é devolvido como veio,
sem modificação — nunca se arrisca a "consertar" um formato que não se
conhece.

**Nunca editar uma migração já publicada** — só acrescentar a próxima
entrada quando o formato mudar de novo.

### 2.2 Anatomia de uma migração

O exemplo canônico é `migrarAlunosApartirDePlanos`/`migrarBackupDe1Para2`
(`storage.js`): quando a entidade Aluno passou a existir, planos antigos
tinham só `plano.aluno` como texto livre, sem `alunoId`. Essa função
agrupa por nome distinto, cria um Aluno por grupo e substitui o texto
livre pela referência — usada tanto na migração do envelope de backup
(seção 2.1) quanto, no passado, na migração do próprio `localStorage`
(seção 2.4).

Toda migração nova deve ter essas quatro propriedades:

- **Preguiçosa** — roda no momento em que o dado é lido/importado/restaurado,
  não num passo de "atualização" bloqueante que trava a tela.
- **Idempotente** — rodar de novo (ex.: reimportar o mesmo arquivo) não
  duplica nem corrompe nada.
- **Silenciosa** — não pede nada a quem usa, não mostra tela de progresso.
- **Segura na falha** — se a versão de origem não for reconhecida, devolve
  o dado como veio em vez de arriscar corrompê-lo (ver seção 2.1).

### 2.3 Receita: como adicionar uma loja nova

Exemplo de aplicação futura: uma loja `midias` pro recurso de
imagens/vídeos próprios (ver seção 1).

1. Em `armazenamento-indexeddb.js`: `VERSAO_BANCO` sobe de `N` pra `N+1`.
2. Acrescenta `MIGRACOES_BANCO[N+1] = criarLojaDeMidias` — nunca editar a
   entrada `N` já publicada.
3. Testar manualmente: abrir o site com o banco ainda na versão `N` (um
   perfil de navegador que não viu o deploy novo) e confirmar que
   `onupgradeneeded` roda a migração `N+1` sem apagar nada das lojas já
   existentes.
4. Se for preciso mudar algo num dado já existente (não só criar uma loja
   vazia), a migração recebe `(banco, transacao, evento)` e pode ler/escrever
   nas lojas já existentes dentro da mesma `transacao` de upgrade.

### 2.4 Migrações já aplicadas (registro histórico)

Log cumulativo — cada mudança de formato nova acrescenta uma linha aqui,
nunca reescreve uma entrada antiga:

1. `planos` sem `alunoId` → entidade Aluno (`migrarAlunosApartirDePlanos`).
2. Plano `schemaVersion` `1.2` → `1.3` (cardio/alongamento embutidos em
   `treino.cardio[]`/`treino.alongamento[]` viraram coleções de primeira
   classe `treinosCardio`/`treinosAlongamento`, referenciadas por id) —
   ver seção 11.4/12.3 de
   [especificacao-biblioteca-exercicios.md](./especificacao-biblioteca-exercicios.md).
   **Sem instância real conhecida sobrevivendo hoje** — `MIGRACOES_PLANO`
   não tem uma entrada `"1.2"` cadastrada; se aparecer um arquivo nesse
   formato, escrever a função a partir desse exemplar real.
3. Backup `versao` `1` → `2` (sem `alunos` — mesma derivação da migração 1).
4. `localStorage` (`treinos.*`) → IndexedDB (`nossotreino` v1) — migração
   de uma vez, já concluída e removida do código (rodou automaticamente
   na primeira visita de cada navegador depois do deploy; não há mais
   nenhuma leitura de `localStorage` em lugar nenhum do projeto).
5. `VERSAO_BANCO` `1` → `2` — loja `bibliotecaPersonalizada` nova (só
   `createObjectStore`, sem tocar nas lojas existentes) — ver seção 26 de
   [especificacao-biblioteca-exercicios.md](./especificacao-biblioteca-exercicios.md).
6. Backup `versao` `2` → `3` — campo `bibliotecaPersonalizada` novo no
   envelope (`migrarBackupDe2Para3`); backup antigo simplesmente não tinha
   nenhum personalizado pra trazer, então migra pra `[]`.
7. `VERSAO_BANCO` `2` → `3` — loja `tiposAtividade` nova, já semeada com
   as duas raízes (`musculacao`, `alongamento`) dentro da própria
   migração de upgrade — ver
   [atividade-livre-especificacao.md](./atividade-livre-especificacao.md).
8. Backup `versao` `3` → `4` — campo `tiposAtividade` novo no envelope
   (`migrarBackupDe3Para4`); backup antigo não tinha a árvore ainda, então
   migra semeando as mesmas duas raízes do `onupgradeneeded` (nunca `[]`,
   pra não deixar a árvore vazia depois de restaurar um backup antigo).
9. Plano `schemaVersion` `1.3` → `1.4` (`migrarPlanoDe13Para14`) — campo
   `atividadesRecorrentes` novo (regras recorrentes da Agenda); plano
   antigo não tinha nenhuma regra pra trazer, migra pra `[]` — ver
   [agenda-especificacao.md](./agenda-especificacao.md).
10. Migração preguiçosa de `tiposAtividade` (`tipoAtividadePaiId` → `categoriaIds`,
    `migrarTipoAtividadeParaCategoriaIds` em `js/storage.js`) — não é bump
    de `VERSAO_BANCO` (é conversão de valor de um campo, não de esquema
    estrutural da loja); roda na hidratação e em `recarregarTiposAtividade()`,
    regravando em segundo plano só os registros que ainda estavam no
    formato antigo. Ver seção 2 de
    [atividade-livre-especificacao.md](./atividade-livre-especificacao.md).
11. Backup `versao` `4` → `5` (`migrarBackupDe4Para5`) — mesma conversão
    `tipoAtividadePaiId` → `categoriaIds`, aplicada ao array `tiposAtividade`
    do envelope de backup.

## 3. Hierarquia aluno → plano → sistema

Nenhuma página faz `fetch()` de aluno/plano de treino. Como são dados
pessoais e nunca publicados junto com o site (seção 1), um `fetch`
relativo só funcionaria em desenvolvimento local, com o arquivo presente
em disco, e falharia sempre em qualquer versão publicada do site. Em vez
disso, o site trata o IndexedDB como a **única** fonte — a biblioteca
de exercícios é o caso oposto: **sempre** vem por `fetch`, nunca por
importação manual (ver seção 1).

```
index.html
   └─> alunos.html (selecionar/criar/editar/excluir; importar; backup) → aluno_novo.html
          └─> planos.html?aluno=<id> (planos/ciclos daquele aluno) → plano_novo.html?aluno=<id>
                 └─> sistema.html (plano ativo)
                        └─> treino_*_menu.html (gráficos somam todos os planos do aluno)
```

### 3.1 `alunos.html` + `aluno_novo.html`

Primeira tela depois de `index.html`. Segue **o mesmo padrão visual das
outras telas de menu** (`treino_bicicleta_menu.html`,
`treino_musculacao_menu.html`, `treino_alongamento_menu.html`): cabeçalho
`header.top` com seta de voltar à esquerda e um botão "+" à direita
(`.icon-btn`) que leva pra uma tela dedicada de criação — aqui,
`aluno_novo.html` — em vez de um formulário embutido na própria lista.
Qualquer tela nova de "listar + criar" deve seguir esse mesmo par
(`<algo>_menu.html`/`<algo>.html` + botão "+" → `<algo>_novo.html`) pra
manter a consistência visual do site.

Antes de qualquer outra coisa, se `avisoIaAceito.v1` ainda não estiver
`true`, mostra um overlay bloqueante avisando que exercícios (nomes,
descrições, grupos musculares) e imagens da biblioteca foram criados com
apoio de inteligência artificial e podem conter erros, reforçando
também o aviso já presente em `index.html` (seção "Aviso importante"):
o sistema não substitui acompanhamento de um profissional de educação
física habilitado, e o uso é de responsabilidade de quem usa — mesmo
padrão visual de `.confirm-card`/`.confirm-botoes` usado no resto do
site. "Entendi, concordo" grava `avisoIaAceito.v1 = true` e libera a
tela; "Não concordo" volta pra `index.html` sem gravar nada (aparece de
novo na próxima visita).

Lista os alunos do índice (`alunos.v1`), cada um com as ações:

- **Entrar** — navega pra `planos.html?aluno=<id>`.
- **Editar** — renomear inline (`TreinosStorage.atualizarAluno(id, nome)`).
- **Excluir** (`TreinosStorage.excluirAluno(id)`) — **cascata**: apaga
  também todos os planos daquele aluno (composição, histórico, progresso
  em andamento — reusa `excluirPlano` pra cada um). Confirmação deixa
  isso explícito (mesmo overlay `.confirm-card`/`.confirm-botoes`
  compartilhado com o menu de reset de `sistema.html`, em
  `css/componentes.css`).

`aluno_novo.html` (um campo: nome) chama `TreinosStorage.criarAluno(nome)`
(gera um id único, `gerarIdUnico` em [identificadores.js](../js/identificadores.js))
e redireciona pra `planos.html?aluno=<id>` — ainda sem nenhum plano
criado.

Dois ícones no mesmo cabeçalho, ao lado do "+", cobrem os casos que não
envolvem escolher entre alunos já existentes: um 📂 (`<label class="icon-btn" for="arquivoInput">`,
mesmo truque de `<input type="file" hidden>` associado por `for`/`id` já
usado nas telas de criação) que aceita tanto um **plano avulso recebido**
de alguém quanto um **backup completo** (`tipo: "backup-treinos"`,
`TreinosStorage.restaurarBackup(backup)` — substitui `alunos.v1` e
`planos.v1` inteiros e todos os planos que o backup contém, sem overlay
de confirmação: a navegação pra `sistema.html` acontece sozinha em
seguida); e um botão de texto discreto, "Baixar backup completo"
(`TreinosStorage.montarBackup()`), com todos os alunos e planos do
navegador, pra levar pra outro aparelho.

Um plano avulso, diferente do backup, **não** vira aluno/plano
automaticamente: abre um overlay de confirmação (`#importarOverlay`,
mesmo padrão `.confirm-card`) perguntando pra qual aluno é aquele plano —
um `<select>` com os alunos já cadastrados + "+ Novo aluno" (que revela um
campo de nome), pré-selecionado no aluno cujo nome bate com
`dados.metadata.aluno` (se achar) ou em "+ Novo aluno" caso contrário,
com o nome sugerido já preenchido. Isso existe porque o mesmo arquivo
pode ser reaproveitado como **template pra um aluno diferente** do que
está gravado no JSON — ex.: baixar o plano de um aluno (seção 3.2, botão
"Baixar plano") e importar escolhendo outro aluno (existente ou novo) em
vez do que o arquivo sugere. Confirmar chama `TreinosStorage.criarAluno(nome)`
se for aluno novo, atualiza `dados.metadata.aluno` pro nome do aluno
escolhido (pra não ficar com o nome de origem depois de reatribuído) e
só então `TreinosStorage.importarPlano(dados, alunoId)` +
`ativarPlano(id)`, indo pra `sistema.html`.

#### 3.1.1 Onboarding automático (`js/treinos-exemplo.js`)

Em `iniciar()`, antes de renderizar a lista, `alunos.html` chama
`semearContaDeExemplo()` (`js/treinos-exemplo.js`). Só faz algo quando o
navegador está **genuinamente vazio** — `listarAlunos().length === 0 &&
listarPlanos().length === 0` (não confundir com a migração de planos
antigos sem `alunoId`, seção 5.1, que já rodou dentro dessas duas
chamadas e por si só não conta como "vazio"):

1. Cria um aluno `"Meu perfil"` (`criarAluno`).
2. Busca (`fetch`) os 5 arquivos de `treinos-exemplo/` (iniciante,
   intermediário, avançado, casa com halteres/banco, peso corporal —
   planos genéricos, ver seção 1), sobrescreve `dados.metadata.aluno` pro
   nome desse aluno (mesmo ajuste feito em qualquer importação, seção
   3.1) e importa cada um (`TreinosStorage.importarPlano(dados, alunoId)`).
3. Rotula cada plano importado com `TreinosStorage.atualizarMetadataPlano(id, {..., nome: "Iniciante"|"Intermediário"|"Avançado"|"Casa (halteres e banco)"|"Peso corporal (sem equipamento)"})`
   — necessário porque os 5 arquivos têm `planejamento.inicio`/`fim`
   nulos, então sem esse rótulo os cards em `planos.html` cairiam no
   mesmo título ("Plano criado em ...").

Se `fetch` falhar (sem conexão na primeira visita, antes do service
worker cachear `treinos-exemplo/*.json`), o nível problemático é só
pulado — não impede os outros nem quebra a tela. Depois de semeado,
`alunos.html` mostra uma mensagem explicando o que aconteceu e que dá
pra renomear/excluir.

### 3.2 `planos.html` + `plano_novo.html`

Sempre acessada com `?aluno=<alunoId>` na URL — sem isso (ou com um id
que não existe), mostra erro com link de volta pra `alunos.html` (mesmo
padrão de `treino_musculacao_novo.html` quando falta contexto). Cabeçalho mostra o
nome do aluno no título ("Planos de João"); voltar → `alunos.html`; "+"
→ `plano_novo.html?aluno=<alunoId>`.

Lista só `TreinosStorage.listarPlanosDoAluno(alunoId)`, cada um com as
ações:

- **Entrar** — `TreinosStorage.ativarPlano(id)` (só grava
  `planoAtivoId.v1`) e navega pra `sistema.html`.
- **Editar** — formulário inline (nome do plano — opcional, rótulo do
  card — professor, início/fim do ciclo) →
  `TreinosStorage.atualizarMetadataPlano(id, {...})`. Não tem campo de
  aluno — quem o plano pertence já é fixo pelo `alunoId`; reatribuir um
  plano a outro aluno fica fora de escopo (seção 7).
- **Duplicar** — abre um overlay (`#duplicarOverlay`, mesmo padrão
  `.confirm-card` do resto do site) perguntando pra qual aluno vai a
  cópia: "Este aluno (novo ciclo)" (padrão — clona só a composição,
  `dados.v1`, sem histórico, dentro do mesmo aluno, pra começar um ciclo
  novo), um outro aluno já cadastrado, ou "+ Novo aluno" (cria na hora,
  `criarAluno(nome)`). Confirmar chama
  `TreinosStorage.duplicarPlano(id, alunoIdDestino)` — mesmo caminho de
  código pros dois casos, só muda o `alunoIdDestino`, e atualiza
  `dados.metadata.aluno` pro nome do destino. Se o destino for o próprio
  aluno da página, só re-renderiza a lista; se for outro, navega pra
  `planos.html?aluno=<alunoIdDestino>` pra já mostrar o resultado —
  tudo em memória, sem precisar baixar/importar arquivo (esse caminho
  continua existindo, seção 3.1, pra mandar de fato pra outro
  aparelho/pessoa fora do navegador).
- **Baixar plano** — `TreinosStorage.montarExportacaoAvulsaDoPlano(id)`,
  baixa a composição (sem histórico) embrulhada em
  `{plano, bibliotecaPersonalizada}` — o segundo campo traz só os
  exercícios/alongamentos personalizados que aquele plano de fato
  referencia (ver seção 26 de
  [especificacao-biblioteca-exercicios.md](./especificacao-biblioteca-exercicios.md)),
  pra quem recebe o arquivo não perder prescrições que apontam pra um
  item que só existe no aparelho de quem criou o plano — pro professor
  mandar pro aluno. `TreinosStorage.importarPlano` aceita tanto esse
  formato embrulhado quanto um arquivo antigo/cru (só o plano, sem o
  embrulho).
- **Baixar tudo (com estatísticas)** —
  `TreinosStorage.montarExportacaoCompletaDoPlano(id)`, baixa composição
  + histórico + progresso em andamento — pro aluno devolver pro
  professor com os dados preenchidos.
- **Excluir** — `TreinosStorage.excluirPlano(id)`: remove a entrada do
  índice e todas as chaves físicas daquele plano (`plano.<id>.*`).
  Se o plano excluído era o ativo, `planoAtivoId.v1` volta pra `null`.

`plano_novo.html?aluno=<alunoId>` (3 campos: nome do plano — opcional —,
professor, início/fim do ciclo — sem campo de aluno, fixo pela URL)
chama `TreinosStorage.criarPlano({alunoId, professor, inicio, fim, nome})`:
gera um id único, adiciona ao índice, ativa e grava um esqueleto vazio
(`treinos`, `treinosCardio`, `treinosAlongamento`, `atividadesRecorrentes`
vazios, `distribuicaoSemanal` com todos os dias sem treino,
`orientacoesGerais: null` —
código já trata essa ausência graciosamente, ver seção 6 de
[treino-exercicios-especificacao.md](./treino-exercicios-especificacao.md))
e redireciona pra `sistema.html`. De lá, o professor usa os mesmos botões
"+" que um aluno usa (`treino_musculacao_novo.html`, `treino_bicicleta_novo.html`,
`treino_alongamento_novo.html`) pra montar os treinos — essas telas já
funcionam com qualquer plano ativo, não distinguem se foi importado,
criado do zero ou duplicado.

### 3.3 `TreinosStorage.carregarDadosTreinos()` / `definirDadosTreinos(dados)`

```js
async function carregarDadosTreinos() {
  const cache = lerJSON("dados.v1", null); // já escopado ao plano ativo
  if (cache) return cache;
  throw new Error("Nenhum dado de treino carregado ainda.");
}

function definirDadosTreinos(dados) {
  salvarJSON("dados.v1", dados); // idem
  // e atualiza `atualizadoEm` do plano ativo no índice `planos.v1`
}
```

Usadas por toda página que precisa da composição do plano (`treino-musculacao-novo.js`,
`treino-execucao.js`, `treino-bicicleta*.js`, `treino-alongamento*.js`
etc.), exatamente como antes de existir mais de um plano por navegador —
nenhuma dessas páginas muda de comportamento. Se não houver plano ativo
com dados salvos, rejeita — cada página trata isso mostrando um link
para `alunos.html` (ver seção 6.2 de
[treino-exercicios-especificacao.md](./treino-exercicios-especificacao.md)
e seção 5 de
[treino-bicicleta-especificacao.md](./treino-bicicleta-especificacao.md)).
A biblioteca de exercícios usa um carregamento à parte,
`carregarBiblioteca()` (`js/biblioteca-exercicios.js`, `fetch`, sem
IndexedDB) — páginas que mostram nome/vídeo/grupo muscular de
exercício carregam os dois em paralelo.

### 3.4 Como o escopo por plano funciona por baixo

`TreinosStorage.lerJSON(chave, padrao)`, `salvarJSON(chave, valor)`,
`removerChave(chave)`, `adicionarAoHistorico(chave, entrada)` e
`listarChavesComPrefixo(prefixo)` — usadas por praticamente toda página
de treino — resolvem a chave relativa automaticamente pra
loja/registro certo dentro do IndexedDB (seção 2), escopado ao
`planoAtivoId` guardado na loja `preferencias`. Trocar de plano
(`ativarPlano(id)`) é só regravar esse ponteiro — não há cópia de dados
envolvida, e por isso não há risco de progresso de um plano vazar pro
outro.

Preferências que não são por plano (cadência do banner de apoio, aviso
de IA aceito) usam `lerJSONGlobal(chave, padrao)` /
`salvarJSONGlobal(chave, valor)` em vez disso, gravando direto na loja
`preferencias` sem passar pelo plano ativo — usadas hoje só por
`js/apoio.js` e o aviso de IA em `alunos.html`.

Primitivas adicionais, usadas por `planos.html`/`alunos.html` pra operar
sobre um plano/aluno que não precisa estar ativo (duplicar, editar
metadata, baixar, agregar estatísticas):
`TreinosStorage.lerJSONDoPlano(id, chave, padrao)` e
`salvarJSONDoPlano(id, chave, valor)`.

### 3.5 Estatísticas agregadas por aluno

As telas de gráfico/estatística (sessões de bike/musculação/alongamento
em `treino_bicicleta_menu.html`/`treino_musculacao_menu.html`/
`treino_alongamento_menu.html`, e progresso por exercício em
`treino_exercicio_progresso.html`) **não** leem só o histórico do plano
ativo — elas resolvem o aluno do plano ativo
(`TreinosStorage.obterAlunoDoPlano(planoAtivoId)`) e somam o histórico de
**todos os planos daquele aluno** com
`TreinosStorage.lerHistoricoAgregadoDoAluno(alunoId, chave)` (atalho:
`lerHistoricoAgregadoDoPlanoAtivo(chave)`, que já resolve o aluno
sozinho). Isso é o que dá o "acompanhamento em vários treinos": o
progresso de um exercício, por exemplo, continua a mesma linha do tempo
mesmo depois de o professor criar um plano novo pro próximo ciclo.

Progresso/execução **em andamento** ("continuar treino", `execucao.*`)
continua escopado só ao plano ativo — não faz sentido agregar "onde eu
parei" entre ciclos diferentes.

## 4. Formato dos registros de histórico

Todo registro de histórico (bike ou musculação) tem pelo menos:

```json
{
  "treinoId": "treino-a",
  "treinoNome": "Treino A",
  "dataHora": "2026-07-15T18:32:10.482Z"
}
```

Os campos específicos de cada tipo de registro estão descritos em
[treino-bicicleta-especificacao.md](./treino-bicicleta-especificacao.md#6-histórico-local-localstorage)
(bike) e em
[treino-exercicios-especificacao.md](./treino-exercicios-especificacao.md#8-execução-guiada-de-treino)
(musculação).

## 5. `storage.js` — API

```js
// Preenchida uma vez por carregamento de página, hidratando o instantâneo
// em memória a partir do IndexedDB — ver seção 2 e "top-level await" logo
// abaixo. Nenhuma das funções abaixo precisa aguardar isso: como
// storage.js é importado por toda página, o próprio import já esperou.
TreinosStorage.pronto                        // Promise<void>

// Espera a fila de gravações em segundo plano esvaziar. Só é preciso nos
// poucos pontos que navegam pra outra página logo depois de gravar
// (criar aluno/plano/treino, importar backup) — sem isso a navegação
// poderia acontecer antes da escrita assíncrona terminar.
TreinosStorage.aguardarEscritas()            // Promise<void>

// Escopadas ao plano ativo (ver seção 3.4)
TreinosStorage.carregarDadosTreinos()        // Promise<dados> — rejeita se o plano ativo não tiver dados
TreinosStorage.definirDadosTreinos(dados)    // grava dados + atualiza `atualizadoEm` do plano ativo
TreinosStorage.lerJSON(chave, padrao)
TreinosStorage.salvarJSON(chave, valor)
TreinosStorage.removerChave(chave)
TreinosStorage.listarChavesComPrefixo(prefixo)
TreinosStorage.adicionarAoHistorico(chave, entrada)

// Globais (não dependem do plano ativo)
TreinosStorage.lerJSONGlobal(chave, padrao)
TreinosStorage.salvarJSONGlobal(chave, valor)

// Gestão de alunos (alunos.html, seção 3.1)
TreinosStorage.listarAlunos()
TreinosStorage.criarAluno(nome)
TreinosStorage.atualizarAluno(id, nome)
TreinosStorage.excluirAluno(id)                       // cascata: apaga também os planos do aluno
TreinosStorage.listarPlanosDoAluno(alunoId)
TreinosStorage.obterAlunoDoPlano(planoId)             // {alunoId, nome} — usado por sistema.js e telas de gráfico
TreinosStorage.lerHistoricoAgregadoDoAluno(alunoId, chave)
TreinosStorage.lerHistoricoAgregadoDoPlanoAtivo(chave) // atalho: resolve o aluno do plano ativo sozinho

// Gestão de planos (planos.html, seção 3.2)
TreinosStorage.listarPlanos()
TreinosStorage.obterPlanoAtivoId()
TreinosStorage.ativarPlano(id)
TreinosStorage.criarPlano({alunoId, professor, inicio, fim, nome})  // nome é opcional, rótulo do card
TreinosStorage.duplicarPlano(id, alunoIdDestino)  // mesmo aluno (novo ciclo) ou outro — decidido na confirmação de duplicar
TreinosStorage.atualizarMetadataPlano(id, {professor, inicio, fim, nome})
TreinosStorage.excluirPlano(id)
TreinosStorage.importarPlano(dados, alunoId)  // alunos.html, seção 3.1 — aceita plano cru ou {plano, bibliotecaPersonalizada}
TreinosStorage.lerDadosDoPlano(id)
TreinosStorage.montarExportacaoAvulsaDoPlano(id)      // {plano, bibliotecaPersonalizada} — botão "Baixar plano"
TreinosStorage.montarExportacaoCompletaDoPlano(id)
TreinosStorage.lerJSONDoPlano(id, chave, padrao)
TreinosStorage.salvarJSONDoPlano(id, chave, valor)

// Biblioteca personalizada (exercícios/alongamentos novos ou editados
// localmente, qualquer domínio — ver seção 26 de especificacao-biblioteca-exercicios.md)
TreinosStorage.listarBibliotecaPersonalizada()
TreinosStorage.salvarExercicioPersonalizado({dominio, id, origem, baseadoEmVersao, entrada})
TreinosStorage.removerExercicioPersonalizado(dominio, id)

// Tipos de atividade (coleção local multi-categoria pra "atividade livre"
// — ver atividade-livre-especificacao.md)
TreinosStorage.listarTiposAtividade()
TreinosStorage.listarPorCategoria(categoriaId)        // filhos de uma categoria (null = raízes)
TreinosStorage.obterTipoAtividade(id)
TreinosStorage.caminhosTipoAtividade(id)              // todos os caminhos raiz → item, mais curto primeiro
TreinosStorage.criarTipoAtividade(nome, categoriaIds) // categoriaIds: string[]
TreinosStorage.alterarCategoriasTipoAtividade(id, categoriaIds)

// Backup completo, todos os alunos e planos (alunos.html, seção 3.1)
TreinosStorage.montarBackup()
TreinosStorage.restaurarBackup(backup)
```

`chave` nessas funções é sempre o nome relativo (`dados.v1`,
`historico.serieMusculacao.v1`, `execucao.musculacao.<id>.v2` etc.) — a
mesma API que existia quando isso vivia em `localStorage`; a função
resolve internamente pra qual loja/registro do IndexedDB isso aponta
(seção 2).

**Leitura é síncrona, escrita é assíncrona em segundo plano.**
`storage.js` hidrata um instantâneo em memória do banco uma vez por
carregamento de página (`await` no topo do módulo — nenhuma página
começa a rodar antes disso terminar, seção 3.4); a partir daí, todas as
funções acima leem/escrevem nesse instantâneo na hora (síncrono) e
enfileiram a gravação real no IndexedDB pra rodar em segundo plano. Se o
IndexedDB estiver indisponível (Safari em `file://`, storage desabilitado
etc.), o instantâneo segue vazio e tudo funciona só em memória pela
duração da página — a gravação nunca é perdida com um erro visível, só
não sobrevive a fechar a aba. Mesma filosofia do antigo `try/catch`
silencioso do `localStorage`, agora assíncrona.

## 6. Limitações

- IndexedDB é por origem (protocolo + host + porta) **e por
  navegador/aparelho** — não sincroniza entre o celular e o computador,
  por exemplo, nem entre navegadores diferentes no mesmo aparelho. Vários
  alunos e planos podem conviver no mesmo navegador (seção 3), mas não
  sincronizam sozinhos pra outro navegador/aparelho — é preciso baixar
  um backup completo em `alunos.html` e restaurá-lo no destino. A
  biblioteca de exercícios **não** tem essa limitação — vem por `fetch`
  a cada página, então é a mesma em qualquer navegador/aparelho sem
  precisar de nenhuma ação manual.
- Limpar dados de navegação / dados do site apaga tudo — todos os alunos
  e planos guardados nesse navegador, com histórico e progresso. A
  biblioteca de exercícios não é afetada (não vive em IndexedDB).
- Quota é por origem e tipicamente uma fração do disco livre (bem maior
  que os poucos MB do antigo `localStorage`), de sobra pro volume de
  texto gerado pelo histórico e pelos dados de treino — inclusive com
  margem pro recurso futuro de imagens/vídeos próprios (seção 1).
- Abrir o site com o esquema do banco desatualizado enquanto outra aba já
  está com ele aberto numa versão mais nova pode bloquear o upgrade
  (`onupgradeneeded` não dispara até a aba antiga fechar/ceder); a aba
  antiga cede sozinha assim que a nova tenta subir a versão
  (`banco.onversionchange` fecha a conexão dela), então na prática isso
  se resolve sem intervenção, só com um instante de atraso.
- Safari não expõe IndexedDB em páginas abertas via `file://` — rodar com
  `python3 serve.py` (ver `CLAUDE.md`) evita esse caso.
- Quando o professor atualiza a composição de um plano à distância
  (fora do site), é preciso reimportar manualmente em `alunos.html`
  (ícone 📂) — não há aviso automático de que os dados ficaram
  desatualizados.

## 7. Exceção deliberada: `localStorage` para consentimento de analytics

A justificativa da seção 1 ("Por que IndexedDB e não `localStorage`")
vale para dado de domínio — aluno, plano, histórico: precisa de
versionamento de esquema e (no futuro) de `Blob`. A escolha de
consentimento para o Google Analytics (ver
[analytics-especificacao.md](./analytics-especificacao.md)) não é dado
de domínio, é preferência de navegador, e por isso é a única coisa no
projeto guardada em `localStorage` puro (chave
`nossoTreinoConsentimentoAnalytics`, `js/consentimento-analytics.js`) —
deliberadamente fora de `TreinosStorage`/IndexedDB, pra não depender da
hidratação assíncrona do banco (seção 5) nem do vocabulário da loja
`preferencias`.

## 8. Fora de escopo

- Painel consolidado por exercício (volume, carga, recordes pessoais a
  partir de `historico.serieMusculacao.v1`) — a visualização por
  exercício individual já existe (seção 9 de
  [treino-exercicios-especificacao.md](./treino-exercicios-especificacao.md#9-progresso-do-exercício-treino_exercicio_progressohtml)),
  mas um painel agregando *todos* os exercícios fica para depois (ver
  seção 10 do mesmo documento). Os gráficos de tempo total por sessão
  (`historico.sessaoBicicleta.v1` e `historico.sessaoMusculacao.v1`) já
  existem, ver seção 5.1.1 de
  [treino-bicicleta-especificacao.md](./treino-bicicleta-especificacao.md#511-gráfico-de-histórico-tempo-de-bicicleta)
  e seção 6.1.2 de
  [treino-exercicios-especificacao.md](./treino-exercicios-especificacao.md#612-gráfico-de-histórico-tempo-total-de-exercícios).
- Editar ou apagar entradas de histórico pela interface.
- Reatribuir um plano **existente** (com histórico) a outro aluno pela
  interface — duplicar (seção 3.2) cria uma cópia zerada num aluno
  diferente, mas não move o original.
- Múltiplos professores/contas no mesmo navegador.
- Pular `alunos.html`/`planos.html` automaticamente quando só existe um
  aluno/plano — a lista sempre aparece, mesmo com um item só.
