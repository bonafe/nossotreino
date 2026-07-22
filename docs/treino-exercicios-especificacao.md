# Especificação — Páginas de Exercícios (Musculação / Peso do Corpo / Funcional)

Esta especificação descreve o formato hoje lido pelo código: dois documentos
JSON separados — `biblioteca-exercicios.json` (vocabulário compartilhado,
versionado, buscado por `fetch`) e o plano de treino (dado pessoal, carregado
manualmente em `localStorage`) — cujo modelo completo está em
[especificacao-biblioteca-exercicios.md](./especificacao-biblioteca-exercicios.md).
Este documento foca no comportamento das páginas de exercícios em cima desse
modelo.

## 1. Objetivo

Descreve como transformar os dois documentos JSON em páginas de exercícios
(musculação, peso do corpo, funcional e flexibilidade), seguindo o mesmo
padrão de "motor genérico + JSON de dados" já usado no
[treino de bicicleta](./treino-bicicleta-especificacao.md).

## 2. Fonte de dados

- **Biblioteca** (`biblioteca-exercicios/biblioteca-exercicios.json`,
  versionada): exercícios, grupos musculares, equipamentos e técnicas. Não é
  dado pessoal — é buscada por `fetch` (`js/biblioteca-exercicios.js#carregarBiblioteca()`),
  cacheada pelo service worker pra funcionar offline, e mantida em memória
  durante o carregamento da página (sem passar por `localStorage`).
- **Plano de treino** (dado pessoal: nome do professor, do aluno, datas do
  ciclo, os treinos prescritos): um navegador pode guardar vários planos,
  escolhidos/criados/importados em [planos.html](../planos.html); "entrar"
  num plano grava `TreinosStorage.definirDadosTreinos()`. Toda página lê
  com `TreinosStorage.carregarDadosTreinos()` (rejeita se nenhum plano
  estiver ativo ainda) — ver
  [armazenamento-local-especificacao.md](./armazenamento-local-especificacao.md).
  Os treinos de bicicleta também são derivados dele (ver seção 4 de
  [treino-bicicleta-especificacao.md](./treino-bicicleta-especificacao.md)).
- Cada página que precisa mostrar nome/vídeo/grupo muscular de um exercício
  carrega os **dois** documentos (biblioteca + plano) e cruza por
  `exercicioId`.

## 3. Estrutura do JSON

Ver a especificação completa do modelo em
[especificacao-biblioteca-exercicios.md](./especificacao-biblioteca-exercicios.md).
Resumo do que cada página usa:

### 3.1 Documento da biblioteca

| Campo | Descrição |
|---|---|
| `bibliotecas.exercicios[exercicioId]` | `nome`, `gruposMusculares.{principais,sinergistas,estabilizadores}` (ids que resolvem em `gruposMusculares`), `midia.{videoMagnet,videoUrl}` |
| `gruposMusculares[id]` | `nome` de exibição de cada grupo muscular |

### 3.2 Documento do plano

| Campo | Tipo | Descrição |
|---|---|---|
| `metadata` | objeto | Nome do professor/aluno, período do ciclo, objetivos — descritivo, não afeta renderização |
| `distribuicaoSemanal` | array de 7 | `{ dia: "segunda-feira"…"domingo", treinoId: string \| null }` — usado pra "treino de hoje" |
| `orientacoesGerais` | objeto | Texto de ajuda fixo (guia rápido) — ver 3.3 |
| `treinos` | array | Ver 3.4 |

### 3.3 `orientacoesGerais`

Regras textuais/numéricas válidas para todos os treinos do plano, mostradas
no "Guia rápido":

| Campo | Conteúdo |
|---|---|
| `ajusteCarga.regra` | Como ajustar peso conforme repetições realizadas |
| `cadenciaPadrao.{concentrica,excentrica}` | Ritmo qualitativo padrão |
| `descansoPadrao.{minSegundos,maxSegundos}` | Faixa de descanso padrão entre séries, usada quando o item não define `prescricao.descansoSegundos` próprio |
| `superset.regra` | Explica o marcador `superset` |
| `isometria.{duracaoSegundos,posicao,momento,aplicacao}` | Parâmetros padrão de isometria mostrados no guia (cada item pode ter os seus próprios em `prescricao.tecnicas`) |
| `circuito.regra` | Explica o marcador `circuito` |

### 3.4 `treinos`

Array de treinos. Cada treino:

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | string | Identificador único, usado em `distribuicaoSemanal` e em rotas (`?treino=<id>`) |
| `nome` | string | Nome exibido |
| `tipo` | `"musculacao"` \| `"calistenia"` \| `"condicionamento"` \| `"flexibilidade"` | Ver seção 4 |
| `aquecimento` | `null` \| `{ protocolos: [...] }` | Se `null`, treino não tem tela de aquecimento — ver 3.4.1 |
| `exercicios` | array plana de item (3.4.2) | Pode ser `[]` (treino ainda sem exercícios definidos) |
| `cardio` | array | Referências a treinos de cardio complementares — ver 3.4.3 |
| `alongamento` | array | Referências a treinos de alongamento complementares — mesmo formato de `cardio`, ver 3.4.3 |
| `configuracaoCircuito` | objeto, opcional | Presente em treinos de circuito (`tipo: "condicionamento"`) |

#### 3.4.1 `aquecimento.protocolos[]`

Cada protocolo:

| Campo | Descrição |
|---|---|
| `tipo` | Identificador do tipo de protocolo (ex. `mobilidade-alongamento`), usado como rótulo humanizado |
| `series` | Número de séries, opcional |
| `dosagem` \| `metrica` | `dosagem: {valor, unidade}` ou `metrica` no mesmo formato da prescrição (3.4.2) |
| `alvo` | Alvo do protocolo (ex. `manguito-rotador`), opcional |
| `videoUrl` | Link externo de vídeo, opcional |
| `observacao` | Texto livre complementar, opcional |

