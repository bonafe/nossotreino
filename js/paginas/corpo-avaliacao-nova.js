import { TreinosStorage } from "../storage.js";
import { Formatadores } from "../formatadores.js";
import { capturarDeVideo, processarArquivo } from "../imagem-corporal.js";
import { ilustracaoMedida, guiaEnquadramento } from "../ilustracao-corpo.js";
import {
  PROTOCOLO_ATUAL,
  METRICAS,
  VISTAS,
  INSTRUCOES,
  metricaPorChave,
  chaveDaMedida,
  lerNumero,
  formatarValor,
  reconciliarLeituras,
  avisoDeFaixa,
  LIMITE_DUPLA_MEDICAO_CM
} from "../medidas-corporais.js";

const CHAVE_MODO = "corpo.modoMedicao.v1";

// Passos do assistente. `metricas` lista as chaves pedidas no passo.
const PASSOS = [
  { id: "preparacao", titulo: "Preparação" },
  { id: "peso", titulo: "Peso", metricas: ["peso:nenhum"], tipo: "peso" },
  { id: "fotos", titulo: "Fotos" },
  { id: "cintura", titulo: "Cintura", metricas: ["cintura:nenhum"], tipo: "cintura" },
  { id: "quadril", titulo: "Quadril", metricas: ["quadril:nenhum"], tipo: "quadril" },
  { id: "bracos", titulo: "Braços", metricas: ["braco:esquerdo", "braco:direito"], tipo: "braco" },
  { id: "coxas", titulo: "Coxas", metricas: ["coxa:esquerdo", "coxa:direito"], tipo: "coxa" },
  { id: "panturrilhas", titulo: "Panturrilhas", metricas: ["panturrilha:esquerdo", "panturrilha:direito"], tipo: "panturrilha" },
  { id: "revisao", titulo: "Revisão" }
];

