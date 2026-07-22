# Especificação — Armazenamento local (localStorage)

## 1. Objetivo

O site não tem backend: cada página HTML roda isolada no navegador de
quem usa. Esta especificação define como passamos a usar `localStorage`
do navegador para dois propósitos:

1. **Planos de treino** — dado pessoal (nome do professor/aluno, datas
   do ciclo, os treinos prescritos), nunca publicado junto com o site.
   Um mesmo navegador pode guardar **vários** planos ao mesmo tempo (um
   professor pode ter um por aluno) — a pessoa escolhe entre eles em
   [planos.html](../planos.html), que também é onde se cria um plano do
   zero, se duplica um existente como template, ou se importa um plano
   recebido/backup (ver seção 3). **A biblioteca de exercícios
   (`biblioteca-exercicios.json`) não entra aqui** — não é dado pessoal,
   é um arquivo estático versionado no repositório e carregado por
   `fetch` a cada página, sem passar por `localStorage` (ver
   [especificacao-biblioteca-exercicios.md](./especificacao-biblioteca-exercicios.md)
   seção 2.1).
2. **Histórico de execução** — guardar, no próprio navegador de quem
   usa, o que foi realmente feito em cada treino (treinos de bike
   concluídos, séries de musculação com carga/repetições), para no
   futuro gerar totais e relatórios. Cada plano tem o seu próprio
   histórico, independente dos outros planos guardados no mesmo
   navegador.

Isso cobre a parte de **dados** funcionando offline. A outra metade — as
**páginas em si** (HTML/CSS/JS) abrindo sem internet, inclusive num link
publicado — é responsabilidade do service worker, ver
[pwa-offline-especificacao.md](./pwa-offline-especificacao.md).

É usado por [planos.html](../planos.html), [plano_novo.html](../plano_novo.html),
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
| `planos.v1` | Índice de todos os planos guardados neste navegador: `[{id, professor, aluno, criadoEm, atualizadoEm}]` |
| `planoAtivoId.v1` | Id do plano cujas chaves escopadas (seção 2.2) estão sendo lidas/escritas agora, ou `null` se nenhum plano foi escolhido ainda |
| `apoio.ultimaExibicaoContador.v1`, `apoio.ultimaExibicaoData.v1`, `apoio.dispensadoPermanentemente.v1` | Cadência do banner de apoio pós-treino (ver `js/apoio.js` e [apoio-especificacao.md](./apoio-especificacao.md)) |
| `avisoIaAceito.v1` | Booleano — `true` depois que a pessoa concorda com o aviso de conteúdo gerado por IA em `planos.html` (seção 3.1). Ausente/`false` faz o aviso aparecer de novo |

### 2.2 Chaves escopadas por plano

Fisicamente gravadas como `treinos.plano.<id>.<chave>`, mas todo o
código de página (`treino_execucao.html`, `treino_novo.html` etc.) lê e
escreve usando só o nome relativo abaixo — `storage.js` resolve o
`<id>` do plano ativo (`planoAtivoId.v1`) por baixo dos panos, sem que
nenhuma dessas páginas precise saber que existe mais de um plano no
navegador (ver seção 3.3):

| Chave relativa | Conteúdo |
|---|---|
| `dados.v1` | Composição do plano — treinos, cardio, alongamento, metadata |
| `historico.sessaoBicicleta.v1` | Array — um registro por treino de bike concluído por inteiro |
| `historico.serieMusculacao.v1` | Array — um registro por série de exercício concluída (carga/repetições) |
| `historico.sessaoMusculacao.v1` | Array — um registro por treino de exercícios concluído por inteiro |
| `historico.sessaoAlongamento.v1` | Array — um registro por alongamento concluído por inteiro, ver seção 7 de [treino-alongamento-especificacao.md](./treino-alongamento-especificacao.md) |
| `execucao.musculacao.<treinoId>.v2` | Estado do treino de exercícios em andamento (para retomar após fechar a página) — endereçado por `exercicioId`, não por índice posicional |
| `execucao.alongamento.<alongamentoId>.v1` | Estado do treino de alongamento em andamento — mesmo princípio, endereçado por `alongamentoId` |

Como o id do plano já faz parte da chave física, dois planos diferentes
podem ter um treino com o mesmo id (ex: ambos com um treino
`treino-a`) sem nenhum risco de um vazar/misturar com o outro.

## 3. Gestão de planos e carregamento

