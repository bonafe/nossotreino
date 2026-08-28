# Especificação — Agenda e atividades recorrentes

## 1. Objetivo

Fase 1 de um recurso maior: permitir registrar uma atividade (ver
`docs/atividade-livre-especificacao.md`) não só como um lançamento
pontual (uma data específica), mas também como uma **regra recorrente**
(um ou mais dias da semana, cada um com seu próprio horário — só a
duração é obrigatoriamente igual pra todos os dias da mesma regra; se um
dia precisa de duração diferente, isso é uma segunda regra, não uma
variante da mesma). `agenda.html` (📅 em `sistema.html`) mostra, numa
janela rolante de dias (não uma semana-calendário fixa segunda-domingo),
o que está previsto pra cada dia e o que já foi de fato registrado,
permitindo marcar cada ocorrência de uma regra como "feito" ou "não
aconteceu".

Musculação já tem um dia da semana atribuído por treino
(`distribuicaoSemanal` no plano, ver seção 3 abaixo) — a Agenda aproveita
isso pra mostrar, só no dia de hoje, um link direto pro treino do dia.
Nenhuma mudança na lógica de "continuar de onde parou"
(`treino_musculacao_menu.js`/`treino_execucao.js`): ela já funciona por
`treinoId`, sem depender de data — o link da Agenda só precisa apontar
pro treino certo.

**Fora de escopo desta fase** (registrado explicitamente, não esquecido):
- Alongamento e bicicleta não ganham recorrência nem aparecem na Agenda.
- Não existe editor pra atribuir treino a um dia da semana
  (`distribuicaoSemanal` continua só editável por fora, via
  importação/exportação do plano).
- Não existe estatística de adesão ("fez 6 de 8 pilates este mês") — só o
  registro bruto de feito/faltou, que poderia alimentar isso no futuro.
- Não é possível editar uma regra recorrente já criada (só criar e
  excluir) nem trocar uma ocorrência de "feito" pra outro status depois
  de confirmada (ver seção 4).
- A visão de dia não agrega `historico.sessaoMusculacao`/
  `sessaoAlongamento`/`sessaoBicicleta` — só `historico.sessaoLivre.v1` e,
  só pra hoje, `distribuicaoSemanal`.

## 2. Formato do dado (`atividadesRecorrentes`)

Campo novo dentro do documento opaco do plano (`dados.v1`, mesmo lugar de
`treinos`/`treinosCardio`/`treinosAlongamento`/`distribuicaoSemanal`) —
**não** é uma loja global como `tiposAtividade`: vive dentro do plano
ativo, duplica junto quando a pessoa cria um novo ciclo (mesmo
`structuredClone` que já duplica treinos, ver `TreinosStorage.duplicarPlano`
em `js/storage.js`) e isola por aluno automaticamente (cada aluno tem seu
próprio plano ativo).

```json
{
  "id": "pilates",
  "tipoAtividadeId": "pilates",
  "tipoAtividadeNome": "Pilates",
  "horarios": [
    { "dia": "terca-feira", "hora": "07:00" },
    { "dia": "quinta-feira", "hora": "19:00" }
  ],
  "duracaoSegundos": 3600,
  "observacao": null,
  "criadoEm": "2026-08-27T22:31:00.000Z",
  "confirmacoes": [
    { "data": "2026-08-25", "status": "faltou" },
    { "data": "2026-08-27", "status": "feito", "duracaoSegundos": 3600 }
  ]
}
```

`tipoAtividadeId` referencia a mesma árvore `tiposAtividade` do picker de
`atividade_livre_novo.html` (ver seção 2 de
`docs/atividade-livre-especificacao.md`) — qualquer tipo cadastrado ali
serve, incluindo as raízes `musculacao`/`alongamento` se a pessoa quiser
(sem restrição especial). `horarios` é um array de `{dia, hora}` — um
horário por dia da semana marcado, não um horário só compartilhado; `dia`
usa os mesmos 7 ids de `distribuicaoSemanal` (`DIAS_SEMANA`, agora
exportado de `js/formatadores.js`). `duracaoSegundos` é o único campo
obrigatoriamente igual pra todos os dias da regra.

`confirmacoes` é um livro-razão de "esta (regra, data) já foi resolvida,
e como" — **nunca** uma fonte alternativa de estatística. Quando o status
é `"feito"`, o código *também* grava uma entrada normal em
`historico.sessaoLivre.v1` (mesmo shape de sempre, ver seção 4 de
`docs/atividade-livre-especificacao.md`), reaproveitando 100% do código
de leitura/gráfico já existente (`atividade-livre-menu.js`,
`GraficoBarrasHistorico`) sem tocar em nenhum deles — uma entrada de
histórico originada de uma confirmação "feito" é indistinguível de um
lançamento avulso normal, de propósito. Quando o status é `"faltou"`,
nada é gravado no histórico (evita sujar o gráfico de duração com
zeros).

Excluir uma regra (`excluirAtividadeRecorrente`) nunca apaga histórico já
gravado — mesma filosofia append-only do resto do projeto.

### Migração de schema

