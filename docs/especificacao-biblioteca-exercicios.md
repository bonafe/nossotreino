# Especificação Técnica — Biblioteca de Exercícios, Cardio e Prescrição de Treinos

**Versão:** 1.2  
**Status:** Implementado  
**Formato de referência:** JSON (dois documentos separados — seção 2)  
**Escopo:** musculação, calistenia, funcional, alongamento, mobilidade e cardio em domínio próprio

### Alterações da versão 1.2

- biblioteca e plano de treino passam a ser dois documentos JSON separados
  (`biblioteca-exercicios.json` e `treino-<identificador>.json`), ver
  seção 2;
- o plano de treino referencia a biblioteca só por `exercicioId`/
  `modalidadeId`, nunca embute o cadastro;
- decisões de conversão específicas de um plano saem do JSON e vão para um
  `.md` de notas ao lado do plano.

### Alterações da versão 1.1

- cardio separado da biblioteca de exercícios e sem uso de `exercicioId`;
- modalidades cardiovasculares cadastradas em `bibliotecas.cardio.modalidades`;
- prescrição cardiovascular armazenada em `treino.cardio`;
- itens de musculação mantidos em uma lista plana;
- supersets representados pelo campo numérico `superset` em cada item;
- exercícios alternativos podem possuir prescrição própria;
- aquecimento passou a ter estrutura formal;
- `midia.videoUrl` passou a ser admitido;
- valores desconhecidos devem ser `null` ou omitidos, em vez de novos valores artificiais de enumeração.

> **Modelo implementado pelo código.** `biblioteca-exercicios.json` fica em
> `biblioteca-exercicios/biblioteca-exercicios.json` (versionado, buscado
> por `fetch` — não é dado pessoal, ver seção 2.1; a mesma pasta
> `biblioteca-exercicios/` guarda as imagens de exercício geradas em
> `imagens-exercicios/`) e o plano de treino é carregado manualmente em
> [importar_dados.html](../importar_dados.html) como sempre foi (dado
> pessoal, só em `localStorage`). Ver
> [treino-exercicios-especificacao.md](./treino-exercicios-especificacao.md) e
> [treino-bicicleta-especificacao.md](./treino-bicicleta-especificacao.md)
> para a semântica de cada página.
>
> As imagens em `imagens-exercicios/` são geradas fora do site
> (`src/python/gerar_imagens_treino.py`) e nomeadas por convenção —
> `<exercicioId>__<genero>.png`, `genero` sendo `masculino` ou `feminino` —
> em vez de referenciadas por um campo no JSON. Não existe registro de
> quais exercícios já têm imagem gerada, então o código sempre tenta
> carregar e trata a ausência como "sem imagem ainda" (`js/imagem-exercicio.js`).
> A variante exibida vem da preferência `preferencias.generoImagem.v1`
> (engrenagem de configurações em `sistema.html`), ver seção 2 de
> [armazenamento-local-especificacao.md](./armazenamento-local-especificacao.md).

---

## 1. Objetivo

Esta especificação define o modelo de dados para:

1. manter uma biblioteca normalizada de exercícios de musculação, calistenia, funcional, alongamento e mobilidade;
2. manter uma biblioteca cardiovascular independente, organizada por modalidades;
3. cadastrar grupos musculares, equipamentos e técnicas;
4. montar treinos por referência aos exercícios cadastrados;
5. prescrever cardio sem tratá-lo como exercício de musculação;
6. separar características permanentes das variáveis de prescrição;
7. permitir busca, filtros, recomendações, substituições e geração automática de treinos.

A regra central da arquitetura é:

> Se uma informação continua verdadeira independentemente do treino, ela pertence à respectiva biblioteca.  
> Se a informação muda entre treinos, alunos, sessões ou períodos, ela pertence à prescrição.

A biblioteca possui dois domínios distintos:

- **exercícios:** movimentos discretos, referenciados por `exercicioId`;
- **cardio:** modalidades contínuas ou intervaladas, referenciadas por `modalidadeId`.

Exemplos:

| Informação | Local correto |
|---|---|
| Nome do exercício | `bibliotecas.exercicios` |
| Grupos musculares | Cadastro do exercício |
| Equipamentos do exercício | Cadastro do exercício |
| Padrão de movimento | Cadastro do exercício |
| Modalidade bicicleta ergométrica | `bibliotecas.cardio.modalidades` |
| Séries e repetições | Prescrição do item de exercício |
| Número do superset | Item do treino, campo `superset` |
| Protocolo 30 s forte / 30 s leve | `treino.cardio[].treino` |
| Carga, descanso e cadência | Prescrição do item de exercício |
| Observação específica para o aluno | Item do treino |

## 2. Estrutura geral do domínio

A partir da versão 1.2, a biblioteca e o plano de treino são dois **documentos
JSON separados**, cada um com seu próprio arquivo. Um plano de treino nunca
embute o cadastro de um exercício ou de uma modalidade — referencia sempre
por `exercicioId`/`modalidadeId`. Isso permite que vários alunos/planos
compartilhem a mesma biblioteca, e que a biblioteca evolua (novos exercícios,
correções, vídeos) sem precisar tocar em nenhum plano já prescrito.

### 2.1. Documento da biblioteca (`biblioteca-exercicios.json`)

Contém apenas vocabulário reutilizável — nada específico de um aluno ou de um
período de treino:

```json
{
  "schema": "biblioteca-exercicios-cardio",
  "schemaVersion": "1.2",

  "bibliotecas": {
    "exercicios": {},
    "cardio": {
      "modalidades": {}
    }
  },
  "gruposMusculares": {},
  "equipamentos": {},
  "tecnicas": {}
}
```

A biblioteca de exercícios contém musculação, calistenia, funcional, alongamento e mobilidade. A biblioteca de cardio contém modalidades como bicicleta ergométrica, esteira, elíptico, remo ergométrico e corrida ao ar livre.

Cardio não deve ser inserido em `bibliotecas.exercicios` apenas para reutilizar `exercicioId`. O treino cardiovascular possui estrutura própria, porque duração, zonas, estímulos, recuperações e intervalos são conceitos diferentes de séries e repetições de musculação.

Coleções opcionais, também no documento da biblioteca:

```json
{
  "condicoesRestritivas": {},
  "padroesMovimento": {},
  "metricas": {},
  "categoriasExercicio": {},
  "tiposTreinoCardio": {}
}
```

### 2.2. Documento do plano de treino (`treino-<identificador>.json`)

Contém apenas o que é específico de um aluno/período — nenhum cadastro de
exercício ou modalidade é repetido aqui, só o `exercicioId`/`modalidadeId`:

```json
{
  "schema": "plano-de-treino",
  "schemaVersion": "1.3",

  "biblioteca": {
    "arquivo": "biblioteca-exercicios/biblioteca-exercicios.json"
  },

  "origem": {
    "tipo": "planejamento-em-pdf",
    "arquivo": "Ajuste - Fulano.pdf",
    "dataConversao": "2026-07-20"
  },

  "metadata": {
    "professor": "...",
    "consultoria": "...",
    "aluno": "...",
    "planejamento": { "inicio": "2025-12-29", "fim": "2026-03-02" },
    "objetivos": []
  },

  "distribuicaoSemanal": [],
  "regraContinuidade": "...",
  "orientacoesGerais": {},
  "treinos": [],
  "treinosCardio": [],
  "treinosAlongamento": []
}
```

Campos:

| Campo | Descrição |
|---|---|
| `biblioteca.arquivo` | Nome do arquivo de biblioteca que este plano espera. Não é um lock de conteúdo — a biblioteca pode crescer; a aplicação valida a referência no carregamento (seção 14.5), não a versão exata. |
| `origem` | Proveniência do plano (de onde veio, quando foi convertido) — opcional, útil quando o plano nasceu de um PDF/planilha externo. |
| `metadata`, `distribuicaoSemanal`, `regraContinuidade`, `orientacoesGerais` | Específicos deste aluno/período; ver `treino-exercicios-especificacao.md` para a semântica de cada um (mantida sem alteração, só movida para este documento separado). |
| `treinos` | Lista de treinos de musculação/calistenia/condicionamento/flexibilidade deste plano, no formato da seção 12. |
| `treinosCardio` | Lista de treinos de cardio (bike, etc.) deste plano, **entidades de primeira classe** com `id`/`nome` próprios — ver seção 11.4. Opcional (`[]`/ausente se o plano não tiver nenhum). |
| `treinosAlongamento` | Lista de treinos de alongamento deste plano, mesma ideia — ver seção 11.5. Opcional. |

**Desde a versão 1.3**, cardio e alongamento deixaram de ser prescrições
embutidas dentro de um treino de musculação e passaram a ser coleções
irmãs de `treinos`, cada entrada com `id`/`nome` próprios — um treino de
musculação passa a **referenciar** essas entradas por id (seção 11.4/11.5),
em vez de embutir a prescrição inteira. Isso permite: um treino de cardio
ou de alongamento existir avulso (sem precisar de um treino de musculação
"dono"), ser reutilizado por mais de um treino de musculação, e ser criado
pela interface (`treino_bicicleta_novo.html`/`treino_alongamento_novo.html`)
do mesmo jeito que `treino_novo.html` já cria treinos de musculação. Planos
no formato `1.2` (cardio embutido em `treino.cardio[].treino`) não são mais
lidos — mesma convenção de "mudança de formato = nova versão, sem migração
automática" já usada no resto do projeto.

Decisões de modelagem específicas de uma conversão (ex.: como um PDF
ambíguo foi interpretado) não pertencem a nenhum dos dois documentos —
registre-as num arquivo `.md` de notas ao lado do plano (ver
`dados/notas-conversao-treino-bonafe.md` como exemplo), não como array de
strings dentro do JSON.

## 3. Princípios de modelagem

### 3.1. Identificadores estáveis

Todos os relacionamentos devem usar identificadores estáveis, e não nomes visíveis.

Correto:

```json
{
  "principais": ["quadriceps", "gluteo-maximo"]
}
```

Evitar:

```json
{
  "principal": "Quadríceps"
}
```

O nome visível pode mudar sem alterar os relacionamentos.

