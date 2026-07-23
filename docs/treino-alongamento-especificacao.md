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
          ├─> treino_alongamento_novo.html                          (criar treino novo, seção 4.1)
          └─> treino_alongamento_exercicios.html?treino=<id>[&origem=<treinoMusculacaoId>]   (lista os alongamentos do treino, seção 6)
                 └─> treino_alongamento.html?treino=<id>[&alongamento=<alongamentoId>][&origem=<treinoMusculacaoId>]   (motor genérico, seção 5)
                        └─> treino_alongamento_progresso.html?alongamento=<id>&treino=<treinoAlongamentoId>   (progresso do alongamento, seção 6.2)
```

Fluxo independente do de exercícios/bicicleta — dá pra fazer uma sessão de
alongamento avulsa sem passar por um treino de musculação. Mirror direto do
fluxo de musculação (lista → execução → progresso, seção 6.2 de
[treino-exercicios-especificacao.md](./treino-exercicios-especificacao.md)):
o card "Alongamento complementar" de `treino_exercicios.html` linka pra
`treino_alongamento_exercicios.html`, usando
`treino=<treinoAlongamentoId>&origem=<treinoMusculacaoId>`.

### 4. Menu (`treino_alongamento_menu.html`)

Mesmo layout de `treino_bicicleta_menu.html` (gráfico de histórico +
lista): cabeçalho com botão "+" pra `treino_alongamento_novo.html`, gráfico
de barras D3 (`historico.sessaoAlongamento.v1`, seção 7, mesmo componente
`GraficoBarrasHistorico` já usado pela bike e por exercícios) e, abaixo, um
cartão por entrada de `dados.treinosAlongamento || []`: nome, `momento`
(quando referenciado por algum treino de musculação — informativo, não
bloqueia o uso avulso) e quantidade de alongamentos. Cada cartão linka
para `treino_alongamento_exercicios.html?treino=<id>` (a lista de
alongamentos do treino, seção 6 — mirror de
`treino_exercicios_menu.html` linkando pra `treino_exercicios.html`, não
direto pro motor). Sem nenhuma entrada, mostra "Nenhum treino de
alongamento cadastrado ainda."

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
- Botão "ⓘ" (`js/detalhes-modal.js`, domínio `"alongamento"` — ver seção
  2.1) ao lado do nome — em cada resultado da busca, no título da
  prescrição depois de escolher um alongamento, e em cada item já
  adicionado à lista — abre os detalhes (descrição, grupos musculares,
  equipamentos, execução, restrições, vídeo se houver e a imagem ao
  final) sem precisar adicionar o alongamento primeiro. A tela também
  ganha seu próprio `#videoOverlay` (`criarVideoPlayerModal()`) só pra
  esse botão de vídeo.
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

- Lê `?treino=<treinoAlongamentoId>` (obrigatório), o opcional
  `?origem=<treinoMusculacaoId>` (seção 5.3) e o opcional
  `?alongamento=<alongamentoId>` (seção 5.4, pular direto pra um item).
- Monta uma fila sequencial de slots a partir de
  `treinoAlongamento.alongamentos` (ordenado por `ordem`) — um slot por
  alongamento, sem opções alternativas (diferente da musculação, aqui cada
  slot tem uma única opção).