`SCHEMA_VERSION_PLANO_ATUAL` subiu de `"1.3"` pra `"1.4"`
(`js/storage.js`), com `MIGRACOES_PLANO["1.3"] = migrarPlanoDe13Para14`
semeando `atividadesRecorrentes: []` num plano antigo que ainda não tinha
o campo. Como a cadeia de migração só roda em `importarPlano`/
`restaurarBackup` (nunca na hidratação normal de página, lacuna
pré-existente do projeto, não introduzida por esta feature), todo ponto
de leitura de `atividadesRecorrentes` lê defensivamente
`dados.atividadesRecorrentes || []` em vez de assumir presença
garantida.

Backup: não precisa de migração própria — `dados.v1` viaja como blob
opaco dentro do pacote de exportação/backup, `atividadesRecorrentes`
segue junto automaticamente.

## 3. `distribuicaoSemanal` (não é novo, só reaproveitado)

Já existia antes desta feature — array de 7 `{dia, treinoId}` dentro do
plano, um por dia da semana, usado hoje só como destaque cosmético
("Hoje ·") em `treino_musculacao_menu.js`. A Agenda lê o mesmo campo pra
mostrar, só na célula de hoje, um link pro treino prescrito daquele dia
(se `treinoId` não for nulo). Atribuir um treino a um dia da semana
continua manual (editar o plano por fora) — nenhum editor novo nesta
fase.

## 4. API (`js/storage.js`)

```js
TreinosStorage.listarAtividadesRecorrentes()
TreinosStorage.criarAtividadeRecorrente({ tipoAtividadeId, horarios, duracaoSegundos, observacao })
TreinosStorage.excluirAtividadeRecorrente(id)
TreinosStorage.confirmarAtividadeRecorrente(regraId, data, status, duracaoSegundosOverride)
```

`confirmarAtividadeRecorrente` é idempotente: substitui qualquer
confirmação anterior pra aquela mesma data (permite corrigir um toque
errado de faltou→feito). Pra montar o `dataHora` do histórico quando o
status é `"feito"`, resolve o dia da semana de `data` com o construtor
local `new Date(ano, mes - 1, dia)` (nunca parseando `"AAAA-MM-DD"` como
ISO — isso leria a data como meia-noite UTC, que vira o dia anterior em
fusos negativos como o do Brasil) e busca o horário correspondente em
`regra.horarios`. **Limitação de fase 1**: uma vez marcada `"feito"`, não
há caminho pra trocar de status — o projeto não tem exclusão de item de
histórico ainda, e desfazer um "feito" exigiria remover a entrada já
gravada. "Faltou" pode virar "feito" livremente (só adiciona ao
histórico, nunca precisa remover).

## 5. Tela (`agenda.html`)

### Janela rolante

Não é uma semana-calendário fixa (segunda a domingo) — é uma janela de 7
dias com 3 antes de hoje e 3 depois (`OFFSET_INICIAL = -3` em
`js/paginas/agenda.js`), sempre incluindo hoje quando o deslocamento é 0.
Botões "◀ Anteriores"/"Próximos ▶" deslocam a janela em blocos de 7 dias;
"Hoje" volta o deslocamento pra 0.

### O que cada célula de dia mostra

1. **Pendente** — uma regra com um horário cadastrado pro dia da semana
   da célula (`regra.horarios.find(h => h.dia === diaSemana)`) e que
   ainda não tem confirmação pra aquela data exata: linha clicável (hora
   daquele dia específico + nome do tipo) que expande um mini-menu inline
   com "✓ Feito"/"✗ Não aconteceu" (não é um overlay modal — pensado pra
   uso diário rápido).
2. **Resolvido** — regra com confirmação pra aquela data: "✓ `<tipo>`" em
   destaque (feito, fixo, não clicável) ou "✗ `<tipo>`" (faltou,
   continua clicável pra virar feito).
3. **Treino de hoje** — só na célula que é literalmente hoje (não se
   repete nos outros dias da janela, já que `distribuicaoSemanal` é uma
   prescrição repetida toda semana, não um evento datado): link
   somente-leitura pro treino de musculação do dia, se houver um
   atribuído.
4. **Lançamentos avulsos** — qualquer entrada de
   `historico.sessaoLivre.v1` cuja data bate com a célula (inclui, sem
   duplicar de forma problemática, os que vieram de uma confirmação
   "feito" — mostrar os dois juntos é aceitável).

### Criar regra recorrente

Link "+" no cabeçalho da Agenda abre `atividade_livre_novo.html` sem
parâmetro especial — a pessoa escolhe "Recorrente" no alternador de lá
(ver seção 3.2 de `docs/atividade-livre-especificacao.md`). Ao salvar uma
regra recorrente, o redirecionamento vai pra `agenda.html` (não pra
`atividade_livre_menu.html`, que é sobre o que já aconteceu — Agenda é
sobre o que está previsto).

## 6. Observações registradas, não bloqueantes

- Duplicar um plano (`TreinosStorage.duplicarPlano`) copia
  `atividadesRecorrentes` **com** `confirmacoes` — não só a definição da
  regra. Pode parecer estranho ver dias "já resolvidos" de um ciclo
  anterior logo após duplicar no meio de uma semana já parcialmente
  confirmada no ciclo antigo. Não é um bug: é consequência de
  `atividadesRecorrentes` viver dentro do mesmo blob opaco que
  `historico` (esse sim nunca duplicado) não vive.
- "Resetar dados de atividade livre" (menu de configurações de
  `sistema.html`) também limpa `atividadesRecorrentes` do plano ativo,
  além do histórico — ver `TreinosStorage.resetarAtividadeLivre`.