Nenhuma página faz `fetch()` de um plano de treino. Como ele é pessoal e
nunca é publicado junto com o site (seção 1), um `fetch` relativo só
funcionaria em desenvolvimento local, com o arquivo presente em disco, e
falharia sempre em qualquer versão publicada do site. Em vez disso, o
site trata `localStorage` como a **única** fonte dos planos, igual em
qualquer ambiente (local ou publicado) — a biblioteca de exercícios é o
caso oposto: **sempre** vem por `fetch`, nunca por importação manual (ver
seção 1).

### 3.1 `planos.html` + `plano_novo.html`

Primeira tela depois de `index.html` (`sistema.html` redireciona pra cá
se não houver plano ativo, seção 3.3). Segue **o mesmo padrão visual das
outras telas de menu** (`treino_bicicleta_menu.html`,
`treino_exercicios_menu.html`, `treino_alongamento_menu.html`): cabeçalho
`header.top` com seta de voltar à esquerda e um botão "+" à direita
(`.icon-btn`) que leva pra uma tela dedicada de criação — aqui,
`plano_novo.html` — em vez de um formulário embutido na própria lista.
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

Lista os planos do índice (`planos.v1`), cada um com as ações:

- **Entrar** — `TreinosStorage.ativarPlano(id)` (só grava
  `planoAtivoId.v1`) e navega pra `sistema.html`.
- **Editar** — formulário inline (professor, aluno, início/fim do
  ciclo) → `TreinosStorage.atualizarMetadataPlano(id, {...})`.
- **Duplicar** — `TreinosStorage.duplicarPlano(id)`: clona só a
  composição (`dados.v1`) do plano de origem num id novo, limpa o nome
  do aluno e não ativa sozinho — pensado como template pra outro aluno,
  sem histórico/progresso.
- **Baixar plano** — `TreinosStorage.lerDadosDoPlano(id)`, baixa só a
  composição (sem histórico) — pro professor mandar pro aluno.
- **Baixar tudo (com estatísticas)** —
  `TreinosStorage.montarExportacaoCompletaDoPlano(id)`, baixa composição
  + histórico + progresso em andamento — pro aluno devolver pro
  professor com os dados preenchidos.
- **Excluir** — `TreinosStorage.excluirPlano(id)`: remove a entrada do
  índice e todas as chaves físicas daquele plano
  (`plano.<id>.*` — composição, histórico, progresso em andamento). Pede
  confirmação (mesmo overlay `.confirm-card`/`.confirm-botoes`
  compartilhado com o menu de reset de `sistema.html`, agora em
  `css/componentes.css`). Se o plano excluído era o ativo,
  `planoAtivoId.v1` volta pra `null`.

`plano_novo.html` (mesmos 4 campos: professor, aluno, início/fim do
ciclo) chama `TreinosStorage.criarPlano({professor, aluno, inicio, fim})`:
gera um id único (`gerarIdUnico`, [identificadores.js](../js/identificadores.js)),
adiciona ao índice, ativa e grava um esqueleto vazio (`treinos`,
`treinosCardio`, `treinosAlongamento` vazios, `distribuicaoSemanal` com
todos os dias sem treino, `orientacoesGerais: null` — código já trata
essa ausência graciosamente, ver seção 6 de
[treino-exercicios-especificacao.md](./treino-exercicios-especificacao.md))
e redireciona pra `sistema.html`. De lá, o professor usa os mesmos botões
"+" que um aluno usa (`treino_novo.html`, `treino_bicicleta_novo.html`,
`treino_alongamento_novo.html`) pra montar os treinos — essas telas já
funcionam com qualquer plano ativo, não distinguem se foi importado,
criado do zero ou duplicado.

Dois ícones no mesmo cabeçalho, ao lado do "+", cobrem os casos que não
envolvem escolher entre planos já existentes: um 📂 (`<label class="icon-btn" for="arquivoInput">`,
mesmo truque de `<input type="file" hidden>` associado por `for`/`id` já
usado nas telas de criação) que aceita tanto um **plano avulso recebido**
de alguém (`TreinosStorage.importarPlano(dados)` seguido de
`ativarPlano(id)` — cria uma entrada nova no índice e já entra nela, sem
passo de "salvar" separado) quanto um **backup completo**
(`tipo: "backup-treinos"`, `TreinosStorage.restaurarBackup(backup)` —
substitui o índice inteiro e todos os planos que o backup contém,
entrando no plano que estava ativo no momento do backup); e um botão de
texto discreto, "Baixar backup completo" (`TreinosStorage.montarBackup()`),
com todos os planos do navegador, pra levar pra outro aparelho. Escolher
o arquivo já basta — sem colar conteúdo, sem botão de confirmação — a
navegação pra `sistema.html` acontece sozinha em seguida.

