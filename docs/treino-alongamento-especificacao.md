# Especificação — Treino de Alongamento genérico

## 1. Objetivo

Terceiro pilar do site, ao lado de bicicleta
([treino-bicicleta-especificacao.md](./treino-bicicleta-especificacao.md)) e
musculação
([treino-exercicios-especificacao.md](./treino-exercicios-especificacao.md)):
mesmo padrão "motor genérico + JSON de dados", desta vez pra sessões de
alongamento — sequência de alongamentos com séries e duração, cada um
executado por vez, com descanso entre séries.

Alongamento também pode ser complementar a um treino de musculação (seção
4.2), do mesmo jeito que cardio já é.

## 2. Fonte dos treinos: catálogo (biblioteca) + treino de alongamento (entidade do plano)

- **Catálogo** (`bibliotecas.alongamentos[alongamentoId]`, dentro de
  `biblioteca-exercicios.json`): nome, grupos musculares, mídia,
  instruções — não é dado pessoal, buscado por `fetch`. Ver
  `docs/estrutura-biblioteca-alongamentos.md`.
- **Treino de alongamento** (específico, com identidade própria): uma
  entrada de `treinosAlongamento[]`, coleção de primeira classe no topo do
  plano de treino (dado pessoal, `localStorage`), irmã de `treinos` e
  `treinosCardio` — ver seção 11.5 de
  [especificacao-biblioteca-exercicios.md](./especificacao-biblioteca-exercicios.md).

```json
{
  "id": "mobilidade-quadril-pos-treino",
  "nome": "Mobilidade de quadril pós-treino",
  "alongamentos": [
    {
      "alongamentoId": "alongamento-de-posteriores-em-pe",
      "ordem": 10,
      "prescricao": {
        "series": 2,
        "metrica": { "tipo": "tempo", "modo": "fixo", "valor": 30, "unidade": "segundos" },
        "descansoSegundos": null
      },
      "observacao": null
    }
  ],
  "status": "ativo",
  "versao": 1
}
```