function paraInputDatetimeLocal(data) {
  const d = new Date(data);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function textoNumero(valor) {
  return valor === null || valor === undefined ? "" : String(valor).replace(".", ",");
}

class CorpoAvaliacaoNovaController {
  #aluno = TreinosStorage.obterAlunoDoPlanoAtivo();
  #edicaoId = new URLSearchParams(window.location.search).get("editar");
  #avaliacaoOriginal = null;
  #passoAtual = 0;
  #modo = TreinosStorage.lerJSONGlobal(CHAVE_MODO, "rapido"); // "rapido" | "preciso"

  // Estado editável da avaliação.
  #medidas = new Map(); // chave -> { leitura1: string, leitura2: string }
  #fotos = new Map(); // vista -> { fotoId?, blob?, largura, altura, capturadoEm, url }
  #fotosRemovidas = []; // fotoIds existentes a excluir ao salvar
  #condicoes = { estadoAlimentar: "", roupa: "", treinoRecente: "" };
  #observacoes = "";
  #medidoEm = new Date();
  #confirmados = new Set(); // chaves de medida cujo aviso de faixa já foi aceito

  // Câmera
  #vistaCamera = null;
  #stream = null;
  #facing = "environment";
  #capturaPendente = null;
  #contagemTimer = null;

  #tituloEl = document.getElementById("passoTitulo");
  #conteudoEl = document.getElementById("passoConteudo");
  #mensagemEl = document.getElementById("mensagem");
  #voltarBtnEl = document.getElementById("voltarBtn");
  #pularBtnEl = document.getElementById("pularBtn");
  #avancarBtnEl = document.getElementById("avancarBtn");

  iniciar() {
    if (!this.#aluno) {
      window.location.href = "alunos.html";
      return;
    }
    document.getElementById("subtitulo").textContent = this.#aluno.nome || "";

    if (this.#edicaoId) {
      this.#avaliacaoOriginal = TreinosStorage.obterAvaliacao(this.#edicaoId);
      if (!this.#avaliacaoOriginal || this.#avaliacaoOriginal.alunoId !== this.#aluno.alunoId) {
        window.location.href = "corpo_menu.html";
        return;
      }
      document.getElementById("titulo").textContent = "Editar avaliação";
      this.#carregarDaAvaliacao(this.#avaliacaoOriginal);
    }

    this.#voltarBtnEl.addEventListener("click", () => this.#irPara(this.#passoAtual - 1));
    this.#pularBtnEl.addEventListener("click", () => this.#irPara(this.#passoAtual + 1));
    this.#avancarBtnEl.addEventListener("click", () => this.#aoAvancar());
    this.#iniciarCamera();
    this.#renderizar();
  }

  #carregarDaAvaliacao(avaliacao) {
    this.#medidoEm = new Date(avaliacao.medidoEm);
    this.#condicoes = { estadoAlimentar: "", roupa: "", treinoRecente: "", ...(avaliacao.condicoes || {}) };
    this.#observacoes = avaliacao.observacoes || "";
    avaliacao.medidas.forEach((m) => {
      this.#medidas.set(chaveDaMedida(m), {
        leitura1: textoNumero(m.leitura1 ?? m.valor),
        leitura2: textoNumero(m.leitura2)
      });
    });
    avaliacao.fotos.forEach((f) => {
      this.#fotos.set(f.vista, { fotoId: f.fotoId, largura: f.largura, altura: f.altura, capturadoEm: f.capturadoEm, url: null });
      TreinosStorage.obterFotoCorporal(f.fotoId).then((blob) => {
        if (!blob) return;
        const entrada = this.#fotos.get(f.vista);
        if (entrada && entrada.fotoId === f.fotoId) {
          entrada.url = URL.createObjectURL(blob);
          if (PASSOS[this.#passoAtual].id === "fotos") this.#renderizar();
        }
      });
    });
  }

  // --- navegação ---

  #irPara(indice) {
    this.#lerCamposDoPasso();
    if (indice < 0 || indice >= PASSOS.length) return;
    this.#passoAtual = indice;
    this.#esconderMensagem();
    this.#renderizar();
    window.scrollTo({ top: 0 });
  }

  #aoAvancar() {
    const passo = PASSOS[this.#passoAtual];
    if (passo.id === "revisao") {
      this.#salvar();
      return;
    }
    this.#lerCamposDoPasso();
    if (!this.#validarPasso(passo)) return;
    this.#irPara(this.#passoAtual + 1);
  }

  #renderizar() {
    const passo = PASSOS[this.#passoAtual];
    document.getElementById("progressoTexto").textContent = `Passo ${this.#passoAtual + 1} de ${PASSOS.length}`;
    document.getElementById("progressoBarra").style.width = `${((this.#passoAtual + 1) / PASSOS.length) * 100}%`;
    this.#tituloEl.textContent = passo.titulo;

    this.#voltarBtnEl.hidden = this.#passoAtual === 0;
    const ultimo = passo.id === "revisao";
    this.#pularBtnEl.hidden = passo.id === "preparacao" || ultimo;
    this.#avancarBtnEl.textContent = ultimo ? "Salvar avaliação" : "Avançar";

    if (passo.id === "preparacao") this.#renderizarPreparacao();
    else if (passo.id === "fotos") this.#renderizarFotos();
    else if (passo.id === "revisao") this.#renderizarRevisao();
    else this.#renderizarMedidas(passo);
  }

  // --- passos ---

  #renderizarPreparacao() {
    const anteriores = TreinosStorage.listarAvaliacoesDoAluno(this.#aluno.alunoId).filter((a) => a.id !== this.#edicaoId);
    const ultima = anteriores[anteriores.length - 1];

    let blocoUltima = "";
    if (ultima) {
      const dias = Math.max(0, Math.round((Date.now() - new Date(ultima.medidoEm)) / 86400000));
      const c = ultima.condicoes || {};
      const partes = [Formatadores.hora(ultima.medidoEm)];
      if (c.roupa) partes.push(`roupa ${ROTULOS.roupa[c.roupa].toLowerCase()}`);
      if (c.estadoAlimentar) partes.push(ROTULOS.estadoAlimentar[c.estadoAlimentar].toLowerCase());
      blocoUltima = `<p><strong>Última avaliação:</strong> ${Formatadores.dataExtenso(ultima.medidoEm)} (há ${dias} dia${dias === 1 ? "" : "s"}).<br />
        Você registrou: ${partes.join(" · ")}. Tente repetir condições semelhantes.</p>`;
    } else {
      blocoUltima = "<p>Esta será a sua <strong>referência inicial</strong> — o ponto de partida para acompanhar a evolução.</p>";
    }

    this.#conteudoEl.innerHTML = `
      ${blocoUltima}
      <p>Para as avaliações serem comparáveis, tente repetir:</p>
      <ul class="checklist">
        <li>a mesma fita métrica e a mesma balança;</li>
        <li>roupa semelhante (pouca roupa);</li>
        <li>horário aproximado e mesmas condições;</li>
        <li>mesmo local, postura e iluminação nas fotos.</li>
      </ul>
      <p>Todos os passos são opcionais — você pode pular qualquer um.</p>
      <p><strong>Modo de medição das circunferências</strong></p>
      <div class="modo-toggle">
        <button type="button" class="modo-opcao" data-modo="rapido" aria-pressed="${this.#modo === "rapido"}">Rápido (1 medida)</button>
        <button type="button" class="modo-opcao" data-modo="preciso" aria-pressed="${this.#modo === "preciso"}">Preciso (2 medidas)</button>
      </div>
      <p class="nota">No modo preciso você mede duas vezes; se as leituras diferirem até ${LIMITE_DUPLA_MEDICAO_CM.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} cm, vale a média.</p>
      <p class="nota">🔒 Suas fotos ficam só neste aparelho.</p>`;

    this.#conteudoEl.querySelectorAll(".modo-opcao").forEach((botao) =>
      botao.addEventListener("click", () => {
        this.#modo = botao.dataset.modo;
        TreinosStorage.salvarJSONGlobal(CHAVE_MODO, this.#modo);
        this.#conteudoEl.querySelectorAll(".modo-opcao").forEach((b) => b.setAttribute("aria-pressed", String(b === botao)));
      })
    );
  }

  #renderizarMedidas(passo) {
    const preciso = this.#modo === "preciso" && passo.tipo !== "peso";
    const primeira = metricaPorChave(passo.metricas[0]);

    const campos = passo.metricas
      .map((chave) => {
        const metrica = metricaPorChave(chave);
        const valores = this.#medidas.get(chave) || { leitura1: "", leitura2: "" };
        const rotulo = `${metrica.rotulo} (${metrica.unidade})`;
        if (preciso) {
          return `<div class="campo-medida">
            <label>${rotulo}</label>
            <div class="leituras">
              <input type="text" inputmode="decimal" data-chave="${chave}" data-leitura="1" placeholder="1ª medida" value="${valores.leitura1}" />
              <input type="text" inputmode="decimal" data-chave="${chave}" data-leitura="2" placeholder="2ª medida" value="${valores.leitura2}" />
            </div>
          </div>`;
        }
        return `<div class="campo-medida">
          <label for="campo-${chave}">${rotulo}</label>
          <input type="text" id="campo-${chave}" inputmode="decimal" data-chave="${chave}" data-leitura="1" placeholder="0,0" value="${valores.leitura1}" />
        </div>`;
      })
      .join("");

    const nota = passo.tipo === "peso" ? "" : `<p class="nota">Método prático de acompanhamento — o importante é medir sempre do mesmo jeito.</p>`;
    this.#conteudoEl.innerHTML = `
      <div class="passo-layout">
        ${ilustracaoMedida(passo.tipo, primeira.lado)}
        <div class="passo-texto">
          <p>${INSTRUCOES[passo.tipo]}</p>
          ${nota}
        </div>
      </div>
      ${campos}`;
  }

  #renderizarFotos() {
    const slots = VISTAS.map((vista) => {
      const foto = this.#fotos.get(vista.id);
      const quadro = foto && foto.url ? `<img src="${foto.url}" alt="Foto ${vista.rotulo}" />` : foto ? "…" : "📷";
      return `<div class="foto-slot">
        <h3>${vista.rotulo}${foto ? " ✓" : ""}</h3>
        <div class="foto-quadro">${quadro}</div>
        <button type="button" class="secondary" data-acao="camera" data-vista="${vista.id}">📷 Câmera</button>
        <button type="button" class="secondary" data-acao="arquivo" data-vista="${vista.id}">📁 Arquivo</button>
        ${foto ? `<button type="button" class="danger" data-acao="remover" data-vista="${vista.id}">Remover</button>` : ""}
      </div>`;
    }).join("");

    this.#conteudoEl.innerHTML = `
      <p>Três fotos de corpo inteiro: frente, lado e costas. Mesmo local, luz uniforme, câmera na altura do centro do corpo e roupa semelhante entre avaliações. Postura natural, sem contrair.</p>
      <div class="fotos-grade">${slots}</div>
      <p class="nota" style="margin-top:10px">🔒 As fotos ficam só neste aparelho. O GPS e demais metadados da foto são descartados, e nenhum filtro é aplicado.</p>`;

    this.#conteudoEl.querySelectorAll("button[data-acao]").forEach((botao) =>
      botao.addEventListener("click", () => {
        const { acao, vista } = botao.dataset;
        if (acao === "camera") this.#abrirCamera(vista);
        else if (acao === "arquivo") this.#escolherArquivo(vista);
        else this.#removerFoto(vista);
      })
    );
  }

  #renderizarRevisao() {
    const itens = [];
    METRICAS.forEach((metrica) => {
      const entrada = this.#valorFinalDaMetrica(metrica);
      if (entrada !== null) itens.push(`<li><span>${metrica.rotulo}</span><span>${formatarValor(entrada, metrica.unidade)}</span></li>`);
    });
    VISTAS.forEach((vista) => {
      if (this.#fotos.has(vista.id)) itens.push(`<li><span>Foto ${vista.rotulo.toLowerCase()}</span><span>✓</span></li>`);
    });

    const opcoes = (mapa, atual) =>
      `<option value="">Não informado</option>` +
      Object.entries(mapa).map(([valor, rotulo]) => `<option value="${valor}" ${atual === valor ? "selected" : ""}>${rotulo}</option>`).join("");

    this.#conteudoEl.innerHTML = `
      <ul class="resumo-lista">${itens.join("") || "<li><span>Nada preenchido ainda</span><span></span></li>"}</ul>
      <div class="campo" style="margin-top:14px">
        <label for="medidoEmInput">Data e hora</label>
        <input type="datetime-local" id="medidoEmInput" value="${paraInputDatetimeLocal(this.#medidoEm)}" />
      </div>
      <div class="campo">
        <label for="estadoAlimentarSelect">Estado alimentar <span class="opcional">(opcional)</span></label>
        <select id="estadoAlimentarSelect">${opcoes(ROTULOS.estadoAlimentar, this.#condicoes.estadoAlimentar)}</select>
      </div>
      <div class="campo">
        <label for="roupaSelect">Roupa <span class="opcional">(opcional)</span></label>
        <select id="roupaSelect">${opcoes(ROTULOS.roupa, this.#condicoes.roupa)}</select>
      </div>
      <div class="campo">
        <label for="treinoRecenteSelect">Treinou há pouco? <span class="opcional">(opcional)</span></label>
        <select id="treinoRecenteSelect">${opcoes(ROTULOS.treinoRecente, this.#condicoes.treinoRecente)}</select>
      </div>
      <div class="campo">
        <label for="observacoesInput">Observações <span class="opcional">(opcional)</span></label>
        <textarea id="observacoesInput" rows="3">${this.#observacoes.replace(/</g, "&lt;")}</textarea>
      </div>
      <p class="nota">Protocolo Nosso Treino v${PROTOCOLO_ATUAL.versao}.</p>`;
  }

  // --- leitura dos campos do passo ---

  #lerCamposDoPasso() {
    const passo = PASSOS[this.#passoAtual];

    if (passo.metricas) {
      this.#conteudoEl.querySelectorAll("input[data-chave]").forEach((input) => {
        const valores = this.#medidas.get(input.dataset.chave) || { leitura1: "", leitura2: "" };
        valores[input.dataset.leitura === "2" ? "leitura2" : "leitura1"] = input.value;
        this.#medidas.set(input.dataset.chave, valores);
      });
    }

    if (passo.id === "revisao") {
      const valorDe = (id) => document.getElementById(id);
      if (valorDe("medidoEmInput") && valorDe("medidoEmInput").value) this.#medidoEm = new Date(valorDe("medidoEmInput").value);
      if (valorDe("estadoAlimentarSelect")) {
        this.#condicoes = {
          estadoAlimentar: valorDe("estadoAlimentarSelect").value,
          roupa: valorDe("roupaSelect").value,
          treinoRecente: valorDe("treinoRecenteSelect").value
        };
        this.#observacoes = valorDe("observacoesInput").value;
      }
    }
  }

  // Valor final de uma métrica (média em modo preciso) — null se vazia.
  #valorFinalDaMetrica(metrica) {
    const valores = this.#medidas.get(metrica.chave);
    if (!valores) return null;
    const l1 = lerNumero(valores.leitura1);
    const l2 = lerNumero(valores.leitura2);
    if (l1 === null && l2 === null) return null;
    if (l1 !== null && l2 !== null && metrica.unidade === "cm") {
      const r = reconciliarLeituras(l1, l2);
      return r.ok ? r.valor : null;
    }
    return l1 !== null ? l1 : l2;
  }

  // --- validação (suave: avisos nunca bloqueiam de vez) ---

  #validarPasso(passo) {
    if (!passo.metricas) return true;

    for (const chave of passo.metricas) {
      const metrica = metricaPorChave(chave);
      const valores = this.#medidas.get(chave);
      if (!valores) continue;

      const textos = [valores.leitura1, valores.leitura2].filter((t) => String(t).trim() !== "");
      const numeros = textos.map(lerNumero);
      if (numeros.some((n) => n === null)) {
        this.#mostrarErro(`${metrica.rotulo}: digite só números (ex.: 91,3).`);
        return false;
      }
      if (numeros.some((n) => n <= 0)) {
        this.#mostrarErro(`${metrica.rotulo}: o valor precisa ser maior que zero.`);
        return false;
      }

      const l1 = lerNumero(valores.leitura1);
      const l2 = lerNumero(valores.leitura2);
      if (l1 !== null && l2 !== null && metrica.unidade === "cm") {
        const r = reconciliarLeituras(l1, l2);
        if (!r.ok) {
          this.#mostrarErro(
            `${metrica.rotulo}: as duas leituras diferem em ${r.diferenca.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} cm (mais de ${LIMITE_DUPLA_MEDICAO_CM.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} cm). Meça novamente.`
          );
          return false;
        }
      }

      const valor = this.#valorFinalDaMetrica(metrica);
      if (valor !== null && !this.#confirmados.has(chave)) {
        const aviso = avisoDeFaixa(metrica, valor);
        if (aviso) {
          this.#mostrarAviso(aviso, chave);
          return false;
        }
      }
    }
    return true;
  }

  #mostrarErro(texto) {
    this.#mensagemEl.className = "mensagem erro";
    this.#mensagemEl.textContent = texto;
    this.#mensagemEl.hidden = false;
  }

  #mostrarAviso(texto, chave) {
    this.#mensagemEl.className = "mensagem aviso";
    this.#mensagemEl.innerHTML = `<span></span><div class="acoes">
      <button type="button" class="secondary" data-acao="corrigir">Corrigir</button>
      <button type="button" class="primary" data-acao="correto">Está correto</button></div>`;
    this.#mensagemEl.querySelector("span").textContent = texto;
    this.#mensagemEl.hidden = false;
    this.#mensagemEl.querySelector('[data-acao="corrigir"]').addEventListener("click", () => {
      this.#esconderMensagem();
      const campo = this.#conteudoEl.querySelector(`input[data-chave="${chave}"]`);
      if (campo) campo.focus();
    });
    this.#mensagemEl.querySelector('[data-acao="correto"]').addEventListener("click", () => {
      this.#confirmados.add(chave);
      this.#esconderMensagem();
      this.#aoAvancar();
    });
  }

  #esconderMensagem() {
    this.#mensagemEl.hidden = true;
    this.#mensagemEl.textContent = "";
  }

  // --- fotos ---

  #escolherArquivo(vista) {
    const input = document.getElementById("arquivoInput");
    input.onchange = async () => {
      const arquivo = input.files && input.files[0];
      input.value = "";
      if (!arquivo) return;
      try {
        const resultado = await processarArquivo(arquivo);
        this.#definirFoto(vista, resultado);
      } catch (erro) {
        this.#mostrarErro("Não consegui ler essa imagem. Tente outro arquivo.");
      }
    };
    input.click();
  }

  #definirFoto(vista, { blob, largura, altura }) {
    const anterior = this.#fotos.get(vista);
    if (anterior) {
      if (anterior.fotoId) this.#fotosRemovidas.push(anterior.fotoId);
      if (anterior.url) URL.revokeObjectURL(anterior.url);
    }
    this.#fotos.set(vista, { blob, largura, altura, capturadoEm: new Date().toISOString(), url: URL.createObjectURL(blob) });
    this.#esconderMensagem();
    if (PASSOS[this.#passoAtual].id === "fotos") this.#renderizarFotos();
  }

  #removerFoto(vista) {
    const foto = this.#fotos.get(vista);
    if (!foto) return;
    if (foto.fotoId) this.#fotosRemovidas.push(foto.fotoId);
    if (foto.url) URL.revokeObjectURL(foto.url);
    this.#fotos.delete(vista);
    this.#renderizarFotos();
  }

  // --- câmera ---

  #iniciarCamera() {
    document.getElementById("cameraGuia").innerHTML = guiaEnquadramento();
    document.getElementById("cameraFechar").addEventListener("click", () => this.#fecharCamera());
    document.getElementById("cameraAlternar").addEventListener("click", () => {
      this.#facing = this.#facing === "environment" ? "user" : "environment";
      this.#ligarStream();
    });
    document.getElementById("cameraTirar").addEventListener("click", () => this.#aoTirarFoto());
    document.getElementById("cameraRefazer").addEventListener("click", () => this.#mostrarAoVivo());
    document.getElementById("cameraUsar").addEventListener("click", () => {
      if (this.#capturaPendente) this.#definirFoto(this.#vistaCamera, this.#capturaPendente);
      this.#fecharCamera();
    });
  }

  async #abrirCamera(vista) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.#mostrarErro("A câmera não está disponível aqui (precisa de HTTPS ou localhost). Use o botão 📁 Arquivo.");
      return;
    }
    this.#vistaCamera = vista;
    const rotulo = VISTAS.find((v) => v.id === vista).rotulo;
    document.getElementById("cameraTitulo").textContent = `Foto de ${rotulo.toLowerCase()} — enquadre o corpo inteiro`;
    document.getElementById("cameraOverlay").hidden = false;
    this.#mostrarAoVivo();
    const ok = await this.#ligarStream();
    if (!ok) {
      this.#fecharCamera();
      this.#mostrarErro("Não consegui acessar a câmera (permissão negada?). Use o botão 📁 Arquivo.");
    }
  }

  async #ligarStream() {
    this.#pararStream();
    try {
      this.#stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: this.#facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });
      document.getElementById("cameraVideo").srcObject = this.#stream;
      return true;
    } catch (erro) {
      return false;
    }
  }

  #pararStream() {
    if (this.#stream) this.#stream.getTracks().forEach((t) => t.stop());
    this.#stream = null;
  }

  #mostrarAoVivo() {
    this.#capturaPendente = null;
    document.getElementById("cameraVideo").hidden = false;
    document.getElementById("cameraPreview").hidden = true;
    document.getElementById("cameraGuia").hidden = false;
    document.getElementById("cameraControlesVivo").hidden = false;
    document.getElementById("cameraControlesPreview").hidden = true;
  }

  #aoTirarFoto() {
    const segundos = Number(document.getElementById("cameraTemporizador").value);
    const botao = document.getElementById("cameraTirar");
    if (this.#contagemTimer) {
      clearInterval(this.#contagemTimer);
      this.#contagemTimer = null;
      document.getElementById("cameraContagem").hidden = true;
      botao.textContent = "📸 Tirar foto";
      return;
    }
    if (!segundos) {
      this.#capturar();
      return;
    }
    let restante = segundos;
    const contagemEl = document.getElementById("cameraContagem");
    contagemEl.textContent = restante;
    contagemEl.hidden = false;
    botao.textContent = "Cancelar";
    this.#contagemTimer = setInterval(() => {
      restante -= 1;
      if (restante > 0) {
        contagemEl.textContent = restante;
        return;
      }
      clearInterval(this.#contagemTimer);
      this.#contagemTimer = null;
      contagemEl.hidden = true;
      botao.textContent = "📸 Tirar foto";
      this.#capturar();
    }, 1000);
  }

  async #capturar() {
    const video = document.getElementById("cameraVideo");
    if (!video.videoWidth) return;
    try {
      this.#capturaPendente = await capturarDeVideo(video);
    } catch (erro) {
      this.#mostrarErro("Não consegui capturar a foto. Tente de novo.");
      return;
    }
    const preview = document.getElementById("cameraPreview");
    if (preview.src.startsWith("blob:")) URL.revokeObjectURL(preview.src);
    preview.src = URL.createObjectURL(this.#capturaPendente.blob);
    video.hidden = true;
    preview.hidden = false;
    document.getElementById("cameraGuia").hidden = true;
    document.getElementById("cameraControlesVivo").hidden = true;
    document.getElementById("cameraControlesPreview").hidden = false;
  }

  #fecharCamera() {
    if (this.#contagemTimer) {
      clearInterval(this.#contagemTimer);
      this.#contagemTimer = null;
    }
    document.getElementById("cameraContagem").hidden = true;
    document.getElementById("cameraTirar").textContent = "📸 Tirar foto";
    this.#pararStream();
    document.getElementById("cameraVideo").srcObject = null;
    document.getElementById("cameraOverlay").hidden = true;
    this.#capturaPendente = null;
  }

  // --- salvar ---

  async #salvar() {
    this.#lerCamposDoPasso();

    const medidas = [];
    METRICAS.forEach((metrica) => {
      const valor = this.#valorFinalDaMetrica(metrica);
      if (valor === null) return;
      const valores = this.#medidas.get(metrica.chave);
      const l1 = lerNumero(valores.leitura1);
      const l2 = lerNumero(valores.leitura2);
      const medida = { tipo: metrica.tipo, lado: metrica.lado, valor, unidade: metrica.unidade, metodo: metrica.metodo };
      if (l1 !== null && l2 !== null) {
        medida.leitura1 = l1;
        medida.leitura2 = l2;
      }
      medidas.push(medida);
    });

    if (!medidas.length && !this.#fotos.size) {
      this.#mostrarErro("Preencha pelo menos um dado (peso, uma medida ou uma foto) antes de salvar.");
      return;
    }

    this.#avancarBtnEl.disabled = true;

    const base = this.#avaliacaoOriginal || {};
    const id = base.id || TreinosStorage.gerarIdCorporal();

    const fotos = [];
    VISTAS.forEach((vista) => {
      const foto = this.#fotos.get(vista.id);
      if (!foto) return;
      const fotoId = foto.blob ? TreinosStorage.salvarFotoCorporal(id, foto.blob) : foto.fotoId;
      fotos.push({ vista: vista.id, fotoId, largura: foto.largura, altura: foto.altura, capturadoEm: foto.capturadoEm });
    });
    this.#fotosRemovidas.forEach((fotoId) => TreinosStorage.excluirFotoCorporal(fotoId));

    TreinosStorage.salvarAvaliacao({
      ...base,
      id,
      alunoId: this.#aluno.alunoId,
      medidoEm: this.#medidoEm.toISOString(),
      protocolo: base.protocolo || { ...PROTOCOLO_ATUAL },
      medidas,
      fotos,
      condicoes: Object.fromEntries(Object.entries(this.#condicoes).filter(([, v]) => v)),
      observacoes: this.#observacoes.trim()
    });

    await TreinosStorage.aguardarEscritas();
    window.location.href = "corpo_menu.html";
  }
}

const ROTULOS = {
  estadoAlimentar: { jejum: "Em jejum", "antes-refeicao": "Antes da refeição", "depois-refeicao": "Depois da refeição" },
  roupa: { minima: "Mínima", leve: "Leve", normal: "Normal", outra: "Outra" },
  treinoRecente: { nao: "Não", sim: "Sim" }
};

new CorpoAvaliacaoNovaController().iniciar();
