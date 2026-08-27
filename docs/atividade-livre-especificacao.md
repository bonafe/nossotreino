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

## 2. Árvore de tipos de atividade (`tiposAtividade`)

Loja própria no IndexedDB (`js/armazenamento-indexeddb.js`), **device-local**
(escopo global, não por aluno/plano — mesmo nível de `bibliotecaPersonalizada`)
e **não versionada no git** — diferente da biblioteca de exercícios. Cada
registro:

```json
{
  "id": "salsa",
  "nome": "Salsa",
  "tipoAtividadePaiId": "danca-de-salao",
  "criadoEm": "2026-08-26T14:00:00.000Z"
}
```

`tipoAtividadePaiId: null` marca um tipo raiz. Profundidade arbitrária —
`dança` → `dança de salão` → `salsa` é uma árvore de 3 níveis. A loja vem
semeada, dentro da própria migração de upgrade do banco
(`criarLojaDeTiposAtividade`), com duas raízes:

```json
[
  { "id": "musculacao", "nome": "Musculação", "tipoAtividadePaiId": null },
  { "id": "alongamento", "nome": "Alongamento", "tipoAtividadePaiId": null }
]
```

### Por que não reusar `DOMINIOS` (`js/dominios-biblioteca.js`)

`DOMINIOS` modela **domínio de biblioteca de exercícios** — cada entrada
carrega um `campos` (schema de formulário completo: nome, vídeo, grupo
muscular, equipamento...) usado por `exercicio_novo.html`/`biblioteca.html`
para cadastrar um item de exercício. É pesado demais pro que "tipo de
atividade" precisa: só um nome e uma posição na árvore. Os dois conceitos
são independentes — os ids das duas raízes semeadas (`musculacao`,
`alongamento`) coincidem com os de `DOMINIOS` só por familiaridade de UX
(quem já reconhece esses nomes no menu de biblioteca reconhece de novo
aqui); nenhum código lê um a partir do outro. Se um dia a biblioteca de
exercícios também passar a vir de contribuição da comunidade, os dois
conceitos podem convergir — ver
[dominios-taxonomia-especificacao.md](./dominios-taxonomia-especificacao.md).

### API (`TreinosStorage`, `js/storage.js`)

```js
TreinosStorage.listarTiposAtividade()               // todos os nós
TreinosStorage.listarFilhosDeTipoAtividade(paiId)
TreinosStorage.obterTipoAtividade(id)
TreinosStorage.caminhoTipoAtividade(id)              // [raiz, ..., item] — breadcrumb
TreinosStorage.criarTipoAtividade(nome, paiId)
TreinosStorage.recarregarTiposAtividade()            // re-hidrata após aba de criação
```

Sem edição/exclusão de tipo no v1 — ver seção 5 "Fora de escopo".

## 3. Telas / fluxo

```
sistema.html
   └─> atividade_livre_menu.html (histórico + gráfico) → atividade_livre_novo.html (lançar sessão)
                                                        └─> atividade_livre_tipo_novo.html (aba nova, criar tipo/subtipo)
```

### 3.1 Menu (`atividade_livre_menu.html`)

Mesmo padrão visual dos outros menus (`treino_bicicleta_menu.html`):
cabeçalho com voltar + botão "+" pra `atividade_livre_novo.html`, gráfico
de barras de tempo total (`GraficoBarrasHistorico`, todos os tipos
agregados juntos, sem filtro por tipo no v1) e, abaixo, a lista de
lançamentos — cada um mostrando o breadcrumb do tipo
(`TreinosStorage.caminhoTipoAtividade`), duração, data/hora e observação.
Não existe "card de treino" aqui — não há treino pré-cadastrado, cada
lançamento é o item de primeira classe.

### 3.2 Lançar sessão (`atividade_livre_novo.html`)

Formulário direto (sem passo de "criar treino" antes):

- **Tipo de atividade** — picker com busca por texto sobre
  `TreinosStorage.listarTiposAtividade()`, mostrando o breadcrumb completo
  pra diferenciar tipos de nomes parecidos em ramos diferentes da árvore.
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
- **Data**, **hora**, **duração (minutos)**, **observação** (opcional).
  Data e hora começam preenchidas com o momento atual
  (`#preencherAgora`); hora/duração são substituídas pela última sessão
  do tipo assim que ele é escolhido, como descrito acima.

Ao salvar: combina data+hora num `dataHora` ISO único, converte a duração
pra segundos, resolve o nome do tipo escolhido e grava via
`TreinosStorage.adicionarAoHistorico(TreinosStorage.chaves.historicoSessaoLivre, entrada)`
— ver seção 4 pro formato exato da entrada.

### 3.3 Criar tipo/subtipo (`atividade_livre_tipo_novo.html`)

Abre sempre em aba nova (`?voltar=atividade_livre_novo.html`, mesmo
parâmetro de `exercicio_novo.html`) — usada tanto pelo link "+ Não achou?
Criar tipo novo" de `atividade_livre_novo.html` quanto pelo "+" de
`biblioteca_dominios.html` (ver seção 26 de
`docs/especificacao-biblioteca-exercicios.md`), sem nenhuma variação de
comportamento entre as duas origens. Um campo de nome + um seletor de pai
(mesmo picker com busca por breadcrumb, mais a opção "— Nenhum (tipo
raiz) —") — `?pai=<id>` na query string pré-seleciona esse seletor (usado
por `biblioteca_dominios.html` pra já sugerir o nível que a pessoa estava
navegando como pai do tipo novo; a pessoa ainda pode trocar pelo picker
antes de criar). Ao salvar, `TreinosStorage.criarTipoAtividade(nome,
paiId)`, limpa o formulário e mostra uma mensagem inline de sucesso — mas,
diferente de `exercicio-novo.js` (que sempre navega pra `?voltar=` na
sequência), aqui **não navega sozinho**: a tela permanece pronta pra criar
mais um tipo (útil pra montar uma árvore de vários níveis de uma vez) e
revela um botão "Voltar" que só então navega pra `?voltar=`.

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
menu prefere o breadcrumb ao vivo (`caminhoTipoAtividade`) quando o tipo
ainda existe, e cai pro nome congelado como alternativa.

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

- **Edição/exclusão de um tipo já criado** (renomear, mover na árvore,
  apagar) — só criação no v1. Excluir um tipo com filhos ou histórico
  apontando pra ele exige antes decidir o que fazer com essas referências;
  fica pra quando o uso real mostrar necessidade.
- **Exclusão de um lançamento individual** — só reset total via
  engrenagem (`TreinosStorage.resetarAtividadeLivre()`), mesmo nível de
  granularidade que bicicleta/alongamento já têm hoje (nenhum dos dois
  tem exclusão por item — ver seção 8 de
  [armazenamento-local-especificacao.md](./armazenamento-local-especificacao.md)).
- **Filtro por tipo/subdomínio no gráfico do menu** — soma tudo junto no
  v1, mesma simplicidade dos outros dois menus.
- **Sincronização/consolidação da árvore com outros navegadores ou com uma
  comunidade** — a árvore é 100% local por enquanto. Visão de longo prazo
  registrada em
  [dominios-taxonomia-especificacao.md](./dominios-taxonomia-especificacao.md).