### 3.2. Formato dos identificadores

Os identificadores devem:

- usar letras minúsculas;
- não conter acentos;
- usar hífen como separador;
- ser únicos dentro da coleção;
- não ser alterados depois que começarem a ser referenciados.

Exemplos:

```text
supino-reto-com-halter
gluteo-maximo
banco-reto
empurrar-horizontal
```

### 3.3. Separação entre exercício e prescrição

O cadastro de exercício descreve o movimento.

A prescrição descreve como esse movimento será realizado em um treino específico.

### 3.4. Objetos em vez de strings quando houver parâmetros

Campos simples podem começar como strings. Entretanto, sempre que um conceito possuir parâmetros, deve ser representado como objeto.

Exemplo inadequado:

```json
{
  "tecnica": "isometria"
}
```

Exemplo adequado:

```json
{
  "tecnica": {
    "tipo": "isometria",
    "duracaoSegundos": 2,
    "posicao": "fundo-do-movimento",
    "aplicacao": "todas-as-repeticoes"
  }
}
```

---


### 3.5. Cardio não é um exercício da biblioteca

Uma modalidade cardiovascular deve ser referenciada por `modalidadeId`:

```json
{
  "modalidadeId": "bicicleta-ergometrica"
}
```

Não usar:

```json
{
  "exercicioId": "bicicleta-ergometrica"
}
```

A modalidade descreve o recurso cardiovascular. A prescrição descreve o treino executado nessa modalidade.

### 3.6. Lista plana de exercícios

Os exercícios de um treino devem permanecer em `treino.exercicios`, sem criar blocos aninhados para supersets.

```json
{
  "exercicioId": "supino-reto-com-halter",
  "ordem": 10,
  "superset": 1
}
```

O campo `superset` preserva o número informado pelo professor. A interface ou o motor de execução pode agrupar, parear ou apresentar os itens posteriormente.

O número não deve ser interpretado como identificador universal de grupo. Ele é um marcador de organização válido dentro do treino em que aparece.

## 4. Modelo da biblioteca de exercícios

### 4.1. Estrutura recomendada

```json
{
  "id": "agachamento-sumo-com-halter",
  "nome": "Agachamento sumô com halter",

  "aliases": [
    "Agachamento sumô",
    "Sumo squat"
  ],

  "classificacao": {
    "categoria": "musculacao",
    "tipo": "composto",
    "nivelTecnico": "iniciante"
  },

  "movimento": {
    "padrao": "agachamento",
    "lateralidade": "bilateral",
    "cadeiaCinetica": "fechada",
    "planoPrincipal": "sagital"
  },

  "gruposMusculares": {
    "principais": [
      "quadriceps",
      "gluteo-maximo",
      "adutores"
    ],
    "sinergistas": [
      "posteriores-de-coxa"
    ],
    "estabilizadores": [
      "abdomen",
      "eretores-da-espinha"
    ]
  },

  "equipamentos": {
    "obrigatorios": [
      {
        "equipamentoId": "halter",
        "quantidade": 1
      }
    ],
    "opcionais": [
      {
        "equipamentoId": "step",
        "finalidade": "aumentar-amplitude"
      }
    ]
  },

  "metricas": {
    "padrao": "repeticoes",
    "permitidas": [
      "repeticoes",
      "tempo"
    ]
  },

  "execucao": {
    "instrucoes": [
      "Posicione os pés além da largura dos ombros.",
      "Direcione as pontas dos pés para fora.",
      "Segure o halter com as duas mãos entre as pernas.",
      "Flexione quadris e joelhos mantendo os joelhos alinhados aos pés.",
      "Retorne à posição inicial estendendo quadris e joelhos."
    ],
    "respiracao": "Inspire durante a descida e expire durante a subida.",
    "errosComuns": [
      "Deixar os joelhos colapsarem para dentro.",
      "Arredondar a região lombar.",
      "Retirar os calcanhares do chão."
    ],
    "cuidados": [
      "Manter os joelhos alinhados com a direção dos pés.",
      "Usar amplitude compatível com a mobilidade individual."
    ]
  },

  "relacoes": {
    "substitutos": [
      {
        "exercicioId": "agachamento-goblet",
        "motivo": "mesmo-padrao-movimento",
        "similaridade": "alta"
      },
      {
        "exercicioId": "leg-press",
        "motivo": "musculatura-semelhante",
        "similaridade": "media"
      }
    ],
    "progressoes": [
      "agachamento-sumo-com-barra"
    ],
    "regressoes": [
      "agachamento-sumo-sem-carga"
    ],
    "variacoes": [
      "agachamento-sumo-com-kettlebell"
    ]
  },

  "restricoes": [
    {
      "condicaoId": "dor-ou-lesao-nos-adutores",
      "nivel": "cautela",
      "orientacao": "Reduzir a abertura dos pés, limitar a amplitude ou substituir."
    }
  ],

  "midia": {
    "videoMagnet": "magnet:?...",
    "thumbnail": "https://exemplo.com/imagens/agachamento-sumo.webp",
    "duracaoVideoSegundos": 30
  },

  "tags": [
    "membros-inferiores",
    "peso-livre",
    "agachamento"
  ],

  "status": "ativo",
  "versao": 1
}
```

---

## 5. Descrição dos campos do exercício

### 5.1. Campos principais

| Campo | Tipo | Obrigatório | Descrição |
|---|---:|---:|---|
| `id` | string | sim | Identificador estável do exercício |
| `nome` | string | sim | Nome principal para exibição |
| `aliases` | array de string | não | Nomes alternativos e termos de busca |
| `classificacao` | objeto | sim | Categoria, tipo e dificuldade técnica |
| `movimento` | objeto | sim | Características biomecânicas gerais |
| `gruposMusculares` | objeto | sim | Participação muscular do exercício |
| `equipamentos` | objeto | sim | Recursos obrigatórios e opcionais |
| `metricas` | objeto | sim | Métricas admitidas na prescrição |
| `execucao` | objeto | não | Instruções e cuidados |
| `relacoes` | objeto | não | Variações, substitutos, progressões e regressões |
| `restricoes` | array | não | Situações que exigem cautela |
| `midia` | objeto | não | Vídeo, thumbnail e outros recursos |
| `tags` | array de string | não | Termos auxiliares para busca e filtros |
| `status` | string | sim | Estado do cadastro |
| `versao` | inteiro | sim | Versão do registro |

### 5.2. `aliases`

O campo deve armazenar nomes alternativos relevantes para busca.

```json
{
  "aliases": [
    "Agachamento sumô",
    "Sumo squat",
    "Agachamento aberto com halter"
  ]
}
```

Não deve ser usado para cadastrar variações biomecanicamente diferentes.

### 5.3. `classificacao`

```json
{
  "classificacao": {
    "categoria": "musculacao",
    "tipo": "composto",
    "nivelTecnico": "iniciante"
  }
}
```

Valores iniciais sugeridos para `categoria`:

```text
musculacao
alongamento
mobilidade
funcional
calistenia
pliometria
calistenia
respiracao
aquecimento
```

Valores sugeridos para `tipo`:

```text
composto
isolado
isometrico
dinamico
estatico
locomocao
```

O campo `tipo` pode variar conforme a categoria. Em uma evolução futura, ele poderá ser substituído por classificações múltiplas.

Valores sugeridos para `nivelTecnico`:

```text
iniciante
intermediario
avancado
```

Quando a fonte não informar o nível, usar `null` ou omitir o campo. Não criar um quarto nível chamado `nao-informado`.

O nível representa a complexidade técnica do exercício, e não o nível do praticante.

### 5.4. `movimento`

```json
{
  "movimento": {
    "padrao": "agachamento",
    "lateralidade": "bilateral",
    "cadeiaCinetica": "fechada",
    "planoPrincipal": "sagital"
  }
}
```

Valores sugeridos para `padrao`:

```text
agachamento
dobradica-de-quadril
empurrar-horizontal
empurrar-vertical
puxar-horizontal
puxar-vertical
flexao-de-cotovelo
extensao-de-cotovelo
flexao-de-joelho
extensao-de-joelho
abducao-de-ombro
aducao-de-ombro
abducao-de-quadril
aducao-de-quadril
flexao-de-tronco
extensao-de-tronco
rotacao-de-tronco
anti-rotacao
anti-extensao
anti-flexao-lateral
carregamento
locomocao
salto
alongamento
mobilidade-articular
```

Valores sugeridos para `lateralidade`:

```text
bilateral
unilateral
alternado
independente
assimetrico
nao-aplicavel
```

É preferível usar `lateralidade` em vez de `unilateral: true/false`, pois há mais de dois estados possíveis.

Valores sugeridos para `cadeiaCinetica`:

```text
aberta
fechada
mista
nao-aplicavel
```

Valores sugeridos para `planoPrincipal`:

```text
sagital
frontal
transversal
multiplanar
nao-aplicavel
```

### 5.5. `gruposMusculares`

```json
{
  "gruposMusculares": {
    "principais": ["peitoral-maior"],
    "sinergistas": ["triceps-braquial", "deltoide-anterior"],
    "estabilizadores": ["abdomen"]
  }
}
```

Definições:

- `principais`: músculos ou grupos que recebem a maior demanda;
- `sinergistas`: auxiliam diretamente na produção do movimento;
- `estabilizadores`: atuam predominantemente no controle postural e articular.

Os valores devem referenciar a coleção `gruposMusculares`.

### 5.6. `equipamentos`

Versão completa:

```json
{
  "equipamentos": {
    "obrigatorios": [
      {
        "equipamentoId": "halter",
        "quantidade": 2
      },
      {
        "equipamentoId": "banco-reto",
        "quantidade": 1
      }
    ],
    "opcionais": [
      {
        "equipamentoId": "colchonete",
        "finalidade": "conforto"
      }
    ]
  }
}
```

Versão simplificada admitida na primeira implementação:

```json
{
  "equipamentos": {
    "obrigatorios": ["halter", "banco-reto"],
    "opcionais": []
  }
}
```

A equipe deve escolher um único formato e aplicá-lo de forma consistente.

