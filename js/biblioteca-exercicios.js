let bibliotecaCache = null;

// biblioteca-exercicios.json não é dado pessoal (é vocabulário
// compartilhado — exercícios, cardio, grupos musculares — igual pra
// qualquer aluno), então é um arquivo estático versionado, buscado por
// fetch em vez de importado manualmente como o plano de treino. sw.js
// pré-cacheia esse arquivo, então o fetch funciona offline depois da
// primeira visita. O cache em memória evita rebuscar a cada chamada
// dentro do mesmo carregamento de página.
export async function carregarBiblioteca() {
  if (bibliotecaCache) return bibliotecaCache;

  const resposta = await fetch("biblioteca-exercicios/biblioteca-exercicios.json");
  if (!resposta.ok) {
    throw new Error("Não foi possível carregar a biblioteca de exercícios.");
  }

  bibliotecaCache = await resposta.json();
  return bibliotecaCache;
}
