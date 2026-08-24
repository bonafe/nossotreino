// Estatística de uso (visitas/páginas) via Google Analytics — só depois de
// autorização explícita da pessoa. Dado de aluno/plano/histórico nunca passa
// por aqui (ver seção "Privacidade" em index.html e
// docs/analytics-especificacao.md). Consentimento em localStorage puro (não
// TreinosStorage/IndexedDB) porque é preferência de navegador, não dado de
// domínio — não precisa de migração de esquema nem de esperar a hidratação
// assíncrona do banco (ver seção 8 de docs/armazenamento-local-especificacao.md).

// TODO: Measurement ID real ainda não configurado — criar uma propriedade
// GA4 (analytics.google.com) e colar o ID (formato "G-XXXXXXX") aqui antes
// de publicar. Enquanto for o placeholder abaixo, aceitar o banner não
// carrega nenhum script de verdade (o `id` na URL do gtag.js seria inválido).
const MEASUREMENT_ID = "G-TODO"; // TODO: configurar

const CHAVE_CONSENTIMENTO = "nossoTreinoConsentimentoAnalytics";

function lerConsentimento() {
  try {
    return window.localStorage.getItem(CHAVE_CONSENTIMENTO);
  } catch {
    return null; // Navegador com localStorage bloqueado (modo privado etc.) — trata como "ainda não respondeu", sem crashar.
  }
}

function salvarConsentimento(valor) {
  try {
    window.localStorage.setItem(CHAVE_CONSENTIMENTO, valor);
  } catch {
    // Sem persistência: o banner volta a aparecer na próxima página, mas o
    // site continua funcionando normalmente de qualquer forma.
  }
}

function carregarGoogleAnalytics() {
  if (MEASUREMENT_ID.includes("TODO")) return;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;
  gtag("js", new Date());
  gtag("config", MEASUREMENT_ID);
}

function exibirBanner() {
  const main = document.querySelector("main");
  if (!main) return;

  const banner = document.createElement("div");
  banner.className = "analytics-banner";
  banner.innerHTML = `
    <p>
      Podemos usar o Google Analytics pra saber quantas pessoas usam o
      Nosso Treino? Isso mede só visitas às páginas — o plano de treino,
      o histórico e os dados de aluno continuam 100% no seu navegador,
      nunca passam por aqui.
    </p>
    <div class="analytics-banner-acoes">
      <button type="button" class="analytics-banner-aceitar">Aceitar</button>
      <button type="button" class="analytics-banner-recusar">Recusar</button>
    </div>
  `;

  banner.querySelector(".analytics-banner-aceitar").addEventListener("click", () => {
    salvarConsentimento("aceito");
    carregarGoogleAnalytics();
    banner.remove();
  });

  banner.querySelector(".analytics-banner-recusar").addEventListener("click", () => {
    salvarConsentimento("recusado");
    banner.remove();
  });

  document.body.appendChild(banner);
}

const consentimento = lerConsentimento();
if (consentimento === "aceito") {
  carregarGoogleAnalytics();
} else if (consentimento !== "recusado") {
  exibirBanner();
}
