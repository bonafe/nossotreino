// Marcas de acentuação Unicode (combining diacritical marks) removidas depois
// do normalize("NFD") — construído por código de caractere em vez de literal
// no arquivo, pra evitar problemas de codificação com o intervalo de marcas
// combináveis.
const REGEX_ACENTOS = new RegExp("[" + String.fromCharCode(0x0300) + "-" + String.fromCharCode(0x036f) + "]", "g");

export function normalizar(texto) {
  return (texto || "").normalize("NFD").replace(REGEX_ACENTOS, "").toLowerCase();
}

export function slugificar(texto) {
  return normalizar(texto)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Gera um id único dentro de `idsExistentes`, a partir do nome — usado
// pelas telas de criação (treino_novo.html, treino_bicicleta_novo.html,
// treino_alongamento_novo.html) pra não colidir com um id já usado na
// mesma coleção do plano.
export function gerarIdUnico(nome, idsExistentes, base = "treino") {
  const slug = slugificar(nome) || base;
  if (!idsExistentes.has(slug)) return slug;

  let contador = 2;
  while (idsExistentes.has(`${slug}-${contador}`)) contador += 1;
  return `${slug}-${contador}`;
}
