const CACHE_NOME = "treinos-shell-v24";

const ARQUIVOS_PARA_CACHE = [
  "index.html",
  "alunos.html",
  "aluno_novo.html",
  "planos.html",
  "plano_novo.html",
  "sistema.html",
  "treinos-exemplo/treino-exemplo-iniciante.json",
  "treinos-exemplo/treino-exemplo-intermediario.json",
  "treinos-exemplo/treino-exemplo-avancado.json",
  "treinos-exemplo/treino-exemplo-casa-halteres-banco.json",
  "treinos-exemplo/treino-exemplo-peso-corporal.json",
  "treino_bicicleta_menu.html",
  "treino_bicicleta.html",
  "treino_bicicleta_novo.html",
  "treino_alongamento_menu.html",
  "treino_alongamento_exercicios.html",
  "treino_alongamento.html",
  "treino_alongamento_novo.html",
  "treino_alongamento_progresso.html",
  "treino_musculacao_menu.html",
  "treino_musculacao_exercicios.html",
  "treino_execucao.html",
  "treino_exercicio_progresso.html",
  "treino_musculacao_novo.html",
  "corpo_menu.html",
  "corpo_avaliacao_nova.html",
  "corpo_comparar.html",
  "biblioteca-exercicios/biblioteca-exercicios.json",
  "d3.v7.min.js",
  "webtorrent.min.js",
  "qrcode.min.js",
  "css/base.css",
  "css/componentes.css",
  "css/graficos.css",
  "css/paginas/index.css",
  "css/paginas/sistema.css",
  "css/paginas/alunos.css",
  "css/paginas/planos.css",
  "css/paginas/treino-bicicleta-menu.css",
  "css/paginas/treino-bicicleta.css",
  "css/paginas/treino-musculacao-menu.css",
  "css/paginas/treino-musculacao-exercicios.css",
  "css/paginas/treino-execucao.css",
  "css/paginas/treino-exercicio-progresso.css",
  "css/paginas/treino-musculacao-novo.css",
  "css/paginas/corpo.css",
  "js/storage.js",
  "js/armazenamento-indexeddb.js",
  "js/versao.js",
  "js/consentimento-analytics.js",
  "js/treinos-exemplo.js",
  "js/biblioteca-exercicios.js",
  "js/prescricao-formatadores.js",
  "js/formatadores.js",
  "js/constantes.js",
  "js/identificadores.js",
  "js/sinal-sonoro.js",
  "js/cronometro.js",
  "js/grafico-barras.js",
  "js/grafico-linha.js",
  "js/videos-torrent.js",
  "js/video-player-modal.js",
  "js/imagem-exercicio.js",
  "js/detalhes-modal.js",
  "js/apoio.js",
  "js/dados-apoio.js",
  "js/imagem-corporal.js",
  "js/medidas-corporais.js",
  "js/ilustracao-corpo.js",
  "js/grafico-medidas.js",
  "js/paginas/index.js",
  "js/paginas/sistema.js",
  "js/paginas/alunos.js",
  "js/paginas/aluno-novo.js",
  "js/paginas/planos.js",
  "js/paginas/plano-novo.js",
  "js/paginas/treino-bicicleta-menu.js",
  "js/paginas/treino-bicicleta.js",
  "js/paginas/treino-bicicleta-novo.js",
  "js/paginas/treino-alongamento-menu.js",
  "js/paginas/treino-alongamento-exercicios.js",
  "js/paginas/treino-alongamento.js",
  "js/paginas/treino-alongamento-novo.js",
  "js/paginas/treino-alongamento-progresso.js",
  "js/paginas/treino-musculacao-menu.js",
  "js/paginas/treino-musculacao-exercicios.js",
  "js/paginas/treino-execucao.js",
  "js/paginas/treino-exercicio-progresso.js",
  "js/paginas/treino-musculacao-novo.js",
  "js/paginas/corpo-menu.js",
  "js/paginas/corpo-avaliacao-nova.js",
  "js/paginas/corpo-comparar.js"
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
