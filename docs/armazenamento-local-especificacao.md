# Especificação — Armazenamento local (localStorage)

## 1. Objetivo

O site não tem backend: cada página HTML roda isolada no navegador do
aluno. Esta especificação define como passamos a usar `localStorage` do
navegador para dois propósitos:

1. **Plano de treino** — dado pessoal (nome do professor/aluno, datas do
   ciclo, os treinos prescritos), nunca publicado junto com o site. Os
   dados só existem depois que o aluno os carrega manualmente uma vez,
   pela tela [importar_dados.html](../importar_dados.html), e ficam
   salvos no `localStorage` daquele navegador dali em diante (ver seção
   3). **A biblioteca de exercícios (`biblioteca-exercicios.json`) não
   entra aqui** — não é dado pessoal, é um arquivo estático versionado no
   repositório e carregado por `fetch` a cada página, sem passar por
   `localStorage` (ver
   [especificacao-biblioteca-exercicios.md](./especificacao-biblioteca-exercicios.md)
   seção 2.1).
2. **Histórico de execução** — guardar, no próprio navegador do aluno, o
   que foi realmente feito em cada treino (treinos de bike concluídos,
   séries de musculação com carga/repetições), para no futuro gerar totais
   e relatórios.

Isso cobre a parte de **dados** funcionando offline. A outra metade — as
**páginas em si** (HTML/CSS/JS) abrindo sem internet, inclusive num link
publicado — é responsabilidade do service worker, ver
[pwa-offline-especificacao.md](./pwa-offline-especificacao.md).

É usado por [sistema.html](../sistema.html),
[importar_dados.html](../importar_dados.html),
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

| Chave (sem prefixo) | Conteúdo |
|---|---|
| `dadosTreinos.v2` | Plano de treino carregado manualmente pelo aluno em [importar_dados.html](../importar_dados.html) |
| `dadosTreinosCarregadoEm.v1` | Data/hora (ISO 8601) em que essa cópia foi salva |
| `historico.sessaoBicicleta.v1` | Array — um registro por treino de bike concluído por inteiro (bike não registra ciclo a ciclo, só o treino completo) |
| `historico.serieMusculacao.v1` | Array — um registro por série de exercício concluída (carga/repetições) |
| `historico.sessaoMusculacao.v1` | Array — um registro por treino de exercícios concluído por inteiro |
| `historico.sessaoAlongamento.v1` | Array — um registro por alongamento concluído por inteiro (mesmo padrão de `historico.sessaoMusculacao.v1`), ver seção 7 de [treino-alongamento-especificacao.md](./treino-alongamento-especificacao.md) |
| `execucao.musculacao.<treinoId>.v2` | Estado do treino de exercícios em andamento (para retomar após fechar a página) — endereçado por `exercicioId`, não por índice posicional |
| `execucao.alongamento.<treinoId>.v1` | Estado do treino de alongamento em andamento — mesmo princípio de `execucao.musculacao.<treinoId>.v2`, endereçado por `alongamentoId` |
| `preferencias.generoImagem.v1` | `"masculino"` ou `"feminino"` — escolhido na engrenagem de configurações (`sistema.html`), define qual variante das imagens (`biblioteca-exercicios/imagens/musculacao/<exercicioId>__<genero>.png` ou `biblioteca-exercicios/imagens/alongamento/<alongamentoId>__<genero>.png`) é exibida |

`dadosTreinos.v1`/`execucao.musculacao.<treinoId>.v1` (formato anterior,
com `blocos`/`itens` e progresso por índice) não são mais lidos — a
troca de versão da chave é o padrão do projeto para mudança de formato,
sem migração automática do conteúdo antigo.

## 3. Carregamento manual do plano de treino

Nenhuma página faz `fetch()` do plano de treino. Como ele é pessoal e
nunca é publicado junto com o site (seção 1), um `fetch` relativo só
funcionaria em desenvolvimento local, com o arquivo presente em disco, e
falharia sempre em qualquer versão publicada do site. Em vez disso, o
site trata `localStorage` como a **única** fonte do plano, igual em
qualquer ambiente (local ou publicado) — a biblioteca de exercícios é o
caso oposto: **sempre** vem por `fetch`, nunca por importação manual (ver
seção 1).

### 3.1 `importar_dados.html`

