import { TreinosStorage } from "../storage.js";
import { Formatadores } from "../formatadores.js";
import { carregarBiblioteca } from "../biblioteca-exercicios.js";
import { VideosTorrent } from "../videos-torrent.js";
import { semearContaDeExemplo } from "../treinos-exemplo.js";

// Mesmos campos exigidos de um plano avulso colado/importado (não um
// backup) — ver seção 2.2 de especificacao-biblioteca-exercicios.md.
const CAMPOS_OBRIGATORIOS_PLANO = ["schema", "metadata", "distribuicaoSemanal", "treinos"];

class AlunosController {
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
  #importarOverlayEl = document.getElementById("importarOverlay");
  #importarAlunoSelectEl = document.getElementById("importarAlunoSelect");
  #importarNomeNovoCampoEl = document.getElementById("importarNomeNovoCampo");
  #importarNomeNovoInputEl = document.getElementById("importarNomeNovoInput");
  #importarCancelarEl = document.getElementById("importarCancelar");
  #importarConfirmarEl = document.getElementById("importarConfirmar");

  #idParaExcluir = null;
  #dadosParaImportar = null;

  async iniciar() {
    this.#confirmCancelarEl.addEventListener("click", () => this.#fecharConfirmacao());
    this.#confirmOkEl.addEventListener("click", () => this.#confirmarExclusao());
    this.#arquivoInputEl.addEventListener("change", (evento) => this.#aoEscolherArquivo(evento));
    this.#baixarBackupBtnEl.addEventListener("click", () => this.#aoBaixarBackup());
    this.#avisoIaAceitarEl.addEventListener("click", () => this.#aoAceitarAvisoIa());
    this.#avisoIaRecusarEl.addEventListener("click", () => {
      window.location.href = "index.html";
    });
    this.#importarAlunoSelectEl.addEventListener("change", () => this.#atualizarVisibilidadeNomeNovo());
    this.#importarCancelarEl.addEventListener("click", () => this.#fecharImportacao());
    this.#importarConfirmarEl.addEventListener("click", () => this.#confirmarImportacao());

    const semeado = await semearContaDeExemplo();
    this.#renderizarLista();
    if (semeado) {
      this.#mostrarMensagem(
        'Criamos um perfil de exemplo ("Meu perfil") com 5 planos de treino ' +
          "(Iniciante, Intermediário, Avançado, Casa e Peso corporal) pra você já " +
          "explorar o sistema — pode renomear ou excluir quando quiser.",
        "sucesso"
      );
    }

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

    this.#abrirConfirmacaoImportar(dados);
  }

  // Pergunta pra qual aluno vai o plano em vez de adivinhar a partir de
  // `dados.metadata.aluno` — o mesmo arquivo pode ser reaproveitado como
  // template pra um aluno diferente do que está gravado nele (ex.: baixar
  // o plano de um aluno e importar pra outro).
  #abrirConfirmacaoImportar(dados) {
    this.#dadosParaImportar = dados;
    const nomeSugerido = ((dados.metadata && dados.metadata.aluno) || "").trim();
    const alunos = TreinosStorage.listarAlunos();
    const existente = nomeSugerido && alunos.find((a) => a.nome.trim().toLowerCase() === nomeSugerido.toLowerCase());

    this.#importarAlunoSelectEl.innerHTML =
      alunos.map((a) => `<option value="${a.id}">${a.nome}</option>`).join("") +
      '<option value="__novo__">+ Novo aluno</option>';
    this.#importarAlunoSelectEl.value = existente ? existente.id : "__novo__";
    this.#importarNomeNovoInputEl.value = nomeSugerido;
    this.#atualizarVisibilidadeNomeNovo();
    this.#importarOverlayEl.hidden = false;
  }

  #atualizarVisibilidadeNomeNovo() {
    this.#importarNomeNovoCampoEl.hidden = this.#importarAlunoSelectEl.value !== "__novo__";
  }

  #fecharImportacao() {
    this.#importarOverlayEl.hidden = true;
    this.#dadosParaImportar = null;
  }

  #confirmarImportacao() {
    const dados = this.#dadosParaImportar;
    if (!dados) return;

    let alunoId = this.#importarAlunoSelectEl.value;
    if (alunoId === "__novo__") {
      const nome = this.#importarNomeNovoInputEl.value.trim();
      if (!nome) {
        this.#mostrarMensagem("Preencha o nome do novo aluno.", "erro");
        return;
      }
      alunoId = TreinosStorage.criarAluno(nome);
    }

    const aluno = TreinosStorage.listarAlunos().find((a) => a.id === alunoId);
    dados.metadata = { ...dados.metadata, aluno: (aluno && aluno.nome) || "" };

    const id = TreinosStorage.importarPlano(dados, alunoId);
    TreinosStorage.ativarPlano(id);
    this.#fecharImportacao();
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
    if (!backup.alunos.length) {
      this.#mostrarMensagem("Crie ou importe pelo menos um aluno antes de baixar um backup.", "erro");
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
    const alunos = TreinosStorage.listarAlunos();

    if (!alunos.length) {
      this.#listaEl.innerHTML =
        '<div class="estado">Nenhum aluno ainda — crie um pelo botão "+" acima ou importe um plano recebido pelo 📂.</div>';
      return;
    }

    this.#listaEl.innerHTML = "";
    alunos
      .slice()
      .sort((a, b) => (b.atualizadoEm || "").localeCompare(a.atualizadoEm || ""))
      .forEach((aluno) => {
        this.#listaEl.appendChild(this.#montarCard(aluno));
      });
  }

  #montarCard(aluno) {
    const card = document.createElement("div");
    card.className = "painel aluno-card";
    card.dataset.id = aluno.id;

    const totalPlanos = TreinosStorage.listarPlanosDoAluno(aluno.id).length;

    card.innerHTML = `
      <div class="aluno-card-topo">
        <div>
          <h3>${aluno.nome || "Sem nome"}</h3>
          <p class="aluno-card-sub">${totalPlanos} plano${totalPlanos === 1 ? "" : "s"}</p>
        </div>
      </div>
      <p class="aluno-card-atualizado">
        ${aluno.atualizadoEm ? `Atualizado em ${Formatadores.dataHora(aluno.atualizadoEm)}` : ""}
      </p>

      <div class="aluno-card-editar" hidden>
        <div class="campo">
          <label>Nome do aluno</label>
          <input type="text" data-campo="nome" autocomplete="off" />
        </div>
        <div class="aluno-card-editar-acoes">
          <button type="button" data-acao="cancelar-edicao">Cancelar</button>
          <button type="button" data-acao="salvar-edicao">Salvar</button>
        </div>
      </div>

      <div class="aluno-card-acoes">
        <button type="button" data-acao="entrar">Entrar</button>
        <button type="button" data-acao="editar">✏️ Editar</button>
        <button type="button" class="danger" data-acao="excluir">🗑️ Excluir</button>
      </div>
    `;

    card.querySelectorAll("[data-acao]").forEach((botao) => {
      botao.addEventListener("click", () => this.#aoEscolherAcao(aluno.id, botao.dataset.acao, card));
    });

    return card;
  }

  #aoEscolherAcao(id, acao, card) {
    if (acao === "entrar") {
      window.location.href = `planos.html?aluno=${encodeURIComponent(id)}`;
      return;
    }

    if (acao === "editar") {
      this.#abrirEdicao(id, card);
      return;
    }

    if (acao === "cancelar-edicao") {
      card.querySelector(".aluno-card-editar").hidden = true;
      return;
    }

    if (acao === "salvar-edicao") {
      const nome = card.querySelector('.aluno-card-editar [data-campo="nome"]').value.trim();
      TreinosStorage.atualizarAluno(id, nome);
      this.#renderizarLista();
      return;
    }

    if (acao === "excluir") {
      this.#abrirConfirmacaoExclusao(id);
      return;
    }
  }

  #abrirConfirmacaoExclusao(id) {
    const aluno = TreinosStorage.listarAlunos().find((a) => a.id === id);
    const totalPlanos = TreinosStorage.listarPlanosDoAluno(id).length;
    this.#idParaExcluir = id;
    this.#confirmTextoEl.textContent =
      `Isso vai apagar "${(aluno && aluno.nome) || "esse aluno"}" e ${totalPlanos} ` +
      `plano${totalPlanos === 1 ? "" : "s"} dele(a) — composição, histórico e progresso de execução de todos. ` +
      "Não dá pra desfazer. Continuar?";
    this.#confirmOverlayEl.hidden = false;
  }

  #fecharConfirmacao() {
    this.#confirmOverlayEl.hidden = true;
    this.#idParaExcluir = null;
  }

  #confirmarExclusao() {
    if (this.#idParaExcluir) {
      TreinosStorage.excluirAluno(this.#idParaExcluir);
      this.#renderizarLista();
    }
    this.#fecharConfirmacao();
  }

  #abrirEdicao(id, card) {
    const aluno = TreinosStorage.listarAlunos().find((a) => a.id === id);
    const painel = card.querySelector(".aluno-card-editar");
    painel.querySelector('[data-campo="nome"]').value = (aluno && aluno.nome) || "";
    painel.hidden = false;
  }
}

new AlunosController().iniciar();
