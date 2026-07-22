import { TreinosStorage } from "../storage.js";
import { Formatadores } from "../formatadores.js";
import { slugificar } from "../identificadores.js";
import { carregarBiblioteca } from "../biblioteca-exercicios.js";
import { VideosTorrent } from "../videos-torrent.js";

// Mesmos campos exigidos de um plano avulso colado/importado (não um
// backup) — ver seção 2.2 de especificacao-biblioteca-exercicios.md.
const CAMPOS_OBRIGATORIOS_PLANO = ["schema", "metadata", "distribuicaoSemanal", "treinos"];

class PlanosController {
  #listaEl = document.getElementById("lista");
  #mensagemEl = document.getElementById("mensagem");
  #confirmOverlayEl = document.getElementById("confirmOverlay");
  #confirmTextoEl = document.getElementById("confirmTexto");
  #confirmOkEl = document.getElementById("confirmOk");
  #confirmCancelarEl = document.getElementById("confirmCancelar");
  #arquivoInputEl = document.getElementById("arquivoInput");
  #baixarBackupBtnEl = document.getElementById("baixarBackupBtn");
  #avisoIaOverlayEl = document.getElementById("avisoIaOverlay");
  #avisoIaAceitarEl = document.getElementById("avisoIaAceitar");
  #avisoIaRecusarEl = document.getElementById("avisoIaRecusar");

  #idParaExcluir = null;