Recomenda-se o formato com objetos quando houver necessidade de quantidade, configuração ou finalidade.

### 5.7. `metricas`

O campo `metricas` informa como o exercício pode ser prescrito.

```json
{
  "metricas": {
    "padrao": "repeticoes",
    "permitidas": [
      "repeticoes",
      "tempo"
    ]
  }
}
```

Métricas iniciais sugeridas:

```text
repeticoes
tempo
distancia
carga
calorias
passos
voltas
pontuacao
```

Exemplos:

| Exercício | Métrica padrão | Outras permitidas |
|---|---|---|
| Supino reto | `repeticoes` | `tempo` |
| Prancha | `tempo` | nenhuma |
| Corrida | `distancia` | `tempo`, `calorias` |
| Farmer walk | `distancia` | `tempo` |
| Bicicleta ergométrica | `tempo` | `distancia`, `calorias` |

A interface de criação do treino deve usar `metricas.padrao` para escolher o controle inicial apresentado ao usuário.

### 5.8. `execucao`

```json
{
  "execucao": {
    "instrucoes": [
      "Deite-se no banco.",
      "Mantenha os pés apoiados no chão.",
      "Desça os halteres de forma controlada.",
      "Empurre os halteres até a extensão confortável dos cotovelos."
    ],
    "respiracao": "Inspire na descida e expire na subida.",
    "errosComuns": [
      "Elevar excessivamente os ombros.",
      "Retirar os pés do chão."
    ],
    "cuidados": [
      "Evitar amplitude que provoque dor no ombro."
    ]
  }
}
```

Diferença entre os campos:

- `instrucoes`: sequência operacional;
- `respiracao`: orientação respiratória;
- `errosComuns`: falhas técnicas frequentes;
- `cuidados`: alertas de segurança, conforto ou controle.

### 5.9. `relacoes`

```json
{
  "relacoes": {
    "substitutos": [
      {
        "exercicioId": "supino-maquina",
        "motivo": "mesmo-padrao-movimento",
        "similaridade": "alta"
      }
    ],
    "progressoes": [
      "supino-reto-com-barra"
    ],
    "regressoes": [
      "flexao-de-bracos-inclinada"
    ],
    "variacoes": [
      "supino-inclinado-com-halter"
    ]
  }
}
```

Definições:

- `substitutos`: opções que podem cumprir função semelhante;
- `progressoes`: alternativas geralmente mais exigentes;
- `regressoes`: alternativas geralmente mais simples ou acessíveis;
- `variacoes`: movimentos relacionados que não são necessariamente mais fáceis ou difíceis.

Valores sugeridos para `motivo`:

```text
mesmo-padrao-movimento
musculatura-semelhante
mesmo-equipamento
sem-equipamento
menor-complexidade
menor-impacto
adaptacao-de-mobilidade
adaptacao-de-dor
```

Valores sugeridos para `similaridade`:

```text
alta
media
baixa
```

### 5.10. `restricoes`

Evitar uma lista categórica e absoluta de contraindicações.

Preferir:

```json
{
  "restricoes": [
    {
      "condicaoId": "dor-no-ombro",
      "nivel": "cautela",
      "orientacao": "Reduzir a amplitude, ajustar a pegada ou substituir o exercício."
    }
  ]
}
```

Valores sugeridos para `nivel`:

```text
informativo
cautela
evitar-sem-avaliacao
contraindicado
```

O valor `contraindicado` deve ser usado somente quando houver base técnica ou profissional explícita.

A aplicação deve apresentar essas informações como alerta, não como diagnóstico médico.

### 5.11. `midia`

```json
{
  "midia": {
    "videoUrl": "https://exemplo.com/video",
    "videoMagnet": "magnet:?...",
    "thumbnail": "https://exemplo.com/thumb.webp",
    "duracaoVideoSegundos": 28
  }
}
```

Campos opcionais futuros:

```json
{
  "midia": {
    "videoUrl": "https://exemplo.com/video",
    "videoMagnet": "magnet:?...",
    "thumbnail": "...",
    "imagens": [],
    "legenda": "...",
    "hashArquivo": "...",
    "mimeType": "video/mp4",
    "duracaoVideoSegundos": 28
  }
}
```

### 5.12. `status` e `versao`

Valores sugeridos para `status`:

```text
rascunho
ativo
inativo
arquivado
```

A versão deve ser incrementada quando houver alteração semântica relevante no cadastro.

```json
{
  "status": "ativo",
  "versao": 2
}
```

### 5.13. `qualidadeDados` (opcional, recomendado em importações)

Campo opcional para registrar a proveniência de um cadastro gerado a partir de
uma fonte externa (PDF de planejamento, planilha etc.), distinguindo o que a
fonte informou do que foi inferido pelo nome/contexto durante a conversão:

```json
{
  "qualidadeDados": {
    "fonte": "planejamento-em-pdf",
    "camposInferidos": ["classificacao", "movimento", "equipamentos"],
    "camposNaoInformados": ["nivelTecnico", "execucao", "restricoes"]
  }
}
```

- `fonte`: origem do registro (ex. `planejamento-em-pdf`, `cadastro-manual`).
- `camposInferidos`: campos preenchidos por inferência (nome/contexto do
  exercício), não declarados explicitamente pela fonte.
- `camposNaoInformados`: campos que permaneceram `null`/vazios por falta de
  informação na fonte.

Isso evita que um valor inferido durante a importação seja lido depois como
se tivesse sido prescrito pelo professor. Aplica-se do mesmo jeito a
modalidades de `bibliotecas.cardio.modalidades` (seção 11.4).

---

## 6. Biblioteca de grupos musculares

### 6.1. Estrutura recomendada

```json
{
  "quadriceps": {
    "nome": "Quadríceps",
    "regiaoCorporal": "membros-inferiores",
    "subgrupos": [
      "reto-femoral",
      "vasto-lateral",
      "vasto-medial",
      "vasto-intermedio"
    ]
  },

  "gluteo-maximo": {
    "nome": "Glúteo máximo",
    "regiaoCorporal": "quadril",
    "subgrupos": []
  },

  "abdomen": {
    "nome": "Abdômen",
    "regiaoCorporal": "tronco",
    "subgrupos": [
      "reto-abdominal",
      "obliquo-interno",
      "obliquo-externo",
      "transverso-do-abdomen"
    ]
  }
}
```

### 6.2. Regras

1. Os exercícios devem referenciar os identificadores.
2. O nome deve ser usado apenas para exibição.
3. Sinônimos podem ser adicionados para pesquisa.
4. A aplicação deve impedir referência a grupo muscular inexistente.

---

## 7. Biblioteca de equipamentos

### 7.1. Estrutura recomendada

```json
{
  "halter": {
    "nome": "Halter",
    "categoria": "peso-livre"
  },

  "banco-reto": {
    "nome": "Banco reto",
    "categoria": "banco"
  },

  "barra-olimpica": {
    "nome": "Barra olímpica",
    "categoria": "peso-livre"
  },

  "maquina-smith": {
    "nome": "Máquina Smith",
    "categoria": "maquina"
  },

  "faixa-elastica": {
    "nome": "Faixa elástica",
    "categoria": "acessorio"
  }
}
```

Categorias sugeridas:

```text
peso-livre
maquina
banco
barra
acessorio
cardio
estrutura
peso-corporal
ambiente
```

Para exercícios sem equipamento:

```json
{
  "equipamentos": {
    "obrigatorios": [],
    "opcionais": []
  }
}
```

Não é necessário cadastrar `peso-corporal` como equipamento obrigatório, salvo se isso for útil para filtros.

---

## 8. Biblioteca de técnicas

As técnicas devem possuir cadastro próprio quando forem reutilizadas em diferentes exercícios.

### 8.1. Exemplo

```json
{
  "isometria": {
    "nome": "Isometria",
    "descricao": "Manutenção estática de uma posição durante parte da série.",
    "parametrosPermitidos": [
      "duracaoSegundos",
      "posicao",
      "aplicacao"
    ]
  },

  "drop-set": {
    "nome": "Drop set",
    "descricao": "Redução de carga após atingir o critério definido.",
    "parametrosPermitidos": [
      "quantidadeReducoes",
      "percentualReducao",
      "descansoEntreReducoesSegundos"
    ]
  },

  "rest-pause": {
    "nome": "Rest-pause",
    "descricao": "Pausa curta dentro da série para permitir repetições adicionais.",
    "parametrosPermitidos": [
      "pausaSegundos",
      "blocos"
    ]
  }
}
```

Técnicas iniciais sugeridas:

```text
tradicional
isometria
drop-set
rest-pause
bi-set
tri-set
superset
cluster-set
piramide-crescente
piramide-decrescente
repeticoes-parciais
repeticoes-negativas
```

---

## 9. Modelo da prescrição de treino

### 9.1. Estrutura recomendada

```json
{
  "exercicioId": "agachamento-sumo-com-halter",
  "ordem": 3,

  "prescricao": {
    "series": 4,

    "metrica": {
      "tipo": "repeticoes",
      "modo": "faixa",
      "min": 16,
      "max": 20
    },

    "carga": {
      "valor": 12,
      "unidade": "kg",
      "formaContagem": "total"
    },

    "descansoSegundos": 60,

    "cadencia": {
      "excentricaSegundos": 3,
      "pausaAlongadoSegundos": 1,
      "concentricaSegundos": 1,
      "pausaContraidoSegundos": 0
    },

    "tecnicas": [
      {
        "tipo": "isometria",
        "duracaoSegundos": 2,
        "posicao": "fundo-do-movimento",
        "aplicacao": "todas-as-repeticoes"
      }
    ],

    "intensidade": {
      "modo": "rir",
      "valor": 2
    }
  },

  "alternativas": [
    {
      "exercicioId": "agachamento-goblet",
      "prioridade": 1
    },
    {
      "exercicioId": "leg-press",
      "prioridade": 2
    }
  ],

  "observacao": null
}
```

---

## 10. Campos da prescrição

### 10.1. `exercicioId`

Referência obrigatória a um exercício ativo ou, conforme regra do sistema, não arquivado.

```json
{
  "exercicioId": "supino-reto-com-halter"
}
```

