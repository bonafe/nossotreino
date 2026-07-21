# Especificação — Treino de Bicicleta genérico

## 1. Objetivo

Hoje o treino de bicicleta (`treino_bicicleta_15_minutos_azul_vermelho.html`) tem os
parâmetros (duração total, tempo em cada intensidade) fixos no código. Esta
especificação define como transformar o treino em um "motor" genérico, que
recebe os parâmetros de fora (JSON), e como criar um menu que lista os
treinos disponíveis para o usuário escolher antes de começar.

Os parâmetros de cada treino de bicicleta vêm de dois documentos JSON
separados (ver seção 4): a modalidade genérica (`biblioteca-exercicios.json`)
e a prescrição específica daquele treino (o plano de treino, dado pessoal).

## 2. Parâmetros configuráveis

Cada treino de bicicleta passa a ser descrito por 5 parâmetros:

| Campo (PT-BR)             | Chave no JSON            | Tipo               | Exemplo |
|----------------------------|---------------------------|--------------------|---------|
| Séries                     | `series`                  | inteiro             | `10`    |
| Tempo de Estímulo          | `tempoEstimuloSegundos`   | inteiro (segundos)  | `60`    |
| Recuperação                | `tempoRecuperacaoSegundos`| inteiro (segundos)  | `30`    |
| Intensidade do Estímulo    | `intensidadeEstimulo`     | `"leve"` \| `"maxima"` | `"maxima"` |
| Intensidade Recuperação    | `intensidadeRecuperacao`  | `"leve"` \| `"maxima"` | `"leve"` |

Essa é a forma "achatada" que o motor (`treino_bicicleta.js`) espera — ver
seção 4.1 para como ela é extraída do JSON de origem.

Um "ciclo" (série) é sempre `Recuperação` seguida de `Estímulo`. O treino
repete esse ciclo `series` vezes. A duração total é:

```
duração total (s) = series * (tempoEstimuloSegundos + tempoRecuperacaoSegundos)
```

A primeira recuperação do treino funciona como aquecimento (mesmo comportamento
que a versão fixa de 15 minutos, que começava em intensidade baixa).

## 3. Mapeamento intensidade → estilo visual/sonoro

O motor não sabe se uma fase é "estímulo" ou "recuperação" para decidir cor e
som — quem decide é a intensidade daquela fase:

| Intensidade | Cor de acento (`--accent-rgb`) | Rótulo grande | Som                                   |
|-------------|----------------------------------|----------------|----------------------------------------|
| `leve`      | Azul (`56, 189, 248`)             | LEVE           | 3 bipes onda quadrada, agudo → grave   |
| `maxima`    | Vermelho (`251, 113, 133`)        | MÁXIMA         | 3 bipes onda quadrada, grave → agudo   |

O subtítulo da tela mostra qual fase é essa (`Recuperação` / `Estímulo`),
enquanto a palavra grande mostra a intensidade (`LEVE` / `MÁXIMA`), já que é
isso que dita o ritmo que a pessoa deve pedalar.

A tela usa a mesma base escura do resto do site (mesmo gradiente de
`index.html`/dos menus) em vez de inundar a tela inteira com a cor da
intensidade — só a variável CSS `--accent-rgb` muda por classe
(`body.leve`/`body.maxima`/`body.fim`), o que tinge o glow no topo, a
palavra grande da fase, a borda do balão de instrução e a barra de
progresso. `fim` (treino concluído) usa `190, 242, 100`, o mesmo
verde-lima (`#bef264`) usado como acento em todo o resto do site — cards,
botões, badges, etc. seguem o mesmo estilo visual das outras telas
(fundo `rgba(15, 23, 42, 0.86)`, bordas `rgba(148, 163, 184, ...)`), só o
glow e os elementos ligados à fase atual é que mudam de cor.

## 4. Fonte dos treinos: modalidade (biblioteca) + treino de cardio (entidade do plano)

Cardio é modelado em dois lugares (ver seção 11.4/14.3 de
[especificacao-biblioteca-exercicios.md](./especificacao-biblioteca-exercicios.md)):

