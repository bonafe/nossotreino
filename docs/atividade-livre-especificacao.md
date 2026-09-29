# Especificação — Atividade Livre

## 1. Objetivo

Registrar horário e duração de qualquer atividade (pilates, natação,
dança, artes marciais, alongamento avulso...) sem depender de um treino
pré-cadastrado — diferente dos outros três pilares do sistema (bicicleta,
alongamento, musculação, ver `CLAUDE.md` seção "Motor genérico + JSON de
dados"), que só gravam histórico depois de completar um treino já
configurado com prescrição (`treinoCardioId`/`treinoAlongamentoId`/`treinoId`
existente no plano). Atividade livre é lançamento manual direto: escolher
um tipo, informar data/hora/duração, salvar — sem execução cronometrada,
sem prescrição, sem passo de "criar treino" antes.

Cobre o caso de uma atividade feita fora do sistema (aula de pilates,
natação num clube) e também o de repetir uma sessão de um domínio que já
existe (ex.: "fiz 15 minutos de alongamento avulso, sem abrir o treino
cadastrado").

## 2. Tipos de atividade (`tiposAtividade`)

Loja própria no IndexedDB (`js/armazenamento-indexeddb.js`), **device-local**
(escopo global, não por aluno/plano — mesmo nível de `bibliotecaPersonalizada`)
e **não versionada no git** — diferente da biblioteca de exercícios. Cada
registro:

```json
{
  "id": "judo",
  "nome": "Judô",
  "categoriaIds": ["artes-marciais-japonesas", "grappling"],
  "criadoEm": "2026-08-26T14:00:00.000Z"
}
```

`categoriaIds` é um array self-referencial (aponta pra outros ids desta
mesma coleção) — um item pode pertencer a **mais de uma categoria ao mesmo
tempo** (ex.: Judô é ao mesmo tempo "Artes marciais japonesas" e
"Grappling"; Capoeira poderia ser "Artes marciais" e "Dança"). `categoriaIds:
[]` marca um tipo raiz. Continua valendo o exemplo simples de um único
vínculo — `dança` → `dança de salão` → `salsa` é `salsa` com
`categoriaIds: ["danca-de-salao"]`. Como categorias também podem ter mais
de uma categoria-pai, é um **grafo**, não uma árvore estrita — toda leitura
que percorre a coleção (`TreinosStorage.caminhosTipoAtividade`, a
travessia de `biblioteca_dominios.html`) é defensiva contra ciclo por
construção. A loja vem semeada, dentro da própria migração de upgrade do
banco (`criarLojaDeTiposAtividade`), com duas raízes:

```json
[
  { "id": "musculacao", "nome": "Musculação", "categoriaIds": [] },
  { "id": "alongamento", "nome": "Alongamento", "categoriaIds": [] }
]
```

Formato anterior (pai único, `tipoAtividadePaiId: string|null`) migrado
preguiçosamente pra `categoriaIds` na hidratação (`migrarTipoAtividadeParaCategoriaIds`
em `js/storage.js`) e no envelope de backup (`migrarBackupDe4Para5`) — ver
seção 2 de [armazenamento-local-especificacao.md](./armazenamento-local-especificacao.md)
pro histórico completo de migrações.

### Por que não reusar `DOMINIOS` (`js/dominios-biblioteca.js`)

`DOMINIOS` modela **domínio de biblioteca de exercícios** — cada entrada
carrega um `campos` (schema de formulário completo: nome, vídeo, grupo
muscular, equipamento...) usado por `exercicio_novo.html`/`biblioteca.html`
para cadastrar um item de exercício. É pesado demais pro que "tipo de
atividade" precisa: só um nome e 0+ categorias. Os dois conceitos
são independentes — os ids das duas raízes semeadas (`musculacao`,
`alongamento`) coincidem com os de `DOMINIOS` só por familiaridade de UX
(quem já reconhece esses nomes no menu de biblioteca reconhece de novo
aqui); nenhum código lê um a partir do outro. Se um dia a biblioteca de
exercícios também passar a vir de contribuição da comunidade, os dois
conceitos podem convergir — ver
[dominios-taxonomia-especificacao.md](./dominios-taxonomia-especificacao.md).

### API (`TreinosStorage`, `js/storage.js`)

```js
TreinosStorage.listarTiposAtividade()                // todos os nós
TreinosStorage.listarPorCategoria(categoriaId)        // filhos de uma categoria (null = raízes)
TreinosStorage.obterTipoAtividade(id)
TreinosStorage.caminhosTipoAtividade(id)              // [[raiz, ..., item], ...] — todos os caminhos, mais curto primeiro
TreinosStorage.criarTipoAtividade(nome, categoriaIds) // categoriaIds: string[], default []
TreinosStorage.alterarCategoriasTipoAtividade(id, categoriaIds) // substitui a lista inteira, filtra ciclo
TreinosStorage.recarregarTiposAtividade()             // re-hidrata após aba de criação
```

Sem edição/exclusão de tipo no v1 — ver seção 5 "Fora de escopo".

## 3. Telas / fluxo

```
sistema.html
   ├─> atividade_livre_menu.html (histórico + gráfico) → atividade_livre_novo.html (lançar sessão)
   │                                                    └─> atividade_livre_tipo_novo.html (aba nova, criar tipo/subtipo)
   └─> agenda.html (📅, janela rolante de dias — ver docs/agenda-especificacao.md)
```

### 3.1 Menu (`atividade_livre_menu.html`)

Mesmo padrão visual dos outros menus (`treino_bicicleta_menu.html`):
cabeçalho com voltar + botão "+" pra `atividade_livre_novo.html`, gráfico
de barras de tempo total (`GraficoBarrasHistorico`, todos os tipos
agregados juntos, sem filtro por tipo no v1) e, abaixo, a lista de
lançamentos — cada um mostrando o breadcrumb canônico do tipo
(`TreinosStorage.caminhosTipoAtividade(id)[0]`), duração, data/hora e observação.
Não existe "card de treino" aqui — não há treino pré-cadastrado, cada
lançamento é o item de primeira classe.

### 3.2 Lançar sessão (`atividade_livre_novo.html`)

Alternador "Uma vez / Recorrente" no topo do formulário (`#modo`,
`js/paginas/atividade-livre-novo.js`) — dois botões-aba
(`aria-pressed`), decide o que acontece ao salvar (ver seção 4 abaixo pra
"uma vez" e `docs/agenda-especificacao.md` seção 2 pro shape da regra
recorrente). Tipo, duração e observação são compartilhados pelos dois
modos sem nenhuma duplicação de campo. O que muda é como data e hora são
capturadas:
- **Uma vez**: `<input type="date">` + um único `<input type="time">`
  compartilhado (`#campoUnica`/`#campoHoraUnica`).
- **Recorrente**: em vez de data, uma lista de 7 linhas (uma por dia da
  semana, rótulos de `DIAS_SEMANA`/`Formatadores.rotuloDia` em
  `js/formatadores.js`) — marcar o checkbox de um dia revela um
  `<input type="time">` **próprio daquele dia** (`#renderizarDiasSemana`).
  Dias diferentes podem ter horários diferentes na mesma regra (ex.:
  pilates terça de manhã, quinta à noite) — só a **duração** é
  obrigatoriamente igual pra todos os dias marcados, é um campo único
  fora da lista.

Formulário direto (sem passo de "criar treino" antes):

- **Tipo de atividade** — picker de seleção única com busca por texto
  sobre `TreinosStorage.listarTiposAtividade()`, mostrando o breadcrumb
  canônico (`caminhosTipoAtividade(id)[0]`, o mais curto) pra diferenciar
  tipos de nomes parecidos; a busca textual verifica **todos** os caminhos
  do item (assim buscar "grappling" acha Judô mesmo que o breadcrumb
  exibido seja o de "artes marciais japonesas"), e um item com mais de um
  caminho ganha um sufixo "+N outro(s) caminho(s)" na linha de ancestrais.
  Link "+ Não achou? Criar tipo novo" abre `atividade_livre_tipo_novo.html`
  numa aba nova (`target="_blank"`, mesmo padrão de
  `treino_musculacao_novo.html`/`exercicio_novo.html` — não perder o
  formulário em preenchimento). Ao voltar o foco pra esta aba,
  `TreinosStorage.recarregarTiposAtividade()` roda de novo (mirror exato
  de `treino-musculacao-novo.js`), refletindo o tipo criado sem recarregar
  a página. Ao escolher o tipo, busca a atividade mais recente daquele
  mesmo tipo no histórico agregado do aluno ativo
  (`TreinosStorage.lerHistoricoAgregadoDoPlanoAtivo(chaves.historicoSessaoLivre)`,
  mesma fonte de `atividade_livre_menu.js` — todos os ciclos, não só o
  atual) e, se existir, sobrescreve **hora** e **duração** com os valores
  daquela última sessão (chute melhor que "agora" pra atividade que
  sempre acontece no mesmo horário/duração, ex.: pilates toda terça às
  19h por 60min). A **data** nunca é sobrescrita — continua sempre hoje.
  Só roda no modo "uma vez" (recorrente não tem uma data única pra
  âncorar a busca da "última sessão").
- **Duração (minutos)** e **observação** (opcional) — compartilhados
  pelos dois modos. Data/hora (uma vez) ou os horários por dia
  (recorrente) começam preenchidos com o momento atual
  (`#preencherAgora`); no modo "uma vez", hora/duração são substituídas
  pela última sessão do tipo assim que ele é escolhido, como descrito
  acima.

**Modo "uma vez"**: ao salvar, combina data+hora num `dataHora` ISO
único, converte a duração pra segundos, resolve o nome do tipo escolhido
e grava via
`TreinosStorage.adicionarAoHistorico(TreinosStorage.chaves.historicoSessaoLivre, entrada)`
— ver seção 4 pro formato exato da entrada. Redireciona pra
`atividade_livre_menu.html`.

#### 3.2.1 Início/fim cronometrados (alternativa a digitar data/hora/duração)

Só no modo "uma vez" (uma regra recorrente não tem um "agora" pra
âncorar a contagem — o bloco some da tela em modo "Recorrente"). Em vez
de preencher data, hora e duração à mão, um botão "▶️ Iniciar agora":

1. Grava o momento exato (`new Date().toISOString()`) mais o tipo já
   escolhido (se houver) em `execucao.atividadeLivre.v1`
   (`TreinosStorage.chaves.execucaoAtividadeLivre`) — chave de execução
   em andamento, mesma família de `execucao.musculacao.<id>.v2`/
   `execucao.alongamento.<id>.v1` (ver seção 2 de
   [armazenamento-local-especificacao.md](./armazenamento-local-especificacao.md)),
   só que sem `treinoId` de verdade: como só pode existir uma contagem
   por vez, o `treinoId` físico é a constante `"unica"`.
2. Preenche os campos de data e hora com esse mesmo momento e os trava
   (`disabled`) — eles deixam de ser editáveis à mão enquanto a contagem
   roda, já que representam o início real.
3. Mostra um cronômetro (`Formatadores.relogio`, atualizado a cada
   segundo) calculado sempre a partir da diferença entre `Date.now()` e o
   início gravado — nunca um contador em memória por si só. É esse
   detalhe que permite fechar a aba/aplicativo e reabrir depois (mesmo
   horas depois) com o tempo decorrido certo: `atividade-livre-novo.js`
   lê `execucao.atividadeLivre.v1` ao carregar a tela
   (`#retomarSessaoEmAndamento`) e, se houver uma sessão, já reaparece no
   estado "rodando" com os campos travados e o cronômetro no valor
   correto, sem precisar de nenhum recurso além do que `storage.js` já
   hidrata no carregamento da página.
4. Troca o tipo de atividade enquanto a contagem roda apenas atualiza o
   tipo gravado na sessão em andamento (`#persistirSessaoEmAndamento`) —
   não reaproveita o chute de "última sessão do tipo" (seção 3.2 acima),
   que só faz sentido pro lançamento manual sem cronômetro.
5. Dois botões ficam visíveis enquanto a contagem roda:
   - **Terminar** — calcula os segundos decorridos, preenche o campo de
     duração (minutos arredondados, mínimo 1) e volta a tela ao estado
     normal (campos de data/hora destravados, botão "Iniciar" de volta)
     — mas **não salva sozinho**: a pessoa ainda confirma com "Registrar
     atividade", podendo revisar/corrigir os campos antes.
   - **Cancelar** — descarta a contagem (remove
     `execucao.atividadeLivre.v1`) sem preencher nada, e repõe data/hora
     pro momento atual (`#preencherAgora`), como se a tela tivesse acabado
     de abrir.

   Os dois removem a chave de execução em andamento — assim como o
   próprio "Registrar atividade", que também limpa a sessão se a pessoa
   salvar direto sem passar por "Terminar" (evita deixar uma contagem
   fantasma pra reaparecer na próxima visita).

`TreinosStorage.resetarAtividadeLivre()` (reset da engrenagem) também
limpa `execucao.atividadeLivre.v1`, e ela entra em
`montarExportacaoCompletaDoPlano`/backup completo junto com as outras
`execucao.*` do plano — nenhuma chave nova de esquema, é só mais um valor
de `tipo` na loja `execucoes` já existente, não exige bump de
`VERSAO_BANCO` (mesmo precedente de `historico.sessaoLivre.v1`, que
também só acrescentou um valor de `tipo` na loja `historico` já
existente).

**Modo "recorrente"**: exige ao menos um dia da semana marcado, cada um
com sua própria hora preenchida; ao salvar, chama
`TreinosStorage.criarAtividadeRecorrente({ tipoAtividadeId, horarios, duracaoSegundos, observacao })`
e redireciona pra `agenda.html` — ver `docs/agenda-especificacao.md` pro
formato da regra e o que a Agenda faz com ela.

### 3.3 Criar tipo/subtipo (`atividade_livre_tipo_novo.html`)

Abre sempre em aba nova (`?voltar=atividade_livre_novo.html`, mesmo
parâmetro de `exercicio_novo.html`) — usada tanto pelo link "+ Não achou?
Criar tipo novo" de `atividade_livre_novo.html` quanto pelo "+" de
`biblioteca_dominios.html` (ver seção 26 de
`docs/especificacao-biblioteca-exercicios.md`), sem nenhuma variação de
comportamento entre as duas origens. Um campo de nome + uma lista de
chips de categorias escolhidas, com um botão "+ Adicionar categoria…" que
abre o mesmo picker com busca por breadcrumb — clicar num resultado
alterna a seleção (`aria-pressed`) e **não fecha o overlay**, permitindo
marcar várias categorias em sequência; cada chip tem um "×" pra remover.
Zero chips = tipo raiz (substitui a antiga opção fixa "— Nenhum (tipo
raiz) —", agora implícita). Ao salvar,
`TreinosStorage.criarTipoAtividade(nome, categoriaIds)`, limpa o
formulário (incluindo os chips) e mostra uma mensagem inline de sucesso —
mas, diferente de `exercicio-novo.js` (que sempre navega pra `?voltar=` na
sequência), aqui **não navega sozinho**: a tela permanece pronta pra criar
mais um tipo (útil pra montar vários vínculos de uma vez) e revela um
botão "Voltar" que só então navega pra `?voltar=`.

`?editar=<id>` troca o modo da tela inteira: em vez de criar, "Editar
categorias" de um tipo já existente (alcançado pelo link "✏️ Categorias"
de `biblioteca.html`, ver seção 26 de
`docs/especificacao-biblioteca-exercicios.md`). O campo de nome vem
preenchido e desabilitado (só mudam as categorias, não o nome), os chips
vêm pré-preenchidos com as categorias atuais, e o picker exclui o próprio
tipo e qualquer candidata cujo **algum** caminho passe por ele — não teria
como escolhê-los sem criar um ciclo em `caminhosTipoAtividade`. Ao salvar,
`TreinosStorage.alterarCategoriasTipoAtividade(id, categoriaIds)` (que
recebe a lista completa nova e filtra silenciosamente qualquer candidata
que ainda assim fechasse ciclo, como defesa em profundidade) e revela o
botão "Voltar" — aqui não tem sentido continuar editando outro tipo na
mesma tela, então não limpa nem oferece continuar.

## 4. Formato do histórico (`historico.sessaoLivre.v1`)

```json
{
  "tipoAtividadeId": "pilates",
  "tipoAtividadeNome": "Pilates",
  "dataHora": "2026-08-26T14:30:00.000Z",
  "duracaoSegundos": 2400,
  "observacao": null
}
```

`tipoAtividadeNome` fica **congelado** no momento do lançamento (mesmo
princípio de `alongamentoNome` em `historico.sessaoAlongamento.v1`) —
sobrevive mesmo que o tipo venha a ser renomeado no futuro (hoje não há
tela de renomear, mas o padrão já protege o histórico contra isso). O
menu prefere o breadcrumb canônico ao vivo (`caminhosTipoAtividade(id)[0]`)
quando o tipo ainda existe, e cai pro nome congelado como alternativa.

`dataHora`/`duracaoSegundos` (em vez de campos separados de data, hora e
minutos) porque é exatamente o shape que `GraficoBarrasHistorico`
(`js/grafico-barras.js`) já sabe consumir sem nenhuma mudança nele — o
formulário continua coletando data, hora e duração em minutos
separadamente; a conversão pra este formato acontece no controller antes
de salvar.

Agregado por aluno, como todo histórico (`TreinosStorage.lerHistoricoAgregadoDoAluno`/
`lerHistoricoAgregadoDoPlanoAtivo` — ver seção 3.5 de
[armazenamento-local-especificacao.md](./armazenamento-local-especificacao.md)):
soma o histórico de **todos os planos do aluno ativo**, não só do ciclo
atual.

## 5. Fora de escopo

- **Edição/exclusão de um tipo já criado** (renomear, apagar) — só criação
  e edição de categorias no v1. Excluir um tipo com dependentes ou
  histórico apontando pra ele exige antes decidir o que fazer com essas
  referências; fica pra quando o uso real mostrar necessidade.
- **Exclusão de um lançamento individual** — só reset total via
  engrenagem (`TreinosStorage.resetarAtividadeLivre()`), mesmo nível de
  granularidade que bicicleta/alongamento já têm hoje (nenhum dos dois
  tem exclusão por item — ver seção 8 de
  [armazenamento-local-especificacao.md](./armazenamento-local-especificacao.md)).
- **Filtro por tipo/subdomínio no gráfico do menu** — soma tudo junto no
  v1, mesma simplicidade dos outros dois menus.
- **Sincronização/consolidação da coleção com outros navegadores ou com
  uma comunidade** — é 100% local por enquanto. Visão de longo prazo
  registrada em
  [dominios-taxonomia-especificacao.md](./dominios-taxonomia-especificacao.md).