Tela dedicada para colar o conteúdo do arquivo do plano (ou escolher o
arquivo do disco, lido com `FileReader`) e salvar no `localStorage`.
Antes de salvar, confere se o JSON tem os campos esperados (`schema`,
`metadata`, `distribuicaoSemanal`, `treinos`) — ver seção 2.2 de
[especificacao-biblioteca-exercicios.md](./especificacao-biblioteca-exercicios.md)
pra descrição de cada um. Mostra também o status atual (quantos treinos
estão carregados e quando) pra confirmar que deu certo, ou pra saber se
precisa recarregar depois de o professor atualizar o plano.

Precisa ser feito uma vez por navegador/aparelho — não sincroniza
sozinho entre eles (seção 6).

### 3.2 `TreinosStorage.carregarDadosTreinos()`

Usada por todas as páginas que precisam do plano, no lugar de ler
`dadosTreinos.v2` na mão:

```js
async function carregarDadosTreinos() {
  const cache = lerJSON("dadosTreinos.v2", null);
  if (cache) return cache;
  throw new Error("Nenhum dado de treino carregado ainda.");
}
```

Se ainda não houver nada salvo (primeira visita nesse navegador, ou
depois de limpar dados do site), rejeita — cada página trata isso
mostrando um link para `importar_dados.html` (ver seção 6.2 de
[treino-exercicios-especificacao.md](./treino-exercicios-especificacao.md)
e seção 5 de
[treino-bicicleta-especificacao.md](./treino-bicicleta-especificacao.md)).
A biblioteca de exercícios usa um carregamento à parte,
`carregarBiblioteca()` (`js/biblioteca-exercicios.js`, `fetch`, sem
`localStorage`) — páginas que mostram nome/vídeo/grupo muscular de
exercício carregam os dois em paralelo.

### 3.3 `TreinosStorage.definirDadosTreinos(dados)`

```js
function definirDadosTreinos(dados) {
  salvarJSON("dadosTreinos.v2", dados);
  salvarJSON("dadosTreinosCarregadoEm.v1", new Date().toISOString());
}
```

Usada por `importar_dados.html` para gravar um novo conjunto de dados
(inclui atualizar `dadosTreinosCarregadoEm.v1`, usada só pra exibir
"carregado em ..." no status).

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
TreinosStorage.carregarDadosTreinos()        // Promise<dados> — lê do localStorage, rejeita se vazio; ver seção 3.2
TreinosStorage.definirDadosTreinos(dados)    // grava dados + data de carregamento; ver seção 3.3
TreinosStorage.lerJSON(chave, padrao)        // lê e faz JSON.parse; retorna `padrao` se não existir/der erro
TreinosStorage.salvarJSON(chave, valor)      // faz JSON.stringify e grava; nunca lança erro
TreinosStorage.adicionarAoHistorico(chave, entrada) // lê array (ou []), dá push, salva de volta
```

`chave` nessas funções é sempre sem o prefixo `treinos.` — a função monta
o nome completo internamente.

Toda escrita é protegida por `try/catch`: se `localStorage` estiver
indisponível (modo privado do navegador, quota cheia etc.), a gravação
falha silenciosamente em vez de quebrar a página. O treino continua
funcionando, só o histórico daquela sessão não é salvo.

## 6. Limitações

- `localStorage` é por origem (protocolo + host + porta) **e por
  navegador/aparelho** — não sincroniza entre o celular e o computador,
  por exemplo, nem entre navegadores diferentes no mesmo aparelho. Isso
  vale para o histórico e para o plano de treino: é preciso passar por
  `importar_dados.html` em cada navegador/aparelho onde o site for usado.
  A biblioteca de exercícios **não** tem essa limitação — vem por `fetch`
  a cada página, então é a mesma em qualquer navegador/aparelho sem
  precisar de nenhuma ação manual.
- Limpar dados de navegação / dados do site apaga tudo — histórico **e**
  o plano de treino importado (é preciso importar de novo). A biblioteca
  de exercícios não é afetada (não vive em `localStorage`).
- Quota é pequena (alguns MB), mas de sobra para o volume de texto
  gerado por esse histórico e pelos dados de treino.
- Quando o professor atualiza o plano, é preciso reimportar
  manualmente em `importar_dados.html` — não há aviso automático de que
  os dados ficaram desatualizados.

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
- Exportar/importar ou sincronizar **histórico** entre aparelhos (os
  dados de treino em si já são importáveis, via `importar_dados.html`
  — seção 3.1 — mas isso é diferente do histórico de execução).
- Editar ou apagar entradas de histórico pela interface.
