// Tratamento das fotos corporais (ver docs/medidas-fotos-especificacao.md,
// seção 7): toda foto é redesenhada num <canvas> e regravada como JPEG
// antes de ser guardada — isso descarta EXIF/GPS/modelo do aparelho. Só
// largura, altura e data ficam. Sem filtro nem correção estética: a imagem
// representa fielmente o que foi capturado (só redução de resolução e
// compressão).
const LADO_MAIOR_MAXIMO = 1920;
const QUALIDADE_JPEG = 0.88;

function canvasParaBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("canvas.toBlob falhou"))), "image/jpeg", QUALIDADE_JPEG);
  });
}

function desenharEmCanvas(fonte, larguraOrigem, alturaOrigem) {
  const escala = Math.min(1, LADO_MAIOR_MAXIMO / Math.max(larguraOrigem, alturaOrigem));
  const largura = Math.max(1, Math.round(larguraOrigem * escala));
  const altura = Math.max(1, Math.round(alturaOrigem * escala));
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  canvas.getContext("2d").drawImage(fonte, 0, 0, largura, altura);
  return canvas;
}

// Quadro atual de um <video> (câmera ao vivo) → { blob, largura, altura }.
export async function capturarDeVideo(video) {
  const canvas = desenharEmCanvas(video, video.videoWidth, video.videoHeight);
  return { blob: await canvasParaBlob(canvas), largura: canvas.width, altura: canvas.height };
}

// Arquivo escolhido pelo usuário (upload) → { blob, largura, altura }.
// `imageOrientation: "from-image"` aplica a rotação do EXIF no desenho,
// então a foto sai na orientação certa mesmo depois de o EXIF ser descartado.
export async function processarArquivo(arquivo) {
  const imagem = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  try {
    const canvas = desenharEmCanvas(imagem, imagem.width, imagem.height);
    return { blob: await canvasParaBlob(canvas), largura: canvas.width, altura: canvas.height };
  } finally {
    imagem.close();
  }
}

// --- Conversão Blob <-> base64, usada só pelo backup com fotos ---

export function blobParaBase64(blob) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result).split(",")[1] || "");
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsDataURL(blob);
  });
}

export function base64ParaBlob(dadosBase64, tipoMime) {
  const binario = atob(dadosBase64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return new Blob([bytes], { type: tipoMime || "image/jpeg" });
}
