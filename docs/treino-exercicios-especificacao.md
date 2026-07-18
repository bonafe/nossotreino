# Especificação — Páginas de Exercícios (Musculação / Peso do Corpo / Funcional)

## 1. Objetivo

Hoje só existe o treino de bicicleta como página navegável. Esta especificação
descreve a estrutura de `dados/dados_treinos.json` e como transformá-la em
páginas de exercícios (musculação, peso do corpo, funcional e flexibilidade),
seguindo o mesmo padrão de "motor genérico + JSON de dados" já usado no
[treino de bicicleta](./treino-bicicleta-especificacao.md).

## 2. Fonte de dados

- Arquivo local de referência: `dados/dados_treinos.json`. Assim como
  `referencias/`, a pasta `dados/` está no `.gitignore`: contém dados
  pessoais do plano de treino (nome do professor, do aluno, datas do
  ciclo), então nunca é versionado nem publicado junto com o site.
- As páginas/código que leem esse arquivo são genéricas e versionadas
  normalmente; só o conteúdo (`dados/dados_treinos.json`) é pessoal e fica de
  fora do repositório. É a **única** fonte de dados de treino do site — os
  treinos de bicicleta também são derivados dele (ver seção 4 de
  [treino-bicicleta-especificacao.md](./treino-bicicleta-especificacao.md)),
  não existe mais um JSON separado por tipo de treino.
- **As páginas não buscam esse arquivo via `fetch`** — como ele nunca é
  publicado, um `fetch` relativo só funcionaria em desenvolvimento local
  e falharia sempre numa versão publicada do site. Em vez disso, todo
  carregamento passa por `TreinosStorage.carregarDadosTreinos()` (ver
  [armazenamento-local-especificacao.md](./armazenamento-local-especificacao.md)),
  que lê exclusivamente do `localStorage`. Os dados só chegam lá através
  de [importar_dados.html](../importar_dados.html), onde o aluno cola ou
  escolhe o arquivo `dados_treinos.json` manualmente uma vez por
  navegador/aparelho.

## 3. Estrutura do JSON

### 3.1 `metadata`

Dados descritivos do ciclo de treino atual — não afetam a lógica de
renderização, mas podem aparecer num cabeçalho/rodapé:

| Campo | Tipo | Descrição |
|---|---|---|
| `professor` | string | Nome de quem prescreveu o treino |
| `consultoria` | string | Nome da consultoria/empresa |
| `aluno` | string | Nome do aluno |
| `planejamento.inicio` / `planejamento.fim` | string (`YYYY-MM-DD`) | Vigência do ciclo |
| `objetivos` | string[] | Lista de objetivos do ciclo |

### 3.2 `distribuicaoSemanal`

Array de 7 posições, uma por dia da semana, mapeando dia → treino:

```json
{ "dia": "segunda", "treinoId": "treino-a" }
```

- `dia`: `"segunda"` … `"domingo"`.
- `treinoId`: `id` de um item em `treinos`, ou `null` quando o dia é de
  descanso.

Serve para montar uma visão "treino de hoje" ou um calendário semanal.

### 3.3 `guia`

Bloco de regras textuais, válidas para todos os treinos de musculação/peso do
corpo, que devem virar texto de ajuda fixo na UI (não mudam por treino):

| Campo | Regra |
|---|---|
| `ajusteCarga` | Como ajustar peso conforme repetições realizadas |
| `cadencia` | Ritmo padrão de execução (concêntrica rápida, excêntrica lenta) |
| `pausaSegundos.min` / `.max` | Faixa de descanso padrão entre séries |
| `corCinza` | Explica que itens com `substituto: true` são alternativas ao exercício anterior |
| `superSet` | Explica o agrupamento `superset` |
| `isometria` | Explica a técnica `isometria` (hold de 20s a 50% de amplitude, nas duas últimas séries) |
| `circuito` | Explica o agrupamento `circuito` |

### 3.4 `aquecimentoPadrao`

