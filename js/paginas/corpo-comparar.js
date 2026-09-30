import { TreinosStorage } from "../storage.js";
import { Formatadores } from "../formatadores.js";
import { VISTAS, formatarValor, formatarDelta, variacaoEntre } from "../medidas-corporais.js";

// Compara duas avaliações do aluno, vista por vista. Sempre o mesmo
// enquadramento de exibição (mesma caixa 3:4, `object-fit: contain`) pra
// diferença de escala/recorte não parecer mudança do corpo.
class CorpoCompararController {
  #aluno = TreinosStorage.obterAlunoDoPlanoAtivo();
  #avaliacoes = [];
  #vista = "frente";
  #modo = "lado";
  #urls = [];

  #antesEl = document.getElementById("antesSelect");
  #depoisEl = document.getElementById("depoisSelect");
  #palcoEl = document.getElementById("palco");
  #controleWrapEl = document.getElementById("controleWrap");
  #controleEl = document.getElementById("controle");
  #legendaEl = document.getElementById("controleLegenda");

  iniciar() {
    if (!this.#aluno) {
      window.location.href = "alunos.html";
      return;
    }
    this.#avaliacoes = TreinosStorage.listarAvaliacoesDoAluno(this.#aluno.alunoId);
    const comFotos = this.#avaliacoes.filter((a) => a.fotos.length);

    if (this.#avaliacoes.length < 2 || !comFotos.length) {
      document.getElementById("vazio").hidden = false;
      return;
    }
    document.getElementById("conteudo").hidden = false;

    [this.#antesEl, this.#depoisEl].forEach((select) =>
      this.#avaliacoes.forEach((a) => select.add(new Option(`${Formatadores.dataExtenso(a.medidoEm)}${a.fotos.length ? "" : " (sem fotos)"}`, a.id)))
    );

    // Padrão: as duas últimas avaliações com foto (ou os extremos, se a URL pedir).
    const parametros = new URLSearchParams(window.location.search);
    const padraoAntes = comFotos.length > 1 ? comFotos[comFotos.length - 2] : this.#avaliacoes[0];
    const padraoDepois = comFotos[comFotos.length - 1];
    this.#antesEl.value = parametros.get("a") || padraoAntes.id;
    this.#depoisEl.value = parametros.get("b") || padraoDepois.id;

    this.#antesEl.addEventListener("change", () => this.#renderizar());
    this.#depoisEl.addEventListener("change", () => this.#renderizar());

    const vistaToggle = document.getElementById("vistaToggle");
    VISTAS.forEach((v) => {
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "modo-opcao";
      botao.dataset.vista = v.id;
      botao.textContent = v.rotulo;
      botao.setAttribute("aria-pressed", String(v.id === this.#vista));
      botao.addEventListener("click", () => {
        this.#vista = v.id;
        vistaToggle.querySelectorAll(".modo-opcao").forEach((b) => b.setAttribute("aria-pressed", String(b === botao)));
        this.#renderizar();
      });
      vistaToggle.appendChild(botao);
    });

    document.querySelectorAll("#modoToggle .modo-opcao").forEach((botao) =>
      botao.addEventListener("click", () => {
        this.#modo = botao.dataset.modo;
        document.querySelectorAll("#modoToggle .modo-opcao").forEach((b) => b.setAttribute("aria-pressed", String(b === botao)));
        this.#renderizar();
      })
    );

    this.#controleEl.addEventListener("input", () => this.#aplicarControle());
    this.#renderizar();
  }

  #avaliacao(select) {
    return this.#avaliacoes.find((a) => a.id === select.value);
  }

  async #urlDaVista(avaliacao) {
    const foto = avaliacao.fotos.find((f) => f.vista === this.#vista);
    if (!foto) return null;
    const blob = await TreinosStorage.obterFotoCorporal(foto.fotoId);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    this.#urls.push(url);
    return url;
  }

  async #renderizar() {
    this.#urls.forEach((u) => URL.revokeObjectURL(u));
    this.#urls = [];

    const antes = this.#avaliacao(this.#antesEl);
    const depois = this.#avaliacao(this.#depoisEl);
    const [urlAntes, urlDepois] = await Promise.all([this.#urlDaVista(antes), this.#urlDaVista(depois)]);

    const rotuloAntes = Formatadores.dataExtenso(antes.medidoEm);
    const rotuloDepois = Formatadores.dataExtenso(depois.medidoEm);
    const imagem = (url, classe = "") =>
      url ? `<img class="${classe}" src="${url}" alt="" />` : `<div class="sem-foto">Sem foto desta vista</div>`;

    this.#controleWrapEl.hidden = this.#modo === "lado";

    if (this.#modo === "lado") {
      this.#palcoEl.innerHTML = `<div class="lado-a-lado">
        <figure><div class="comparar-palco">${imagem(urlAntes)}</div><figcaption>${rotuloAntes}</figcaption></figure>
        <figure><div class="comparar-palco">${imagem(urlDepois)}</div><figcaption>${rotuloDepois}</figcaption></figure>
      </div>`;
    } else {
      this.#palcoEl.innerHTML = `<div class="comparar-palco" id="palcoUnico">
        ${imagem(urlAntes, "camada-antes")}
        ${imagem(urlDepois, "camada-depois")}
      </div>`;
      this.#controleEl.value = 50;
      this.#aplicarControle();
    }

    this.#renderizarVariacao(antes, depois);
  }

  #aplicarControle() {
    const valor = Number(this.#controleEl.value);
    const antes = this.#palcoEl.querySelector(".camada-antes");
    const depois = this.#palcoEl.querySelector(".camada-depois");
    if (this.#modo === "slider") {
      // "Antes" por baixo; "Depois" cobre só a parte à direita do cursor.
      if (depois) depois.style.clipPath = `inset(0 0 0 ${valor}%)`;
      if (antes) antes.style.opacity = "1";
      if (depois) depois.style.opacity = "1";
      this.#legendaEl.textContent = "ANTES ◀ ▶ DEPOIS";
    } else {
      if (depois) depois.style.clipPath = "none";
      if (depois) depois.style.opacity = String(valor / 100);
      this.#legendaEl.textContent = `Opacidade do "depois": ${valor}%`;
    }
  }

  #renderizarVariacao(antes, depois) {
    const card = document.getElementById("variacaoCard");
    const linhas = antes.id !== depois.id ? variacaoEntre(antes, depois) : [];
    card.hidden = !linhas.length;
    document.getElementById("variacaoLista").innerHTML = linhas
      .map(
        (l) => `<div class="variacao-linha">
          <span>${l.metrica.rotulo}</span>
          <span class="variacao-valores">${formatarValor(l.antes)} → ${formatarValor(l.depois, l.metrica.unidade)}</span>
          <span class="variacao-delta">${formatarDelta(l.delta, l.metrica.unidade)}</span>
        </div>`
      )
      .join("");
  }
}

new CorpoCompararController().iniciar();