### 3.2 `TreinosStorage.carregarDadosTreinos()` / `definirDadosTreinos(dados)`

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
para `planos.html` (ver seção 6.2 de
[treino-exercicios-especificacao.md](./treino-exercicios-especificacao.md)
e seção 5 de
[treino-bicicleta-especificacao.md](./treino-bicicleta-especificacao.md)).
A biblioteca de exercícios usa um carregamento à parte,
`carregarBiblioteca()` (`js/biblioteca-exercicios.js`, `fetch`, sem
`localStorage`) — páginas que mostram nome/vídeo/grupo muscular de
exercício carregam os dois em paralelo.

### 3.3 Como o escopo por plano funciona por baixo

`TreinosStorage.lerJSON(chave, padrao)`, `salvarJSON(chave, valor)`,
`removerChave(chave)`, `adicionarAoHistorico(chave, entrada)` e
`listarChavesComPrefixo(prefixo)` — usadas por praticamente toda página
de treino — resolvem a chave física automaticamente como
`treinos.plano.<planoAtivoId>.<chave>` internamente, usando
`planoAtivoId.v1` (seção 2.1). Trocar de plano (`ativarPlano(id)`) é só
regravar esse ponteiro — não há cópia de dados envolvida, e por isso não
há risco de progresso de um plano vazar pro outro.

Preferências que não são por plano (gênero da imagem, cadência do
banner de apoio) usam `lerJSONGlobal(chave, padrao)` /
`salvarJSONGlobal(chave, valor)` em vez disso, gravando direto em
`treinos.<chave>`, sem passar pelo plano ativo — usadas hoje só por
`js/imagem-exercicio.js` e `js/apoio.js`.

Duas primitivas adicionais, usadas só por `planos.html` pra operar sobre
um plano que não precisa estar ativo (duplicar, editar metadata, baixar):
`TreinosStorage.lerJSONDoPlano(id, chave, padrao)` e
`salvarJSONDoPlano(id, chave, valor)`.

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
// Escopadas ao plano ativo (ver seção 3.3)
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

// Gestão de planos (planos.html, seção 3.1)
TreinosStorage.listarPlanos()
TreinosStorage.obterPlanoAtivoId()
TreinosStorage.ativarPlano(id)
TreinosStorage.criarPlano({professor, aluno, inicio, fim})
TreinosStorage.duplicarPlano(id)
TreinosStorage.atualizarMetadataPlano(id, {professor, aluno, inicio, fim})
TreinosStorage.excluirPlano(id)
TreinosStorage.importarPlano(dadosPlano)     // planos.html, seção 3.1
TreinosStorage.lerDadosDoPlano(id)
TreinosStorage.montarExportacaoCompletaDoPlano(id)
TreinosStorage.lerJSONDoPlano(id, chave, padrao)
TreinosStorage.salvarJSONDoPlano(id, chave, valor)

// Backup completo, todos os planos (planos.html, seção 3.1)
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

## 6. Limitações

- `localStorage` é por origem (protocolo + host + porta) **e por
  navegador/aparelho** — não sincroniza entre o celular e o computador,
  por exemplo, nem entre navegadores diferentes no mesmo aparelho. Vários
  planos podem conviver no mesmo navegador (seção 3), mas não sincronizam
  sozinhos pra outro navegador/aparelho — é preciso baixar um backup
  completo em `planos.html` e restaurá-lo no destino. A
  biblioteca de exercícios **não** tem essa limitação — vem por `fetch`
  a cada página, então é a mesma em qualquer navegador/aparelho sem
  precisar de nenhuma ação manual.
- Limpar dados de navegação / dados do site apaga tudo — todos os planos
  guardados nesse navegador, com histórico e progresso. A biblioteca de
  exercícios não é afetada (não vive em `localStorage`).
- Quota é pequena (alguns MB), mas de sobra para o volume de texto
  gerado por esse histórico e pelos dados de treino, mesmo com vários
  planos guardados ao mesmo tempo.
- Quando o professor atualiza a composição de um plano à distância
  (fora do site), é preciso reimportar manualmente em `planos.html`
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
- Pular `planos.html` automaticamente quando só existe um plano — a
  lista sempre aparece, mesmo com um item só.
