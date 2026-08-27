// Registro dos domínios de biblioteca personalizável (ver seção 26 de
// docs/especificacao-biblioteca-exercicios.md). Cada domínio declara sua
// própria lista de campos — musculação e alongamento têm formatos
// diferentes de verdade na biblioteca oficial (ex.: alongamento tem
// `execucao.respiracao` como lista, musculação como texto único;
// `gruposMusculares.secundarios` vs `.sinergistas`) — em vez de um
// formulário/motor de merge hardcoded pra só esses dois. Domínios oficiais
// futuros (dança, luta, yoga) entram só como uma entrada nova aqui, sem
// tocar em `js/biblioteca-exercicios.js` nem em `js/paginas/exercicio-novo.js`.
//
// Propositalmente só dado puro serializável (sem funções de validação
// embutidas em cada campo) — quando existir domínio criado pelo próprio
// usuário, este objeto passa a vir de uma loja no IndexedDB em vez de um
// módulo estático, e o formato precisa sobreviver a essa migração sem
// mudar de forma.

// Caminho com pontos (ex.: "classificacao.tipo") dentro de um objeto —
// usado tanto pra popular o formulário em modo edição quanto pra escrever
// os valores coletados de volta em `entrada`, e por `carregarBiblioteca()`
// pra navegar `colecaoPath`.
export function obterEm(objeto, caminho) {
  return caminho.reduce((atual, chave) => (atual == null ? undefined : atual[chave]), objeto);
}

export function definirEm(objeto, caminho, valor) {
  const partes = Array.isArray(caminho) ? caminho : caminho.split(".");
  let atual = objeto;
  for (let i = 0; i < partes.length - 1; i++) {
    if (typeof atual[partes[i]] !== "object" || atual[partes[i]] === null) atual[partes[i]] = {};
    atual = atual[partes[i]];
  }
  atual[partes[partes.length - 1]] = valor;
}

const NIVEIS_TECNICOS = [
  ["", "—"],
  ["iniciante", "Iniciante"],
  ["intermediario", "Intermediário"],
  ["avancado", "Avançado"]
];

const CATEGORIAS_MUSCULACAO = [
  ["musculacao", "Musculação"],
  ["calistenia", "Calistenia"],
  ["funcional", "Funcional"],
  ["mobilidade", "Mobilidade"],
  ["pliometria", "Pliometria"],
  ["respiracao", "Respiração"],
  ["aquecimento", "Aquecimento"]
];

const TIPOS_ALONGAMENTO = [
  ["estatico-passivo", "Estático passivo"],
  ["estatico-ativo", "Estático ativo"],
  ["dinamico", "Dinâmico"],
  ["balistico", "Balístico"]
];

const METRICAS = [
  ["repeticoes", "Repetições"],
  ["tempo", "Tempo"],
  ["distancia", "Distância"],
  ["carga", "Carga"],
  ["calorias", "Calorias"],
  ["passos", "Passos"],
  ["voltas", "Voltas"],
  ["pontuacao", "Pontuação"]
];

function camposComuns() {
  return [
    { chave: "nome", rotulo: "Nome", tipo: "texto" },
    { chave: "aliases", rotulo: "Nomes alternativos", tipo: "lista-virgula", opcional: true, ajuda: "separados por vírgula" }
  ];
}

