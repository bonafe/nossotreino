import { TreinosStorage } from "./storage.js";

// Cadência do pedido de apoio pós-treino — ver docs/apoio-especificacao.md
// seção 4. Só aparece depois que a pessoa já treinou o suficiente pra
// perceber valor no sistema, nunca antes.
const TREINOS_MINIMOS_PRIMEIRA_EXIBICAO = 3;
const TREINOS_MINIMOS_ENTRE_EXIBICOES = 10;
const DIAS_MINIMOS_ENTRE_EXIBICOES = 30;

function totalTreinosConcluidos() {
  return (
    TreinosStorage.lerJSON(TreinosStorage.chaves.historicoSessaoBicicleta, []).length +
    TreinosStorage.lerJSON(TreinosStorage.chaves.historicoSessaoMusculacao, []).length +
    TreinosStorage.lerJSON(TreinosStorage.chaves.historicoSessaoAlongamento, []).length
  );
}

function diasDesde(dataIso) {
  return (Date.now() - new Date(dataIso).getTime()) / 86400000;
}

export function deveExibirPedidoApoio() {
  if (TreinosStorage.lerJSON(TreinosStorage.chaves.apoioDispensadoPermanentemente, false)) return false;

  const total = totalTreinosConcluidos();
  const ultimaData = TreinosStorage.lerJSON(TreinosStorage.chaves.apoioUltimaExibicaoData, null);

  if (!ultimaData) return total >= TREINOS_MINIMOS_PRIMEIRA_EXIBICAO;

  const ultimoContador = TreinosStorage.lerJSON(TreinosStorage.chaves.apoioUltimaExibicaoContador, 0);
  return (
    total - ultimoContador >= TREINOS_MINIMOS_ENTRE_EXIBICOES || diasDesde(ultimaData) >= DIAS_MINIMOS_ENTRE_EXIBICOES
  );
}

function marcarExibido() {
  TreinosStorage.salvarJSON(TreinosStorage.chaves.apoioUltimaExibicaoContador, totalTreinosConcluidos());
  TreinosStorage.salvarJSON(TreinosStorage.chaves.apoioUltimaExibicaoData, new Date().toISOString());
}

/**
 * Monta o banner discreto de apoio dentro de `containerEl` (ex.
 * `#apoioContainer`, presente nas três telas de conclusão de treino).
 * Chamar só quando `deveExibirPedidoApoio()` for `true`.
 */
export function renderizarPedidoApoio(containerEl) {
  const total = totalTreinosConcluidos();
  marcarExibido();

  containerEl.innerHTML = `
    <div class="apoio-banner">
      <p>Você já concluiu <strong>${total}</strong> treino${total === 1 ? "" : "s"} com o Nosso Treino 🎉</p>
      <p>O sistema é gratuito, aberto e não vende seus dados. Se ele está te ajudando, uma contribuição via Pix já ajuda a manter o projeto.</p>
      <div class="apoio-banner-acoes">
        <a class="apoio-banner-cta" href="index.html#apoio">Apoiar com Pix →</a>
        <button type="button" class="apoio-banner-fechar" data-acao="agora-nao">Agora não</button>
      </div>
      <button type="button" class="apoio-banner-permanente" data-acao="nao-mostrar">Não mostrar novamente</button>
    </div>
  `;
  containerEl.hidden = false;

  function fechar() {
    containerEl.hidden = true;
    containerEl.innerHTML = "";
  }

  containerEl.querySelector('[data-acao="agora-nao"]').addEventListener("click", fechar);
  containerEl.querySelector('[data-acao="nao-mostrar"]').addEventListener("click", () => {
    TreinosStorage.salvarJSON(TreinosStorage.chaves.apoioDispensadoPermanentemente, true);
    fechar();
  });
}