```json
{ "videoUrl": "...", "texto": "..." }
```

Aquecimento reutilizado por qualquer treino cujo `aquecimento.usaPadrao` seja
`true` (ver 3.7).

### 3.5 `exercicios`

Dicionário `exercicioId → { nome, videoUrl }`. É a tabela de referência de
todos os exercícios citados nos treinos; os blocos dos treinos armazenam
apenas o `exercicioId` (chave deste dicionário), não o nome/vídeo repetido.

### 3.6 `cardios`

Dicionário `cardioId → { nome, exercicio, series, tempoEstimulo.segundos,
recuperacao.segundos, intensidadeEstimulo, intensidadeRecuperacao }` — o
mesmo padrão de "dicionário de referência" de `exercicios` (3.5), só que
para cardio complementar:

```json
"cardio-a": {
  "nome": "Cardio A",
  "exercicio": "Bicicleta",
  "series": 15,
  "tempoEstimulo": { "segundos": 30 },
  "recuperacao": { "segundos": 30 },
  "intensidadeEstimulo": "maxima",
  "intensidadeRecuperacao": "leve"
}
```

- `nome`: identidade própria do cardio, independente do(s) treino(s) que o
  referenciam via `cardioId` (3.7) — pode em tese ser reaproveitado por mais
  de um treino, do mesmo jeito que um `exercicioId` pode aparecer em vários
  treinos.
- `exercicio`: hoje só existe `"Bicicleta"`, mas o campo já existe para
  distinguir tipos de cardio no futuro (esteira, elíptico...). É o campo que
  `treino_bicicleta_menu.html` usa pra filtrar quais entradas de `cardios`
  aparecem no menu de bicicleta (`cardio.exercicio === "Bicicleta"`) — ver
  seção 5.1 de
  [treino-bicicleta-especificacao.md](./treino-bicicleta-especificacao.md).
- `series`/`tempoEstimulo.segundos`/`recuperacao.segundos`/
  `intensidadeEstimulo`/`intensidadeRecuperacao`: mesmos parâmetros do motor
  de bicicleta (seção 2 de
  [treino-bicicleta-especificacao.md](./treino-bicicleta-especificacao.md)),
  só que aninhados em objetos (`tempoEstimulo.segundos` em vez de
  `tempoEstimuloSegundos`).

Uma entrada em `cardios` não precisa ser referenciada por nenhum treino pra
aparecer no menu de bicicleta — o menu lê `cardios` direto, não via
`treinos[].cardioId`.

### 3.7 `treinos`

Array de treinos. Cada treino:

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | string | Identificador único, usado em `distribuicaoSemanal` e em rotas (`?treino=<id>`) |
| `nome` | string | Nome exibido |
| `tipo` | `"musculacao"` \| `"peso-do-corpo"` \| `"funcional"` \| `"flexibilidade"` | Ver seção 4 |
| `aquecimento` | `null` \| `{ usaPadrao: bool, extra?: string }` | Se `null`, treino não tem tela de aquecimento |
| `blocos` | array de bloco (abaixo) | Pode ser `[]` (treino ainda sem exercícios definidos) |
| `cardioId` | string, opcional, só em alguns `musculacao` | Chave em `cardios` (3.6); ausente quando o treino não tem cardio complementar |

#### 3.7.1 Bloco

```json
{
  "grupo": 1,
  "tipoAgrupamento": "superset",
  "itens": [ ... ]
}
```

- `grupo`: número do bloco dentro do treino, ou `null` quando não se aplica
  (treinos `peso-do-corpo` com um único bloco sequencial).
- `tipoAgrupamento`: `"superset"` (fazer os itens em sequência combinando
  séries), `"sequencial"` (fazer um exercício por vez, do jeito que aparece)
  ou `"circuito"` (rodar todos os itens do bloco uma série por vez antes de
  repetir).

#### 3.7.2 Item (exercício dentro de um bloco)