### 10.2. `ordem`

Número inteiro usado para ordenar os exercícios dentro de uma sessão.

```json
{
  "ordem": 1
}
```

A aplicação pode usar intervalos, por exemplo 10, 20, 30, para facilitar inserções intermediárias.

### 10.3. `series`

```json
{
  "series": 4
}
```

Em uma evolução futura, poderá aceitar séries de aquecimento e séries efetivas:

```json
{
  "series": {
    "aquecimento": 2,
    "efetivas": 4
  }
}
```

### 10.4. `metrica`

A métrica substitui o uso exclusivo de `repeticoes`.

#### Repetição fixa

```json
{
  "metrica": {
    "tipo": "repeticoes",
    "modo": "fixo",
    "valor": 12
  }
}
```

#### Faixa de repetições

```json
{
  "metrica": {
    "tipo": "repeticoes",
    "modo": "faixa",
    "min": 8,
    "max": 12
  }
}
```

#### Máximo de repetições

```json
{
  "metrica": {
    "tipo": "repeticoes",
    "modo": "maximo"
  }
}
```

#### Tempo fixo

```json
{
  "metrica": {
    "tipo": "tempo",
    "modo": "fixo",
    "valor": 30,
    "unidade": "segundos"
  }
}
```

#### Distância

```json
{
  "metrica": {
    "tipo": "distancia",
    "modo": "fixo",
    "valor": 100,
    "unidade": "metros"
  }
}
```

#### Faixa de tempo

```json
{
  "metrica": {
    "tipo": "tempo",
    "modo": "faixa",
    "min": 20,
    "max": 40,
    "unidade": "segundos"
  }
}
```

Valores sugeridos para `modo`:

```text
fixo
faixa
maximo
minimo
ate-falha
livre
```

A aplicação deve validar se `metrica.tipo` está presente em `exercicio.metricas.permitidas`.

### 10.5. `carga`

```json
{
  "carga": {
    "valor": 12,
    "unidade": "kg",
    "formaContagem": "total"
  }
}
```

Valores sugeridos para `unidade`:

```text
kg
lb
percentual-1rm
peso-corporal
nivel-maquina
nao-informado
```

Valores sugeridos para `formaContagem`:

```text
total
por-lado
por-halter
por-membro
```

Exemplos:

Dois halteres de 12 kg cada:

```json
{
  "carga": {
    "valor": 12,
    "unidade": "kg",
    "formaContagem": "por-halter"
  }
}
```

Barra com carga total de 60 kg:

```json
{
  "carga": {
    "valor": 60,
    "unidade": "kg",
    "formaContagem": "total"
  }
}
```

### 10.6. `descansoSegundos`

```json
{
  "descansoSegundos": 60
}
```

O valor representa o intervalo entre séries, salvo indicação diferente.

Em circuitos ou supersets, o descanso pode ser definido no agrupamento em vez de no exercício.

### 10.7. `cadencia`

A cadência deve ser armazenada como objeto.

```json
{
  "cadencia": {
    "excentricaSegundos": 3,
    "pausaAlongadoSegundos": 1,
    "concentricaSegundos": 1,
    "pausaContraidoSegundos": 0
  }
}
```

A aplicação pode gerar a string de exibição:

```text
3-1-1-0
```

Para fases explosivas:

```json
{
  "cadencia": {
    "excentricaSegundos": 2,
    "pausaAlongadoSegundos": 0,
    "concentrica": "explosiva",
    "pausaContraidoSegundos": 0
  }
}
```

Valores especiais possíveis:

```text
explosiva
controlada
livre
```

A convenção adotada é:

1. fase excêntrica;
2. pausa em posição alongada;
3. fase concêntrica;
4. pausa em posição contraída.

### 10.8. `tecnicas`

Usar array, pois uma prescrição pode conter mais de uma técnica.

```json
{
  "tecnicas": [
    {
      "tipo": "isometria",
      "duracaoSegundos": 2,
      "posicao": "fundo-do-movimento",
      "aplicacao": "todas-as-repeticoes"
    }
  ]
}
```

Exemplo de drop set:

```json
{
  "tecnicas": [
    {
      "tipo": "drop-set",
      "quantidadeReducoes": 2,
      "percentualReducao": 20,
      "descansoEntreReducoesSegundos": 10
    }
  ]
}
```

### 10.9. `intensidade`

```json
{
  "intensidade": {
    "modo": "rir",
    "valor": 2
  }
}
```

Modos sugeridos:

```text
rir
rpe
percentual-1rm
frequencia-cardiaca
zona-cardiaca
percepcao-livre
```

Exemplos:

```json
{
  "intensidade": {
    "modo": "rpe",
    "valor": 8
  }
}
```

```json
{
  "intensidade": {
    "modo": "percentual-1rm",
    "valor": 75
  }
}
```

### 10.10. `alternativas`

As alternativas pertencem à prescrição quando são definidas especificamente para aquele treino.

```json
{
  "alternativas": [
    {
      "exercicioId": "supino-maquina",
      "prioridade": 1,
      "motivo": "indisponibilidade-de-halteres"
    }
  ]
}
```

Quando a alternativa utiliza a mesma prescrição do exercício principal, o campo `prescricao` deve ser omitido.

Quando a alternativa possui séries, métrica, técnica ou descanso diferentes, ela pode declarar uma prescrição própria:

```json
{
  "exercicioId": "supino-reto-com-halter",
  "prescricao": {
    "series": 4,
    "metrica": {
      "tipo": "repeticoes",
      "modo": "faixa",
      "min": 16,
      "max": 20
    }
  },
  "alternativas": [
    {
      "exercicioId": "flexao-de-bracos",
      "prioridade": 1,
      "prescricao": {
        "series": 4,
        "metrica": {
          "tipo": "repeticoes",
          "modo": "maximo"
        }
      }
    }
  ]
}
```

Essa modelagem substitui `substituto: false` e é mais expressiva do que `substituiExercicioId: null` para alternativas planejadas.

### 10.11. `observacao`

Campo livre para orientação específica da prescrição ou do aluno.

```json
{
  "observacao": "Manter a base ligeiramente mais fechada por desconforto nos adutores."
}
```

Não deve ser usado para armazenar dados que possuem estrutura própria, como duração da isometria, carga ou cadência.

---

## 11. Exemplos completos por categoria

### 11.1. Musculação — supino reto com halteres

```json
{
  "id": "supino-reto-com-halter",
  "nome": "Supino reto com halteres",
  "aliases": [
    "Supino com halteres",
    "Dumbbell bench press"
  ],
  "classificacao": {
    "categoria": "musculacao",
    "tipo": "composto",
    "nivelTecnico": "iniciante"
  },
  "movimento": {
    "padrao": "empurrar-horizontal",
    "lateralidade": "bilateral",
    "cadeiaCinetica": "aberta",
    "planoPrincipal": "transversal"
  },
  "gruposMusculares": {
    "principais": [
      "peitoral-maior"
    ],
    "sinergistas": [
      "triceps-braquial",
      "deltoide-anterior"
    ],
    "estabilizadores": [
      "abdomen"
    ]
  },
  "equipamentos": {
    "obrigatorios": [
      {
        "equipamentoId": "halter",
        "quantidade": 2
      },
      {
        "equipamentoId": "banco-reto",
        "quantidade": 1
      }
    ],
    "opcionais": []
  },
  "metricas": {
    "padrao": "repeticoes",
    "permitidas": [
      "repeticoes",
      "tempo"
    ]
  },
  "execucao": {
    "instrucoes": [
      "Deite-se no banco com os pés apoiados no chão.",
      "Posicione os halteres ao lado do peito.",
      "Empurre os halteres até a extensão confortável dos cotovelos.",
      "Retorne de forma controlada."
    ],
    "respiracao": "Inspire na descida e expire na subida.",
    "errosComuns": [
      "Elevar excessivamente os ombros.",
      "Retirar os pés do chão.",
      "Descer os halteres sem controle."
    ],
    "cuidados": [
      "Evitar amplitude dolorosa no ombro."
    ]
  },
  "relacoes": {
    "substitutos": [
      {
        "exercicioId": "supino-reto-com-barra",
        "motivo": "mesmo-padrao-movimento",
        "similaridade": "alta"
      },
      {
        "exercicioId": "supino-maquina",
        "motivo": "mesmo-padrao-movimento",
        "similaridade": "alta"
      }
    ],
    "progressoes": [],
    "regressoes": [
      "flexao-de-bracos-inclinada"
    ],
    "variacoes": [
      "supino-inclinado-com-halter"
    ]
  },
  "restricoes": [],
  "midia": {
    "videoMagnet": "magnet:?...",
    "thumbnail": null
  },
  "tags": [
    "peito",
    "triceps",
    "halter",
    "empurrar"
  ],
  "status": "ativo",
  "versao": 1
}
```

### 11.2. Isometria — prancha

```json
{
  "id": "prancha-isometrica",
  "nome": "Prancha isométrica",
  "aliases": [
    "Prancha abdominal",
    "Plank"
  ],
  "classificacao": {
    "categoria": "musculacao",
    "tipo": "isometrico",
    "nivelTecnico": "iniciante"
  },
  "movimento": {
    "padrao": "anti-extensao",
    "lateralidade": "bilateral",
    "cadeiaCinetica": "fechada",
    "planoPrincipal": "sagital"
  },
  "gruposMusculares": {
    "principais": [
      "abdomen"
    ],
    "sinergistas": [
      "gluteo-maximo",
      "serratil-anterior"
    ],
    "estabilizadores": [
      "quadriceps",
      "eretores-da-espinha"
    ]
  },
  "equipamentos": {
    "obrigatorios": [],
    "opcionais": [
      {
        "equipamentoId": "colchonete",
        "finalidade": "conforto"
      }
    ]
  },
  "metricas": {
    "padrao": "tempo",
    "permitidas": [
      "tempo"
    ]
  },
  "execucao": {
    "instrucoes": [
      "Apoie antebraços e pontas dos pés no chão.",
      "Mantenha cabeça, tronco e quadril alinhados.",
      "Contraia o abdômen e os glúteos durante toda a execução."
    ],
    "respiracao": "Mantenha respiração contínua, sem prender o ar.",
    "errosComuns": [
      "Deixar o quadril cair.",
      "Elevar excessivamente o quadril.",
      "Prender a respiração."
    ],
    "cuidados": [
      "Interromper em caso de dor lombar."
    ]
  },
  "relacoes": {
    "substitutos": [],
    "progressoes": [
      "prancha-com-elevacao-de-perna"
    ],
    "regressoes": [
      "prancha-com-joelhos-apoiados"
    ],
    "variacoes": [
      "prancha-lateral"
    ]
  },
  "restricoes": [],
  "midia": {
    "videoMagnet": "magnet:?...",
    "thumbnail": null
  },
  "tags": [
    "core",
    "abdomen",
    "isometria"
  ],
  "status": "ativo",
  "versao": 1
}
```