Não existe mais um "aquecimento padrão" global reaproveitado por vários
treinos — cada treino define seus próprios protocolos.

#### 3.4.2 Item (exercício, lista plana)

| Campo | Tipo | Descrição |
|---|---|---|
| `exercicioId` | string | Chave em `bibliotecas.exercicios` |
| `ordem` | number | Ordena os itens dentro do treino |
| `superset` / `circuito` | inteiro ou `null` | Marcador de agrupamento — ver seção 5 |
| `prescricao.series` | number | Quantidade de séries |
| `prescricao.metrica.{tipo,modo,min,max,valor,unidade}` | objeto | Ver tabela abaixo |
| `prescricao.descansoSegundos` | number ou `null` | Descanso específico deste item; `null` usa `orientacoesGerais.descansoPadrao` |
| `prescricao.tecnicas` | array | `[{tipo: "isometria", duracaoSegundos, posicao, momento, aplicacao: {ultimasSeries}}]` — vazio ou sem entrada `isometria` = técnica tradicional |
| `alternativas` | array | `[{exercicioId, prioridade, prescricao?}]` — substitutos deste item; herdam `prescricao` do item principal quando não declaram a própria |
| `observacao` | string ou `null` | Nota específica do item |

Renderização de `prescricao.metrica` conforme `modo`:

| `modo` | Exibição |
|---|---|
| `faixa` | "`min` a `max` `unidade`" |
| `fixo` | "`valor` `unidade`" |
| `maximo` (tipo `tempo`) | "Tempo máximo" |
| `maximo` (demais) | "Máximo de repetições" |

`unidade` default é `"repetições"` para `tipo: "repeticoes"` e `"segundos"`
para `tipo: "tempo"` quando o campo não vem explícito.

#### 3.4.3 `cardio[]` / `alongamento[]`

Cada entrada de `cardio[]`: `{ treinoCardioId, momento }` — referência a
uma entrada de `treinosCardio[]` (coleção de primeira classe no topo do
plano, ver seção 2.2/11.4/12.3 de
[especificacao-biblioteca-exercicios.md](./especificacao-biblioteca-exercicios.md)),
não mais a prescrição embutida. Cada entrada de `alongamento[]`:
`{ treinoAlongamentoId, momento }`, mesmo princípio, referenciando
`treinosAlongamento[]` (seção 11.5 do mesmo documento).

Quando presente, o treino tem cardio/alongamento complementar; a página
resolve a referência em `dados.treinosCardio`/`dados.treinosAlongamento` e
monta um botão "Fazer bicicleta →"/"Fazer alongamento →" por entrada (ver
seção 6.2). Um treino pode ter zero, uma ou mais entradas de cada — e a
mesma entrada de `treinosCardio`/`treinosAlongamento` pode, em tese, ser
referenciada por mais de um treino de musculação (o motor de bicicleta
hoje só sabe tocar `treino.tipo === "intervalado"`; outros tipos ficam
fora de escopo, ver seção 8 de
[treino-bicicleta-especificacao.md](./treino-bicicleta-especificacao.md)).

## 4. Tipos de treino (`tipo`)

| `tipo` | `aquecimento` | Marcador típico | `cardio` |
|---|---|---|---|
| `musculacao` | protocolos presentes | `superset` | às vezes presente |
| `calistenia` | protocolos presentes | nenhum (`grupo` sequencial) | não observado |
| `condicionamento` | `null` (sem tela de aquecimento) | `circuito` | não observado |
| `flexibilidade` | protocolos presentes | `exercicios: []` (rascunho, `status: "rascunho"`) | não observado |

`flexibilidade` hoje não tem nenhum exercício definido no JSON — a página
deve lidar com esse caso (mensagem "Nenhum exercício cadastrado ainda para
este treino", botão "Iniciar treino" oculto), sem quebrar.

## 5. Regras de negócio a refletir na UI

- **Alternativas**: cada item pode ter `alternativas[]`. A UI mostra cada
  alternativa como um card adicional logo depois do item principal,
  esmaecido e marcado "Substituto" (mesmo efeito visual de antes) — não é
  mais um item-irmão no JSON, é um array aninhado no item que substitui.
- **Superset**: itens consecutivos (após ordenar por `ordem`) com o mesmo
  `superset` são agrupados visualmente sob um heading "Superset N — fazer
  em sequência", calculado pela página a partir da lista plana (não vem
  pronto no JSON).
- **Circuito**: mesma lógica de agrupamento, heading "Circuito N — uma
  série de cada por volta", a partir do marcador `circuito`.
- **Isometria**: item com `prescricao.tecnicas` contendo `{tipo:
  "isometria", ...}` mostra uma nota construída a partir dos parâmetros
  daquele item específico (duração, posição, momento, últimas séries) — não
  é mais um texto fixo igual pra todo mundo.
- **Pausa padrão** (`orientacoesGerais.descansoPadrao`): usada como
  referência de descanso entre séries quando o item não define
  `prescricao.descansoSegundos` próprio.
- **Cadência** (`orientacoesGerais.cadenciaPadrao`) e **ajuste de carga**
  (`orientacoesGerais.ajusteCarga`): textos informativos, exibidos uma vez
  no guia rápido (não por exercício).
- **Aquecimento**: se `aquecimento` for `null`, não mostrar etapa de
  aquecimento; senão, renderizar cada `protocolos[]` (texto + vídeo quando
  o protocolo tiver `videoUrl`).
- **Grupo muscular**: nomes resolvidos via `bibliotecas.exercicios[id].gruposMusculares`
  + `gruposMusculares[id].nome` da biblioteca — não vêm mais soltos no item.

## 6. Telas / fluxo

```
sistema.html
   └─> treino_exercicios_menu.html   (lista treinos do plano carregado)
          └─> treino_exercicios.html?treino=<id>   (exibe aquecimento, exercícios e cardio do treino)
                 └─> treino_execucao.html?treino=<id>   (execução guiada, um exercício por vez — ver seção 8)
```

