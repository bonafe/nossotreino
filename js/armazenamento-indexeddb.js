// Motor de baixo nível sobre IndexedDB — só conhece `loja`/`chave`/`registro`,
// nenhuma regra de domínio (aluno/plano/histórico). storage.js é quem
// interpreta o significado de cada loja. Ver seção 2 de
// docs/armazenamento-local-especificacao.md.
export const NOME_BANCO = "nossotreino";
export const VERSAO_BANCO = 3;

function criarEsquemaInicial(banco) {
  banco.createObjectStore("alunos", { keyPath: "id" });

  const planos = banco.createObjectStore("planos", { keyPath: "id" });
  planos.createIndex("porAluno", "alunoId");

  banco.createObjectStore("planoDados", { keyPath: "planoId" });

  const historico = banco.createObjectStore("historico", { keyPath: "id", autoIncrement: true });
  historico.createIndex("porPlano", "planoId");
  historico.createIndex("porPlanoETipo", ["planoId", "tipo"]);

  const execucoes = banco.createObjectStore("execucoes", { keyPath: ["planoId", "tipo", "treinoId"] });
  execucoes.createIndex("porPlano", "planoId");
  execucoes.createIndex("porPlanoETipo", ["planoId", "tipo"]);

  banco.createObjectStore("preferencias", { keyPath: "chave" });

  // Bookkeeping interno (ex.: flag de migração do localStorage) — nunca
  // dado de usuário.
  banco.createObjectStore("meta", { keyPath: "chave" });
}

// Biblioteca personalizada do usuário (exercícios novos ou edições locais
// de exercícios oficiais — ver docs/especificacao-biblioteca-exercicios.md).
// KeyPath composto porque exercícios e alongamentos podem repetir `id`
// entre si (mesma regra do JSON oficial, ver js/imagem-exercicio.js).
// Escopo global (não por aluno/plano) — mesmo nível de `preferencias`/`meta`.
function criarLojaDeBibliotecaPersonalizada(banco) {
  banco.createObjectStore("bibliotecaPersonalizada", { keyPath: ["dominio", "id"] });
}

// Coleção local (device-local, não versionada no git, não é dado de
// aluno/plano) de tipos de atividade pra "atividade livre" (sessão com
// data/duração lançada manualmente, sem treino pré-cadastrado — ver
// docs/atividade-livre-especificacao.md). Semeada com as mesmas duas
// raízes que já existem como domínio de biblioteca de exercícios
// (`musculacao`, `alongamento` — ids coincidem por familiaridade de UX
// com js/dominios-biblioteca.js, não por acoplamento: nenhum código lê um
// a partir do outro).
//
// Migração já publicada (VERSAO_BANCO 3) — nunca editar o shape gravado
// aqui (`tipoAtividadePaiId`). `js/storage.js` normaliza pra
// `categoriaIds` (array, multi-categoria) na hidratação seguinte, então o
// shape antigo nunca é observado por código nenhum — ver
// migrarTipoAtividadeParaCategoriaIds em storage.js. O índice `porPai`
// abaixo já era código morto antes disso (nenhuma leitura o usa) e
// continua só como vestígio histórico.
function criarLojaDeTiposAtividade(banco) {
  const tipos = banco.createObjectStore("tiposAtividade", { keyPath: "id" });
  tipos.createIndex("porPai", "tipoAtividadePaiId");
  const agora = new Date().toISOString();
  tipos.put({ id: "musculacao", nome: "Musculação", tipoAtividadePaiId: null, criadoEm: agora });
  tipos.put({ id: "alongamento", nome: "Alongamento", tipoAtividadePaiId: null, criadoEm: agora });
}

// Tabela de migração estrutural do banco. Chave = versão de destino.
// `onupgradeneeded` aplica em sequência de (oldVersion+1) até newVersion,
// então um navegador parado numa versão antiga passa por todas as
// intermediárias em ordem. Nunca editar uma entrada já publicada — só
// acrescentar a próxima quando VERSAO_BANCO subir.
const MIGRACOES_BANCO = {
  1: criarEsquemaInicial,
  2: criarLojaDeBibliotecaPersonalizada,
  3: criarLojaDeTiposAtividade
};

function promessaDaRequisicao(requisicao) {
  return new Promise((resolve, reject) => {
    requisicao.onsuccess = () => resolve(requisicao.result);
    requisicao.onerror = () => reject(requisicao.error);
  });
}

function promessaDaTransacao(transacao) {
  return new Promise((resolve, reject) => {
    transacao.oncomplete = () => resolve();
    transacao.onerror = () => reject(transacao.error);
    transacao.onabort = () => reject(transacao.error);
  });
}

let promessaConexao = null;
let disponivel = true;

