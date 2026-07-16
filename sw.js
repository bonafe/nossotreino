const CACHE_NOME = "treinos-shell-v1";

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

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE_NOME).then((cache) => cache.addAll(ARQUIVOS_PARA_CACHE))
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
