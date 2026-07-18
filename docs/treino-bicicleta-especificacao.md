# Especificação — Treino de Bicicleta genérico

## 1. Objetivo

Hoje o treino de bicicleta (`treino_bicicleta_15_minutos_azul_vermelho.html`) tem os
parâmetros (duração total, tempo em cada intensidade) fixos no código. Esta
especificação define como transformar o treino em um "motor" genérico, que
recebe os parâmetros de fora (arquivo JSON), e como criar um menu que lista os
treinos disponíveis para o usuário escolher antes de começar.

Os parâmetros de cada treino de bicicleta vêm do dicionário `cardios` em
`dados/dados_treinos.json` — não existe (nem nunca mais existirá) um
arquivo `.json` próprio por treino de bicicleta (ver seção 4).

## 2. Parâmetros configuráveis

Cada treino de bicicleta passa a ser descrito por 5 parâmetros:

| Campo (PT-BR)             | Chave no JSON            | Tipo               | Exemplo |
|----------------------------|---------------------------|--------------------|---------|
| Séries                     | `series`                  | inteiro             | `10`    |
| Tempo de Estímulo          | `tempoEstimuloSegundos`   | inteiro (segundos)  | `60`    |
| Recuperação                | `tempoRecuperacaoSegundos`| inteiro (segundos)  | `30`    |
| Intensidade do Estímulo    | `intensidadeEstimulo`     | `"leve"` \| `"maxima"` | `"maxima"` |
| Intensidade Recuperação    | `intensidadeRecuperacao`  | `"leve"` \| `"maxima"` | `"leve"` |

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

| Intensidade | Cor de fundo | Rótulo grande | Som                                   |
|-------------|--------------|----------------|----------------------------------------|
| `leve`      | Azul         | LEVE           | 3 bipes onda quadrada, agudo → grave   |
| `maxima`    | Vermelho     | MÁXIMA         | 3 bipes onda quadrada, grave → agudo   |

O subtítulo da tela mostra qual fase é essa (`Recuperação` / `Estímulo`),
enquanto a palavra grande mostra a intensidade (`LEVE` / `MÁXIMA`), já que é
isso que dita o ritmo que a pessoa deve pedalar.

## 4. Fonte dos treinos: `cardios` em `dados/dados_treinos.json`

Não existe um arquivo `.json` dedicado por treino de bicicleta. Cada treino
de bicicleta é uma entrada do dicionário `cardios`, no mesmo
`dados/dados_treinos.json` usado pelas páginas de exercícios (ver seção 3.6
de
[treino-exercicios-especificacao.md](./treino-exercicios-especificacao.md)
para o esquema completo).

```json
"cardios": {
  "cardio-a": {
    "nome": "Cardio A",
    "exercicio": "Bicicleta",
    "series": 15,
    "tempoEstimulo": { "segundos": 30 },
    "recuperacao": { "segundos": 30 },
    "intensidadeEstimulo": "maxima",
    "intensidadeRecuperacao": "leve"
  }
}
```

Isso quer dizer:

- `cardios` é um dicionário de referência, no mesmo padrão de `exercicios`
  (seção 3.5 de
  [treino-exercicios-especificacao.md](./treino-exercicios-especificacao.md)):
  cada entrada tem `id` próprio (a chave, ex. `cardio-a`) e `nome` próprios,
  **independentes** de qualquer treino de musculação.
- Um treino de musculação pode referenciar um cardio via `treinoMusculacao.cardioId`
  (seção 3.7.3 do mesmo documento) — mas essa referência é opcional e só
  serve pra linkar "Fazer bicicleta →" a partir da tela do treino completo
  (`treino_exercicios.html`). O menu de bicicleta (seção 5.1) **não**
  depende dela: lê `cardios` direto.
- `exercicio` (hoje sempre `"Bicicleta"`) é o campo usado pra filtrar quais
  entradas de `cardios` aparecem no menu de bicicleta — deixa aberto pra um
  dia ter outro tipo de cardio no mesmo dicionário sem aparecer aqui.
- O JSON vem de `TreinosStorage.carregarDadosTreinos()`, que lê do
  `localStorage` (sem `fetch` — ver
  [armazenamento-local-especificacao.md](./armazenamento-local-especificacao.md)),
  a mesma função usada pelas páginas de exercícios. Os dados só existem
  ali depois que o aluno os carrega manualmente em
  [importar_dados.html](../importar_dados.html).

### 4.1 Conversão `cardios[cardioId]` → parâmetros do motor

O esquema de uma entrada de `cardios` (aninhado, com `tempoEstimulo.segundos`
e `recuperacao.segundos`) é diferente da forma "achatada" que o motor espera
(seção 2). A conversão é feita por uma função `extrairConfigBicicleta`,
duplicada em `treino_bicicleta.html` e `treino_bicicleta_menu.html`:

```js
function extrairConfigBicicleta(cardioId, cardio) {
  return {
    id: cardioId,
    nome: cardio.nome,
    series: cardio.series,
    tempoEstimuloSegundos: cardio.tempoEstimulo.segundos,
    tempoRecuperacaoSegundos: cardio.recuperacao.segundos,
    intensidadeEstimulo: cardio.intensidadeEstimulo,
    intensidadeRecuperacao: cardio.intensidadeRecuperacao
  };
}
```

