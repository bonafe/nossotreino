// Strings "Pix copia e cola" já prontas, geradas no app do banco/PSP —
// nunca construídas ou calculadas aqui (ver docs/apoio-especificacao.md
// seção 2.1: um payload Pix errado falha na validação do banco de quem
// for pagar, não é algo pra reinventar). `valor: null` é a opção "valor
// livre"; deixar `payload: null` oculta aquela opção até existir a
// string real.
export const OPCOES_PIX = [
  {
    valor: 5,
    payload:
      "00020126810014br.gov.bcb.pix0136a7d46d39-e7ff-452c-90b3-86aa6eafd1f70219Doacao_Nosso_Treino52040000530398654045.005802BR5925FERNANDO_AUGUSTO_SAMPAIO_6008CAMPINAS62150511NossoTreino63040795"
  },
  {
    valor: 10,
    payload:
      "00020126810014br.gov.bcb.pix0136a7d46d39-e7ff-452c-90b3-86aa6eafd1f70219Doacao_Nosso_Treino520400005303986540510.005802BR5925FERNANDO_AUGUSTO_SAMPAIO_6008CAMPINAS62170513NossoTreino10630470AD"
  },
  {
    valor: 25,
    payload:
      "00020126810014br.gov.bcb.pix0136a7d46d39-e7ff-452c-90b3-86aa6eafd1f70219Doacao_Nosso_Treini520400005303986540525.005802BR5925FERNANDO_AUGUSTO_SAMPAIO_6008CAMPINAS62170513NossoTreino2563041E3A"
  },
  {
    valor: 50,
    payload:
      "00020126810014br.gov.bcb.pix0136a7d46d39-e7ff-452c-90b3-86aa6eafd1f70219Doacao_Nosso_Treino520400005303986540550.005802BR5925FERNANDO_AUGUSTO_SAMPAIO_6008CAMPINAS62170513NossoTreino5063041272"
  },
  { valor: null, payload: null }
];