`alongamentos[]` é sempre lista plana, ordenada por `ordem`, executada
sequencialmente. **Sem** `superset`/`circuito`/`alternativas`/`tecnicas` —
não fazem sentido pra composição de alongamento (fora de escopo, seção 8).
`prescricao.metrica` segue o mesmo formato de
[especificacao-biblioteca-exercicios.md](./especificacao-biblioteca-exercicios.md#104-metrica)
(tipicamente `tempo` fixo, já que a maioria dos alongamentos cadastrados é
isométrica — mas `repeticoes` também é aceito, ver seção 5).

Um treino de alongamento existe por conta própria (dá pra entrar direto
pelo menu, seção 4) e pode, opcionalmente, ser referenciado por um treino
de musculação como complemento (seção 4.2).

## 3. Telas / fluxo

```
sistema.html
   └─> treino_alongamento_menu.html   (lista treinosAlongamento[])
          ├─> treino_alongamento_novo.html                          (criar treino novo, seção 6)
          └─> treino_alongamento.html?treino=<id>[&origem=<treinoMusculacaoId>]   (motor genérico, seção 5)
```

Fluxo independente do de exercícios/bicicleta — dá pra fazer uma sessão de
alongamento avulsa sem passar por um treino de musculação. O card
"Alongamento complementar" de `treino_exercicios.html` também linka pra cá
(seção 6.2 de
[treino-exercicios-especificacao.md](./treino-exercicios-especificacao.md)),
usando `treino=<treinoAlongamentoId>&origem=<treinoMusculacaoId>`.

### 4. Menu (`treino_alongamento_menu.html`)

Mesmo layout de `treino_bicicleta_menu.html` (gráfico de histórico +
lista): cabeçalho com botão "+" pra `treino_alongamento_novo.html`, gráfico
de barras D3 (`historico.sessaoAlongamento.v1`, seção 7, mesmo componente
`GraficoBarrasHistorico` já usado pela bike e por exercícios) e, abaixo, um
cartão por entrada de `dados.treinosAlongamento || []`: nome, `momento`
(quando referenciado por algum treino de musculação — informativo, não
bloqueia o uso avulso) e quantidade de alongamentos. Cada cartão linka
para `treino_alongamento.html?treino=<id>`. Sem nenhuma entrada, mostra
"Nenhum treino de alongamento cadastrado ainda."

### 4.1 Criar treino de alongamento (`treino_alongamento_novo.html`)

Mesmo padrão de `treino_novo.html` (picker com busca/filtro + formulário de
prescrição), trocando a fonte do picker para `bibliotecas.alongamentos`:

- Filtros: grupo muscular (`gruposMusculares.{principais,secundarios,estabilizadores}`)
  e `classificacao.tipo` (`estatico-passivo`/`estatico-ativo`/`dinamico`/
  `mobilidade-articular`) — sem filtro de equipamento/categoria (não fazem
  sentido aqui, a categoria já é sempre `alongamento`).
- Formulário de prescrição: série + métrica (mesmo controle de
  `treino_novo.html`, mas sem os campos de isometria/agrupamento —
  alongamento não usa técnica nem superset/circuito).
- Ao salvar, gera um `id` único (`js/identificadores.js`, mesmo helper de
  `treino_novo.html`/`treino_bicicleta_novo.html`) e dá `push` em
  `dados.treinosAlongamento`, depois volta para
  `treino_alongamento_menu.html`.
- Anexar esse treino como complemento de um treino de musculação existente
  continua manual (editar `treino.alongamento[]` daquele treino, seção
  4.2) — fora de escopo desta tela, mesma decisão já tomada pra cardio.

### 4.2 Anexar como complemento de um treino de musculação

Editar `treino.alongamento[]` do treino de musculação desejado:

```json
{ "treinoAlongamentoId": "mobilidade-quadril-pos-treino", "momento": "apos-musculacao" }
```

`momento` é informativo (ex. `"antes-musculacao"`, `"apos-musculacao"`) —
não muda o comportamento do motor, só ajuda o aluno/professor a saber
quando encaixar aquele alongamento na sessão.

## 5. Motor genérico (`treino_alongamento.html`)

Modelado em `treino_execucao.html`/`treino-execucao.js` (musculação), mas
**simplificado** — sem carga, repetições realizadas, ajuste de carga
sugerido, nem substituto/alternativas (a lista de alongamentos não tem
essas opções, seção 2):

- Lê `?treino=<treinoAlongamentoId>` (obrigatório) e o opcional
  `?origem=<treinoMusculacaoId>` (seção 5.3).
- Monta uma fila sequencial de slots a partir de
  `treinoAlongamento.alongamentos` (ordenado por `ordem`) — um slot por
  alongamento, sem opções alternativas (diferente da musculação, aqui cada
  slot tem uma única opção).
- Pra cada slot: nome do alongamento e grupos musculares (resolvidos via
  `bibliotecas.alongamentos[id]` + `bibliotecas.gruposMusculares`, mesmo
  padrão da musculação), "Série `serieAtual` de `prescricao.series`", alvo
  formatado com `PrescricaoFormatadores.metrica` (reaproveitado, já lida
  com `tempo`/`repeticoes`), botão "Começar série"/"Concluir série" com
  cronômetro da série em andamento (mesmo padrão de
  `Cronometro`/`SinalSonoro` da musculação), botão "Ver vídeo"
  (`ligarBotaoVideo`, a partir de `bibliotecas.alongamentos[id].midia`) e
  imagem sempre visível (`ligarImagemExercicio(..., "alongamento")`, mesmo
  helper genérico por id+gênero de `js/imagem-exercicio.js`, passando o
  domínio `"alongamento"` pra resolver em `imagens/alongamento/` em vez de
  `imagens/musculacao/` — hoje nenhum alongamento tem imagem gerada ainda,
  então fica oculta até existir uma seguindo a convenção
  `biblioteca-exercicios/imagens/alongamento/<alongamentoId>__<genero>.png`,
  gerável com `src/python/gerar_imagens_treino.py --categoria alongamentos`).
- Descanso entre séries/alongamentos: mesma tela/cronômetro da musculação,
  alvo min/máx a partir de `prescricao.descansoSegundos` do item, ou um
  padrão de 15–30s quando ausente (treino de alongamento não tem
  `orientacoesGerais.descansoPadrao` — não é um treino de musculação).
- Concluída a última série do último slot, mostra a tela de conclusão
  (mesmo padrão "🎉 Treino concluído!") e volta ao menu.
- Progresso persistido em `execucao.alongamento.<treinoId>.v1` (seção 7),
  endereçado por `alongamentoId`, pra retomar depois de fechar o
  navegador — mesmo princípio de `execucao.musculacao.<treinoId>.v2`.
- Se faltar `treino=`, a entrada não existir, ou o carregamento falhar,
  mostra mensagem de erro.

### 5.1 Stepper entre alongamentos

Mesmo `‹`/`›` da musculação — navega entre slots sem precisar terminar o
atual (mesmo aviso "descarta o tempo parcial do alongamento atual" já
usado lá).

### 5.2 Sem substituto

Diferente da musculação, um slot de alongamento tem sempre uma única
opção — não existe botão "Usar substituto" nesta tela (fora de escopo,
seção 8).

### 5.3 Botão de voltar

Mesmo padrão da bike (seção 5.2.1 de
[treino-bicicleta-especificacao.md](./treino-bicicleta-especificacao.md)):

- Com `?origem=<treinoMusculacaoId>`: volta para
  `treino_exercicios.html?treino=<origem>`.
- Sem `origem`: volta para `treino_alongamento_menu.html`.

## 6. (reservado)

Ver seção 4.1 — a tela de criação já está descrita ali, ao lado do menu
que ela alimenta.

## 7. Histórico local (localStorage)

Ver [armazenamento-local-especificacao.md](./armazenamento-local-especificacao.md)
para a convenção geral de chaves. Mesmo padrão da musculação: um registro
por alongamento concluído (não por treino inteiro, pra alongamentos feitos
avulsos também contarem) em `historico.sessaoAlongamento.v1`:

```json
{
  "treinoId": "mobilidade-quadril-pos-treino",
  "origemTreinoId": null,
  "alongamentoId": "alongamento-de-posteriores-em-pe",
  "alongamentoNome": "Alongamento de posteriores em pé",
  "concluidoEm": "2026-07-21T18:47:10.482Z",
  "duracaoSegundos": 130
}
```

`origemTreinoId` segue o mesmo princípio da bike (seção 6.1 de
[treino-bicicleta-especificacao.md](./treino-bicicleta-especificacao.md)):
`null` quando a sessão foi feita direto pelo menu, ou o `id` do treino de
musculação de origem quando veio de um card "Alongamento complementar".

## 8. Fora de escopo

- Superset/circuito/alternativas/técnicas na composição de um treino de
  alongamento (seção 2) — sempre sequencial simples.
- Carga, repetições realizadas e sugestão de ajuste de carga (não se
  aplicam a alongamento).
- Anexar/desanexar treinos de cardio ou alongamento a um treino de
  musculação pela interface — continua manual, editando
  `treino.alongamento[]`/`treino.cardio[]` no plano (seção 4.2).
- Imagens geradas especificamente para alongamentos — o mecanismo já
  suporta (seção 5), só falta gerar as imagens.
