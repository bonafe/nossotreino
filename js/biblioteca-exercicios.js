import { TreinosStorage } from "./storage.js";
import { obterDominio, obterEm } from "./dominios-biblioteca.js";

let bibliotecaOficialCache = null;
let bibliotecaCache = null;

// biblioteca-exercicios.json não é dado pessoal (é vocabulário
// compartilhado — exercícios, cardio, grupos musculares — igual pra
// qualquer aluno), então é um arquivo estático versionado, buscado por
// fetch em vez de importado manualmente como o plano de treino. sw.js
// pré-cacheia esse arquivo, então o fetch funciona offline depois da
// primeira visita. O cache em memória evita rebuscar a cada chamada
// dentro do mesmo carregamento de página.
//
// Separada de carregarBiblioteca() (abaixo) e nunca mutada: é o que
// permite comparar a `versao` oficial atual contra a `baseadoEmVersao` de
// um exercício personalizado editado, pra avisar quando a oficial evoluiu
// além do que a pessoa partiu ao editar (ver
// docs/especificacao-biblioteca-exercicios.md).
export async function carregarBibliotecaOficial() {
  if (bibliotecaOficialCache) return bibliotecaOficialCache;

  const resposta = await fetch("biblioteca-exercicios/biblioteca-exercicios.json");
  if (!resposta.ok) {
    throw new Error("Não foi possível carregar a biblioteca de exercícios.");
  }

  bibliotecaOficialCache = await resposta.json();
  return bibliotecaOficialCache;
}

// Biblioteca oficial + itens personalizados de qualquer domínio (guardados
// localmente em IndexedDB, nunca no repositório — ver
// TreinosStorage.listarBibliotecaPersonalizada em storage.js). Um registro
// com origem "novo" entra como item novo; um com origem "edicao"
// substitui por completo o item oficial de mesmo id (nunca mescla campo a
// campo). A coleção de destino (`bibliotecas.exercicios`,
// `bibliotecas.alongamentos`, ...) vem do `colecaoPath` declarado pelo
// domínio em js/dominios-biblioteca.js — um domínio novo não exige mudar
// esta função. Clona a oficial antes de mesclar pra não mutar
// bibliotecaOficialCache.
export async function carregarBiblioteca() {
  if (bibliotecaCache) return bibliotecaCache;

  const oficial = await carregarBibliotecaOficial();
  const personalizados = await TreinosStorage.listarBibliotecaPersonalizada();

  const mesclada = structuredClone(oficial);
  personalizados.forEach((registro) => {
    const colecao = obterEm(mesclada.bibliotecas, obterDominio(registro.dominio).colecaoPath);
    colecao[registro.id] = registro.entrada;
  });

  bibliotecaCache = mesclada;
  return bibliotecaCache;
}

// Descarta o merge em memória (nunca a oficial, que não muda em tempo de
// execução) — chamada junto com TreinosStorage.recarregarBibliotecaPersonalizada()
// quando uma aba volta a ficar em foco, pra um personalizado criado/editado
// numa aba separada (ver exercicio-novo.js) aparecer na próxima chamada de
// carregarBiblioteca() sem precisar recarregar a página.
export function invalidarCacheBiblioteca() {
  bibliotecaCache = null;
}