// `rotulo` nomeia UM item do domínio ("Novo exercício", "Excluir exercício
// personalizado" — sempre singular, item-a-item); `tituloBiblioteca` nomeia
// o domínio em si (tela `biblioteca.html`, ícone 📚 nos menus). Pra
// musculação os dois divergem de propósito: um item é "um exercício", mas
// o domínio (que já inclui calistenia/funcional/pliometria/etc — ver
// `classificacao.categoria` abaixo) não é "a biblioteca de exercícios" —
// isso implicaria que alongamento (e dança/luta/yoga no futuro) não são
// exercícios também. "Musculação" aqui é o sentido coloquial amplo
// (treino de força/academia), não só levantamento de peso.
const DOMINIOS = {
  musculacao: {
    rotulo: "Exercício",
    tituloBiblioteca: "Biblioteca de musculação",
    menu: "treino_musculacao_menu.html",
    colecaoPath: ["exercicios"],
    campos: [
      ...camposComuns(),
      {
        chave: "classificacao.categoria",
        rotulo: "Categoria",
        tipo: "select",
        opcoesEstaticas: CATEGORIAS_MUSCULACAO,
        valorPadrao: "musculacao"
      },
      {
        chave: "classificacao.tipo",
        rotulo: "Tipo",
        tipo: "select",
        opcional: true,
        opcoesEstaticas: [
          ["", "—"],
          ["composto", "Composto"],
          ["isolado", "Isolado"],
          ["isometrico", "Isométrico"],
          ["dinamico", "Dinâmico"],
          ["estatico", "Estático"],
          ["locomocao", "Locomoção"]
        ]
      },
      { chave: "classificacao.nivelTecnico", rotulo: "Nível técnico", tipo: "select", opcional: true, opcoesEstaticas: NIVEIS_TECNICOS },
      { chave: "gruposMusculares.principais", rotulo: "Principais", tipo: "grupo-checkbox", opcoesDe: "gruposMusculares", secao: "Grupos musculares" },
      { chave: "gruposMusculares.sinergistas", rotulo: "Sinergistas", tipo: "grupo-checkbox", opcional: true, opcoesDe: "gruposMusculares", secao: "Grupos musculares" },
      { chave: "gruposMusculares.estabilizadores", rotulo: "Estabilizadores", tipo: "grupo-checkbox", opcional: true, opcoesDe: "gruposMusculares", secao: "Grupos musculares" },
      { chave: "equipamentos.obrigatorios", rotulo: "Obrigatórios", tipo: "grupo-checkbox", opcional: true, opcoesDe: "equipamentos", envolverComo: "equipamentoId", secao: "Equipamentos" },
      { chave: "equipamentos.opcionais", rotulo: "Opcionais", tipo: "grupo-checkbox", opcional: true, opcoesDe: "equipamentos", envolverComo: "equipamentoId", secao: "Equipamentos" },
      { chave: "metricas.permitidas", rotulo: "Permitidas", tipo: "grupo-checkbox", opcoesEstaticas: METRICAS, secao: "Métricas" },
      { chave: "metricas.padrao", rotulo: "Padrão", tipo: "select", opcoesEstaticas: METRICAS, valorPadrao: "repeticoes", secao: "Métricas" },
      { chave: "execucao.instrucoes", rotulo: "Instruções", tipo: "lista-linhas", opcional: true, ajuda: "uma por linha", secao: "Execução" },
      { chave: "execucao.respiracao", rotulo: "Respiração", tipo: "texto", opcional: true, secao: "Execução" },
      { chave: "execucao.errosComuns", rotulo: "Erros comuns", tipo: "lista-linhas", opcional: true, ajuda: "um por linha", secao: "Execução" },
      { chave: "execucao.cuidados", rotulo: "Cuidados", tipo: "lista-linhas", opcional: true, ajuda: "um por linha", secao: "Execução" },
      { chave: "tags", rotulo: "Tags", tipo: "lista-virgula", opcional: true, ajuda: "separadas por vírgula" }
    ],
    // Filtros de busca da biblioteca (js/paginas/biblioteca.js) — dimensão
    // separada de `campos` porque um filtro precisa combinar vários campos
    // do item numa coisa só (ex.: "grupo muscular" casa contra
    // principais+sinergistas/secundarios+estabilizadores de uma vez, não
    // um campo isolado) — ver `extrator` em obterValoresDeFiltro no
    // controller da biblioteca. `chave` é pra filtro de valor único
    // (ex.: categoria); `extrator` é pra filtro que combina campos.
    filtros: [
      { chave: "classificacao.categoria", rotulo: "Categoria", opcoesEstaticas: CATEGORIAS_MUSCULACAO },
      { extrator: "gruposMusculares", rotulo: "Grupo muscular", opcoesDe: "gruposMusculares" },
      { extrator: "equipamentos", rotulo: "Equipamento", opcoesDe: "equipamentos" }
    ],
    // Campos biomecânicos/de relação avançados fora do formulário v1 (não
    // exibidos em nenhuma tela hoje, ver js/detalhes-modal.js) — mantém o
    // objeto no formato esperado com valores neutros em vez de omitir.
    entradaBase: () => ({
      aliases: [],
      classificacao: { categoria: "musculacao", tipo: null, nivelTecnico: null },
      movimento: { padrao: null, lateralidade: "nao-aplicavel", cadeiaCinetica: "nao-aplicavel", planoPrincipal: "nao-aplicavel" },
      gruposMusculares: { principais: [], sinergistas: [], estabilizadores: [] },
      equipamentos: { obrigatorios: [], opcionais: [] },
      metricas: { padrao: "repeticoes", permitidas: [] },
      execucao: { instrucoes: [], respiracao: null, errosComuns: [], cuidados: [] },
      relacoes: { substitutos: [], progressoes: [], regressoes: [], variacoes: [] },
      restricoes: [],
      midia: {},
      tags: [],
      status: "ativo",
      versao: 1
    })
  },
  alongamento: {
    rotulo: "Alongamento",
    tituloBiblioteca: "Biblioteca de alongamento",
    menu: "treino_alongamento_menu.html",
    colecaoPath: ["alongamentos"],
    campos: [
      ...camposComuns(),
      {
        chave: "classificacao.tipo",
        rotulo: "Tipo",
        tipo: "select",
        opcional: true,
        opcoesEstaticas: [["", "—"], ...TIPOS_ALONGAMENTO]
      },
      { chave: "classificacao.nivelTecnico", rotulo: "Nível técnico", tipo: "select", opcional: true, opcoesEstaticas: NIVEIS_TECNICOS },
      { chave: "classificacao.finalidades", rotulo: "Finalidades", tipo: "lista-virgula", opcional: true, ajuda: "separadas por vírgula, ex.: flexibilidade, relaxamento" },
      { chave: "classificacao.momentoRecomendado", rotulo: "Momento recomendado", tipo: "texto", opcional: true },
      { chave: "gruposMusculares.principais", rotulo: "Principais", tipo: "grupo-checkbox", opcoesDe: "gruposMusculares", secao: "Grupos musculares" },
      { chave: "gruposMusculares.secundarios", rotulo: "Secundários", tipo: "grupo-checkbox", opcional: true, opcoesDe: "gruposMusculares", secao: "Grupos musculares" },
      { chave: "gruposMusculares.estabilizadores", rotulo: "Estabilizadores", tipo: "grupo-checkbox", opcional: true, opcoesDe: "gruposMusculares", secao: "Grupos musculares" },
      { chave: "equipamentos.obrigatorios", rotulo: "Obrigatórios", tipo: "grupo-checkbox", opcional: true, opcoesDe: "equipamentos", envolverComo: "equipamentoId", secao: "Equipamentos" },
      { chave: "equipamentos.opcionais", rotulo: "Opcionais", tipo: "grupo-checkbox", opcional: true, opcoesDe: "equipamentos", envolverComo: "equipamentoId", secao: "Equipamentos" },
      { chave: "metricas.permitidas", rotulo: "Permitidas", tipo: "grupo-checkbox", opcoesEstaticas: METRICAS, secao: "Métricas" },
      { chave: "metricas.padrao", rotulo: "Padrão", tipo: "select", opcoesEstaticas: METRICAS, valorPadrao: "tempo", secao: "Métricas" },
      { chave: "execucao.instrucoes", rotulo: "Instruções", tipo: "lista-linhas", opcional: true, ajuda: "uma por linha", secao: "Execução" },
      { chave: "execucao.respiracao", rotulo: "Respiração", tipo: "lista-linhas", opcional: true, ajuda: "uma por linha", secao: "Execução" },
      { chave: "execucao.errosComuns", rotulo: "Erros comuns", tipo: "lista-linhas", opcional: true, ajuda: "um por linha", secao: "Execução" },
      { chave: "execucao.cuidados", rotulo: "Cuidados", tipo: "lista-linhas", opcional: true, ajuda: "um por linha", secao: "Execução" },
      { chave: "tags", rotulo: "Tags", tipo: "lista-virgula", opcional: true, ajuda: "separadas por vírgula" }
    ],
    filtros: [
      { chave: "classificacao.tipo", rotulo: "Tipo", opcoesEstaticas: TIPOS_ALONGAMENTO },
      { extrator: "gruposMusculares", rotulo: "Grupo muscular", opcoesDe: "gruposMusculares" }
    ],
    // Mesmo princípio de musculacao.entradaBase: anatomia/dosagem/relacoes/
    // restricoes/guiaImagem são específicos de alongamento na biblioteca
    // oficial (ver biblioteca-exercicios.json) e ficam fora do formulário v1.
    entradaBase: () => ({
      aliases: [],
      classificacao: { categoria: "alongamento", tipo: null, nivelTecnico: null, finalidades: [], momentoRecomendado: null },
      movimento: { padrao: null, lateralidade: "nao-aplicavel" },
      gruposMusculares: { principais: [], secundarios: [], estabilizadores: [] },
      anatomia: { musculosPrincipais: [], musculosSecundarios: [], estruturasAlvo: [], articulacoesPrincipais: [], movimentosArticulares: [] },
      equipamentos: { obrigatorios: [], opcionais: [] },
      metricas: { padrao: "tempo", permitidas: [] },
      dosagem: { duracaoSegundos: null, repeticoesPorLado: null, series: null, intensidadePercebida: null },
      execucao: { instrucoes: [], respiracao: [], errosComuns: [], cuidados: [] },
      relacoes: { alternativos: [], progressoes: [], regressoes: [], variacoes: [] },
      restricoes: [],
      guiaImagem: null,
      midia: {},
      tags: [],
      status: "ativo",
      versao: 1
    })
  }
};

export function listarDominios() {
  return Object.entries(DOMINIOS).map(([id, dominio]) => ({ id, rotulo: dominio.rotulo }));
}

export function obterDominio(id) {
  return DOMINIOS[id] || DOMINIOS.musculacao;
}

// Diferente de obterDominio (que sempre devolve algo, com fallback pra
// musculação, pensado pra quem já sabe que o id é válido), esta função
// existe pra quem precisa checar sem cair no fallback — usada por
// biblioteca_dominios.html pra decidir se um tipo da árvore de atividade
// livre tem uma biblioteca de verdade por trás ou não.
export function existeDominio(id) {
  return Object.prototype.hasOwnProperty.call(DOMINIOS, id);
}
