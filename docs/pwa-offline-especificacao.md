# Especificação — App shell offline (service worker / PWA)

## 1. Objetivo

O site já funciona offline no que diz respeito aos **dados de treino**: eles
vivem só em `localStorage`, escolhidos/criados manualmente em
[planos.html](../planos.html) (ver
[armazenamento-local-especificacao.md](./armazenamento-local-especificacao.md)).
Essa especificação cobre a segunda parte do problema: fazer as **páginas em
si** (HTML/CSS/JS) carregarem mesmo sem internet, depois de um primeiro
acesso — hoje isso só é garantido rodando local (`file://` ou `serve.py`);
um link publicado (ex.: GitHub Pages) aberto do zero, sem internet nenhuma,
não tinha garantia de abrir.

A solução é um **service worker** ([`sw.js`](../sw.js)) que guarda os
arquivos do "app shell" (as páginas, `storage.js`, `d3.v7.min.js`) num
cache do navegador (`CacheStorage`, diferente do cache HTTP comum) e passa
a servir esse cache quando a rede falhar.

Fora de escopo aqui (não mexido nesta rodada — ver pedido original):

- Cache dos dados de treino via `fetch` — já não existe mais `fetch` pra
  esses dados (seção 3 do doc de armazenamento local); não há nada a
  cachear ali, o service worker não participa dessa parte.