Exemplo de prescrição:

```json
{
  "exercicioId": "prancha-isometrica",
  "ordem": 5,
  "prescricao": {
    "series": 4,
    "metrica": {
      "tipo": "tempo",
      "modo": "maximo",
      "unidade": "segundos"
    },
    "carga": null,
    "descansoSegundos": 45,
    "cadencia": null,
    "tecnicas": [],
    "intensidade": null
  },
  "alternativas": [],
  "observacao": "Encerrar a série quando não for possível manter o alinhamento."
}
```

### 11.3. Alongamento

```json
{
  "id": "alongamento-de-posteriores-em-pe",
  "nome": "Alongamento de posteriores em pé",
  "aliases": [
    "Alongamento de isquiotibiais em pé"
  ],
  "classificacao": {
    "categoria": "alongamento",
    "tipo": "estatico",
    "nivelTecnico": "iniciante"
  },
  "movimento": {
    "padrao": "alongamento",
    "lateralidade": "bilateral",
    "cadeiaCinetica": "fechada",
    "planoPrincipal": "sagital"
  },
  "gruposMusculares": {
    "principais": [
      "posteriores-de-coxa"
    ],
    "sinergistas": [
      "panturrilha"
    ],
    "estabilizadores": []
  },
  "equipamentos": {
    "obrigatorios": [],
    "opcionais": [
      {
        "equipamentoId": "faixa-elastica",
        "finalidade": "auxiliar-o-posicionamento"
      }
    ]
  },
  "metricas": {
    "padrao": "tempo",
    "permitidas": [
      "tempo"
    ]
  },
  "execucao": {
    "instrucoes": [
      "Mantenha os joelhos levemente flexionados.",
      "Incline o tronco a partir do quadril.",
      "Pare ao sentir tensão confortável na parte posterior das coxas."
    ],
    "respiracao": "Respire de forma lenta e contínua.",
    "errosComuns": [
      "Forçar o tronco com movimentos bruscos.",
      "Buscar amplitude à custa de dor."
    ],
    "cuidados": [
      "O alongamento deve produzir tensão confortável, não dor aguda."
    ]
  },
  "relacoes": {
    "substitutos": [],
    "progressoes": [],
    "regressoes": [],
    "variacoes": [
      "alongamento-de-posteriores-sentado"
    ]
  },
  "restricoes": [],
  "midia": {
    "videoMagnet": "magnet:?...",
    "thumbnail": null
  },
  "tags": [
    "flexibilidade",
    "posteriores-de-coxa"
  ],
  "status": "ativo",
  "versao": 1
}
```

### 11.4. Cardio

Cardio possui biblioteca e prescrição próprias. Não é cadastrado como exercício.

#### Biblioteca da modalidade

```json
{
  "bibliotecas": {
    "cardio": {
      "modalidades": {
        "bicicleta-ergometrica": {
          "id": "bicicleta-ergometrica",
          "nome": "Bicicleta ergométrica",
          "aliases": [
            "Bicicleta",
            "Bike indoor"
          ],
          "equipamentoId": "bicicleta-ergometrica",
          "tiposTreinoPermitidos": [
            "continuo",
            "intervalado"
          ],
          "metricasPermitidas": [
            "tempo",
            "distancia",
            "calorias",
            "frequencia-cardiaca",
            "potencia"
          ],
          "status": "ativo",
          "versao": 1
        }
      }
    }
  }
}
```

#### Entrada de `treinosCardio[]` (entidade de primeira classe, seção 2.2)

```json
{
  "id": "bike-intervalado-15x30-30",
  "nome": "Treino A",
  "modalidadeId": "bicicleta-ergometrica",
  "treino": {
    "tipo": "intervalado",
    "series": 15,
    "estimulo": {
      "duracaoSegundos": 30,
      "intensidade": {
        "modo": "percepcao-livre",
        "valor": "maxima"
      }
    },
    "recuperacao": {
      "duracaoSegundos": 30,
      "intensidade": {
        "modo": "percepcao-livre",
        "valor": "leve"
      }
    }
  },
  "observacao": null,
  "status": "ativo",
  "versao": 1
}
```

Um treino de musculação que quiser esse cardio como complemento referencia
o `id` acima (não embute a prescrição) — ver seção 12.3:

```json
{
  "cardio": [
    { "treinoCardioId": "bike-intervalado-15x30-30", "momento": "apos-musculacao" }
  ]
}
```

`momento` fica na referência, não na entidade: é uma propriedade do vínculo
com aquele treino de musculação específico (o mesmo treino de cardio pode,
em tese, ser referenciado em momentos diferentes por treinos diferentes).

Outros exemplos possíveis de `treino` (dentro da entidade `treinosCardio[]`):

- bicicleta ergométrica contínua por tempo;
- esteira intervalada por velocidade;
- remo ergométrico por distância;
- treino por zona de frequência cardíaca;
- treino por potência em watts.

(O motor implementado, `treino_bicicleta.html`, hoje só sabe tocar
`tipo: "intervalado"` com `estimulo`/`recuperacao` — ver seção 8 de
[treino-bicicleta-especificacao.md](./treino-bicicleta-especificacao.md).)

### 11.5. Alongamento — treino de alongamento

Mesmo padrão de entidade de primeira classe, em `treinosAlongamento[]`
(seção 2.2), referenciando alongamentos de `bibliotecas.alongamentos`
(ver `docs/estrutura-biblioteca-alongamentos.md`) por `alongamentoId`:

```json
{
  "id": "mobilidade-quadril-pos-treino",
  "nome": "Mobilidade de quadril pós-treino",
  "alongamentos": [
    {
      "alongamentoId": "alongamento-de-posteriores-em-pe",
      "ordem": 10,
      "prescricao": {
        "series": 2,
        "metrica": { "tipo": "tempo", "modo": "fixo", "valor": 30, "unidade": "segundos" },
        "descansoSegundos": null
      },
      "observacao": null
    }
  ],
  "status": "ativo",
  "versao": 1
}
```

Referenciado por um treino de musculação da mesma forma que cardio:

```json
{
  "alongamento": [
    { "treinoAlongamentoId": "mobilidade-quadril-pos-treino", "momento": "apos-musculacao" }
  ]
}
```

`alongamentos[]` é sempre lista plana e sequencial — **sem** `superset`,
`circuito`, `alternativas` nem `tecnicas` (não fazem sentido pra composição
de alongamento, ver seção 5 de
[treino-alongamento-especificacao.md](./treino-alongamento-especificacao.md)).

## 12. Estrutura de treino

### 12.1. Estrutura canônica

O treino possui uma lista plana de exercícios e, opcionalmente, uma lista própria de prescrições cardiovasculares.

```json
{
  "id": "treino-a",
  "nome": "Treino A",
  "tipo": "musculacao",

  "aquecimento": {
    "protocolos": [
      {
        "tipo": "mobilidade-alongamento",
        "series": 2,
        "dosagem": {
          "valor": 15,
          "unidade": "segundos-ou-repeticoes"
        }
      }
    ]
  },

  "exercicios": [
    {
      "exercicioId": "supino-reto-com-halter",
      "ordem": 10,
      "superset": 1,
      "prescricao": {
        "series": 4,
        "metrica": {
          "tipo": "repeticoes",
          "modo": "faixa",
          "min": 16,
          "max": 20
        },
        "carga": null,
        "descansoSegundos": null,
        "cadencia": null,
        "tecnicas": [
          {
            "tipo": "tradicional"
          }
        ],
        "intensidade": null
      },
      "alternativas": [
        {
          "exercicioId": "flexao-de-bracos",
          "prioridade": 1,
          "prescricao": {
            "series": 4,
            "metrica": {
              "tipo": "repeticoes",
              "modo": "maximo"
            }
          }
        }
      ],
      "observacao": null
    },
    {
      "exercicioId": "agachamento-sumo-com-halter",
      "ordem": 20,
      "superset": 2,
      "prescricao": {
        "series": 4,
        "metrica": {
          "tipo": "repeticoes",
          "modo": "faixa",
          "min": 16,
          "max": 20
        }
      },
      "alternativas": [],
      "observacao": null
    }
  ],

  "cardio": [
    { "treinoCardioId": "bike-intervalado-15x30-30", "momento": "apos-musculacao" }
  ],

  "alongamento": [
    { "treinoAlongamentoId": "mobilidade-quadril-pos-treino", "momento": "apos-musculacao" }
  ],

  "status": "ativo",
  "versao": 1
}
```

### 12.2. Aquecimento

O aquecimento deve possuir estrutura própria, sem ser misturado às séries efetivas.

```json
{
  "aquecimento": {
    "protocolos": [
      {
        "tipo": "serie-preparatoria-do-exercicio",
        "alvo": "primeiro-exercicio-do-treino",
        "series": 1,
        "metrica": {
          "tipo": "repeticoes",
          "modo": "fixo",
          "valor": 30
        }
      }
    ]
  }
}
```

### 12.3. `cardio`/`alongamento`: referência, não embutido

Desde a versão 1.3 do schema (seção 2.2), `cardio` e `alongamento` são
arrays de **referências leves**, nunca a prescrição inteira:

```json
{
  "cardio": [{ "treinoCardioId": "bike-intervalado-15x30-30", "momento": "apos-musculacao" }],
  "alongamento": [{ "treinoAlongamentoId": "mobilidade-quadril-pos-treino", "momento": "apos-musculacao" }]
}
```