- Pra cada slot: nome do alongamento (com botão "ⓘ" ao lado, abrindo o
  mesmo `js/detalhes-modal.js` da musculação — descrição, grupos
  musculares detalhados, equipamentos, execução, restrições, vídeo se
  houver e a imagem ao final, domínio `"alongamento"`) e grupos
  musculares (resolvidos via
  `bibliotecas.alongamentos[id]` + `bibliotecas.gruposMusculares`, mesmo
  padrão da musculação), "Série `serieAtual` de `prescricao.series`", alvo
  formatado com `PrescricaoFormatadores.metrica` (reaproveitado, já lida
  com `tempo`/`repeticoes`), botão "Começar série"/"Concluir série" com
  cronômetro da série em andamento (mesmo padrão de
  `Cronometro`/`SinalSonoro` da musculação), botão "Ver vídeo"
  (`ligarBotaoVideo`, a partir de `bibliotecas.alongamentos[id].midia`) e
  imagem sempre visível (`ligarImagemExercicio(..., "alongamento")`, mesmo
  helper genérico por id de `js/imagem-exercicio.js`, passando o domínio
  `"alongamento"` pra resolver em `imagens/alongamento/<alongamentoId>.png`
  em vez de `imagens/musculacao/` — fica oculta pros alongamentos que
  ainda não têm imagem gerada, gerável com
  `src/python/gerar_imagens_treino.py --categoria alongamentos`, que
  sorteia gênero/etnia do personagem a cada imagem, ver seção 2.1 de
  [especificacao-biblioteca-exercicios.md](./especificacao-biblioteca-exercicios.md)).
- Descanso entre séries/alongamentos: mesma tela/cronômetro da musculação,
  alvo min/máx a partir de `prescricao.descansoSegundos` do item, ou um
  padrão de 15–30s quando ausente (treino de alongamento não tem
  `orientacoesGerais.descansoPadrao` — não é um treino de musculação).
- Concluída a última série do último slot, mostra a tela de conclusão
  (mesmo padrão "🎉 Treino concluído!") e volta ao menu — estático, sempre
  `treino_alongamento_menu.html`, mesmo comportamento (também estático) de
  `treino_execucao.html` ao concluir.
- Progresso persistido em `execucao.alongamento.<treinoId>.v1` (seção 7),
  endereçado por `alongamentoId`, pra retomar depois de fechar o
  navegador — mesmo princípio de `execucao.musculacao.<treinoId>.v2`.
- A cada série concluída, grava tanto em `historico.sessaoAlongamento.v1`
  (ao terminar o item inteiro) quanto em `historico.serieAlongamento.v1`
  (uma entrada por série, seção 7) — mirror exato de
  `historico.serieMusculacao.v1`/`historico.sessaoMusculacao.v1` na
  musculação.
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

Diferente de antes: sempre volta pra
`treino_alongamento_exercicios.html?treino=<treinoAlongamentoId>`,
repassando `?origem=` quando presente — é essa tela (seção 6) que decide
o próximo passo (voltar pro treino de musculação de origem ou pro menu de
alongamento). Mirror exato de como `treino_execucao.html` sempre volta
pra `treino_exercicios.html?treino=<id>` (nunca direto pro
`treino_exercicios_menu.html`).

### 5.4 Pular direto para um alongamento (`?alongamento=`)

Mirror de `?exercicio=`/`?opcao=` na musculação (seção 8.2.1 de
[treino-exercicios-especificacao.md](./treino-exercicios-especificacao.md)),
mas sem par de parâmetros — um slot de alongamento tem sempre uma única
opção (seção 5.2), então basta `?alongamento=<alongamentoId>`. Se o id
existir entre os slots, o progresso é resetado pra começar dali (série 1,
tempo acumulado zerado) e a URL é limpa via `history.replaceState` pra
`treino_alongamento.html?treino=<id>[&origem=...]`, sem o parâmetro
`alongamento` — mesmo tratamento da musculação. Usado pelo clique num
card de `treino_alongamento_exercicios.html` (seção 6).

## 6. Página do treino e progresso

### 6.1 Lista de alongamentos (`treino_alongamento_exercicios.html`)

Mirror de `treino_exercicios.html` (seção 6.2 de
[treino-exercicios-especificacao.md](./treino-exercicios-especificacao.md)),
mas sem aquecimento/superset/circuito/cardio/alongamento complementar
(nada disso existe num treino de alongamento, seção 8):

- Lê `?treino=<treinoAlongamentoId>` e o opcional
  `?origem=<treinoMusculacaoId>`.