function abrirConexao() {
  if (typeof indexedDB === "undefined") {
    disponivel = false;
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    let resolvido = false;
    const finalizar = (valor) => {
      if (resolvido) return;
      resolvido = true;
      resolve(valor);
    };

    let requisicao;
    try {
      requisicao = indexedDB.open(NOME_BANCO, VERSAO_BANCO);
    } catch (erro) {
      console.warn("armazenamento-indexeddb: indexedDB.open falhou — seguindo só em memória", erro);
      disponivel = false;
      finalizar(null);
      return;
    }

    requisicao.onupgradeneeded = (evento) => {
      const banco = requisicao.result;
      for (let versao = evento.oldVersion + 1; versao <= evento.newVersion; versao++) {
        const migracao = MIGRACOES_BANCO[versao];
        if (migracao) migracao(banco, requisicao.transaction, evento);
      }
    };

    requisicao.onsuccess = () => {
      const banco = requisicao.result;
      // Outra aba tentou subir a versão do esquema — cede fechando esta
      // conexão, pra não bloquear o upgrade dela.
      banco.onversionchange = () => banco.close();
      finalizar(banco);
    };

    requisicao.onerror = () => {
      console.warn("armazenamento-indexeddb: não foi possível abrir o banco — seguindo só em memória", requisicao.error);
      disponivel = false;
      finalizar(null);
    };

    requisicao.onblocked = () => {
      console.warn("armazenamento-indexeddb: abertura bloqueada por outra aba com o banco aberto numa versão antiga");
      setTimeout(() => {
        disponivel = false;
        finalizar(null);
      }, 3000);
    };
  });
}

export class BancoIndexedDB {
  static abrir() {
    if (!promessaConexao) promessaConexao = abrirConexao();
    return promessaConexao;
  }

  static get disponivel() {
    return disponivel;
  }

  static async ler(loja, chave) {
    const banco = await BancoIndexedDB.abrir();
    if (!banco) return undefined;
    try {
      const transacao = banco.transaction(loja, "readonly");
      return await promessaDaRequisicao(transacao.objectStore(loja).get(chave));
    } catch (erro) {
      console.warn(`armazenamento-indexeddb: falha ao ler de "${loja}"`, erro);
      return undefined;
    }
  }

  static async lerTodos(loja) {
    const banco = await BancoIndexedDB.abrir();
    if (!banco) return [];
    try {
      const transacao = banco.transaction(loja, "readonly");
      return (await promessaDaRequisicao(transacao.objectStore(loja).getAll())) || [];
    } catch (erro) {
      console.warn(`armazenamento-indexeddb: falha ao ler tudo de "${loja}"`, erro);
      return [];
    }
  }

  static async gravar(loja, registro) {
    const banco = await BancoIndexedDB.abrir();
    if (!banco) return false;
    try {
      const transacao = banco.transaction(loja, "readwrite");
      transacao.objectStore(loja).put(registro);
      await promessaDaTransacao(transacao);
      return true;
    } catch (erro) {
      console.warn(`armazenamento-indexeddb: falha ao gravar em "${loja}"`, erro);
      return false;
    }
  }

  static async gravarVarios(loja, registros) {
    if (!registros || !registros.length) return true;
    const banco = await BancoIndexedDB.abrir();
    if (!banco) return false;
    try {
      const transacao = banco.transaction(loja, "readwrite");
      const armazem = transacao.objectStore(loja);
      registros.forEach((registro) => armazem.put(registro));
      await promessaDaTransacao(transacao);
      return true;
    } catch (erro) {
      console.warn(`armazenamento-indexeddb: falha ao gravar vários em "${loja}"`, erro);
      return false;
    }
  }

  static async remover(loja, chave) {
    const banco = await BancoIndexedDB.abrir();
    if (!banco) return false;
    try {
      const transacao = banco.transaction(loja, "readwrite");
      transacao.objectStore(loja).delete(chave);
      await promessaDaTransacao(transacao);
      return true;
    } catch (erro) {
      console.warn(`armazenamento-indexeddb: falha ao remover de "${loja}"`, erro);
      return false;
    }
  }

  // Remove todos os registros cujo índice bata com `intervalo` (um valor
  // exato ou um IDBKeyRange) — usado pra apagar em lote (ex.: todo o
  // histórico de um tipo dentro de um plano).
  static async removerPorIndice(loja, indice, intervalo) {
    const banco = await BancoIndexedDB.abrir();
    if (!banco) return false;
    try {
      const transacao = banco.transaction(loja, "readwrite");
      const cursorRequisicao = transacao.objectStore(loja).index(indice).openCursor(intervalo);
      await new Promise((resolve, reject) => {
        cursorRequisicao.onsuccess = () => {
          const cursor = cursorRequisicao.result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          } else {
            resolve();
          }
        };
        cursorRequisicao.onerror = () => reject(cursorRequisicao.error);
      });
      await promessaDaTransacao(transacao);
      return true;
    } catch (erro) {
      console.warn(`armazenamento-indexeddb: falha ao remover por índice "${indice}" em "${loja}"`, erro);
      return false;
    }
  }

  static async limparLoja(loja) {
    const banco = await BancoIndexedDB.abrir();
    if (!banco) return false;
    try {
      const transacao = banco.transaction(loja, "readwrite");
      transacao.objectStore(loja).clear();
      await promessaDaTransacao(transacao);
      return true;
    } catch (erro) {
      console.warn(`armazenamento-indexeddb: falha ao limpar "${loja}"`, erro);
      return false;
    }
  }
}