- `treinoCardioId`/`treinoAlongamentoId` apontam para uma entrada de
  `treinosCardio[]`/`treinosAlongamento[]` (seção 2.2/11.4/11.5) **do
  mesmo documento de plano** — diferente de `exercicioId`/`modalidadeId`,
  que apontam pro documento da biblioteca (validação em seção 14.5, esta é
  uma validação intra-documento, seção 14.3).
- `momento` (ex. `"antes-musculacao"`, `"apos-musculacao"`) descreve
  quando, dentro *deste* treino de musculação, aquele complemento deve ser
  feito — é uma propriedade do vínculo, por isso fica na referência e não
  na entidade `treinosCardio`/`treinosAlongamento` (que pode, em tese, ser
  referenciada por mais de um treino de musculação, cada um com seu
  próprio `momento`).
- Ambos os arrays são opcionais — um treino de musculação sem cardio nem
  alongamento complementar simplesmente omite o campo ou usa `[]`.

## 13. Agrupamentos de exercícios

Os exercícios devem permanecer em uma lista plana. A organização é representada por metadados nos próprios itens ou no treino.

### 13.1. Superset

```json
{
  "exercicios": [
    {
      "exercicioId": "supino-reto-com-halter",
      "ordem": 10,
      "superset": 1
    },
    {
      "exercicioId": "remada-unilateral-com-halter",
      "ordem": 20,
      "superset": 1
    },
    {
      "exercicioId": "agachamento-sumo-com-halter",
      "ordem": 30,
      "superset": 2
    }
  ]
}
```

O sistema não deve criar objetos `blocos` apenas para representar supersets. O número é preservado como fornecido pelo planejamento. O agrupamento visual ou operacional é responsabilidade da aplicação.

Regras:

- `superset` é inteiro positivo ou `null`;
- o mesmo número pode aparecer em vários exercícios;
- números diferentes podem ser combinados conforme a regra do planejamento;
- o campo não altera a ordem canônica; `ordem` continua sendo a referência principal;
- a ausência de superset deve ser representada por `null` ou pela omissão do campo.

### 13.2. Circuito

Circuitos também podem manter os exercícios em lista plana. A configuração geral fica no treino e cada item pode preservar o marcador original.

```json
{
  "tipo": "funcional",
  "configuracaoCircuito": {
    "ativo": true,
    "modoExecucao": "uma-serie-de-cada-exercicio-em-sequencia"
  },
  "exercicios": [
    {
      "exercicioId": "agachamento-com-salto",
      "ordem": 10,
      "circuito": 1,
      "prescricao": {
        "series": 4,
        "metrica": {
          "tipo": "tempo",
          "modo": "fixo",
          "valor": 30,
          "unidade": "segundos"
        }
      }
    }
  ]
}
```

A estrutura aninhada de blocos pode existir futuramente para protocolos que realmente exijam árvore de execução, mas não é necessária para supersets nem para os circuitos simples desta versão.

## 14. Regras de validação

### 14.1. Exercícios

1. `id` deve ser único em `bibliotecas.exercicios`.
2. `nome` não pode ser vazio.
3. Todos os grupos musculares referenciados devem existir.
4. Todos os equipamentos referenciados devem existir.
5. Todos os exercícios relacionados devem existir.
6. `metricas.padrao` deve estar em `metricas.permitidas`.
7. `versao` deve ser inteiro positivo.
8. Um exercício arquivado não deve ser usado em novos treinos.
9. Aliases duplicados devem ser removidos, desconsiderando maiúsculas e acentos.
10. Modalidades cardiovasculares não podem ser cadastradas como exercício apenas para uso em treino cardio.

### 14.2. Item de exercício no treino

1. `exercicioId` deve existir em `bibliotecas.exercicios`.
2. `prescricao.series` deve ser maior que zero.
3. `metrica.tipo` deve ser permitida pelo exercício.
4. No modo `faixa`, `min` deve ser menor ou igual a `max`.
5. No modo `fixo`, `valor` é obrigatório.
6. `descansoSegundos` não pode ser negativo.
7. `ordem` deve ser numérica.
8. `superset`, quando informado, deve ser inteiro positivo.
9. A técnica deve existir na biblioteca de técnicas.
10. Alternativas devem referenciar exercícios existentes.
11. Um exercício não pode ser alternativa de si mesmo.
12. A prescrição da alternativa é opcional; quando ausente, herda a prescrição principal.
13. Cadência não deve conter valores negativos.
14. RIR deve estar normalmente entre 0 e 10.
15. RPE deve estar normalmente entre 1 e 10.

### 14.3. Cardio e alongamento

1. `modalidadeId` (dentro de uma entrada de `treinosCardio[]`) deve existir
   em `bibliotecas.cardio.modalidades`.
2. Cardio não usa `exercicioId`; alongamento usa `alongamentoId`,
   referenciando `bibliotecas.alongamentos` (nunca `bibliotecas.exercicios`).
3. `treino.tipo` (de uma entrada de `treinosCardio[]`) deve estar em
   `tiposTreinoPermitidos` da modalidade.
4. `series` deve ser inteiro positivo quando informado (cardio e
   alongamento).
5. Durações não podem ser negativas.
6. Um treino de cardio intervalado deve informar ao menos `estimulo`.
7. A recuperação pode ser omitida em protocolos sem fase recuperativa.
8. As métricas utilizadas devem ser permitidas pela modalidade (cardio) ou
   pelo alongamento (`alongamento.metricas.permitidas`, mesma regra da
   seção 14.2 pra exercícios).
9. `treinoCardioId`/`treinoAlongamentoId` referenciados em `treino.cardio`/
   `treino.alongamento` (seção 12.3) devem existir em
   `treinosCardio`/`treinosAlongamento` **do mesmo documento de plano** —
   integridade intra-documento, diferente da integridade entre os dois
   documentos descrita na seção 14.5.
10. `id` de cada entrada de `treinosCardio[]`/`treinosAlongamento[]` deve
    ser único dentro da respectiva coleção (mesma regra de unicidade da
    seção 14.1 pra exercícios).

### 14.4. Integridade referencial

A remoção física de cadastros referenciados deve ser evitada. Preferir `status: "arquivado"`.

Treinos históricos devem continuar exibindo exercícios e modalidades cardiovasculares arquivados.

### 14.5. Integridade entre os dois documentos

1. Todo `exercicioId` usado em `treino.exercicios` (e em `alternativas`) deve
   existir em `bibliotecas.exercicios` do documento de biblioteca carregado.
2. Todo `modalidadeId` usado numa entrada de `treinosCardio[]` deve existir
   em `bibliotecas.cardio.modalidades` do documento de biblioteca
   carregado; todo `alongamentoId` usado numa entrada de
   `treinosAlongamento[].alongamentos` deve existir em
   `bibliotecas.alongamentos`.
3. A aplicação deve carregar o documento de biblioteca antes de validar um
   plano de treino; um plano não é válido sozinho, sem a biblioteca que ele
   referencia.
4. `biblioteca.arquivo` (seção 2.2) identifica qual documento de biblioteca o
   plano espera; não é necessário (nem recomendado) fixar a versão exata —
   uma biblioteca mais nova, com mais exercícios ou vídeos, continua válida
   para um plano antigo, desde que os `exercicioId`/`modalidadeId`
   referenciados continuem existindo.
5. Se um `exercicioId`/`modalidadeId` referenciado não existir na biblioteca
   carregada, a aplicação deve sinalizar o problema (ex.: exercício não
   encontrado) em vez de falhar silenciosamente ou quebrar a tela inteira.

## 15. JSON Schema simplificado

O schema abaixo é indicativo. A implementação pode usar JSON Schema, Zod, Joi, Bean Validation, TypeScript types ou tecnologia equivalente.

### 15.1. Exercício

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Exercicio",
  "type": "object",
  "required": [
    "id",
    "nome",
    "classificacao",
    "movimento",
    "gruposMusculares",
    "equipamentos",
    "metricas",
    "status",
    "versao"
  ],
  "properties": {
    "id": {
      "type": "string",
      "pattern": "^[a-z0-9]+(?:-[a-z0-9]+)*$"
    },
    "nome": {
      "type": "string",
      "minLength": 1
    },
    "aliases": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "uniqueItems": true
    },
    "classificacao": {
      "type": "object",
      "required": [
        "categoria",
        "tipo",
        "nivelTecnico"
      ],
      "properties": {
        "categoria": {
          "type": "string"
        },
        "tipo": {
          "type": "string"
        },
        "nivelTecnico": {
          "enum": [
            "iniciante",
            "intermediario",
            "avancado"
          ]
        }
      }
    },
    "metricas": {
      "type": "object",
      "required": [
        "padrao",
        "permitidas"
      ],
      "properties": {
        "padrao": {
          "type": "string"
        },
        "permitidas": {
          "type": "array",
          "minItems": 1,
          "items": {
            "type": "string"
          },
          "uniqueItems": true
        }
      }
    },
    "status": {
      "enum": [
        "rascunho",
        "ativo",
        "inativo",
        "arquivado"
      ]
    },
    "versao": {
      "type": "integer",
      "minimum": 1
    }
  }
}
```

### 15.2. Item de treino

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "ItemTreino",
  "type": "object",
  "required": [
    "exercicioId",
    "ordem",
    "prescricao"
  ],
  "properties": {
    "exercicioId": {
      "type": "string"
    },
    "ordem": {
      "type": "number"
    },
    "superset": {
      "type": ["integer", "null"],
      "minimum": 1
    },
    "circuito": {
      "type": ["integer", "null"],
      "minimum": 1
    },
    "prescricao": {
      "type": "object",
      "required": ["series", "metrica"],
      "properties": {
        "series": {
          "type": "integer",
          "minimum": 1
        },
        "metrica": {
          "type": "object",
          "required": ["tipo", "modo"]
        },
        "descansoSegundos": {
          "type": ["integer", "null"],
          "minimum": 0
        }
      }
    },
    "alternativas": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["exercicioId", "prioridade"],
        "properties": {
          "exercicioId": {"type": "string"},
          "prioridade": {"type": "integer", "minimum": 1},
          "motivo": {"type": "string"},
          "prescricao": {"type": "object"}
        }
      }
    },
    "observacao": {
      "type": ["string", "null"]
    }
  }
}
```