- **Modalidade** (genérica, ex. "Bicicleta ergométrica"): cadastrada em
  `bibliotecas.cardio.modalidades[modalidadeId]`, dentro de
  `biblioteca-exercicios.json` — arquivo estático, versionado, buscado por
  `fetch` (não é dado pessoal).
- **Treino de cardio** (específico, com identidade própria): uma entrada
  de `treinosCardio[]`, coleção de primeira classe no **topo** do plano de
  treino (dado pessoal, `localStorage`), irmã de `treinos` — `{ id, nome,
  modalidadeId, treino: {tipo, series, estimulo, recuperacao}, observacao,
  status, versao }`.

```json
{
  "id": "bike-intervalado-15x30-30",
  "nome": "Treino A",
  "modalidadeId": "bicicleta-ergometrica",
  "treino": {
    "tipo": "intervalado",
    "series": 15,
    "estimulo": { "duracaoSegundos": 30, "intensidade": { "modo": "percepcao-livre", "valor": "maxima" } },
    "recuperacao": { "duracaoSegundos": 30, "intensidade": { "modo": "percepcao-livre", "valor": "leve" } }
  },
  "observacao": null,
  "status": "ativo",
  "versao": 1
}
```

Isso quer dizer:

- Um treino de cardio **existe por conta própria** — não precisa estar
  ligado a nenhum treino de musculação (diferente do modelo anterior, em
  que a prescrição vivia só dentro de `treino.cardio[]`). É por isso que
  dá pra entrar direto pelo menu (seção 5) sem passar por um treino de
  musculação.
- Um treino de musculação pode **referenciar** zero, uma ou mais entradas
  de `treinosCardio[]` como complemento — ver seção 12.3 de
  [especificacao-biblioteca-exercicios.md](./especificacao-biblioteca-exercicios.md):
  `treino.cardio: [{ treinoCardioId, momento }]`. A referência não repete
  a prescrição, só aponta o `id`.
- O motor hoje só sabe tocar `treino.tipo === "intervalado"` com
  `estimulo`/`recuperacao` definidos — outros tipos (ex. `continuo`) ficam
  fora de escopo (seção 8).
- O plano vem de `TreinosStorage.carregarDadosTreinos()` (`localStorage`,
  sem `fetch` — carregado manualmente em
  [importar_dados.html](../importar_dados.html)); a biblioteca vem de
  `carregarBiblioteca()` (`fetch`, ver
  [armazenamento-local-especificacao.md](./armazenamento-local-especificacao.md)).
  Ambos os documentos são carregados antes de montar a config do motor.

**Mudança de formato (schemaVersion 1.3):** antes, a prescrição vivia
embutida em `treino.cardio[].treino`, sem `id`/`nome` próprios, endereçada
pelo par `(treinoId, modalidadeId)`. Isso não permitia um treino de cardio
avulso nem reuso entre treinos de musculação diferentes. Planos no formato
antigo não são mais lidos — mesma convenção do projeto pra mudança de
formato (sem migração automática).

### 4.1 Conversão para os parâmetros do motor

A função `extrairConfig`, duplicada em `treino_bicicleta.html` e
`treino_bicicleta_menu.html`, combina as duas fontes:

```js
function extrairConfig(treinoCardio, modalidade) {
  const cfg = treinoCardio.treino;
  return {
    modalidadeId: treinoCardio.modalidadeId,
    treinoCardioId: treinoCardio.id,
    nome: `${treinoCardio.nome} — ${modalidade.nome}`,
    series: cfg.series,
    tempoEstimuloSegundos: cfg.estimulo.duracaoSegundos,
    tempoRecuperacaoSegundos: cfg.recuperacao.duracaoSegundos,
    intensidadeEstimulo: cfg.estimulo.intensidade.valor,
    intensidadeRecuperacao: cfg.recuperacao.intensidade.valor
  };
}
```

`intensidade.valor` já vem como `"leve"`/`"maxima"` — os mesmos valores que
`#estilosIntensidade` (seção 3) espera, então nenhum mapeamento adicional é
necessário além de extrair o campo aninhado.

### 4.2 Criar um treino de cardio novo

Duas formas, ambas válidas:

