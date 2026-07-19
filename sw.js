const CACHE_NOME = "treinos-shell-v4";

const ARQUIVOS_PARA_CACHE = [
  "index.html",
  "sistema.html",
  "importar_dados.html",
  "treino_bicicleta_menu.html",
  "treino_bicicleta.html",
  "treino_exercicios_menu.html",
  "treino_exercicios.html",
  "treino_execucao.html",
  "treino_exercicio_progresso.html",
  "d3.v7.min.js",
  "css/base.css",
  "css/componentes.css",
  "css/graficos.css",
  "css/paginas/index.css",
  "css/paginas/sistema.css",
  "css/paginas/importar-dados.css",
  "css/paginas/treino-bicicleta-menu.css",
  "css/paginas/treino-bicicleta.css",
  "css/paginas/treino-exercicios-menu.css",
  "css/paginas/treino-exercicios.css",
  "css/paginas/treino-execucao.css",
  "css/paginas/treino-exercicio-progresso.css",
  "js/storage.js",
  "js/formatadores.js",
  "js/constantes.js",
  "js/sinal-sonoro.js",
  "js/cronometro.js",
  "js/grafico-barras.js",
  "js/grafico-linha.js",
  "js/paginas/index.js",
  "js/paginas/sistema.js",
  "js/paginas/importar-dados.js",
  "js/paginas/treino-bicicleta-menu.js",
  "js/paginas/treino-bicicleta.js",
  "js/paginas/treino-exercicios-menu.js",
  "js/paginas/treino-exercicios.js",
  "js/paginas/treino-execucao.js",
  "js/paginas/treino-exercicio-progresso.js"
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
