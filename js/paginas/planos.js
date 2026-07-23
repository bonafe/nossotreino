import { TreinosStorage } from "../storage.js";
import { Formatadores } from "../formatadores.js";
import { slugificar } from "../identificadores.js";

class PlanosController {
  #carregandoEl = document.getElementById("carregando");
  #erroEl = document.getElementById("erro");
  #listaEl = document.getElementById("lista");
  #mensagemEl = document.getElementById("mensagem");
  #confirmOverlayEl = document.getElementById("confirmOverlay");
  #confirmTextoEl = document.getElementById("confirmTexto");
  #confirmOkEl = document.getElementById("confirmOk");
  #confirmCancelarEl = document.getElementById("confirmCancelar");
  #tituloEl = document.getElementById("titulo");
  #voltarLinkEl = document.getElementById("voltarLink");
  #novoPlanoLinkEl = document.getElementById("novoPlanoLink");
  #duplicarOverlayEl = document.getElementById("duplicarOverlay");
  #duplicarAlunoSelectEl = document.getElementById("duplicarAlunoSelect");
  #duplicarNomeNovoCampoEl = document.getElementById("duplicarNomeNovoCampo");
  #duplicarNomeNovoInputEl = document.getElementById("duplicarNomeNovoInput");
  #duplicarCancelarEl = document.getElementById("duplicarCancelar");
  #duplicarConfirmarEl = document.getElementById("duplicarConfirmar");

  #alunoId = null;
  #idParaExcluir = null;
  #idParaDuplicar = null;

  iniciar() {
    this.#alunoId = new URLSearchParams(window.location.search).get("aluno");
    const aluno = this.#alunoId && TreinosStorage.listarAlunos().find((a) => a.id === this.#alunoId);

    if (!aluno) {
      this.#mostrarErro("Nenhum aluno selecionado.");
      return;
    }

    this.#carregandoEl.hidden = true;
    this.#listaEl.hidden = false;

    document.title = `${aluno.nome} — Meus Planos`;
    this.#tituloEl.textContent = `Planos de ${aluno.nome}`;
    this.#voltarLinkEl.href = "alunos.html";
    this.#novoPlanoLinkEl.href = `plano_novo.html?aluno=${encodeURIComponent(this.#alunoId)}`;

    this.#confirmCancelarEl.addEventListener("click", () => this.#fecharConfirmacao());
    this.#confirmOkEl.addEventListener("click", () => this.#confirmarExclusao());
    this.#duplicarAlunoSelectEl.addEventListener("change", () => this.#atualizarVisibilidadeNomeNovo());
    this.#duplicarCancelarEl.addEventListener("click", () => this.#fecharDuplicacao());
    this.#duplicarConfirmarEl.addEventListener("click", () => this.#confirmarDuplicacao());

    this.#renderizarLista();
  }