| Campo | Tipo | Descrição |
|---|---|---|
| `exercicioId` | string | Chave em `exercicios` |
| `grupoMuscular.principal` / `.sinergista1` / `.sinergista2` | string, todos opcionais | Pode ser objeto vazio `{}` |
| `series` | number | Quantidade de séries |
| `repeticoes.modo` | `"faixa"` \| `"maximo"` \| `"tempo"` | Ver tabela abaixo |
| `repeticoes.min` / `.max` | number, só quando `modo: "faixa"` | Faixa de repetições |
| `repeticoes.segundos` | number, só quando `modo: "tempo"` | Duração da série |
| `tecnica` | `"tradicional"` \| `"isometria"` | Se `"isometria"`, aplicar regra `guia.isometria` |
| `substituto` | boolean | Se `true`, é alternativa ao item anterior do mesmo bloco (exibir em cinza, conforme `guia.corCinza`) |

Renderização de `repeticoes` conforme `modo`:

| `modo` | Exibição sugerida |
|---|---|
| `faixa` | "`min` a `max` repetições" |
| `maximo` | "até a falha / máximo de repetições" |
| `tempo` | "`segundos` segundos" |

#### 3.7.3 `cardioId` (opcional)

Chave em `cardios` (seção 3.6). Quando presente, o treino tem um cardio
complementar executado ao final da musculação — a página busca
`dados.cardios[treino.cardioId]` pra saber os parâmetros e monta o link
pra `treino_bicicleta.html?cardio=<cardioId>` (não `?treino=<id>` — o
motor de bicicleta é endereçado por `cardioId`, não pelo `id` do treino de
musculação; ver seção 4 de
[treino-bicicleta-especificacao.md](./treino-bicicleta-especificacao.md)).

## 4. Tipos de treino (`tipo`)

| `tipo` | `aquecimento` | `tipoAgrupamento` típico | `cardioId` |
|---|---|---|---|
| `musculacao` | `{ usaPadrao: true, extra? }` | `superset` | às vezes presente |
| `peso-do-corpo` | `{ usaPadrao: true }` | `sequencial`, `grupo: null` | não observado |
| `funcional` | `null` (sem tela de aquecimento) | `circuito` | não observado |
| `flexibilidade` | `{ usaPadrao: true }` | `blocos: []` atualmente | não observado |

`flexibilidade` hoje não tem nenhum bloco/exercício definido no JSON — a
página deve lidar com esse caso (ex.: mensagem "sem exercícios cadastrados"),
sem quebrar.

## 5. Regras de negócio a refletir na UI

- **Cor cinza** (`guia.corCinza`): item com `substituto: true` renderizado em
  cinza/esmaecido, indicando que é opção alternativa ao item anterior no
  mesmo bloco (não soma série extra).
- **Superset** (`guia.superSet`): itens de um bloco `tipoAgrupamento:
  "superset"` devem ser sinalizados como "fazer em sequência", agrupados
  visualmente.
- **Circuito** (`guia.circuito`): itens de um bloco `tipoAgrupamento:
  "circuito"` são feitos um após o outro, uma série de cada, repetindo o
  ciclo pelo número de `series`; descanso só entre voltas completas do
  circuito, não entre exercícios.
- **Isometria** (`guia.isometria`): item com `tecnica: "isometria"` deve
  indicar visualmente (ex. destaque azul, como já citado no texto do guia)
  que nas duas últimas séries é preciso segurar isometria de 20s a 50% da
  amplitude ao final da série.
- **Pausa padrão** (`guia.pausaSegundos`): usada como referência de descanso
  entre séries quando não há regra mais específica (ex. circuito).
- **Cadência** (`guia.cadencia`) e **ajuste de carga**
  (`guia.ajusteCarga`): textos informativos, exibidos uma vez (não por
  exercício).