### 4.2 Treinos hoje cadastrados

| `cardioId` | Nome | Séries | Tempo de Estímulo | Recuperação | Intensidade Estímulo | Intensidade Recuperação |
|---|---|---|---|---|---|---|
| `cardio-a` | Cardio A | 15 | 30s | 30s | Máxima | Leve |
| `cardio-b` | Cardio B | 3 | 3min (180s) | 2min (120s) | Máxima | Leve |
| `cardio-c` | Cardio C | 3 | 4min (240s) | 60s | Máxima | Leve |

Hoje `cardio-a`/`cardio-b`/`cardio-c` são referenciados por
`treino-a`/`treino-b`/`treino-c` (via `cardioId`), mas isso é incidental —
adicionar um treino de bicicleta novo = adicionar uma entrada em `cardios`
em `dados/dados_treinos.json`, com ou sem algum treino de musculação
apontando pra ela. Nenhum código HTML/JS precisa mudar — o menu (seção 5.1)
lê a lista direto do JSON.

## 5. Telas / fluxo

```
index.html
   └─> treino_bicicleta_menu.html   (lista dados.cardios com exercicio === "Bicicleta")
          └─> treino_bicicleta.html?cardio=cardio-a   (motor genérico)
```

Esse fluxo é independente do fluxo de exercícios
(`treino_exercicios_menu.html` → `treino_exercicios.html` →
`treino_execucao.html`) — dá para entrar direto no cronômetro de bicicleta
sem passar pelo treino de musculação. O card "Cardio complementar" de
`treino_exercicios.html` também linka pra cá
(`treino_bicicleta.html?cardio=<cardioId>`), pra quem já está vendo o
treino completo.

### 5.1 Menu (`treino_bicicleta_menu.html`)

A primeira coisa exibida na tela, antes da lista de treinos, é o gráfico de
histórico (seção 5.1.1). A lista de treinos disponíveis vem depois.

- Busca `dados/dados_treinos.json` via `TreinosStorage.carregarDadosTreinos()`.
- Filtra as entradas de `dados.cardios` com `exercicio === "Bicicleta"`,
  converte cada uma com `extrairConfigBicicleta` (seção 4.1) e mostra um
  cartão com: Nome, Séries, Tempo de Estímulo, Recuperação, Intensidade do
  Estímulo, Intensidade de Recuperação.
- Cada cartão é um link para `treino_bicicleta.html?cardio=<cardioId>`.
- Se não houver nenhuma entrada de bicicleta em `cardios`, mostra uma
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
  direto com `TreinosStorage.lerJSON(...)` — independe de
  `dados/dados_treinos.json` estar carregado (histórico e dados de treino
  são chaves separadas no `localStorage`, ver seção 1 de
  [armazenamento-local-especificacao.md](./armazenamento-local-especificacao.md)).
  Por isso o gráfico é montado mesmo que a busca de `dados.cardios` (pra
  lista de treinos) falhe.
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
- Lê o parâmetro de query `?cardio=<cardioId>`.
- Busca `dados/dados_treinos.json`, localiza `dados.cardios[cardioId]` e
  converte com `extrairConfigBicicleta` (seção 4.1) para calcular fases,
  tempos e o mapeamento de intensidade descrito na seção 3.
- Se não houver `cardio` na URL, o `cardioId` não existir em `dados.cardios`,
  ou o carregamento falhar, mostra uma mensagem de erro com link de volta
  para o menu.

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
  "cardioId": "cardio-a",
  "cardioNome": "Cardio A",
  "dataHora": "2026-07-15T18:47:10.482Z",
  "duracaoSegundos": 900,
  "series": 15
}
```

`duracaoSegundos` é a duração planejada do treino
(`series * (tempoEstimuloSegundos + tempoRecuperacaoSegundos)`), não o
tempo de relógio real — pausas feitas com o botão "PAUSAR" não entram na
conta, já que o cronômetro só avança enquanto `running` é verdadeiro.

Nada é salvo se o treino for pausado/abandonado antes da última série —
isso é uma limitação aceita por ora (ver seção 7 de
[armazenamento-local-especificacao.md](./armazenamento-local-especificacao.md#7-fora-de-escopo)).

## 7. Observação sobre hospedagem

Como o motor não usa mais `fetch()` para os dados do treino (seção 4 —
tudo vem do `localStorage`, carregado manualmente em
[importar_dados.html](../importar_dados.html)), o site não depende mais
de ser servido por HTTP por causa de CORS. Ainda é conveniente usar um
servidor local (`serve.py`) durante o desenvolvimento, mas por outros
motivos de praticidade, não por uma limitação técnica do `fetch`.

Para testar localmente, use o script `serve.py` (stdlib, sem dependências):

```
python3 serve.py        # sobe em http://localhost:8000
python3 serve.py 8934   # porta customizada
```

## 8. Fora de escopo

- Intensidades além de `leve`/`maxima` (ex.: "moderada") — não usadas em
  nenhum dos 3 treinos definidos, não implementadas agora.
- Edição dos treinos pela interface (`dados/dados_treinos.json` continua
  editado manualmente).
- Salvar progresso de um treino pausado/abandonado antes da última série
  (ver seção 6).