### 6.1 Menu (`treino_exercicios_menu.html`)

A ordem de exibição na tela é: botão "Continuar de onde parou" (seção
6.1.1, se houver alguma execução em andamento), gráfico de histórico
(seção 6.1.2) e só depois a lista de treinos.

- Carrega o plano via `TreinosStorage.carregarDadosTreinos()`.
- Mostra um cartão por treino com `nome`, `tipo` e contagem de exercícios
  (`treino.exercicios.length`); marca o treino de hoje comparando
  `distribuicaoSemanal[].dia` (`"segunda-feira"`…`"domingo"`) com o dia
  atual.
- Cada cartão é um link para `treino_exercicios.html?treino=<id>`.

#### 6.1.1 Botão "Continuar de onde parou"

O botão "Continuar treino →" que já existe em `treino_exercicios.html`
(seção 6.2) só aparece depois de entrar no treino específico que está em
andamento — útil quando é o treino do dia, mas obriga a lembrar/adivinhar
qual treino estava pendente quando não é. Este botão resolve isso: acessa
diretamente a execução em andamento **de qualquer treino**, direto do
menu, sem passar por `treino_exercicios.html`.

- Ao carregar a tela, busca todas as chaves com prefixo
  `execucao.musculacao.` via `TreinosStorage.listarChavesComPrefixo(...)`
  (mesma função usada por `TreinosStorage.montarBackup()`) — uma por
  treino com progresso salvo (seção 8.3). Extrai o `treinoId` de cada
  chave (formato `execucao.musculacao.<treinoId>.v2`).
- Considera "em andamento" o mesmo critério já usado em
  `treino_exercicios.html` (seção 6.2): `progresso.exercicioId &&
  progresso.serieAtual >= 1`.
- **Vários treinos em andamento ao mesmo tempo** (caso raro, mas
  possível — nada impede começar um treino diferente sem finalizar o
  anterior): mostra só **um** botão, para a execução com `iniciadoEm`
  (seção 8.3) mais recente. As demais ficam acessíveis normalmente
  entrando em cada treino específico — não há, por ora, uma lista de
  "todas as execuções em andamento".
- O botão mostra o nome do treino (`dados.treinos[].nome`, buscado via
  `TreinosStorage.carregarDadosTreinos()`; se os dados ainda não
  estiverem carregados nesse navegador, mostra o `treinoId` cru em vez do
  nome — degradação aceita, não bloqueia o botão) e leva direto para
  `treino_execucao.html?treino=<treinoId>` — a própria tela de execução
  já retoma do estado salvo (seção 8.3), sem precisar de mais nenhum
  parâmetro na URL.
- Se não houver nenhuma execução em andamento (nenhuma chave
  `execucao.musculacao.*` válida), o botão não aparece.

#### 6.1.2 Gráfico de histórico (tempo total de exercícios)