  #mostrarErro(mensagem) {
    this.#carregandoEl.hidden = true;
    this.#erroEl.hidden = false;
    this.#erroEl.innerHTML = `${mensagem} Volte pra <a href="alunos.html">Alunos</a>.`;
  }

  #mostrarMensagem(texto, tipo) {
    this.#mensagemEl.hidden = false;
    this.#mensagemEl.className = `mensagem ${tipo}`;
    this.#mensagemEl.textContent = texto;
  }

  #renderizarLista() {
    const planos = TreinosStorage.listarPlanosDoAluno(this.#alunoId);
    const ativoId = TreinosStorage.obterPlanoAtivoId();

    if (!planos.length) {
      this.#listaEl.innerHTML = '<div class="estado">Nenhum plano ainda — crie um pelo botão "+" acima.</div>';
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

    const titulo = TreinosStorage.tituloDoPlano(plano.id);

    card.innerHTML = `
      <div class="plano-card-topo">
        <div>
          <h3>${titulo}</h3>
          <p class="plano-card-sub">${plano.professor ? `Professor: ${plano.professor}` : ""}</p>
        </div>
        <span class="tag" ${ativo ? "" : "hidden"}>ativo agora</span>
      </div>
      <p class="plano-card-atualizado">
        ${plano.atualizadoEm ? `Atualizado em ${Formatadores.dataHora(plano.atualizadoEm)}` : ""}
      </p>

      <div class="plano-card-editar" hidden>
        <div class="campo">
          <label>Nome do plano <span class="opcional">(opcional)</span></label>
          <input type="text" data-campo="nome" autocomplete="off" />
        </div>
        <div class="campo">
          <label>Nome do professor</label>
          <input type="text" data-campo="professor" autocomplete="off" />
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
        inicio: valores.inicio,
        fim: valores.fim,
        nome: valores.nome
      });
      this.#renderizarLista();
      return;
    }

    if (acao === "duplicar") {
      this.#abrirDuplicacao(id);
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
    this.#idParaExcluir = id;
    this.#confirmTextoEl.textContent =
      `Isso vai apagar o plano "${id}" — composição, histórico e progresso de execução. ` +
      "Não dá pra desfazer. Continuar?";
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

  // Duplicar sempre pergunta o aluno de destino — "este aluno" (novo
  // ciclo, comportamento de sempre) ou outro já cadastrado/novo (manda
  // a composição pra outro aluno sem precisar baixar/importar arquivo,
  // já que os dois estão no mesmo navegador).
  #abrirDuplicacao(id) {
    this.#idParaDuplicar = id;
    const outrosAlunos = TreinosStorage.listarAlunos().filter((a) => a.id !== this.#alunoId);

    this.#duplicarAlunoSelectEl.innerHTML =
      `<option value="${this.#alunoId}">Este aluno (novo ciclo)</option>` +
      outrosAlunos.map((a) => `<option value="${a.id}">${a.nome}</option>`).join("") +
      '<option value="__novo__">+ Novo aluno</option>';
    this.#duplicarAlunoSelectEl.value = this.#alunoId;
    this.#duplicarNomeNovoInputEl.value = "";
    this.#atualizarVisibilidadeNomeNovo();
    this.#duplicarOverlayEl.hidden = false;
  }

  #atualizarVisibilidadeNomeNovo() {
    this.#duplicarNomeNovoCampoEl.hidden = this.#duplicarAlunoSelectEl.value !== "__novo__";
  }

  #fecharDuplicacao() {
    this.#duplicarOverlayEl.hidden = true;
    this.#idParaDuplicar = null;
  }

  #confirmarDuplicacao() {
    const id = this.#idParaDuplicar;
    if (!id) return;

    let alunoIdDestino = this.#duplicarAlunoSelectEl.value;
    if (alunoIdDestino === "__novo__") {
      const nome = this.#duplicarNomeNovoInputEl.value.trim();
      if (!nome) {
        this.#mostrarMensagem("Preencha o nome do novo aluno.", "erro");
        return;
      }
      alunoIdDestino = TreinosStorage.criarAluno(nome);
    }

    TreinosStorage.duplicarPlano(id, alunoIdDestino);
    this.#fecharDuplicacao();

    if (alunoIdDestino === this.#alunoId) {
      this.#renderizarLista();
    } else {
      window.location.href = `planos.html?aluno=${encodeURIComponent(alunoIdDestino)}`;
    }
  }

  #abrirEdicao(id, card) {
    const dados = TreinosStorage.lerDadosDoPlano(id);
    const metadata = (dados && dados.metadata) || {};
    const planejamento = metadata.planejamento || {};
    const plano = TreinosStorage.listarPlanos().find((p) => p.id === id);

    const painel = card.querySelector(".plano-card-editar");
    painel.querySelector('[data-campo="nome"]').value = (plano && plano.nome) || "";
    painel.querySelector('[data-campo="professor"]').value = metadata.professor || "";
    painel.querySelector('[data-campo="inicio"]').value = planejamento.inicio || "";
    painel.querySelector('[data-campo="fim"]').value = planejamento.fim || "";
    painel.hidden = false;
  }

  #sufixoArquivo(id) {
    return `${slugificar(id)}-${new Date().toISOString().slice(0, 10)}.json`;
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
