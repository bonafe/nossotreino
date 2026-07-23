import { TreinosStorage } from "./storage.js";

// Conteúdo de onboarding: 3 planos genéricos (não são dados pessoais de
// ninguém, ver `metadata.carater: "exemplo-generico-nao-individualizado"`
// em cada arquivo) versionados em `treinos-exemplo/`, a única exceção à
// regra de "plano nunca no código" — ver seção 1 de
// docs/armazenamento-local-especificacao.md.
const NIVEIS = [
  { arquivo: "treinos-exemplo/iniciante.json", nome: "Iniciante" },
  { arquivo: "treinos-exemplo/intermediario.json", nome: "Intermediário" },
  { arquivo: "treinos-exemplo/avancado.json", nome: "Avançado" }
];

const NOME_ALUNO_PADRAO = "Meu perfil";

// Só roda quando o navegador está genuinamente vazio (nem aluno nem
// plano nenhum) — não confundir com a migração de planos antigos sem
// `alunoId` (garantirAlunosMigrados, que já roda dentro de
// listarAlunos()/listarPlanos() antes desta checagem).
export async function semearContaDeExemplo() {
  if (TreinosStorage.listarAlunos().length || TreinosStorage.listarPlanos().length) {
    return false;
  }

  const alunoId = TreinosStorage.criarAluno(NOME_ALUNO_PADRAO);

  for (const nivel of NIVEIS) {
    try {
      const resposta = await fetch(nivel.arquivo);
      if (!resposta.ok) continue;
      const dados = await resposta.json();
      dados.metadata = { ...dados.metadata, aluno: NOME_ALUNO_PADRAO };

      const planoId = TreinosStorage.importarPlano(dados, alunoId);
      TreinosStorage.atualizarMetadataPlano(planoId, {
        professor: (dados.metadata && dados.metadata.professor) || "",
        inicio: (dados.metadata.planejamento && dados.metadata.planejamento.inicio) || "",
        fim: (dados.metadata.planejamento && dados.metadata.planejamento.fim) || "",
        nome: nivel.nome
      });
    } catch (erro) {
      // Sem conexão ou arquivo ausente — segue pros próximos níveis, não
      // impede o resto do onboarding (o aluno já foi criado de qualquer
      // forma, mesmo que fique sem nenhum plano nesse caso raro).
    }
  }

  return true;
}