- **Aquecimento**: se `aquecimento` for `null`, não mostrar etapa de
  aquecimento. Se `usaPadrao: true`, mostrar `aquecimentoPadrao` (vídeo +
  texto); se além disso houver `aquecimento.extra`, mostrar esse texto
  complementar também.
- **Grupo muscular**: exibir apenas os campos presentes (`principal`,
  `sinergista1`, `sinergista2` são todos opcionais).

## 6. Telas / fluxo propostas

```
index.html
   └─> treino_exercicios_menu.html   (lista treinos de dados/dados_treinos.json)
          └─> treino_exercicios.html?treino=<id>   (exibe aquecimento, blocos e itens do treino)
                 └─> treino_execucao.html?treino=<id>   (execução guiada, um exercício por vez — ver seção 8)
```

### 6.1 Menu (`treino_exercicios_menu.html`)

A primeira coisa exibida na tela, antes da lista de treinos, é o gráfico de
histórico (seção 6.1.1). A lista de treinos vem depois.

- Lê `dados/dados_treinos.json` (arquivo único; diferente da bicicleta, não
  precisa de um `indice.json` separado — a lista de treinos já está em
  `treinos`).
- Mostra um cartão por treino com `nome` e `tipo`; opcionalmente pode marcar
  qual treino é o de hoje usando `distribuicaoSemanal` + dia atual.
- Cada cartão é um link para `treino_exercicios.html?treino=<id>`.

#### 6.1.1 Gráfico de histórico (tempo total de exercícios)