- **Pela interface**: `treino_bicicleta_novo.html` (seção 5.3) — formulário
  simples (nome, modalidade, séries, tempo/intensidade de estímulo,
  tempo/intensidade de recuperação; tipo fixo `intervalado`, único
  suportado pelo motor). Gera um `id` único e dá `push` em
  `dados.treinosCardio`.
- **Editando o plano à mão**: adicionar uma entrada em `treinosCardio[]`
  no plano, referenciando uma `modalidadeId` já cadastrada em
  `biblioteca-exercicios.json` (ou cadastrando uma modalidade nova ali, se
  for um tipo de aparelho diferente). Nenhum código HTML/JS precisa
  mudar — o menu (seção 5.1) lê a lista direto dos dois documentos.

Pra usar esse treino como complemento de um treino de musculação, adicionar
`{ treinoCardioId: "<id>", momento: "..." }` em `treino.cardio[]` daquele
treino (seção 4).

## 5. Telas / fluxo

```
sistema.html
   └─> treino_bicicleta_menu.html   (lista treinosCardio[] cujas modalidades são de bicicleta)
          ├─> treino_bicicleta_novo.html                       (criar treino de cardio novo, seção 5.3)
          └─> treino_bicicleta.html?treino=<treinoCardioId>[&origem=<treinoMusculacaoId>]   (motor genérico)
```

Esse fluxo é independente do fluxo de exercícios
(`treino_exercicios_menu.html` → `treino_exercicios.html` →
`treino_execucao.html`) — dá para entrar direto no cronômetro de bicicleta
sem passar pelo treino de musculação. O card "Cardio complementar" de
`treino_exercicios.html` também linka pra cá, usando o mesmo
`treino=<treinoCardioId>` mais um `origem=<treinoMusculacaoId>` (só nesse
caso) — ver seção 5.2.1.

### 5.1 Menu (`treino_bicicleta_menu.html`)

A primeira coisa exibida na tela, antes da lista de treinos, é o gráfico de
histórico (seção 5.1.1). A lista de treinos disponíveis vem depois. O
cabeçalho tem um botão "+" (mesmo padrão de `treino_exercicios_menu.html`)
que leva a `treino_bicicleta_novo.html` (seção 5.3).

- Carrega o plano (`TreinosStorage.carregarDadosTreinos()`) e a biblioteca
  (`carregarBiblioteca()`, fetch).
- Itera `dados.treinosCardio || []` diretamente: para cada entrada, resolve
  a modalidade em `bibliotecas.cardio.modalidades[modalidadeId]` e filtra
  pelas que parecem ser de bicicleta (nome/aliases contendo "bicicleta" —
  heurística equivalente ao antigo filtro por texto livre
  `cardio.exercicio === "Bicicleta"`, já que o modelo não tem um campo
  dedicado pra "categoria de cardio").
- Mostra um cartão por entrada, combinando `extrairConfig` (seção 4.1):
  título `"<nome do treino de cardio> — <nome da modalidade>"`, Tipo,
  Séries, Tempo de Estímulo, Recuperação, Intensidade do Estímulo,
  Intensidade de Recuperação.
- Cada cartão é um link para
  `treino_bicicleta.html?treino=<treinoCardioId>`.
- Se não houver nenhuma entrada de bicicleta em `treinosCardio`, mostra uma
  mensagem ("Nenhum treino de bicicleta cadastrado ainda") em vez de lista
  vazia.

#### 5.1.1 Gráfico de histórico (tempo de bicicleta)

Logo abaixo do título da tela e acima da lista de treinos, um gráfico de
barras (D3.js, usando o mesmo `d3.v7.min.js` vendorizado já usado por
[treino_exercicio_progresso.html](../treino_exercicio_progresso.html) — sem
CDN, pra continuar funcionando offline) mostra quanto tempo de bicicleta foi
feito, agregado por período. Cada barra é um dia (ou mês) e sua altura é a
soma de `duracaoSegundos` (seção 6.1) das sessões daquele dia/mês, em
minutos.

- **Fonte dos dados**: `historico.sessaoBicicleta.v1` (seção 6.1), lido
  direto com `TreinosStorage.lerJSON(...)` — independe do plano de treino
  ou da biblioteca estarem carregados (histórico e dados de treino são
  chaves separadas no `localStorage`, ver seção 1 de
  [armazenamento-local-especificacao.md](./armazenamento-local-especificacao.md)).
  Por isso o gráfico é montado mesmo que o carregamento do plano/biblioteca
  (pra lista de treinos) falhe.
