# Especificação — Armazenamento local (localStorage)

## 1. Objetivo

O site não tem backend: cada página HTML roda isolada no navegador de
quem usa. Esta especificação define como passamos a usar `localStorage`
do navegador para três propósitos:

1. **Alunos** — cada aluno tem um id próprio (`alunos.v1`), pra poder
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
   `fetch` a cada página, sem passar por `localStorage` (ver
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
[treino_exercicios_menu.html](../treino_exercicios_menu.html),
[treino_exercicios.html](../treino_exercicios.html),
[treino_execucao.html](../treino_execucao.html),
[treino_exercicio_progresso.html](../treino_exercicio_progresso.html),
[treino_alongamento_menu.html](../treino_alongamento_menu.html),
[treino_alongamento.html](../treino_alongamento.html) e
[treino_alongamento_novo.html](../treino_alongamento_novo.html) (ver
[treino-exercicios-especificacao.md](./treino-exercicios-especificacao.md),
[treino-bicicleta-especificacao.md](./treino-bicicleta-especificacao.md) e
[treino-alongamento-especificacao.md](./treino-alongamento-especificacao.md)),
através de um script único e compartilhado:
[`storage.js`](../storage.js).

## 2. Convenção de chaves

Todas as chaves gravadas em `localStorage` usam o prefixo `treinos.` e
terminam com uma versão (`.v1`), para permitir mudar o formato no futuro
sem ter que migrar dados antigos — se o formato mudar, cria-se uma
`.v2` e a leitura da `.v1` é simplesmente abandonada.

Duas famílias de chave convivem em `storage.js`:

### 2.1 Chaves globais (não dependem de qual plano está ativo)

| Chave (sem prefixo) | Conteúdo |
|---|---|
| `alunos.v1` | Índice de todos os alunos guardados neste navegador: `[{id, nome, criadoEm, atualizadoEm}]` |
| `planos.v1` | Índice de todos os planos guardados neste navegador: `[{id, alunoId, professor, criadoEm, atualizadoEm}]` — `alunoId` referencia uma entrada de `alunos.v1` |
| `planoAtivoId.v1` | Id do plano cujas chaves escopadas (seção 2.2) estão sendo lidas/escritas agora, ou `null` se nenhum plano foi escolhido ainda |
| `apoio.ultimaExibicaoContador.v1`, `apoio.ultimaExibicaoData.v1`, `apoio.dispensadoPermanentemente.v1` | Cadência do banner de apoio pós-treino (ver `js/apoio.js` e [apoio-especificacao.md](./apoio-especificacao.md)) |
| `avisoIaAceito.v1` | Booleano — `true` depois que a pessoa concorda com o aviso de conteúdo gerado por IA em `alunos.html` (seção 3.1). Ausente/`false` faz o aviso aparecer de novo |

Não existe um "aluno ativo" global: qual aluno está sendo visto é só a
query string (`planos.html?aluno=<id>`) — nenhuma leitura/escrita de
dados de plano depende disso, só a navegação (seção 3.1/3.2).

### 2.2 Chaves escopadas por plano

Fisicamente gravadas como `treinos.plano.<id>.<chave>`, mas todo o
código de página (`treino_execucao.html`, `treino_novo.html` etc.) lê e
escreve usando só o nome relativo abaixo — `storage.js` resolve o
`<id>` do plano ativo (`planoAtivoId.v1`) por baixo dos panos, sem que
nenhuma dessas páginas precise saber que existe mais de um plano no
navegador (ver seção 3.4):

| Chave relativa | Conteúdo |
|---|---|
| `dados.v1` | Composição do plano — treinos, cardio, alongamento, metadata (`metadata.aluno`/`metadata.professor` são cópias de exibição, ver seção 3.2) |
| `historico.sessaoBicicleta.v1` | Array — um registro por treino de bike concluído por inteiro |
| `historico.serieMusculacao.v1` | Array — um registro por série de exercício concluída (carga/repetições) |
| `historico.sessaoMusculacao.v1` | Array — um registro por treino de exercícios concluído por inteiro |
| `historico.serieAlongamento.v1` | Array — um registro por série de alongamento concluída (tempo sustentado, sem carga/repetições), ver seção 7 de [treino-alongamento-especificacao.md](./treino-alongamento-especificacao.md) |
| `historico.sessaoAlongamento.v1` | Array — um registro por alongamento concluído por inteiro, ver seção 7 de [treino-alongamento-especificacao.md](./treino-alongamento-especificacao.md) |
| `execucao.musculacao.<treinoId>.v2` | Estado do treino de exercícios em andamento (para retomar após fechar a página) — endereçado por `exercicioId`, não por índice posicional |
| `execucao.alongamento.<alongamentoId>.v1` | Estado do treino de alongamento em andamento — mesmo princípio, endereçado por `alongamentoId` |

Como o id do plano já faz parte da chave física, dois planos diferentes
podem ter um treino com o mesmo id (ex: ambos com um treino
`treino-a`) sem nenhum risco de um vazar/misturar com o outro.

## 3. Hierarquia aluno → plano → sistema

Nenhuma página faz `fetch()` de aluno/plano de treino. Como são dados
pessoais e nunca publicados junto com o site (seção 1), um `fetch`
relativo só funcionaria em desenvolvimento local, com o arquivo presente
em disco, e falharia sempre em qualquer versão publicada do site. Em vez
disso, o site trata `localStorage` como a **única** fonte — a biblioteca
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
`treino_exercicios_menu.html`, `treino_alongamento_menu.html`): cabeçalho
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
padrão de `treino_novo.html` quando falta contexto). Cabeçalho mostra o
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
- **Baixar plano** — `TreinosStorage.lerDadosDoPlano(id)`, baixa só a
  composição (sem histórico) — pro professor mandar pro aluno.
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
(`treinos`, `treinosCardio`, `treinosAlongamento` vazios,
`distribuicaoSemanal` com todos os dias sem treino, `orientacoesGerais: null` —
código já trata essa ausência graciosamente, ver seção 6 de
[treino-exercicios-especificacao.md](./treino-exercicios-especificacao.md))
e redireciona pra `sistema.html`. De lá, o professor usa os mesmos botões
"+" que um aluno usa (`treino_novo.html`, `treino_bicicleta_novo.html`,
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

Usadas por toda página que precisa da composição do plano (`treino-novo.js`,
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
`localStorage`) — páginas que mostram nome/vídeo/grupo muscular de
exercício carregam os dois em paralelo.

### 3.4 Como o escopo por plano funciona por baixo

`TreinosStorage.lerJSON(chave, padrao)`, `salvarJSON(chave, valor)`,
`removerChave(chave)`, `adicionarAoHistorico(chave, entrada)` e
`listarChavesComPrefixo(prefixo)` — usadas por praticamente toda página
de treino — resolvem a chave física automaticamente como
`treinos.plano.<planoAtivoId>.<chave>` internamente, usando
`planoAtivoId.v1` (seção 2.1). Trocar de plano (`ativarPlano(id)`) é só
regravar esse ponteiro — não há cópia de dados envolvida, e por isso não
há risco de progresso de um plano vazar pro outro.

Preferências que não são por plano (cadência do banner de apoio, aviso
de IA aceito) usam `lerJSONGlobal(chave, padrao)` /
`salvarJSONGlobal(chave, valor)` em vez disso, gravando direto em
`treinos.<chave>`, sem passar pelo plano ativo — usadas hoje só por
`js/apoio.js` e o aviso de IA em `alunos.html`.

Primitivas adicionais, usadas por `planos.html`/`alunos.html` pra operar
sobre um plano/aluno que não precisa estar ativo (duplicar, editar
metadata, baixar, agregar estatísticas):
`TreinosStorage.lerJSONDoPlano(id, chave, padrao)` e
`salvarJSONDoPlano(id, chave, valor)`.

### 3.5 Estatísticas agregadas por aluno

As telas de gráfico/estatística (sessões de bike/musculação/alongamento
em `treino_bicicleta_menu.html`/`treino_exercicios_menu.html`/
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
TreinosStorage.importarPlano(dadosPlano, alunoId)  // alunos.html, seção 3.1 — alunoId decidido na confirmação de importação
TreinosStorage.lerDadosDoPlano(id)
TreinosStorage.montarExportacaoCompletaDoPlano(id)
TreinosStorage.lerJSONDoPlano(id, chave, padrao)
TreinosStorage.salvarJSONDoPlano(id, chave, valor)

// Backup completo, todos os alunos e planos (alunos.html, seção 3.1)
TreinosStorage.montarBackup()
TreinosStorage.restaurarBackup(backup)
```

`chave` nessas funções é sempre o nome relativo (sem o prefixo
`treinos.` nem o `plano.<id>.`) — a função monta o nome físico completo
internamente.

Toda escrita é protegida por `try/catch`: se `localStorage` estiver
indisponível (modo privado do navegador, quota cheia etc.), a gravação
falha silenciosamente em vez de quebrar a página. O treino continua
funcionando, só o histórico daquela sessão não é salvo.

### 5.1 Migração automática de `planos.v1` sem `alunoId`

Dados salvos antes de a entidade Aluno existir tinham `planos.v1[].aluno`
como texto livre, sem `alunoId`. Na primeira leitura de `alunos.v1` (se a
chave ainda não existir), `storage.js` agrupa as entradas de `planos.v1`
pelo texto de `aluno` (normalizado), cria um `Aluno` por nome distinto,
seta `alunoId` em cada plano correspondente e remove o texto livre —
silencioso, roda uma vez, sem pedir nada a quem usa. O mesmo agrupamento
é aplicado ao restaurar um backup salvo antes desta mudança (sem
`alunos` no JSON).

## 6. Limitações

- `localStorage` é por origem (protocolo + host + porta) **e por
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
  biblioteca de exercícios não é afetada (não vive em `localStorage`).
- Quota é pequena (alguns MB), mas de sobra para o volume de texto
  gerado por esse histórico e pelos dados de treino, mesmo com vários
  alunos/planos guardados ao mesmo tempo.
- Quando o professor atualiza a composição de um plano à distância
  (fora do site), é preciso reimportar manualmente em `alunos.html`
  (ícone 📂) — não há aviso automático de que os dados ficaram
  desatualizados.

## 7. Fora de escopo

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