Os vídeos dos exercícios (`exercicio.videoMagnet`) não fazem parte do app
shell coberto aqui — eles são baixados por torrent e guardados num cache
próprio (`treinos-videos.v1`, separado do `CACHE_NOME` deste documento), ver
[torrent-videos-especificacao.md](./torrent-videos-especificacao.md#6-armazenamento-local-cache-api-não-localstorage-nem-indexeddb).
Diferente da geração anterior deste site, os vídeos **funcionam offline**
depois de baixados uma vez.

## 2. Registro (`storage.js`)

`storage.js` é carregado em toda página do site, então o registro do
service worker fica ali (não precisa repetir em cada `.html`):

```js
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
```

- Registra depois do evento `load` (não atrasa o carregamento da página).
- `.catch(() => {})`: se o navegador não suportar, ou a página estiver
  rodando sem HTTPS/`localhost` (service worker exige "contexto seguro" —
  não funciona em `file://`), o registro falha silenciosamente e o site
  segue funcionando normalmente, só sem o cache offline do app shell.
- Chamar `.register()` de novo em cada carregamento é seguro/barato — o
  navegador só reinstala se o conteúdo de `sw.js` mudou.

## 3. `sw.js` — o que é cacheado

```js
const ARQUIVOS_PARA_CACHE = [
  "index.html",
  "planos.html",
  "sistema.html",
  "treino_bicicleta_menu.html",
  "treino_bicicleta.html",
  "treino_exercicios_menu.html",
  "treino_exercicios.html",
  "treino_execucao.html",
  "treino_exercicio_progresso.html",
  "storage.js",
  "d3.v7.min.js",
  "webtorrent.min.js"
];
```

Essa lista é o app shell inteiro: toda página `.html` da raiz do site,
os `.js`/`.css` compartilhados, e — diferente de antes —
`biblioteca-exercicios.json`: não é dado pessoal (ver
[especificacao-biblioteca-exercicios.md](./especificacao-biblioteca-exercicios.md)
seção 2.1), é buscado por `fetch` a cada página, então precisa estar no
app shell pra esse `fetch` funcionar offline depois da primeira visita.
**Não inclui** o plano de treino (dado pessoal, nunca publicado, só
existe no `localStorage` de quem importou) nem `serve.py` (roda no
servidor, o navegador nunca busca esse arquivo).

No evento `install`, cada arquivo da lista é cacheado **individualmente**
(`cache.add(arquivo)`, um por um, dentro de um `Promise.allSettled`) em vez
de um `cache.addAll(ARQUIVOS_PARA_CACHE)` só. Isso é deliberado: a primeira
versão usava `cache.addAll`, que é **tudo ou nada** — se um único arquivo
da lista falhasse, **nenhum** entrava no cache, e o erro não aparecia em
lugar nenhum visível. Na prática isso mordeu no Safari/Chrome do iOS: o
pré-cache falhava inteiro (silenciosamente) e o app shell só ia sendo
cacheado aos poucos, página por página, conforme a pessoa visitava cada
uma (efeito colateral do `fetch` handler da seção 4) — dava a impressão de
"só funciona offline a página que eu já abri antes". Com
`Promise.allSettled`, uma falha isolada (ex.: um arquivo temporariamente
inacessível) não derruba as outras — e o erro de cada falha vai pro
console (`console.warn`) em vez de sumir. Ainda assim, a lista precisa
ficar em dia com os arquivos reais da raiz do projeto.

## 4. Estratégia: rede primeiro, cache como reserva

```js
self.addEventListener("fetch", (evento) => {
  const requisicao = evento.request;
  const url = new URL(requisicao.url);

  if (requisicao.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  evento.respondWith(
    fetch(requisicao)
      .then((respostaRede) => {
        if (respostaRede.ok) {
          const copia = respostaRede.clone();
          caches.open(CACHE_NOME).then((cache) => cache.put(requisicao, copia));
        }
        return respostaRede;
      })
      .catch(() => caches.match(requisicao))
  );
});
```

- Só intercepta `GET` de **mesma origem** — o `if` de saída deixa vídeos
  externos e qualquer outro método passarem direto pelo caminho normal do
  navegador, sem o service worker no meio.
- Toda requisição tenta a rede primeiro. Se der certo, atualiza o cache
  com a resposta fresca (assim o cache nunca fica muito desatualizado
  enquanto há internet) e devolve essa resposta.
- Se a rede falhar (offline), cai pro `caches.match(requisicao)` — serve a
  última cópia cacheada daquele arquivo.

Essa escolha (rede primeiro, não cache primeiro) é deliberada: durante
desenvolvimento local os arquivos mudam com frequência, e `serve.py` já
manda `Cache-Control: no-store` (ver seção 7 de
[treino-bicicleta-especificacao.md](./treino-bicicleta-especificacao.md))
justamente pra evitar servir versão antiga — um service worker
cache-primeiro brigaria com essa decisão. Rede primeiro mantém o
comportamento "sempre pega o mais novo quando tem conexão" e só usa o
cache como reserva de verdade, quando não tem escolha.

## 5. Versionamento do cache

```js
const CACHE_NOME = "treinos-shell-v2";
```

No `activate`, todo cache do `CacheStorage` com nome diferente de
`CACHE_NOME` é apagado. Ou seja: trocar esse nome (`v1` → `v2`) força uma
limpeza completa do cache antigo na próxima ativação — útil se algum
arquivo for renomeado/removido da lista `ARQUIVOS_PARA_CACHE` e a cópia
antiga, órfã, precisar sumir. Não é automático: quem edita `sw.js` decide
quando vale a pena bumpar a versão (mesmo padrão de `.v1`/`.v2` já usado
nas chaves de `localStorage`, seção 2 de
[armazenamento-local-especificacao.md](./armazenamento-local-especificacao.md)).
`v1` → `v2` foi bumpado junto com a correção do `cache.addAll` (seção 3),
justamente pra forçar quem já tinha instalado a versão quebrada (cache
vazio) a reinstalar do zero com a lógica resiliente.

## 6. Limitações

- Service worker exige contexto seguro (HTTPS ou `localhost`) — não
  funciona abrindo o `.html` direto do disco (`file://`). Nesse caso o
  registro falha silenciosamente (seção 2) e o site funciona do jeito de
  sempre, só sem o cache de app shell (mas continua funcionando offline
  do mesmo jeito, já que nunca dependeu de `fetch` pra abrir localmente).
- Primeiro acesso a um link publicado ainda precisa de internet (pra
  instalar o service worker e cachear os arquivos pela primeira vez).
  Só a partir do **segundo** acesso em diante é que funciona offline.
- Se a lista `ARQUIVOS_PARA_CACHE` ficar desatualizada (arquivo novo
  esquecido, arquivo removido não tirado da lista), o app shell offline
  fica incompleto/quebrado nesse arquivo específico — não tem checagem
  automática, é manual.

## 7. Fora de escopo

- Cache de vídeos ou de qualquer recurso de outra origem.
- Página de fallback offline customizada (ex.: uma tela "Você está sem
  internet" quando um arquivo não cacheado é pedido offline) — hoje
  simplesmente falha a requisição.
- Atualização automática de `CACHE_NOME` via build/script — é manual.
- Notificar o usuário quando uma nova versão do app shell foi cacheada em
  segundo plano (o `activate` já assume o controle imediatamente via
  `self.clients.claim()`, mas não há aviso de "recarregue a página").