### 15.3. Prescrição de cardio

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "ItemCardio",
  "type": "object",
  "required": ["modalidadeId", "treino"],
  "properties": {
    "modalidadeId": {
      "type": "string"
    },
    "momento": {
      "enum": [
        "antes-musculacao",
        "apos-musculacao",
        "sessao-separada",
        "durante-circuito"
      ]
    },
    "treino": {
      "type": "object",
      "required": ["tipo"],
      "properties": {
        "tipo": {
          "enum": ["continuo", "intervalado"]
        },
        "series": {
          "type": "integer",
          "minimum": 1
        },
        "estimulo": {
          "type": "object"
        },
        "recuperacao": {
          "type": ["object", "null"]
        }
      }
    }
  }
}
```

Regras condicionais devem ser adicionadas ao schema definitivo.

## 16. Modelo TypeScript de referência

```ts
type StatusCadastro = "rascunho" | "ativo" | "inativo" | "arquivado";
type NivelTecnico = "iniciante" | "intermediario" | "avancado" | null;
type TipoTreinoCardio = "continuo" | "intervalado";

type MetricaTipo =
  | "repeticoes"
  | "tempo"
  | "distancia"
  | "carga"
  | "calorias"
  | "frequencia-cardiaca"
  | "potencia";

interface DocumentoBiblioteca {
  schema: "biblioteca-exercicios-cardio";
  schemaVersion: "1.2";
  bibliotecas: {
    exercicios: Record<string, Exercicio>;
    cardio: {
      modalidades: Record<string, ModalidadeCardio>;
    };
  };
  gruposMusculares: Record<string, GrupoMuscular>;
  equipamentos: Record<string, Equipamento>;
  tecnicas: Record<string, Tecnica>;
}

interface DocumentoPlanoDeTreino {
  schema: "plano-de-treino";
  schemaVersion: "1.2";
  biblioteca: {
    arquivo: string;
  };
  origem?: {
    tipo?: string;
    arquivo?: string;
    dataConversao?: string;
  };
  metadata: {
    professor?: string;
    consultoria?: string;
    aluno?: string;
    planejamento?: { inicio: string; fim: string };
    objetivos?: string[];
  };
  distribuicaoSemanal: { dia: string; treinoId: string | null }[];
  regraContinuidade?: string;
  orientacoesGerais?: Record<string, unknown>;
  treinos: Treino[];
}

interface Exercicio {
  id: string;
  nome: string;
  aliases?: string[];
  classificacao: {
    categoria: string;
    tipo: string;
    nivelTecnico?: NivelTecnico;
  };
  movimento: {
    padrao: string;
    lateralidade: string;
    cadeiaCinetica?: string;
    planoPrincipal?: string;
  };
  gruposMusculares: {
    principais: string[];
    sinergistas: string[];
    estabilizadores: string[];
  };
  equipamentos: {
    obrigatorios: RequisitoEquipamento[];
    opcionais: RequisitoEquipamento[];
  };
  metricas: {
    padrao: MetricaTipo;
    permitidas: MetricaTipo[];
  };
  execucao?: {
    instrucoes?: string[];
    respiracao?: string;
    errosComuns?: string[];
    cuidados?: string[];
  };
  midia?: {
    videoUrl?: string | null;
    videoMagnet?: string | null;
    thumbnail?: string | null;
  };
  status: StatusCadastro;
  versao: number;
}

interface ModalidadeCardio {
  id: string;
  nome: string;
  aliases?: string[];
  equipamentoId?: string | null;
  tiposTreinoPermitidos: TipoTreinoCardio[];
  metricasPermitidas: MetricaTipo[];
  status: StatusCadastro;
  versao: number;
}

interface Treino {
  id: string;
  nome: string;
  tipo: string;
  aquecimento?: Aquecimento;
  configuracaoCircuito?: {
    ativo: boolean;
    modoExecucao?: string;
  };
  exercicios: ItemTreino[];
  cardio: ItemCardio[];
  status: StatusCadastro;
  versao: number;
}

interface ItemTreino {
  exercicioId: string;
  ordem: number;
  superset?: number | null;
  circuito?: number | null;
  prescricao: PrescricaoExercicio;
  alternativas?: AlternativaExercicio[];
  observacao?: string | null;
}

interface AlternativaExercicio {
  exercicioId: string;
  prioridade: number;
  motivo?: string;
  prescricao?: PrescricaoExercicio;
}

interface PrescricaoExercicio {
  series: number;
  metrica: MetricaPrescrita;
  carga?: Carga | null;
  descansoSegundos?: number | null;
  cadencia?: Cadencia | null;
  tecnicas?: TecnicaAplicada[];
  intensidade?: Intensidade | null;
}

type MetricaPrescrita =
  | { tipo: MetricaTipo; modo: "fixo"; valor: number; unidade?: string }
  | { tipo: MetricaTipo; modo: "faixa"; min: number; max: number; unidade?: string }
  | { tipo: MetricaTipo; modo: "maximo" | "minimo" | "ate-falha" | "livre"; unidade?: string };

interface ItemCardio {
  modalidadeId: string;
  momento?: "antes-musculacao" | "apos-musculacao" | "sessao-separada" | "durante-circuito";
  treino: TreinoCardio;
  observacao?: string | null;
}

type TreinoCardio =
  | {
      tipo: "continuo";
      duracaoSegundos?: number;
      distancia?: { valor: number; unidade: string };
      intensidade?: Intensidade;
    }
  | {
      tipo: "intervalado";
      series: number;
      estimulo: FaseCardio;
      recuperacao?: FaseCardio | null;
    };

interface FaseCardio {
  duracaoSegundos?: number;
  distancia?: { valor: number; unidade: string };
  intensidade?: Intensidade;
}

interface RequisitoEquipamento {
  equipamentoId: string;
  quantidade?: number;
  finalidade?: string;
}

interface Carga {
  valor: number;
  unidade: "kg" | "lb" | "percentual-1rm" | "peso-corporal" | "nivel-maquina";
  formaContagem?: "total" | "por-lado" | "por-halter" | "por-membro";
}

interface Cadencia {
  excentricaSegundos?: number;
  pausaAlongadoSegundos?: number;
  concentricaSegundos?: number;
  concentrica?: "explosiva" | "controlada" | "livre";
  pausaContraidoSegundos?: number;
}

interface TecnicaAplicada {
  tipo: string;
  [parametro: string]: unknown;
}

interface Intensidade {
  modo: "rir" | "rpe" | "percentual-1rm" | "frequencia-cardiaca" | "zona-cardiaca" | "percepcao-livre" | "potencia";
  valor: number | string;
}

interface Aquecimento {
  protocolos: Array<Record<string, unknown>>;
}