  iniciar() {
    this.#confirmCancelarEl.addEventListener("click", () => this.#fecharConfirmacao());
    this.#confirmOkEl.addEventListener("click", () => this.#confirmarExclusao());
    this.#arquivoInputEl.addEventListener("change", (evento) => this.#aoEscolherArquivo(evento));
    this.#baixarBackupBtnEl.addEventListener("click", () => this.#aoBaixarBackup());
    this.#avisoIaAceitarEl.addEventListener("click", () => this.#aoAceitarAvisoIa());
    this.#avisoIaRecusarEl.addEventListener("click", () => {
      window.location.href = "index.html";
    });
    this.#renderizarLista();

    if (!TreinosStorage.lerJSONGlobal(TreinosStorage.chaves.avisoIaAceito, false)) {
      this.#avisoIaOverlayEl.hidden = false;
    }
  }

  #aoAceitarAvisoIa() {
    TreinosStorage.salvarJSONGlobal(TreinosStorage.chaves.avisoIaAceito, true);
    this.#avisoIaOverlayEl.hidden = true;
  }

  #validarPlano(dados) {
    return dados && typeof dados === "object" && CAMPOS_OBRIGATORIOS_PLANO.every((campo) => campo in dados);
  }

  #aoEscolherArquivo(evento) {
    const arquivo = evento.target.files[0];
    if (!arquivo) return;

    const leitor = new FileReader();
    leitor.onload = () => this.#aoCarregarConteudo(leitor.result);
    leitor.readAsText(arquivo);
    evento.target.value = "";
  }

  #aoCarregarConteudo(texto) {
    let dados;
    try {
      dados = JSON.parse(texto);
    } catch (erro) {
      this.#mostrarMensagem("Esse arquivo não é um JSON válido.", "erro");
      return;
    }

    if (dados && dados.tipo === "backup-treinos") {
      TreinosStorage.restaurarBackup(dados);
      this.#prefetchVideosDaBiblioteca();
      window.location.href = "sistema.html";
      return;
    }

    if (!this.#validarPlano(dados)) {
      this.#mostrarMensagem(
        "Esse arquivo não parece ser um plano de treino nem um backup válido — faltam campos como treinos, metadata ou distribuicaoSemanal.",
        "erro"
      );
      return;
    }

    const id = TreinosStorage.importarPlano(dados);
    TreinosStorage.ativarPlano(id);
    this.#prefetchVideosDaBiblioteca();
    window.location.href = "sistema.html";
  }

  #prefetchVideosDaBiblioteca() {
    carregarBiblioteca()
      .then((bibliotecaExercicios) => VideosTorrent.prefetchTodosOsVideos(bibliotecaExercicios))
      .catch(() => {
        // Sem conexão — a biblioteca ainda não deve ter sido cacheada pelo
        // service worker na primeira visita. O plano continua salvo normalmente.
      });
  }

  #aoBaixarBackup() {
    const backup = TreinosStorage.montarBackup();
    if (!backup.planos.length) {
      this.#mostrarMensagem("Crie ou importe pelo menos um plano antes de baixar um backup.", "erro");
      return;
    }

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `treinos-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  #mostrarMensagem(texto, tipo) {
    this.#mensagemEl.hidden = false;
    this.#mensagemEl.className = `mensagem ${tipo}`;
    this.#mensagemEl.textContent = texto;
  }

  #renderizarLista() {
    const planos = TreinosStorage.listarPlanos();
    const ativoId = TreinosStorage.obterPlanoAtivoId();

    if (!planos.length) {
      this.#listaEl.innerHTML =
        '<div class="estado">Nenhum plano ainda — crie um pelo botão "+" acima ou importe um recebido pelo 📂.</div>';
      return;
    }

    this.#listaEl.innerHTML = "";
    planos
      .slice()
      .sort((a, b) => (b.atualizadoEm || "").localeCompare(a.atualizadoEm || ""))
      .forEach((plano) => {
        this.#listaEl.appendChild(this.#montarCard(plano, plano.id === ativoId));
      });
  }

  #montarCard(plano, ativo) {
    const card = document.createElement("div");
    card.className = "painel plano-card";
    card.dataset.id = plano.id;

    const subLinhas = [];
    if (plano.professor) subLinhas.push(`Professor: ${plano.professor}`);
    const dados = TreinosStorage.lerJSONDoPlano(plano.id, "dados.v1", null);
    const planejamento = dados && dados.metadata && dados.metadata.planejamento;
    if (planejamento && (planejamento.inicio || planejamento.fim)) {
      subLinhas.push(`Ciclo: ${planejamento.inicio || "?"} – ${planejamento.fim || "?"}`);
    }

    card.innerHTML = `
      <div class="plano-card-topo">
        <div>
          <h3>${plano.aluno || "Sem aluno definido"}</h3>
          <p class="plano-card-sub">${subLinhas.join(" · ")}</p>
        </div>
        <span class="tag" ${ativo ? "" : "hidden"}>ativo agora</span>
      </div>
      <p class="plano-card-atualizado">
        ${plano.atualizadoEm ? `Atualizado em ${Formatadores.dataHora(plano.atualizadoEm)}` : ""}
      </p>

      <div class="plano-card-editar" hidden>
        <div class="campo">
          <label>Nome do professor</label>
          <input type="text" data-campo="professor" autocomplete="off" />
        </div>
        <div class="campo">
          <label>Nome do aluno</label>
          <input type="text" data-campo="aluno" autocomplete="off" />
        </div>
        <div class="campo-linha">
          <div class="campo">
            <label>Início do ciclo</label>
            <input type="date" data-campo="inicio" />
          </div>
          <div class="campo">
            <label>Fim do ciclo</label>
            <input type="date" data-campo="fim" />
          </div>
        </div>
        <div class="plano-card-editar-acoes">
          <button type="button" data-acao="cancelar-edicao">Cancelar</button>
          <button type="button" data-acao="salvar-edicao">Salvar</button>
        </div>
      </div>

      <div class="plano-card-acoes">
        <button type="button" data-acao="entrar">Entrar</button>
        <button type="button" data-acao="editar">✏️ Editar</button>
        <button type="button" data-acao="duplicar">Duplicar</button>
        <button type="button" data-acao="baixar-plano">⬇️ Baixar plano</button>
        <button type="button" data-acao="baixar-tudo">⬇️ Baixar tudo</button>
        <button type="button" class="danger" data-acao="excluir">🗑️ Excluir</button>
      </div>
    `;

    card.querySelectorAll("[data-acao]").forEach((botao) => {
      botao.addEventListener("click", () => this.#aoEscolherAcao(plano.id, botao.dataset.acao, card));
    });

    return card;
  }

  #aoEscolherAcao(id, acao, card) {
    if (acao === "entrar") {
      TreinosStorage.ativarPlano(id);
      window.location.href = "sistema.html";
      return;
    }

    if (acao === "editar") {
      this.#abrirEdicao(id, card);
      return;
    }

    if (acao === "cancelar-edicao") {
      card.querySelector(".plano-card-editar").hidden = true;
      return;
    }

    if (acao === "salvar-edicao") {
      const campos = card.querySelectorAll(".plano-card-editar [data-campo]");
      const valores = {};
      campos.forEach((input) => {
        valores[input.dataset.campo] = input.value.trim();
      });
      TreinosStorage.atualizarMetadataPlano(id, {
        professor: valores.professor,
        aluno: valores.aluno,
        inicio: valores.inicio,
        fim: valores.fim
      });
      this.#renderizarLista();
      return;
    }

    if (acao === "duplicar") {
      TreinosStorage.duplicarPlano(id);
      this.#renderizarLista();
      return;
    }

    if (acao === "baixar-plano") {
      this.#baixarJSON(TreinosStorage.lerDadosDoPlano(id), `plano-${this.#sufixoArquivo(id)}`);
      return;
    }

    if (acao === "baixar-tudo") {
      this.#baixarJSON(TreinosStorage.montarExportacaoCompletaDoPlano(id), `plano-completo-${this.#sufixoArquivo(id)}`);
      return;
    }

    if (acao === "excluir") {
      this.#abrirConfirmacaoExclusao(id);
      return;
    }
  }

  #abrirConfirmacaoExclusao(id) {
    const plano = TreinosStorage.listarPlanos().find((p) => p.id === id);
    this.#idParaExcluir = id;
    this.#confirmTextoEl.textContent =
      `Isso vai apagar o plano de "${(plano && plano.aluno) || "aluno sem nome"}" — composição, histórico e ` +
      "progresso de execução. Não dá pra desfazer. Continuar?";
    this.#confirmOverlayEl.hidden = false;
  }

  #fecharConfirmacao() {
    this.#confirmOverlayEl.hidden = true;
    this.#idParaExcluir = null;
  }

  #confirmarExclusao() {
    if (this.#idParaExcluir) {
      TreinosStorage.excluirPlano(this.#idParaExcluir);
      this.#renderizarLista();
    }
    this.#fecharConfirmacao();
  }

  #abrirEdicao(id, card) {
    const dados = TreinosStorage.lerDadosDoPlano(id);
    const metadata = (dados && dados.metadata) || {};
    const planejamento = metadata.planejamento || {};

    const painel = card.querySelector(".plano-card-editar");
    painel.querySelector('[data-campo="professor"]').value = metadata.professor || "";
    painel.querySelector('[data-campo="aluno"]').value = metadata.aluno || "";
    painel.querySelector('[data-campo="inicio"]').value = planejamento.inicio || "";
    painel.querySelector('[data-campo="fim"]').value = planejamento.fim || "";
    painel.hidden = false;
  }

  #sufixoArquivo(id) {
    const planos = TreinosStorage.listarPlanos();
    const plano = planos.find((p) => p.id === id);
    const nome = slugificar((plano && plano.aluno) || id);
    return `${nome}-${new Date().toISOString().slice(0, 10)}.json`;
  }

  #baixarJSON(dados, nomeArquivo) {
    if (!dados) {
      this.#mostrarMensagem("Não foi possível ler os dados desse plano.", "erro");
      return;
    }

    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

new PlanosController().iniciar();