Mesmo esquema do gráfico de bike (seção 5.1.1 de
[treino-bicicleta-especificacao.md](./treino-bicicleta-especificacao.md#511-gráfico-de-histórico-tempo-de-bicicleta)),
aplicado a `historico.sessaoMusculacao.v1` em vez de
`historico.sessaoBicicleta.v1`: um gráfico de barras (D3.js,
`d3.v7.min.js` vendorizado) logo abaixo do título da tela, com o tempo
total de treino de exercícios (musculação/peso do corpo/funcional/
flexibilidade — qualquer `treino.tipo`, o histórico não distingue) por
dia ou mês.

- **Fonte dos dados**: `historico.sessaoMusculacao.v1`, lido direto com
  `TreinosStorage.lerJSON(...)` — cada barra soma o `duracaoSegundos`
  (seção 8.7) das sessões concluídas naquele dia/mês. Independe de
  `dados/dados_treinos.json` estar carregado, mesma lógica da seção 5.1.1
  da bike.
- **Três períodos**, mesmos botões e mesmos defaults da bike: **7 dias**
  (padrão), **30 dias**, **Meses** (últimos 6 meses). Dias/meses sem
  sessão concluída aparecem como barra vazia — o eixo sempre cobre o
  período inteiro.
- **Tooltip** e **estado vazio** ("Nenhum treino de exercícios registrado
  ainda.") seguem exatamente o mesmo comportamento descrito na seção
  5.1.1 da bike, só trocando a fonte do histórico.
- Mesma cor de barra (`#bef264`), única série.

### 6.2 Página do treino (`treino_exercicios.html`)

- Lê o parâmetro de query `?treino=<id>`.
- Busca os dados via `TreinosStorage.carregarDadosTreinos()`, localiza o
  treino pelo `id` em `treinos` e renderiza aquecimento (se houver),
  blocos/itens e, se `treino.cardioId` existir, o cardio correspondente
  (`dados.cardios[cardioId]`) no final — com um botão "Fazer bicicleta →"
  que leva a `treino_bicicleta.html?cardio=<cardioId>` (ver seção 3.6 e
  3.7.3, e seção 4 de
  [treino-bicicleta-especificacao.md](./treino-bicicleta-especificacao.md)).
- Se não houver `treino` na URL, o `id` não existir, ou não houver dados
  carregados ainda, mostrar mensagem de erro com link de volta para o
  menu (e para `importar_dados.html`, se for o caso) — mesmo
  comportamento já adotado em `treino_bicicleta.html`.
- Quando `treino.blocos` tiver ao menos um item, mostrar um botão que leva
  a `treino_execucao.html?treino=<id>` (seção 8). O texto do botão depende
  de já existir progresso salvo pra esse treino
  (`execucao.musculacao.<id>.v1`, seção 8.3): "Continuar treino →" se
  existir, "Iniciar treino →" caso contrário — mesma checagem de validade
  usada em `treino_execucao.html` (`slotIndex >= 0` e `serieAtual >= 1`).
  Quando `blocos` estiver vazio (`flexibilidade`), o botão não aparece.
- Cada card de exercício é clicável (a caixa inteira, igual ao cartão de
  treino em `treino_exercicios_menu.html`) e leva direto para aquele
  exercício específico em `treino_execucao.html?treino=<id>&exercicio=<slotIndex>&opcao=<opcaoIndex>`
  (`slotIndex`/`opcaoIndex` conforme a montagem de slots da seção 8.2 —
  a página calcula os mesmos índices ao renderizar cada item, na ordem
  em que aparecem nos blocos). Dentro do card, dois botões próprios (cada
  um com `event.stopPropagation()` para não disparar a navegação do
  card): "Ver vídeo" abre `exercicio.videoUrl` numa nova aba; "Ver
  progresso" leva para
  `treino_exercicio_progresso.html?exercicio=<exercicioId>&treino=<treinoId>`
  (seção 9).

## 8. Execução guiada de treino (`treino_execucao.html`)

Tela para fazer o treino "ao vivo": mostra um exercício por vez, deixa
registrar carga e repetições de cada série e avança sozinha para o
próximo exercício.

### 8.1 Simplificação adotada: tudo é sequencial

O `tipoAgrupamento` do bloco (`superset` / `sequencial` / `circuito`) **não
é respeitado ainda** nesta tela — todo item de todo bloco é executado em
sequência, na ordem em que aparece no JSON, um de cada vez. Isso é uma
simplificação deliberada: o comportamento de intercalar exercícios de um
superset, ou de repetir uma volta inteira de circuito, fica para uma
iteração futura (ver seção 9). O que já é tratado corretamente é o
exercício substituto (`substituto: true`, seção 8.2).

### 8.2 Montagem da fila de execução ("slots")

A página constrói, a partir de `treino.blocos`, uma lista sequencial de
**slots**: cada slot é um "posto" a cumprir, com uma ou mais **opções**
de exercício (a original e, se houver, seus substitutos consecutivos):

```js
function construirSlots(treino) {
  const slots = [];
  treino.blocos.forEach((bloco) => {
    bloco.itens.forEach((item) => {
      if (item.substituto && slots.length) {
        slots[slots.length - 1].opcoes.push(item);
      } else {
        slots.push({ opcoes: [item] });
      }
    });
  });
  return slots;
}
```

Cada item com `substituto: true` vira mais uma opção do slot anterior
(nunca um slot próprio), pois no JSON o substituto sempre aparece logo
depois do item que substitui, dentro do mesmo bloco.

`treino_exercicios.html` monta essa mesma numeração de `slotIndex`/
`opcaoIndex` ao renderizar os cards de exercício (percorrendo os blocos na
mesma ordem), para poder linkar cada card ao exercício certo — ver seção
6.2.

### 8.2.1 Pular direto para um exercício (`?exercicio=` e `?opcao=`)

Além de `?treino=<id>`, a página aceita `?exercicio=<slotIndex>` e,
opcionalmente, `?opcao=<opcaoIndex>` (usado por `treino_exercicios.html`
ao linkar um card específico). Quando presentes e válidos:

1. Carrega/retoma o progresso salvo normalmente (seção 8.3).
2. Sobrescreve `slotIndex`/`opcaoIndex` com os valores da URL e zera
   `serieAtual` para `1` (o `iniciadoEm` é preservado, seja de um
   progresso retomado ou recém-criado).
3. Salva esse estado e limpa `exercicio`/`opcao` da URL com
   `history.replaceState`, para que um reload da página não repita o
   salto e perca o progresso feito depois dele.

Índices fora do intervalo (`slotIndex`/`opcaoIndex` inexistentes) são
ignorados — a execução segue de onde estava.

### 8.3 Estado da execução

Guardado em `localStorage`, chave `execucao.musculacao.<treinoId>.v1`
(ver [armazenamento-local-especificacao.md](./armazenamento-local-especificacao.md)):

```json
{
  "slotIndex": 2,
  "opcaoIndex": 0,
  "serieAtual": 3,
  "iniciadoEm": "2026-07-15T18:00:00.000Z"
}
```

- `slotIndex`: índice do slot atual na lista construída em 8.2.
- `opcaoIndex`: qual opção do slot está sendo usada agora (`0` = exercício
  original; `1`, `2`... = substitutos, na ordem em que aparecem).
- `serieAtual`: número da série pendente dentro do slot/opção atual
  (1-indexado).
- `iniciadoEm`: quando o treino começou — preservado entre reloads, usado
  para calcular a duração total na conclusão (seção 8.6).

Ao abrir a página com `?treino=<id>`, se já existir estado salvo para
esse `treinoId`, a execução **retoma** de onde parou (permite fechar o
navegador no meio do treino sem perder o progresso). Se não existir,
começa do zero (`slotIndex: 0, opcaoIndex: 0, serieAtual: 1`) e salva
esse estado inicial imediatamente.

### 8.4 Tela do exercício atual

Para `slots[slotIndex].opcoes[opcaoIndex]`, mostrar:

- Nome do exercício (com link para o vídeo) e grupo muscular.
- "Série `serieAtual` de `item.series`".
- Alvo da série, formatado conforme `item.repeticoes.modo` (mesma regra
  da seção 3.7.2 deste documento).
- Nota de isometria, se `item.tecnica === "isometria"` (mesma regra da
  seção 5).
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
  `exercicioId`; **omitido** quando `item.repeticoes.modo === "tempo"`
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
- Botão **"Usar substituto: `<nome>`"**, mostrado apenas quando
  `slots[slotIndex].opcoes.length > 1`. Ao tocar, cicla para a próxima
  opção do slot (`opcaoIndex = (opcaoIndex + 1) % opcoes.length`) e
  reinicia `serieAtual` para `1`, já que a opção nova pode ter `series`/
  `repeticoes` diferentes da anterior.
- Stepper **"‹ Exercício `slotIndex + 1` de `slots.length` ›"** acima do
  card, com um botão de cada lado (`exercicioAnterior`/`exercicioProximo`)
  para navegar manualmente entre exercícios sem precisar concluir as
  séries do atual. Cada toque chama `irParaExercicio(slotIndex ± 1)`, que
  troca `slotIndex`, zera `opcaoIndex`/`serieAtual` para `0`/`1` (mesma
  regra do salto por URL da seção 8.2.1) e salva o progresso — **sem**
  gravar nenhuma entrada em `historico.serieMusculacao.v1`, já que
  nenhuma série foi de fato concluída. O botão fica desabilitado no
  primeiro (`slotIndex === 0`) e no último (`slotIndex === slots.length - 1`)
  exercício. Não aparece na tela de descanso (seção 8.6), só na do
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
   ficou em branco (ou não existe, no caso de `repeticoes` em série por
   tempo). `duracaoSegundos` é o tempo entre tocar "Começar série" (seção
   8.4) e "Concluir série" — quanto tempo a série em si levou, sem contar
   o descanso.

3. Se `serieAtual < item.series`: incrementa `serieAtual`, continua no
   mesmo slot/opção (mesmo exercício, próxima série) e entra na tela de
   descanso (seção 8.6) em vez de mostrar a próxima série direto.
4. Senão (era a última série do slot):
   - Se houver próximo slot: avança (`slotIndex += 1`, `opcaoIndex = 0`,
     `serieAtual = 1`) e também entra na tela de descanso (seção 8.6).
   - Se era o último slot: encerra o treino (seção 8.7) — sem tela de
     descanso, o treino já acabou.
5. Salva o novo estado em `execucao.musculacao.<treinoId>.v1` (exceto no
   caso de encerramento, onde a chave é removida — ver 8.7).

### 8.6 Tela de descanso

Ao entrar em descanso (passo 2/3 acima), a tela troca a área do exercício
por um cronômetro contando **para cima**, a partir de `00:00`, junto com
o nome/série do próximo exercício (já refletindo o estado avançado no
passo anterior). A contagem só termina quando o aluno toca em **"Iniciar
série"** — não há avanço automático.

Os alvos vêm de `guia.pausaSegundos.min` e `guia.pausaSegundos.max` (o
mesmo texto exibido no "Guia rápido" de `treino_exercicios.html`, seção
3.3 deste documento):

- Ao atingir `pausaSegundos.min` segundos: toca um sinal sonoro (três
  bipes iguais, mesmo tom) + vibração curta, e o cronômetro muda de cor
  (indicando "já pode voltar"). Esse sinal toca uma única vez.
- Nos últimos 10 segundos antes de `pausaSegundos.max` (ou seja, quando
  `pausaSegundos.max - descansoSegundos` está entre `1` e `10`): toca um
  bipe curto e leve, um por segundo — uma contagem regressiva avisando
  que a pausa máxima está chegando. Sem vibração nem flash de tela,
  pra não ficar exagerado repetindo 10 vezes seguidas.
- Ao atingir `pausaSegundos.max` segundos: toca um sinal parecido ao do
  mínimo, porém mais forte (bipes mais longos e mais altos, vibração
  mais intensa) e o cronômetro muda para uma cor de alerta. Também toca
  uma única vez.
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

- Remove a chave `execucao.musculacao.<treinoId>.v1` (não há mais
  progresso em aberto para retomar).
- Mostra uma tela de conclusão simples ("Treino concluído 🎉") com link
  de volta para `treino_exercicios_menu.html`.

### 8.8 Erros

Mesmo padrão das demais páginas: sem `?treino=` na URL, `id` inexistente,
nenhum dado carregado ainda (`carregarDadosTreinos()` rejeitando), ou
treino com `blocos` vazio → tela de erro/estado com link de volta ao
menu, sem tentar montar a fila de execução.

## 9. Progresso do exercício (`treino_exercicio_progresso.html`)

Tela acessível pelo botão "Ver progresso" de qualquer card de exercício
(seção 6.2). Mostra o histórico de séries de **um exercício específico**
(`exercicioId`), agregando `historico.serieMusculacao.v1` de **todos os
treinos** em que ele aparece — não só o treino a partir do qual o botão
foi clicado (o parâmetro `?treino=<id>` na URL só serve para montar o
link "Voltar").

### 9.1 Agrupamento por sessão

Os registros de série não têm um identificador de "sessão" explícito, só
`treinoId` e `dataHora`. A página deriva sessões assim: ordena as
entradas por `dataHora` e agrupa em blocos consecutivos que compartilham
`treinoId` **e** a mesma data local (`AAAA-MM-DD`). Ou seja, "muda de
treino" tanto quando `treinoId` muda quanto quando o mesmo `treinoId`
aparece de novo num dia diferente (o exemplo citado no pedido original).
Cada grupo resultante recebe um índice alternado (`0`, `1`, `0`, `1`...)
usado para colorir tanto o gráfico quanto a tabela — sessões vizinhas
sempre ficam com cores diferentes.

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
  nenhum bloco/exercício cadastrado para esse tipo).
- Respeitar `superset`/`circuito` na execução guiada — por ora tudo é
  sequencial (seção 8.1).
- Edição dos dados pela interface — `dados/dados_treinos.json` continua
  editado manualmente e fora do controle de versão.
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