Mesmo esquema do gráfico de bike (seção 5.1.1 de
[treino-bicicleta-especificacao.md](./treino-bicicleta-especificacao.md#511-gráfico-de-histórico-tempo-de-bicicleta)),
aplicado a `historico.sessaoMusculacao.v1` em vez de
`historico.sessaoBicicleta.v1`: um gráfico de barras (D3.js,
`d3.v7.min.js` vendorizado) logo abaixo do título da tela, com o tempo
total de treino de exercícios (qualquer `treino.tipo`, o histórico não
distingue) por dia ou mês.

- **Fonte dos dados**: `historico.sessaoMusculacao.v1`, lido direto com
  `TreinosStorage.lerJSON(...)` — cada barra soma o `duracaoSegundos`
  (seção 8.7) das sessões concluídas naquele dia/mês. Independe do plano
  de treino estar carregado, mesma lógica da seção 5.1.1 da bike.
- **Três períodos**, mesmos botões e mesmos defaults da bike: **7 dias**
  (padrão), **30 dias**, **Meses** (últimos 6 meses). Dias/meses sem
  sessão concluída aparecem como barra vazia — o eixo sempre cobre o
  período inteiro.
- **Tooltip**, **rótulo em cima da barra** (some quando a banda fica
  abaixo de 20px, ou seja, em **30 dias**) e **estado vazio** ("Nenhum
  treino de exercícios registrado ainda.") seguem exatamente o mesmo
  comportamento descrito na seção 5.1.1 da bike, só trocando a fonte do
  histórico.
- Mesma cor de barra (`#bef264`) e mesma cor de rótulo (`#e2e8f0`), única
  série.

### 6.2 Página do treino (`treino_exercicios.html`)

- Lê o parâmetro de query `?treino=<id>`.
- Carrega o plano (`TreinosStorage.carregarDadosTreinos()`) e a biblioteca
  (`carregarBiblioteca()`, fetch), localiza o treino pelo `id` em
  `treinos` e renderiza aquecimento (se houver), a lista de exercícios
  agrupada por `superset`/`circuito` (seção 5) e:
  - para cada entrada de `treino.cardio[]`, um card com um botão "Fazer
    bicicleta →" que leva a
    `treino_bicicleta.html?treino=<treinoCardioId>&origem=<id>` (ver 3.4.3,
    e seção 4/5.2.1 de
    [treino-bicicleta-especificacao.md](./treino-bicicleta-especificacao.md));
  - para cada entrada de `treino.alongamento[]`, um card equivalente com
    botão "Fazer alongamento →" que leva a
    `treino_alongamento.html?treino=<treinoAlongamentoId>&origem=<id>` (ver
    3.4.3, e seção 4/5.2.1 de
    [treino-alongamento-especificacao.md](./treino-alongamento-especificacao.md)).
- Se não houver `treino` na URL, o `id` não existir, o plano não estiver
  carregado, ou a biblioteca não puder ser buscada, mostra mensagem de
  erro com link de volta para o menu (e para `planos.html`, se for o
  caso) — mesmo comportamento já adotado em `treino_bicicleta.html`.
- Quando `treino.exercicios` tiver ao menos um item, mostra um botão que
  leva a `treino_execucao.html?treino=<id>` (seção 8). O texto do botão
  depende de já existir progresso salvo pra esse treino
  (`execucao.musculacao.<id>.v2`, seção 8.3): "Continuar treino →" se
  existir, "Iniciar treino →" caso contrário — mesma checagem de validade
  usada em `treino_execucao.html` (`progresso.exercicioId` e
  `serieAtual >= 1`). Quando `exercicios` estiver vazio (`flexibilidade`),
  o botão não aparece.
- Cada card de exercício é clicável (a caixa inteira, igual ao cartão de
  treino em `treino_exercicios_menu.html`) e leva direto para aquele
  exercício específico em
  `treino_execucao.html?treino=<id>&exercicio=<exercicioId>&opcao=<opcaoExercicioId>`
  (o item principal usa `opcao` igual ao próprio `exercicioId`; cada
  alternativa usa o seu). O card é dividido em duas colunas
  (`.item-linha`): a esquerda com nome, grupos musculares, prescrição e
  ações; a direita com a imagem do exercício (`.item-imagem`,
  `js/imagem-exercicio.js#ligarImagemExercicio`) — só aparece se a
  imagem daquele `exercicioId` existir em
  `biblioteca-exercicios/imagens/musculacao/` (tentativa de carregamento,
  sem registro prévio de quais exercícios já têm imagem — ver seção 2.1 de
  [especificacao-biblioteca-exercicios.md](./especificacao-biblioteca-exercicios.md)),
  e clicar nela (`event.stopPropagation()` pra não disparar a navegação
  do card) abre em tamanho maior num overlay próprio (`#imagemOverlay`,
  `criarImagemModal`). Dentro da coluna de conteúdo, dois botões/links
  próprios (mesmo `event.stopPropagation()`): "Ver vídeo" mostra o estado
  do download por torrent (baixando/pronto/indisponível) e abre um
  player embutido quando o vídeo estiver pronto — ver
  [torrent-videos-especificacao.md](./torrent-videos-especificacao.md#7-estados-de-carregamento-ui);
  "Ver progresso" leva para
  `treino_exercicio_progresso.html?exercicio=<exercicioId>&treino=<treinoId>`
  (seção 9).

## 8. Execução guiada de treino (`treino_execucao.html`)

Tela para fazer o treino "ao vivo": mostra um exercício por vez, deixa
registrar carga e repetições de cada série e avança sozinha para o
próximo exercício.

### 8.1 Simplificação adotada: tudo é sequencial

Os marcadores `superset`/`circuito` **não são respeitados ainda** nesta
tela — todo item de `treino.exercicios` é executado em sequência, na
ordem de `ordem`, um de cada vez. Isso é uma simplificação deliberada: o
comportamento de intercalar exercícios de um superset, ou de repetir uma
volta inteira de circuito, fica para uma iteração futura (ver seção 10).
O que já é tratado corretamente é o exercício substituto (`alternativas`,
seção 8.2).

### 8.2 Montagem da fila de execução ("slots")

A página constrói, a partir de `treino.exercicios` (ordenado por
`ordem`), uma lista sequencial de **slots**: cada slot é um "posto" a
cumprir, com uma ou mais **opções** de exercício (o item principal e,
se houver, suas alternativas):

```js
function construirSlots(treino) {
  return [...treino.exercicios]
    .sort((a, b) => a.ordem - b.ordem)
    .map((item) => ({
      exercicioId: item.exercicioId,
      opcoes: [
        { exercicioId: item.exercicioId, prescricao: item.prescricao },
        ...(item.alternativas || []).map((alt) => ({
          exercicioId: alt.exercicioId,
          prescricao: alt.prescricao || item.prescricao
        }))
      ]
    }));
}
```

Cada alternativa herda a `prescricao` do item principal quando não
declara a própria (ver seção 10.10 de
[especificacao-biblioteca-exercicios.md](./especificacao-biblioteca-exercicios.md)).

`treino_exercicios.html` usa o `exercicioId` de cada item/alternativa
diretamente para montar o link de cada card — ver seção 6.2.

Assim que os slots são montados, a página dispara
`prefetchImagensDoTreino` (`js/imagem-exercicio.js`) com o `exercicioId`
de toda opção (item principal + alternativas) do treino — cada imagem
(uma só por `exercicioId`, sem variante de gênero, ver seção 2.1 de
[especificacao-biblioteca-exercicios.md](./especificacao-biblioteca-exercicios.md))
vira uma requisição que o
`sw.js` intercepta e guarda no cache (rede-primeiro-com-reserva-em-cache,
mesmo mecanismo do app shell, ver
[pwa-offline-especificacao.md](./pwa-offline-especificacao.md#4-estratégia-rede-primeiro-cache-como-reserva)).
Sem isso, só a imagem do exercício exibido no momento carregava (seção
8.4) — as dos exercícios seguintes só seriam buscadas quando o aluno
chegasse neles, o que falha se a rede cair no meio do treino. Diferente
do pré-carregamento de vídeo (biblioteca inteira, seção 8 de
[torrent-videos-especificacao.md](./torrent-videos-especificacao.md)),
aqui o escopo é só os exercícios deste treino — a pasta de imagens já
passa de 40 MB, então baixar a biblioteca inteira de uma vez seria
desperdício. `treino_exercicios.html` (seção 6.2) já cobre isso hoje sem
precisar dessa função: como monta um card por item/alternativa de uma
vez, cada `ligarImagemExercicio` já dispara o carregamento daquela
imagem como efeito colateral.

### 8.2.1 Pular direto para um exercício (`?exercicio=` e `?opcao=`)

Além de `?treino=<id>`, a página aceita `?exercicio=<exercicioId>` e,
opcionalmente, `?opcao=<opcaoExercicioId>` (usado por `treino_exercicios.html`
ao linkar um card específico). Quando presentes e válidos:

1. Carrega/retoma o progresso salvo normalmente (seção 8.3).
2. Sobrescreve `exercicioId`/`opcaoExercicioId` com os valores da URL e
   zera `serieAtual` para `1` (o `iniciadoEm` é preservado, seja de um
   progresso retomado ou recém-criado).
3. Salva esse estado e limpa `exercicio`/`opcao` da URL com
   `history.replaceState`, para que um reload da página não repita o
   salto e perca o progresso feito depois dele.

Se o `exercicioId`/`opcaoExercicioId` da URL não existir mais no treino, o
parâmetro é ignorado — a execução segue de onde estava.

### 8.3 Estado da execução

Guardado em `localStorage`, chave `execucao.musculacao.<treinoId>.v2`
(ver [armazenamento-local-especificacao.md](./armazenamento-local-especificacao.md)):

```json
{
  "exercicioId": "agachamento-sumo-com-halter",
  "opcaoExercicioId": "agachamento-sumo-com-halter",
  "serieAtual": 3,
  "iniciadoEm": "2026-07-15T18:00:00.000Z",
  "tempoAcumuladoSegundos": 340
}
```

- `exercicioId`: identifica o slot atual (o `exercicioId` do item
  principal daquele posto na lista de 8.2) — **não** é mais um índice
  posicional, então continua válido mesmo se a ordem do plano mudar entre
  uma sessão e outra.
- `opcaoExercicioId`: qual opção do slot está sendo usada agora (igual a
  `exercicioId` = item original; um `exercicioId` de alternativa =
  substituto em uso).
- `serieAtual`: número da série pendente dentro do slot/opção atual
  (1-indexado).
- `iniciadoEm`: quando o treino começou — preservado entre reloads, usado
  para calcular a duração total na conclusão (seção 8.6).
- `tempoAcumuladoSegundos`: tempo (séries + descansos) acumulado no
  exercício atual, persistido pra sobreviver a um reload no meio do
  exercício.

Ao abrir a página com `?treino=<id>`, se já existir estado salvo para
esse `treinoId` e o `exercicioId`/`opcaoExercicioId` ainda existirem no
treino, a execução **retoma** de onde parou (permite fechar o navegador
no meio do treino sem perder o progresso). Caso contrário (nunca
começou, ou o exercício salvo não existe mais no plano), começa do
primeiro slot e salva esse estado inicial imediatamente.

### 8.4 Tela do exercício atual

Para a opção atual do slot atual, mostrar:

- Nome do exercício (com link para o vídeo, via
  `bibliotecas.exercicios[exercicioId].midia`) e grupos musculares, com um
  botão "ⓘ" ao lado do nome (`js/detalhes-modal.js#criarDetalhesModal`) que
  abre um overlay com descrição (posição inicial/movimento/posição final),
  grupos musculares detalhados (principais/secundários/estabilizadores),
  equipamentos, instruções de execução, respiração, erros comuns,
  cuidados e restrições do exercício atual — mesmo componente
  reaproveitado em `treino_novo.html` (picker de busca e lista de
  exercícios já adicionados) e no motor de alongamento
  ([treino-alongamento-especificacao.md](./treino-alongamento-especificacao.md)).
  O overlay também tem um botão "Ver vídeo" (`ligarBotaoVideo`, quando
  `midia.videoMagnet`/`.videoUrl` existir — reaproveita o mesmo
  `videoModal` já criado pela página) e, ao final, a imagem do exercício
  (`caminhoImagemExercicio`, oculta quando ainda não existe uma gerada).
- Imagem do exercício (`#imagemExercicio`, `js/imagem-exercicio.js`),
  **sempre visível** na tela (não atrás de um botão, diferente do vídeo) —
  atualizada a cada troca de exercício/opção/slot e também na tela de
  descanso (mostra a imagem do próximo exercício, seção 8.6). Fica oculta
  quando não existe imagem gerada para aquele `exercicioId`, e também na
  tela de conclusão do treino (seção 8.7).
- "Série `serieAtual` de `prescricao.series`".
- Alvo da série, formatado conforme `prescricao.metrica` (mesma regra
  da seção 3.4.2 deste documento).
- Nota de isometria, se `prescricao.tecnicas` contiver `{tipo:
  "isometria"}` (mesma regra da seção 5), construída a partir dos
  parâmetros daquele item.
- Campo **Carga (kg)** — numérico, opcional, **editável desde que a tela
  abre**, sem precisar apertar nenhum botão antes. Pré-preenchido com
  `cargaKg` do registro mais recente desse `exercicioId` em
  `historico.serieMusculacao.v1` (não importa de qual treino/dia — é o
  último peso usado nesse exercício, período). Como cada série já vira
  um registro no histórico assim que é concluída (seção 8.5), esse
  mesmo mecanismo cobre tanto "repetir o peso da série anterior, na
  mesma execução" quanto "lembrar o peso de uma execução passada, dias
  atrás".
- Campo **Repetições realizadas** — mesma ideia: editável desde o
  início, pré-preenchido com a última `repeticoes` registrada para esse
  `exercicioId`; **omitido** quando `prescricao.metrica.tipo === "tempo"`
  (série por tempo não tem contagem de repetição).
- Botão único de cronômetro da série, que troca de rótulo conforme o
  estado (`serieRodando`/`serieJaIniciada`):
  - **"▶ Começar série"** (estado inicial, antes de qualquer toque).
    Ao tocar, chama `alternarSerie()`: liga `serieRodando`, guarda
    `serieUltimoInicio = Date.now()`, mostra o cronômetro (a partir de
    `00:00`, contando pra cima) e revela o botão **"Concluir série"**
    (fica escondido até esse primeiro toque — não dá pra concluir uma
    série que nunca foi iniciada).
  - **"⏸ Pausar"** (enquanto `serieRodando` é `true`). Ao tocar, soma o
    tempo decorrido a `serieSegundosAcumulados`, desliga `serieRodando`
    e para o intervalo — o cronômetro para de contar, mas mantém o
    valor acumulado na tela.
  - **"▶ Continuar"** (depois de pausar pelo menos uma vez). Ao tocar,
    volta pro comportamento de "▶ Começar série" (liga `serieRodando`,
    novo `serieUltimoInicio`), sem zerar `serieSegundosAcumulados`.
  - Nada disso é salvo em `localStorage` — é só de tela, mesma decisão
    já tomada para o cronômetro de descanso (seção 8.6). Um reload no
    meio de uma série volta pro estado inicial ("▶ Começar série",
    cronômetro zerado).
- Botão **"Usar substituto: `<nome>`"**, mostrado apenas quando o slot
  tem mais de uma opção. Ao tocar, cicla para a próxima opção do slot
  (round-robin pelas opções) e reinicia `serieAtual` para `1`, já que a
  opção nova pode ter `prescricao` diferente da anterior.
- Stepper **"‹ Exercício `slotIndex + 1` de `slots.length` ›"** acima do
  card (`slotIndex` calculado a partir do `exercicioId` salvo, não
  guardado como número), com um botão de cada lado
  (`exercicioAnterior`/`exercicioProximo`) para navegar manualmente
  entre exercícios sem precisar concluir as séries do atual. Cada toque
  troca `exercicioId`/`opcaoExercicioId` pro novo slot, zera
  `serieAtual` pra `1` (mesma regra do salto por URL da seção 8.2.1) e
  salva o progresso — **sem** gravar nenhuma entrada em
  `historico.serieMusculacao.v1`, já que nenhuma série foi de fato
  concluída. O botão fica desabilitado no primeiro e no último exercício
  do treino. Não aparece na tela de descanso (seção 8.6), só na do
  exercício.

### 8.5 Ao concluir uma série

1. Para o cronômetro da série e calcula `duracaoSegundos` a partir de
   `serieSegundosAcumulados` (que já exclui o tempo em que ficou
   pausada — seção 8.4). Na prática só chega aqui depois de ter
   iniciado pelo menos uma vez, já que o botão "Concluir série" só
   aparece depois do primeiro toque em "▶ Começar série" (seção 8.4).
2. Grava um registro em `historico.serieMusculacao.v1`:

   ```json
   {
     "treinoId": "treino-a",
     "treinoNome": "Treino A",
     "exercicioId": "supino-reto-com-halter",
     "exercicioNome": "Supino reto com halter",
     "serie": 1,
     "cargaKg": 8,
     "repeticoes": 18,
     "duracaoSegundos": 42,
     "dataHora": "2026-07-15T18:03:12.000Z"
   }
   ```

   `cargaKg` e `repeticoes` vão como `null` quando o campo correspondente
   ficou em branco (ou não existe, no caso de métrica por tempo).
   `exercicioNome` é denormalizado a partir da biblioteca no momento do
   registro — sobrevive independente de futuras mudanças no cadastro do
   exercício. `duracaoSegundos` é o tempo entre tocar "Começar série"
   (seção 8.4) e "Concluir série" — quanto tempo a série em si levou, sem
   contar o descanso.
3. Se `serieAtual < prescricao.series`: incrementa `serieAtual`, continua
   no mesmo slot/opção (mesmo exercício, próxima série) e entra na tela
   de descanso (seção 8.6) em vez de mostrar a próxima série direto.
4. Senão (era a última série do slot):
   - Se houver próximo slot: avança pro `exercicioId`/`opcaoExercicioId`
     do próximo slot, `serieAtual = 1`, e também entra na tela de
     descanso (seção 8.6).
   - Se era o último slot: encerra o treino (seção 8.7) — sem tela de
     descanso, o treino já acabou.
5. Salva o novo estado em `execucao.musculacao.<treinoId>.v2` (exceto no
   caso de encerramento, onde a chave é removida — ver 8.7).

### 8.6 Tela de descanso

Ao entrar em descanso (passo 2/3 acima), a tela troca a área do exercício
por um cronômetro contando **para cima**, a partir de `00:00`, junto com
o nome/série do próximo exercício (já refletindo o estado avançado no
passo anterior). A contagem só termina quando o aluno toca em **"Iniciar
série"** — não há avanço automático.

Os alvos vêm de `prescricao.descansoSegundos` do item atual quando
definido (mín. = máx. = esse valor); senão, de
`orientacoesGerais.descansoPadrao.{minSegundos,maxSegundos}` (o mesmo
texto exibido no "Guia rápido" de `treino_exercicios.html`, seção 3.3
deste documento); na ausência de ambos, 60–120s:

- Ao atingir o mínimo: toca um sinal sonoro (três bipes iguais, mesmo
  tom) + vibração curta, e o cronômetro muda de cor (indicando "já pode
  voltar"). Esse sinal toca uma única vez.
- Nos últimos 10 segundos antes do máximo: toca um bipe curto e leve, um
  por segundo — uma contagem regressiva avisando que a pausa máxima está
  chegando. Sem vibração nem flash de tela, pra não ficar exagerado
  repetindo 10 vezes seguidas.
- Ao atingir o máximo: toca um sinal parecido ao do mínimo, porém mais
  forte (bipes mais longos e mais altos, vibração mais intensa) e o
  cronômetro muda para uma cor de alerta. Também toca uma única vez.
- Depois do máximo, a contagem continua normalmente — os sinais não se
  repetem, só marcam a transição de cada limite.

Tocar em "Iniciar série" para o cronômetro, esconde a tela de descanso e
mostra a tela do próximo exercício/série (seção 8.4) normalmente.

Essa contagem de descanso é só de tela (estado em memória) — não é salva
em `localStorage`; se a página for recarregada no meio de um descanso, a
execução retoma direto na tela do próximo exercício (sem repetir o
cronômetro).

### 8.7 Conclusão do treino

Quando a última série do último slot é concluída:

- Grava um resumo em `historico.sessaoMusculacao.v1`:

  ```json
  {
    "treinoId": "treino-a",
    "treinoNome": "Treino A",
    "iniciadoEm": "2026-07-15T18:00:00.000Z",
    "concluidoEm": "2026-07-15T18:41:32.000Z",
    "duracaoSegundos": 2492,
    "totalSlots": 9
  }
  ```

  `duracaoSegundos` é `concluidoEm - iniciadoEm` (tempo de relógio real,
  diferente da bike — aqui não há como distinguir pausa de execução, já
  que a tela não tem cronômetro rodando).

- Remove a chave `execucao.musculacao.<treinoId>.v2` (não há mais
  progresso em aberto para retomar).
- Mostra uma tela de conclusão simples ("Treino concluído 🎉") com link
  de volta para `treino_exercicios_menu.html`.

### 8.8 Erros

Mesmo padrão das demais páginas: sem `?treino=` na URL, `id` inexistente,
plano não carregado, biblioteca não carregada, ou treino com
`exercicios` vazio → tela de erro/estado com link de volta ao menu, sem
tentar montar a fila de execução.

## 9. Progresso do exercício (`treino_exercicio_progresso.html`)

Tela acessível pelo botão "Ver progresso" de qualquer card de exercício
(seção 6.2). Mostra o histórico de séries de **um exercício específico**
(`exercicioId`), agregando `historico.serieMusculacao.v1` de **todos os
treinos** em que ele aparece — não só o treino a partir do qual o botão
foi clicado (o parâmetro `?treino=<id>` na URL só serve para montar o
link "Voltar"). Como o histórico já denormaliza `exercicioNome`, esta
página só precisa da biblioteca (via `carregarBiblioteca()`) para o
título — não depende do plano de treino estar carregado.

### 9.1 Agrupamento por sessão

Os registros de série não têm um identificador de "sessão" explícito, só
`treinoId` e `dataHora`. A página deriva sessões assim: ordena as
entradas por `dataHora` e agrupa em blocos consecutivos que compartilham
`treinoId` **e** a mesma data local (`AAAA-MM-DD`). Ou seja, "muda de
treino" tanto quando `treinoId` muda quanto quando o mesmo `treinoId`
aparece de novo num dia diferente. Cada grupo resultante recebe um
índice alternado (`0`, `1`, `0`, `1`...) usado para colorir tanto o
gráfico quanto a tabela — sessões vizinhas sempre ficam com cores
diferentes.

Limitação aceita: se o mesmo treino for repetido duas vezes no mesmo dia
(ex.: manhã e noite), as duas execuções caem no mesmo grupo/cor — caso
raro, não tratado agora.

### 9.2 Duas abas

- **Gráfico** (aba inicial): renderizado com [D3.js](https://d3js.org/)
  (`d3-scale`, `d3-axis`, data joins) manipulando o `<svg id="grafico">`.
  A biblioteca fica **vendorizada localmente** em `d3.v7.min.js` na raiz
  do repositório (baixada de `https://d3js.org/d3.v7.min.js`, incluída
  via `<script src="d3.v7.min.js">`) em vez de carregada de um CDN — o
  site continua funcionando offline, igual ao resto das páginas. Eixo X
  é a data (`dataHora`) em escala de tempo (`d3.scaleTime`) contínua —
  sessões próximas no tempo ficam com pontos próximos, intervalos sem
  treino aparecem como espaço vazio no eixo.
  - Eixo Y esquerdo: `cargaKg` (pontos verde-limão).
  - Eixo Y direito: `repeticoes` (pontos azuis).
  - Cada ponto é uma série (`historico.serieMusculacao.v1` filtrado por
    `exercicioId`); entradas com `cargaKg`/`repeticoes` nulos simplesmente
    não geram ponto naquele eixo (uma série de "tempo" sem repetição, por
    exemplo, só aparece no eixo de carga, se tiver carga).
  - A cor de cada ponto usa o hue fixo do eixo (verde para carga, azul
    para repetições) com opacidade alternada pelo índice de grupo da
    sessão (`0` = opaco, `1` = translúcido) — é o "cor sim, cor não" do
    pedido original.
  - Cada `<circle>` tem um `<title>` (tooltip nativo do navegador ao
    passar o mouse) com data/hora, treino, série e valor.
- **Tabela**: mesmos dados, uma linha de cabeçalho por sessão (nome do
  treino + data) seguida das séries daquela sessão (série, carga,
  repetições, hora). A cor do grupo aparece como uma borda esquerda de
  4px + fundo leve, usando `borda`/`fundo` do mesmo par de cores do
  índice de grupo (lima para índice `0`, azul para índice `1` — aqui a
  cor marca a sessão, não o eixo, já que a tabela já tem colunas
  separadas para carga e repetições).

### 9.3 Estado vazio

Se não houver nenhuma entrada em `historico.serieMusculacao.v1` para o
`exercicioId` (aluno nunca completou uma série desse exercício pela
execução guiada), mostra uma mensagem única ("Nenhuma série registrada
ainda...") e não renderiza as abas.

## 10. Fora de escopo

- Renderização de exercícios do tipo `flexibilidade` (JSON ainda não tem
  nenhum exercício cadastrado para esse tipo).
- Respeitar `superset`/`circuito` na execução guiada — por ora tudo é
  sequencial (seção 8.1).
- Edição de treino existente pela interface — só criação de treino novo
  (seção 11). Aquecimento, cardio complementar e alternativas de um
  treino continuam editáveis só no JSON; a biblioteca é versionada no
  repositório, também sem editor na interface.
- Painel de totais/relatórios agregando *todos* os exercícios (volume
  semanal, recordes pessoais etc.) — a seção 9 cobre progresso de um
  exercício por vez, não uma visão consolidada (ver
  [armazenamento-local-especificacao.md](./armazenamento-local-especificacao.md#7-fora-de-escopo)).
- Editar/apagar uma série já registrada, ou reiniciar um treino em
  andamento pela interface (dá para destravar manualmente limpando o
  `localStorage`).
- Detectar sessões repetidas do mesmo treino no mesmo dia (seção 9.1) —
  hoje caem no mesmo grupo/cor.
- Persistir o cronômetro de uma série em andamento
  (`serieSegundosAcumulados`/`serieRodando`, seção 8.4) no
  `localStorage` — é só de tela, igual ao cronômetro de descanso (seção
  8.6). Um reload no meio de uma série volta pro estado "▶ Começar
  série" daquele exercício, com o cronômetro zerado (a série anterior,
  se já tinha sido concluída, continua salva normalmente).

## 11. Criar treino novo (`treino_novo.html`)

Primeira tela de edição do plano pela interface: monta um treino do zero
e anexa a `dados.treinos`. Acessível por um botão "+" no cabeçalho de
`treino_exercicios_menu.html` (`.icon-btn`, mesma aparência do
`voltar-icon`, alinhado à direita).

### 11.1 Carregamento

Como qualquer outra página, carrega o plano
(`TreinosStorage.carregarDadosTreinos()`) e a biblioteca
(`carregarBiblioteca()`) — sem plano ativo, mostra erro apontando pra
`planos.html` (não dá pra criar um treino "solto", sem
`metadata`/`distribuicaoSemanal`/`orientacoesGerais` de um plano
existente).

### 11.2 Formulário

- **Nome** (texto, obrigatório) e **Tipo** (select com os quatro valores
  de `treino.tipo`, seção 4).
- Lista dos exercícios já adicionados nesta sessão (em memória, só grava
  no plano ao salvar): nome (com botão "ⓘ" ao lado, ver seção 8.4) resumo
  da prescrição (`PrescricaoFormatadores.metrica`), marcador de
  superset/circuito se houver. Cada item tem botões pra mover pra
  cima/baixo (recalcula `ordem` em passos de 10), editar (reabre o
  formulário de prescrição pré-preenchido) e remover.
- Botão "+ Adicionar exercício" abre o modal de busca.

### 11.3 Modal de busca e prescrição

Dois passos dentro do mesmo `.overlay`:

1. **Busca**: texto livre (nome/aliases/tags, normalizado — minúsculas e
   sem acento) + três filtros de múltipla seleção (grupo muscular,
   equipamento, categoria de `classificacao.categoria`, rótulos em
   `LABEL_CATEGORIA_EXERCICIO` de `js/constantes.js`) — cada um é um botão
   que revela um painel de checkboxes roláveis (não um `<select multiple>`:
   esse exige ctrl/cmd+clique pra selecionar mais de um item, inviável por
   toque no celular), combinando por OU dentro do mesmo filtro e por E
   entre filtros diferentes. Botão "Limpar filtros" zera busca e todas as
   seleções. Filtragem client-side contra toda a biblioteca. Cada
   resultado tem um botão "ⓘ" (`js/detalhes-modal.js#criarDetalhesModal`,
   `event.stopPropagation()` pra não selecionar o exercício) que mostra
   descrição, grupos musculares detalhados, equipamentos, execução,
   restrições, vídeo (se houver) e a imagem do exercício (ao final) antes
   de decidir adicionar — a tela ganha seu próprio `#videoOverlay`
   (`criarVideoPlayerModal()`) só pra isso, já que o formulário de
   prescrição em si não tem vídeo. Clicar no resto do resultado
   abre o passo 2 pra aquele exercício.
2. **Prescrição**: séries; métrica (tipo limitado a
   `exercicio.metricas.permitidas`, modo faixa/fixo/máximo — unidade é
   automática, não editável); descanso em segundos (opcional, vazio usa
   o padrão do plano); isometria (checkbox que revela
   duração/posição/momento/últimas séries); agrupamento (nenhum/superset/
   circuito + número). O título deste passo (nome do exercício) também
   tem o botão "ⓘ". Botão "Adicionar" empurra o item pra lista em
   memória e volta pro passo 1 (permite adicionar vários sem fechar o
   modal); editar um item já adicionado abre direto no passo 2, com o
   botão virando "Salvar" e fechando o modal ao confirmar.

### 11.4 Salvar

Ao clicar "Salvar treino": valida nome preenchido, gera `id`
(`js/identificadores.js#gerarIdUnico`, nome normalizado/sem acento,
espaços viram hífen, dedupe contra `dados.treinos` existente com sufixo
`-2`, `-3`...), monta o objeto do treino (`aquecimento: null`, `cardio: []`,
`alongamento: []`, `alternativas: []` em cada item — anexar um treino de
cardio/alongamento existente como complementar fica fora de escopo desta
tela, editável só no JSON depois (seção 12.3 de
[especificacao-biblioteca-exercicios.md](./especificacao-biblioteca-exercicios.md));
`configuracaoCircuito` setado automaticamente se algum item usar
`circuito`; `status: "ativo"` com pelo menos um exercício, `"rascunho"`
sem nenhum), empurra em `dados.treinos` e regrava o plano inteiro com
`TreinosStorage.definirDadosTreinos(dados)` — mesma função já usada por
`plano-novo.js`/`planos.js` pra criar/importar um plano, sem mudar
assinatura. Redireciona pra `treino_exercicios.html?treino=<id>`.

### 11.5 Fora de escopo desta tela

- Editar um treino já existente — só criação nova.
- Configurar aquecimento, cardio complementar e alternativas — ficam
  vazios/nulos, editáveis só no JSON.
- Cadastrar exercício novo na biblioteca — a tela só consulta
  `biblioteca-exercicios.json`, nunca escreve nela.
- Atribuir o treino num dia da semana (`distribuicaoSemanal`).
