import WebTorrent from "../webtorrent.min.js";

const NOME_CACHE = "treinos-videos.v1";

let cliente = null;

function obterCliente() {
  if (!cliente) cliente = new WebTorrent();
  return cliente;
}

function extrairInfoHash(magnet) {
  const combinacao = /xt=urn:btih:([a-zA-Z0-9]+)/.exec(magnet || "");
  return combinacao ? combinacao[1].toLowerCase() : null;
}

// Cache API pede uma URL como chave — não existe URL de origem real pra esses
// vídeos (só trafegam via WebRTC), então usamos o infohash como se fosse uma
// URL de um domínio que nunca é buscado de verdade, só serve de identificador.
function chaveCache(infoHash) {
  return `https://videos.treinos.local/${infoHash}`;
}

async function buscarDoCache(infoHash) {
  const cache = await caches.open(NOME_CACHE);
  const resposta = await cache.match(chaveCache(infoHash));
  return resposta ? resposta.blob() : null;
}

async function salvarNoCache(infoHash, blob) {
  const cache = await caches.open(NOME_CACHE);
  await cache.put(chaveCache(infoHash), new Response(blob));
}

// infoHash -> { ouvintes: Set<function>, ultimoProgresso: number }
// Garante que o mesmo vídeo nunca é baixado duas vezes ao mesmo tempo nesta
// aba — quem pedir de novo enquanto já está baixando só entra na lista de
// quem recebe as atualizações de progresso.
const downloadsEmAndamento = new Map();

export const VideosTorrent = {
  /**
   * Garante que o vídeo do magnet informado seja baixado (ou recuperado do
   * cache local) e chama `aoAtualizar` a cada mudança de estado:
   *   { estado: "baixando", progresso: 0..1 }
   *   { estado: "pronto", blobUrl }
   *   { estado: "erro" }
   */
  async garantirVideo(magnet, aoAtualizar) {
    const infoHash = extrairInfoHash(magnet);
    if (!infoHash) {
      aoAtualizar({ estado: "erro" });
      return;
    }

    const blobDoCache = await buscarDoCache(infoHash);
    if (blobDoCache) {
      aoAtualizar({ estado: "pronto", blobUrl: URL.createObjectURL(blobDoCache) });
      return;
    }

    const existente = downloadsEmAndamento.get(infoHash);
    if (existente) {
      existente.ouvintes.add(aoAtualizar);
      aoAtualizar({ estado: "baixando", progresso: existente.ultimoProgresso });
      return;
    }

    const entrada = { ouvintes: new Set([aoAtualizar]), ultimoProgresso: 0 };
    downloadsEmAndamento.set(infoHash, entrada);
    const notificar = (dados) => entrada.ouvintes.forEach((ouvinte) => ouvinte(dados));

    // Avisa "baixando" já de cara — não espera o primeiro byte chegar
    // (torrent.on("download")), porque se o swarm estiver frio (sem
    // nenhum peer alcançável, mais comum em rede de celular por causa de
    // NAT mais restritivo) esse evento pode nunca disparar, deixando quem
    // pediu o vídeo sem nenhum retorno.
    notificar({ estado: "baixando", progresso: 0 });

    try {
      // Usa o retorno de client.add (em vez do callback `ontorrent`, que só
      // dispara quando os metadados do torrent chegam) pra já anexar os
      // listeners agora — assim erros/avisos que aconteçam enquanto ainda
      // procura peers/metadados também são capturados.
      const torrent = obterCliente().add(magnet);

      torrent.on("download", () => {
        entrada.ultimoProgresso = torrent.progress;
        notificar({ estado: "baixando", progresso: torrent.progress });
      });

      torrent.on("noPeers", () => {
        notificar({ estado: "baixando", progresso: torrent.progress, semPeers: true });
      });

      torrent.on("error", () => {
        downloadsEmAndamento.delete(infoHash);
        notificar({ estado: "erro" });
      });

      torrent.on("done", async () => {
        try {
          const blob = await torrent.files[0].blob();
          await salvarNoCache(infoHash, blob);
          if (navigator.storage && navigator.storage.persist) {
            navigator.storage.persist().catch(() => {});
          }
          notificar({ estado: "pronto", blobUrl: URL.createObjectURL(blob) });
        } catch (erro) {
          notificar({ estado: "erro" });
        } finally {
          downloadsEmAndamento.delete(infoHash);
          // Já salvamos o Blob completo no Cache API (seção 6 da
          // especificação) — não precisa manter as peças do torrent
          // guardadas de novo no armazenamento interno do WebTorrent.
          torrent.destroy({ destroyStore: true });
        }
      });
    } catch (erro) {
      downloadsEmAndamento.delete(infoHash);
      notificar({ estado: "erro" });
    }
  },

  /**
   * Dispara o download de todos os vídeos da biblioteca de exercícios —
   * chamada assim que biblioteca-exercicios.json é buscada (ver seção 8 de
   * docs/torrent-videos-especificacao.md), não vídeo por vídeo sob demanda.
   * Vídeos já presentes no Cache API não geram nenhuma requisição de rede.
   */
  prefetchTodosOsVideos(bibliotecaExercicios) {
    const magnets = new Set();

    Object.values(bibliotecaExercicios.bibliotecas.exercicios || {}).forEach((exercicio) => {
      if (exercicio.midia && exercicio.midia.videoMagnet) magnets.add(exercicio.midia.videoMagnet);
    });
    Object.values(bibliotecaExercicios.bibliotecas.alongamentos || {}).forEach((alongamento) => {
      if (alongamento.midia && alongamento.midia.videoMagnet) magnets.add(alongamento.midia.videoMagnet);
    });
    Object.values((bibliotecaExercicios.bibliotecas.cardio || {}).modalidades || {}).forEach((modalidade) => {
      if (modalidade.midia && modalidade.midia.videoMagnet) magnets.add(modalidade.midia.videoMagnet);
    });

    magnets.forEach((magnet) => this.garantirVideo(magnet, () => {}));
  }
};