- **Três períodos**, escolhidos por botões acima do gráfico:
  - **7 dias** (padrão ao abrir a tela) — uma barra por dia, últimos 7 dias
    corridos incluindo hoje.
  - **30 dias** — uma barra por dia, últimos 30 dias corridos incluindo
    hoje. Só uma fração dos rótulos do eixo X é exibida (pra não
    sobrepor texto), mas todas as 30 barras aparecem.
  - **Meses** — uma barra por mês, últimos 6 meses corridos incluindo o
    mês atual.
  - Dias/meses sem nenhuma sessão registrada aparecem como barra vazia
    (altura mínima, só pra marcar a posição no eixo) — o eixo sempre
    mostra o período inteiro, não só os dias com treino.
- **Tooltip**: passar o mouse/tocar numa barra mostra a data (ou mês) e o
  tempo total formatado (`"32min"`, `"1h15"`, ou `"sem treino"` se zero).
- **Rótulo em cima da barra**: além do tooltip, o valor formatado
  (`"32min"`, `"1h15"`) aparece direto acima de cada barra com treino
  (`totalSegundos > 0` — barra vazia não ganha rótulo, já é óbvia pela
  altura zero), pra não depender de passar o mouse pra ler o tempo. Só é
  desenhado quando a banda de cada barra tem pelo menos 20px de largura
  (`x.bandwidth() >= 20`) — em **30 dias** as barras ficam finas demais
  pro texto caber sem sobrepor a barra vizinha, então esse período fica só
  com o tooltip; em **7 dias** e **Meses**, com poucas barras mais largas,
  o rótulo sempre aparece.
- **Estado vazio**: se `historico.sessaoBicicleta.v1` não tiver nenhum
  registro (nenhum treino de bike concluído ainda neste navegador), o
  gráfico e os botões de período não aparecem — no lugar, uma mensagem
  ("Nenhum treino de bicicleta registrado ainda.") é mostrada, no mesmo
  estilo das outras mensagens de estado vazio da tela.
- Cor da barra: `#bef264` (mesmo verde-lima usado no resto da UI), única
  série — sem legenda necessária. Rótulo de valor em `#e2e8f0` (texto
  claro, não a cor da série — o rótulo é texto, não marca).

### 5.2 Motor genérico (`treino_bicicleta.html`)

- Antigo `treino_bicicleta_15_minutos_azul_vermelho.html`, renomeado.
- Lê o parâmetro de query `?treino=<treinoCardioId>` (obrigatório) e o
  opcional `?origem=<treinoMusculacaoId>` (seção 5.2.1).
- Carrega o plano e a biblioteca, localiza
  `dados.treinosCardio.find(t => t.id === treinoCardioId)` e a modalidade
  correspondente em `bibliotecas.cardio.modalidades[modalidadeId]`;
  converte com `extrairConfig` (seção 4.1) para calcular fases, tempos e o
  mapeamento de intensidade descrito na seção 3.
- Se faltar `treino=` na URL, a entrada/modalidade não existir, o tipo não
  for `intervalado`, ou o carregamento falhar, mostra uma mensagem de
  erro.

#### 5.2.1 Botão de voltar

O ícone `←` no topo da tela (mesmo padrão visual de
`treino_exercicios.html`/`treino_execucao.html`) depende de como a página
foi aberta:

- Com `?origem=<treinoMusculacaoId>` na URL (entrou pelo card "Cardio
  complementar" de `treino_exercicios.html`, seção 6.2 de
  [treino-exercicios-especificacao.md](./treino-exercicios-especificacao.md)):
  volta para `treino_exercicios.html?treino=<origem>`.
- Sem `origem` (entrou direto pelo menu de bicicleta, seção 5.1): volta
  para `treino_bicicleta_menu.html`.

Esse destino é calculado assim que a página lê os parâmetros da URL, antes
mesmo de tentar carregar os dados — funciona mesmo nos estados de
carregando/erro.

### 5.3 Criar treino de cardio (`treino_bicicleta_novo.html`)