- Um card por item de `treinoAlongamento.alongamentos` (ordenado por
  `ordem`): imagem sempre visível (`ligarImagemExercicio(..., "alongamento")`),
  nome, grupos musculares, "Série X" + métrica formatada, botão
  "Ver vídeo" e link "Ver progresso →" pra
  `treino_alongamento_progresso.html?alongamento=<id>&treino=<treinoAlongamentoId>`.
  Clicar no card (fora do link/botão) navega direto pra
  `treino_alongamento.html?treino=<treinoAlongamentoId>&alongamento=<id>[&origem=...]`
  — entra já executando aquele item.
- Botão "Iniciar treino →" no topo, virando "Continuar treino →" quando
  já existe `execucao.alongamento.<id>.v1` salvo — mesma checagem que
  `treino_exercicios.html` já faz com `execucao.musculacao.<id>.v2`.
- Botão de voltar: com `origem` → `treino_exercicios.html?treino=<origem>`;
  sem `origem` → `treino_alongamento_menu.html`.

### 6.2 Progresso do alongamento (`treino_alongamento_progresso.html`)

Mirror de `treino_exercicio_progresso.html` (seção 9 de
[treino-exercicios-especificacao.md](./treino-exercicios-especificacao.md)),
mas com **uma métrica só** (tempo sustentado, em segundos — sem
carga/repetições):

- Lê `?alongamento=<alongamentoId>&treino=<treinoAlongamentoId>`.
- `TreinosStorage.lerHistoricoAgregadoDoPlanoAtivo(TreinosStorage.chaves.historicoSerieAlongamento)`,
  filtrado por `alongamentoId` — mesmo padrão da tela de musculação.
- Aba Gráfico: linha única (tempo médio do dia, `GraficoProgressoAlongamento`
  em `js/grafico-linha.js`, ao lado de `GraficoProgressoExercicio`).
- Aba Tabela: colunas Série / Tempo / Hora.
- Botão de voltar → `treino_alongamento_exercicios.html?treino=<treinoAlongamentoId>`.
- Estado vazio: "Nenhuma série registrada ainda para este alongamento."
  quando não há entradas em `historico.serieAlongamento.v1` pra esse id.

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

Além disso, mirror de `historico.serieMusculacao.v1`: um registro por
**série concluída** (não só por alongamento inteiro), gravado em
`historico.serieAlongamento.v1` a cada "Concluir série" — é o que
alimenta `treino_alongamento_progresso.html` (seção 6.2) com
gráfico/tabela por item:

```json
{
  "treinoId": "mobilidade-quadril-pos-treino",
  "treinoNome": "Mobilidade de quadril pós-treino",
  "alongamentoId": "alongamento-de-posteriores-em-pe",
  "alongamentoNome": "Alongamento de posteriores em pé",
  "serie": 1,
  "duracaoSegundos": 22,
  "dataHora": "2026-07-21T18:45:08.112Z"
}
```

Sem `cargaKg`/`repeticoes` (não se aplicam, seção 8). Os dois históricos
convivem, mesma relação de `historico.sessaoMusculacao.v1` com
`historico.serieMusculacao.v1` na musculação.

## 8. Fora de escopo

- Superset/circuito/alternativas/técnicas na composição de um treino de
  alongamento (seção 2) — sempre sequencial simples.
- Carga, repetições realizadas e sugestão de ajuste de carga (não se
  aplicam a alongamento).
- Anexar/desanexar treinos de cardio ou alongamento a um treino de
  musculação pela interface — continua manual, editando
  `treino.alongamento[]`/`treino.cardio[]` no plano (seção 4.2).
- Cobertura completa de imagens pra todo o catálogo de alongamentos — o
  mecanismo já suporta (seção 5) e parte do catálogo já tem imagem
  gerada, mas ainda não é a biblioteca inteira.
