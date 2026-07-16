const CACHE_NOME = "treinos-shell-v2";

const ARQUIVOS_PARA_CACHE = [
  "index.html",
  "importar_dados.html",
  "treino_bicicleta_menu.html",
  "treino_bicicleta.html",
  "treino_exercicios_menu.html",
  "treino_exercicios.html",
  "treino_execucao.html",
  "treino_exercicio_progresso.html",
  "storage.js",
  "d3.v7.min.js"
];

// cache.addAll é tudo-ou-nada: se um único arquivo falhar, nenhum entra no
// cache. Cacheando um por um com Promise.allSettled, uma falha isolada não
// derruba o pré-cache inteiro — os demais arquivos continuam sendo salvos.
self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE_NOME).then((cache) =>
      Promise.allSettled(
        ARQUIVOS_PARA_CACHE.map((arquivo) =>
          cache.add(arquivo).catch((erro) => {
            console.warn(`sw.js: falhou ao pré-cachear "${arquivo}"`, erro);
          })
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys().then((nomes) =>
      Promise.all(nomes.filter((nome) => nome !== CACHE_NOME).map((nome) => caches.delete(nome)))
    )
  );
  self.clients.claim();
});

// Estratégia "rede primeiro, cache como reserva": sempre tenta buscar a
// versão mais nova quando há conexão (bom pra desenvolvimento local, onde
// os arquivos mudam com frequência) e cai pro cache quando estiver offline.
// Só intercepta GET de mesma origem — vídeos externos e afins seguem o
// caminho normal do navegador, sem passar pelo cache do app shell.
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