Formulário simples (sem picker — a biblioteca de modalidades cardio é
pequena, um `<select>` basta): nome, modalidade
(`bibliotecas.cardio.modalidades`), séries, tempo de estímulo +
intensidade (leve/máxima), tempo de recuperação + intensidade. Tipo fixo
`"intervalado"` (seção 8 — único suportado pelo motor). Ao salvar, gera um
`id` único (reaproveitando `js/identificadores.js`, mesmo helper usado por
`treino_novo.html`) e dá `push` em `dados.treinosCardio`, depois volta
para `treino_bicicleta_menu.html`. Anexar esse treino a um treino de
musculação existente como complemento continua sendo manual (editar
`treino.cardio[]` daquele treino, seção 4.2) — fora de escopo desta tela.

## 6. Histórico local (localStorage)

Ver [armazenamento-local-especificacao.md](./armazenamento-local-especificacao.md)
para a convenção geral de chaves e o script compartilhado `storage.js`.

Diferente da musculação (seção 8 de
[treino-exercicios-especificacao.md](./treino-exercicios-especificacao.md)),
aqui não importa o progresso ciclo a ciclo — só o treino completo. O
motor genérico grava um único tipo de registro, usando
`TreinosStorage.adicionarAoHistorico`:

### 6.1 Treino concluído — `historico.sessaoBicicleta.v1`

Quando a última série termina (`elapsed` chega em `TOTAL_SECONDS`), é
adicionado um resumo do treino inteiro:

```json
{
  "modalidadeId": "bicicleta-ergometrica",
  "treinoId": "bike-intervalado-15x30-30",
  "origemTreinoId": "treino-a",
  "nome": "Treino A",
  "dataHora": "2026-07-15T18:47:10.482Z",
  "duracaoSegundos": 900,
  "series": 15
}
```

`treinoId` agora é o `id` do treino de cardio (`treinosCardio[].id`, seção
4), não mais o de um treino de musculação. `origemTreinoId` é `null`
quando o treino de bike foi feito direto pelo menu (seção 5.1), ou o `id`
do treino de musculação de origem quando veio de um card "Cardio
complementar" (`?origem=`, seção 5.2.1) — permite continuar sabendo, como
antes, de qual treino de musculação aquela sessão de cardio foi
complementar, quando aplicável. `duracaoSegundos` é a duração planejada do
treino
(`series * (tempoEstimuloSegundos + tempoRecuperacaoSegundos)`), não o
tempo de relógio real — pausas feitas com o botão "PAUSAR" não entram na
conta, já que o cronômetro só avança enquanto `running` é verdadeiro.

Nada é salvo se o treino for pausado/abandonado antes da última série —
isso é uma limitação aceita por ora (ver seção 7 de
[armazenamento-local-especificacao.md](./armazenamento-local-especificacao.md#7-fora-de-escopo)).

## 7. Observação sobre hospedagem

O motor faz `fetch()` da biblioteca de exercícios (`biblioteca-exercicios.json`,
seção 4) — diferente do plano de treino, que continua vindo só do
`localStorage`, carregado manualmente em
[importar_dados.html](../importar_dados.html). Por isso o site precisa ser
servido por HTTP (não `file://`) pra essa página funcionar, mesmo que só
localmente — o service worker (`sw.js`) cacheia
`biblioteca-exercicios.json` como parte do app shell depois da primeira
visita, então o `fetch` continua funcionando offline em seguida.

Para testar localmente, use o script `serve.py` (stdlib, sem dependências):

```
python3 serve.py        # sobe em http://localhost:8000
python3 serve.py 8934   # porta customizada
```

## 8. Fora de escopo

- Intensidades além de `leve`/`maxima` (ex.: "moderada") — não usadas em
  nenhum dos 3 treinos definidos, não implementadas agora.
- Tipos de treino cardiovascular além de `intervalado` (ex. `continuo`,
  ver seção 4) — o motor rejeita com mensagem de erro.
- Edição dos treinos pela interface (o plano de treino continua editado
  manualmente; a biblioteca é versionada no repositório).
- Salvar progresso de um treino pausado/abandonado antes da última série
  (ver seção 6).