interface GrupoMuscular { nome: string; }
interface Equipamento { nome: string; categoria: string; }
interface Tecnica { nome: string; descricao?: string; }
```

## 17. Modelo relacional sugerido

Caso a implementação utilize banco relacional, uma estrutura possível é:

### Tabelas principais

```text
exercicio
grupo_muscular
equipamento
tecnica
modalidade_cardio
treino
treino_item
treino_cardio
```

### Relacionamentos de exercícios

```text
exercicio_alias
exercicio_grupo_muscular
exercicio_equipamento
exercicio_metrica
exercicio_relacao
exercicio_restricao
exercicio_tag
treino_item_alternativa
treino_item_tecnica
```

### `treino_item`

```text
- id
- treino_id
- exercicio_id
- ordem
- superset_numero
- circuito_numero
- series
- metrica_tipo
- metrica_modo
- metrica_valor
- metrica_min
- metrica_max
- metrica_unidade
- carga_valor
- carga_unidade
- descanso_segundos
- observacao
```

Não é necessária uma tabela de bloco de superset para a versão 1.1.

### `modalidade_cardio`

```text
- id
- nome
- equipamento_id
- status
- versao
```

### `treino_cardio`

```text
- id
- treino_id
- modalidade_cardio_id
- momento
- tipo
- series
- estimulo_duracao_segundos
- estimulo_intensidade_modo
- estimulo_intensidade_valor
- recuperacao_duracao_segundos
- recuperacao_intensidade_modo
- recuperacao_intensidade_valor
- observacao
```

Protocolos cardiovasculares mais complexos podem ser armazenados em JSON ou normalizados em tabelas de fases.

## 18. Estratégia de API

### 18.1. Exercícios

```text
GET    /exercicios
GET    /exercicios/{id}
POST   /exercicios
PUT    /exercicios/{id}
PATCH  /exercicios/{id}
DELETE /exercicios/{id}
```

Filtros:

```text
GET /exercicios?categoria=musculacao
GET /exercicios?grupoMuscular=quadriceps
GET /exercicios?equipamento=halter
GET /exercicios?padraoMovimento=agachamento
GET /exercicios?busca=sumo
```

### 18.2. Cardio

```text
GET    /cardio/modalidades
GET    /cardio/modalidades/{id}
POST   /cardio/modalidades
PUT    /cardio/modalidades/{id}
PATCH  /cardio/modalidades/{id}
DELETE /cardio/modalidades/{id}
```

Uma modalidade cardiovascular não deve ser retornada pelo endpoint `/exercicios`.

### 18.3. Treinos

```text
GET    /treinos
GET    /treinos/{id}
POST   /treinos
PUT    /treinos/{id}
PATCH  /treinos/{id}
DELETE /treinos/{id}
```

O payload do treino contém `exercicios` e `cardio` como coleções irmãs.

### 18.4. Busca

A busca de exercícios considera nome, aliases, tags, grupos musculares, equipamentos e padrão de movimento.

A busca de cardio considera nome da modalidade, aliases, equipamento, métricas e tipos de treino permitidos.

## 19. Regras para substituição automática

Uma rotina de sugestão de substitutos pode considerar os seguintes critérios, em ordem:

1. mesma métrica permitida;
2. mesmo padrão de movimento;
3. mesmos grupos musculares principais;
4. equipamentos disponíveis;
5. nível técnico compatível;
6. restrições aplicáveis;
7. lateralidade;
8. similaridade cadastrada;
9. objetivo do treino;
10. preferência do aluno.

Exemplo de pontuação:

```text
+40 mesmo padrão de movimento
+30 mesmo grupo muscular principal
+15 equipamentos disponíveis
+10 mesmo nível técnico
+5 mesma lateralidade
-50 restrição incompatível
```

Essa regra é opcional e pode ser implementada em fase posterior.

---

## 20. Histórico e versionamento

Alterações em exercícios podem afetar treinos já prescritos.

Recomenda-se uma das estratégias:

### Estratégia A — referência à versão atual

O treino guarda somente `exercicioId`.

Vantagem:

- simplicidade.

Desvantagem:

- mudanças no exercício alteram a exibição de treinos históricos.

### Estratégia B — referência com versão

```json
{
  "exercicioId": "supino-reto-com-halter",
  "exercicioVersao": 2
}
```

Vantagem:

- preserva consistência histórica.

Desvantagem:

- exige armazenamento e consulta por versão.

### Estratégia C — snapshot parcial

O treino guarda o identificador e uma cópia dos dados essenciais de exibição.

```json
{
  "exercicioId": "supino-reto-com-halter",
  "snapshot": {
    "nome": "Supino reto com halteres",
    "videoMagnet": "magnet:?...",
    "versao": 2
  }
}
```

Recomendação:

- usar referência com versão ou snapshot em sistemas que precisam preservar treinos históricos exatamente como foram prescritos.

---

## 21. Migração do modelo atual

### 21.1. Migração dos itens de musculação

Modelo anterior:

```json
{
  "exercicioId": "agachamento-sumo-com-halter",
  "grupoMuscular": {
    "principal": "Quadríceps"
  },
  "series": 4,
  "repeticoes": {
    "modo": "faixa",
    "min": 16,
    "max": 20
  },
  "tecnica": "isometria",
  "substituto": false
}
```

Modelo 1.1:

```json
{
  "exercicioId": "agachamento-sumo-com-halter",
  "ordem": 30,
  "superset": 2,
  "prescricao": {
    "series": 4,
    "metrica": {
      "tipo": "repeticoes",
      "modo": "faixa",
      "min": 16,
      "max": 20
    },
    "tecnicas": [
      {
        "tipo": "isometria",
        "duracaoSegundos": 20
      }
    ]
  },
  "alternativas": [],
  "observacao": null
}
```

### 21.2. Migração de supersets

Antes:

```json
{
  "blocos": [
    {
      "tipo": "superset",
      "itens": []
    }
  ]
}
```

Depois:

```json
{
  "exercicios": [
    {
      "exercicioId": "supino-reto-com-halter",
      "superset": 1
    },
    {
      "exercicioId": "agachamento-sumo-com-halter",
      "superset": 2
    }
  ]
}
```

### 21.3. Migração do cardio

Antes:

```json
{
  "exercicioId": "bicicleta-ergometrica"
}
```

Depois:

```json
{
  "modalidadeId": "bicicleta-ergometrica",
  "treino": {
    "tipo": "intervalado",
    "series": 15,
    "estimulo": {
      "duracaoSegundos": 30
    },
    "recuperacao": {
      "duracaoSegundos": 30
    }
  }
}
```

### 21.4. Passos de migração

1. Normalizar grupos musculares e equipamentos.
2. Mover anatomia e equipamentos dos treinos para a biblioteca de exercícios.
3. Converter repetições para `prescricao.metrica`.
4. Converter técnica string para `tecnicas`.
5. Transformar substitutos em `alternativas`.
6. Preservar a prescrição própria da alternativa quando diferente.
7. Desmontar blocos de superset e inserir `superset` em cada item.
8. Manter os exercícios na ordem original do planejamento.
9. Remover modalidades cardio de `bibliotecas.exercicios`.
10. Cadastrar as modalidades em `bibliotecas.cardio.modalidades`.
11. Converter blocos intervalados em `treino.cardio`.
12. Representar dados desconhecidos por `null` ou omissão.
13. Validar todas as referências.
14. Separar o documento em dois arquivos: `bibliotecas`, `gruposMusculares`,
    `equipamentos` e `tecnicas` vão para `biblioteca-exercicios.json`;
    `metadata`, `distribuicaoSemanal`, `regraContinuidade`,
    `orientacoesGerais` e `treinos` vão para `treino-<identificador>.json`
    (seção 2).
15. Adicionar `biblioteca.arquivo` ao documento do plano, apontando para o
    arquivo de biblioteca esperado.
16. Mover decisões de conversão (ex.: como uma ambiguidade do PDF foi
    interpretada) para um `.md` de notas ao lado do plano — não ficam em
    nenhum dos dois JSONs.

## 22. Decisões arquiteturais consolidadas

1. Grupos musculares pertencem à biblioteca do exercício.
2. Equipamentos do exercício pertencem à biblioteca do exercício.
3. Cardio constitui domínio próprio e não usa `exercicioId`.
4. Modalidades cardio são cadastradas em `bibliotecas.cardio.modalidades`.
5. Prescrições cardio ficam em `treino.cardio`.
6. `metricaPadrao` é representada por `metricas.padrao`.
7. `aliases` melhoram busca e importação.
8. `padraoMovimento` pertence a `movimento`.
9. `unilateral: boolean` deve ser substituído por `lateralidade`.
10. `errosComuns` e `cuidados` pertencem a `execucao`.
11. Técnicas são objetos parametrizados.
12. Cadência é objeto; a string é apenas formato de exibição.
13. `substituto: false` deve ser removido.
14. Alternativas ficam no item principal e podem ter prescrição própria.
15. Os exercícios do treino permanecem em lista plana.
16. Supersets são indicados por `superset: número` no item.
17. O sistema decide posteriormente como agrupar ou exibir supersets.
18. Circuitos simples também podem usar lista plana e configuração no treino.
19. Carga, descanso, intensidade, séries e métricas pertencem à prescrição.
20. Dados desconhecidos devem ser `null` ou omitidos.
21. A aplicação deve garantir integridade referencial entre todos os domínios.
22. Biblioteca e plano de treino são documentos JSON separados; o plano
    referencia a biblioteca só por id, nunca embute o cadastro (seção 2).

## 23. Escopo mínimo recomendado para a primeira versão

O MVP deve suportar:

### Biblioteca de exercícios

```json
{
  "bibliotecas": {
    "exercicios": {
      "supino-reto-com-halter": {
        "id": "supino-reto-com-halter",
        "nome": "Supino reto com halteres",
        "classificacao": {
          "categoria": "musculacao",
          "tipo": "composto",
          "nivelTecnico": null
        },
        "gruposMusculares": {
          "principais": ["peitoral-maior"],
          "sinergistas": ["triceps-braquial", "deltoide-anterior"],
          "estabilizadores": []
        },
        "equipamentos": {
          "obrigatorios": ["halter", "banco-reto"],
          "opcionais": []
        },
        "metricas": {
          "padrao": "repeticoes",
          "permitidas": ["repeticoes"]
        },
        "status": "ativo",
        "versao": 1
      }
    }
  }
}
```

### Biblioteca de cardio

```json
{
  "bibliotecas": {
    "cardio": {
      "modalidades": {
        "bicicleta-ergometrica": {
          "id": "bicicleta-ergometrica",
          "nome": "Bicicleta ergométrica",
          "equipamentoId": "bicicleta-ergometrica",
          "tiposTreinoPermitidos": ["continuo", "intervalado"],
          "metricasPermitidas": ["tempo", "distancia", "calorias"],
          "status": "ativo",
          "versao": 1
        }
      }
    }
  }
}
```

### Treino

```json
{
  "id": "treino-a",
  "exercicios": [
    {
      "exercicioId": "supino-reto-com-halter",
      "ordem": 10,
      "superset": 1,
      "prescricao": {
        "series": 4,
        "metrica": {
          "tipo": "repeticoes",
          "modo": "faixa",
          "min": 8,
          "max": 12
        }
      },
      "alternativas": [],
      "observacao": null
    }
  ],
  "cardio": [
    {
      "modalidadeId": "bicicleta-ergometrica",
      "treino": {
        "tipo": "intervalado",
        "series": 10,
        "estimulo": {"duracaoSegundos": 30},
        "recuperacao": {"duracaoSegundos": 30}
      }
    }
  ]
}
```

## 24. Critérios de aceite

A implementação será considerada aderente quando:

1. for possível cadastrar exercício sem séries ou repetições;
2. grupos musculares e equipamentos estiverem na biblioteca;
3. treino referenciar exercício por `exercicioId`;
4. cardio não for cadastrado nem prescrito por `exercicioId`;
5. modalidade cardio for referenciada por `modalidadeId`;
6. treino puder conter `exercicios` e `cardio` simultaneamente;
7. exercícios forem armazenados em lista plana;
8. superset for representado por número no próprio item;
9. nenhum bloco de superset for necessário para leitura do treino;
10. alternativas puderem ter prescrição própria;
11. a interface usar `metricas.padrao` como métrica inicial;
12. técnicas aceitarem parâmetros;
13. cadência não depender de interpretação de string;
14. referências inválidas forem rejeitadas;
15. exercícios e modalidades arquivados permanecerem disponíveis em históricos;
16. a API separar `/exercicios` de `/cardio/modalidades`;
17. os dados atuais puderem ser migrados sem perda semântica relevante.

## 25. Observações finais

O modelo foi desenhado para permitir uma implementação inicial simples, sem impedir evoluções futuras.

A equipe pode começar com os campos essenciais e adotar gradualmente:

- técnicas avançadas;
- restrições graduadas;
- substituição automática;
- histórico por versão;
- protocolos avançados de execução;
- geração automática;
- análise de volume por grupo muscular;
- recomendações com base em equipamentos disponíveis;
- personalização por aluno;
- registro de execução real versus prescrição.

A separação entre biblioteca e prescrição deve permanecer como princípio estrutural em todas as evoluções.
