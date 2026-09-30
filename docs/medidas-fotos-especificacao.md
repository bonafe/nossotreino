# Especificação — Medidas e Fotos corporais

> **Status:** MVP implementado (banco v4, backup v6). Páginas: `corpo_menu.html`,
> `corpo_avaliacao_nova.html`, `corpo_comparar.html`. Código: `js/medidas-corporais.js`
> (protocolo/regras), `js/imagem-corporal.js` (canvas/EXIF/base64),
> `js/ilustracao-corpo.js`, `js/grafico-medidas.js` e os métodos de avaliação em
> `js/storage.js`. Ilustrações são SVG gerados em código (sem arquivos em `imagens/`).

## 1. Objetivo

Permitir que cada aluno acompanhe a evolução do corpo ao longo do tempo
registrando, de forma periódica e padronizada:

- massa corporal;
- circunferências (cintura, quadril, braço, coxa, panturrilha);
- fotos frontal, lateral e posterior;
- o contexto da medição.

Princípio que orienta toda a interface:

> **Uma medida imperfeita, mas feita sempre do mesmo jeito, serve mais pra
> acompanhar evolução do que medidas feitas cada vez de um jeito.**

Portanto a prioridade é **padronização, repetibilidade e facilidade de
uso** — não precisão laboratorial.

Fora de escopo nesta fase: percentual de gordura, composição corporal,
diagnóstico, avaliação postural e qualquer inferência automática (por
foto ou por medida). O sistema mede, guarda, compara e mostra tendência;
não interpreta. Nada de mensagens valorativas automáticas ("piorou",
"ideal", "excelente") — só a variação objetiva (`94,2 → 90,8 cm, −3,4 cm`).

## 2. Princípios de arquitetura

1. **Offline-first, dado no aparelho.** A fonte da verdade é o
   IndexedDB do navegador. Tudo funciona sem rede, inclusive a câmera.
2. **Troca de dados por arquivo hoje (backup/restauração), por API
   amanhã.** Nenhuma tela conhece o mecanismo de persistência: toda leitura
   e escrita passa por métodos de domínio em `js/storage.js` (seção 6),
   que são a fronteira que um adaptador remoto poderia implementar no
   futuro sem mexer em nenhuma página.
3. **Dado pessoal e sensível.** Peso, medidas e principalmente fotos
   corporais são dado de saúde (LGPD). Por padrão nunca saem do aparelho;
   só saem por ação explícita de quem usa (exportar backup, seção 8).
4. **Toda mudança de formato persistido tem migração** (CLAUDE.md,
   seção 2.1 de [armazenamento-local-especificacao.md](./armazenamento-local-especificacao.md)).

## 3. Escopo: a avaliação pertence ao aluno

Uma avaliação corporal pertence a um **aluno** (`alunoId`), não a um
plano. O corpo não "reinicia" quando um ciclo de treino termina, então a
série histórica atravessa todos os planos do aluno — mesma lógica das
estatísticas agregadas por aluno (seção 3.5 de
`armazenamento-local-especificacao.md`). Excluir um plano não apaga
avaliações; excluir um aluno apaga as dele (e seus blobs de foto).

Ponto de entrada: `sistema.html` (aluno do plano ativo, resolvido por
`TreinosStorage.obterAlunoDoPlano`), como os demais pilares.

## 4. Protocolo Nosso Treino v1

Existem vários protocolos antropométricos válidos; o sistema não finge
ser o único correto. Adota um protocolo próprio, **identificado e
versionado** em cada avaliação:

```json
{ "protocolo": { "id": "nosso-treino", "versao": 1 } }
```

Assim o método pode mudar no futuro sem tornar o histórico ambíguo.
Cada versão do protocolo define o método de cada medida (`metodo`), que
também é gravado junto da medida (ex.: `cintura` →
`"ponto-medio-oms"`). Nunca misturar métodos silenciosamente numa mesma
série do gráfico: se o método mudou, o gráfico mostra a quebra.

### 4.1 Medidas da v1

| Medida (`tipo`) | Unidade | Lados (`lado`) | Método (`metodo`) |
|---|---|---|---|
| `peso` | kg (0,1) | `nenhum` | balança, preferencialmente a mesma |
| `cintura` | cm (0,1) | `nenhum` | `ponto-medio-oms`: ponto médio entre a última costela palpável e o topo da crista ilíaca; fita horizontal; leitura no fim de uma expiração normal |
| `quadril` | cm (0,1) | `nenhum` | `maior-circunferencia`: maior circunferência dos glúteos; fita horizontal |
| `braco` | cm (0,1) | `esquerdo`/`direito` | `maior-circunferencia`: braço relaxado ao lado do corpo |
| `coxa` | cm (0,1) | `esquerdo`/`direito` | `maior-circunferencia`: peso distribuído, fita perpendicular ao eixo da perna |
| `panturrilha` | cm (0,1) | `esquerdo`/`direito` | `maior-circunferencia`: perna relaxada |

Braço, coxa e panturrilha são sempre bilaterais (assimetria importa pra
quem treina e custa quase nada no modelo). Braço, coxa e panturrilha
usam o ponto mais proeminente como método **prático de acompanhamento
longitudinal**, não como antropometria de laboratório — a própria tela
deve dizer isso.

Regras gerais de execução (texto de apoio das telas): fita flexível e
não elástica, paralela ao chão ou perpendicular ao segmento, encostada
sem comprimir a pele.

O modelo de dados aceita `tipo` novo sem migração (tórax, abdômen,
pescoço, antebraço, altura) — ver seção 5.

### 4.2 Dupla medição (opcional)

Por configuração (modo **rápido**, padrão: 1 leitura; modo **preciso**: 2):

```
diferença entre as duas leituras ≤ 1,0 cm → registra a média
diferença > 1,0 cm                        → pede nova medição
```

A dupla medição vale pras circunferências; peso é sempre uma leitura.
Guarda-se `leitura1`/`leitura2` além do `valor` final.

### 4.3 Validações suaves

Faixas plausíveis (peso 20–400 kg, circunferência 10–300 cm) geram
**aviso com confirmação**, nunca bloqueio: "Você informou cintura de
9,2 cm. Talvez quisesse 92 cm." com [Corrigir] / [Está correto]. O
sistema nunca converte `9,2 → 92` sem confirmação (normalizar `92` para
`92,0` é só representação).

## 5. Modelo de dados

Duas lojas novas no IndexedDB (`js/armazenamento-indexeddb.js`),
escopo **global por aluno** (não por plano):

| Loja | `keyPath` | Índices | Registro |
|---|---|---|---|
| `avaliacoesCorporais` | `id` | `porAluno`→`alunoId` | documento da avaliação (abaixo), **sem binários** |
| `fotosCorporais` | `id` | `porAvaliacao`→`avaliacaoId` | `{id, avaliacaoId, blob, tipoMime, bytes}` — só o `Blob` da foto |

O `Blob` fica em loja própria pra que listar avaliações, desenhar gráfico
e montar backup leve nunca carreguem imagem.

```json
{
  "id": "0f8e2c1e-....",
  "alunoId": "aluno-1",
  "medidoEm": "2026-09-30T08:12:00.000Z",
  "protocolo": { "id": "nosso-treino", "versao": 1 },
  "medidas": [
    { "tipo": "peso",   "lado": "nenhum",   "valor": 82.4, "unidade": "kg", "metodo": "balanca" },
    { "tipo": "cintura","lado": "nenhum",   "valor": 91.3, "unidade": "cm", "metodo": "ponto-medio-oms", "leitura1": 91.2, "leitura2": 91.4 },
    { "tipo": "braco",  "lado": "direito",  "valor": 36.5, "unidade": "cm", "metodo": "maior-circunferencia" }
  ],
  "fotos": [
    { "vista": "frente", "fotoId": "b71a...", "largura": 1080, "altura": 1920, "capturadoEm": "2026-09-30T08:14:00.000Z" }
  ],
  "condicoes": { "estadoAlimentar": "jejum", "roupa": "minima", "treinoRecente": "nao" },
  "observacoes": "",
  "criadoEm": "2026-09-30T08:20:00.000Z",
  "atualizadoEm": "2026-09-30T08:20:00.000Z",
  "versaoRegistro": 1,
  "removidoEm": null
}
```

- `id` de avaliação e de foto: `crypto.randomUUID()` gerado no cliente
  (funciona offline e não colide com um id gerado por outro aparelho —
  requisito pra trocar dados entre aparelhos/API depois). Não usar
  `gerarIdUnico` de `js/identificadores.js` — aquele gera slug legível
  por coleção, não serve pra id que precisa ser globalmente único.
- `vista`: `frente` | `lado` | `costas` (a v1 tem uma foto de cada; o
  modelo aceita vistas novas, ex. `lado-esquerdo`, sem migração).
- `lado`: `nenhum` | `esquerdo` | `direito`.
- `condicoes` (todas opcionais, nenhuma obrigatória): `estadoAlimentar`
  (`jejum`/`antes-refeicao`/`depois-refeicao`), `roupa`
  (`minima`/`leve`/`normal`/`outra`), `treinoRecente` (`sim`/`nao`).
- Avaliação pode ter só peso, só medidas, só fotos ou tudo — nada é
  obrigatório, mas a tela incentiva a avaliação completa.
- `criadoEm`, `atualizadoEm`, `versaoRegistro` e `removidoEm` (remoção
  lógica) **já são gravados hoje** mas só ganham uso com sincronização —
  ver seção 6.2. Exclusão pelo usuário hoje remove de verdade (seção 7).

## 6. Camada de persistência e preparo pra API futura

### 6.1 API de domínio em `js/storage.js`

Nenhuma página chama `indexedDB` nem as lojas diretamente (regra geral
do projeto). Métodos novos de `TreinosStorage`, seguindo o mesmo padrão
do resto (leitura síncrona sobre o instantâneo em memória das
avaliações — sem blobs —, escrita enfileirada em segundo plano,
`aguardarEscritas()` antes de navegar):

- `listarAvaliacoesDoAluno(alunoId)` — ordenadas por `medidoEm`;
- `obterAvaliacao(id)`, `salvarAvaliacao(avaliacao)`, `excluirAvaliacao(id)`;
- `salvarFotoCorporal(avaliacaoId, vista, blob)` / `obterFotoCorporal(fotoId)`
  (assíncronos — blob não entra no instantâneo) / `excluirFotoCorporal(fotoId)`;
- `lerSerieDeMedida(alunoId, tipo, lado)` — pontos `{medidoEm, valor}` pro gráfico.

O instantâneo em memória guarda só os documentos de avaliação (leves);
blobs de foto são lidos sob demanda e liberados com `URL.revokeObjectURL`.

### 6.2 Pontos de extensão pra sincronização (não implementar agora)

O desenho é **offline-first com troca de arquivos hoje e API amanhã**.
Pra isso nada precisa ser reescrito depois, desde que hoje se respeite:

1. **Ids globalmente únicos** (UUID) — dois aparelhos nunca geram o mesmo.
2. **Carimbos e versão por registro** (`atualizadoEm`, `versaoRegistro`,
   `removidoEm`) — base pra detectar mudança e resolver conflito
   (ex.: "o mais recente por `atualizadoEm` vence", decisão futura).
3. **Fronteira única de persistência** — os métodos da seção 6.1 são a
   interface; um adaptador remoto (`fetch` pra uma API) implementaria os
   mesmos métodos, mantendo o IndexedDB como cache/fonte offline.
4. **Formato de troca já definido** — o envelope de backup (seção 8) é
   o mesmo documento que uma API futura trocaria; as avaliações são
   serializáveis em JSON e as fotos são referenciadas por `fotoId`, então
   uma API pode enviar foto como upload binário separado.
5. **Fila de saída** (ex.: loja `sincronizacaoPendente` ou chave em
   `meta`): só descrita aqui como ponto de extensão; criada quando a API
   existir, junto com sua migração de banco.

Requisitos que só passam a valer quando existir backend (não são do
MVP): autenticação, fotos em storage privado com URL temporária,
autorização por usuário (teste explícito de que o usuário A não acessa
a foto do B trocando um id), criptografia em trânsito, consentimento
específico pra tratamento no servidor, e nunca usar foto pra treinar IA.

## 7. Privacidade e tratamento das fotos

- Fotos ficam **só no IndexedDB do aparelho**; sem URL pública, sem CDN,
  nunca passam pelo Google Analytics (ver `docs/analytics-especificacao.md`).
- Mensagem clara na tela: "Suas fotos ficam só neste aparelho e servem
  pra acompanhar a sua evolução."
- **Remoção de metadados (EXIF/GPS):** toda foto é desenhada em um
  `<canvas>` e regravada como JPEG (`canvas.toBlob`) antes de guardar —
  isso descarta GPS, modelo do aparelho e demais metadados. Guardam-se
  só `largura`, `altura` e orientação. Redução de resolução (ex.: lado
  maior ≤ 1920 px), compressão e recorte de enquadramento são aceitáveis.
- **Sem manipulação:** nenhum filtro estético, afinamento ou correção —
  a imagem deve representar fielmente o que foi capturado.
- **Exclusão real:** excluir uma foto remove o `Blob` da loja
  `fotosCorporais` e a referência na avaliação; excluir uma avaliação
  remove todas as suas fotos e medidas (confirmação mostra o que será
  removido: "3 fotos, 7 medidas").
- Nunca compartilhar, usar como avatar, nem exibir fora da tela do
  próprio aluno sem ação explícita.

## 8. Backup e restauração

### 8.1 O que entra

`TreinosStorage.montarBackup()` ganha o campo `avaliacoesCorporais`
(documentos leves, **sempre** incluídos). As **fotos são opcionais,
perguntadas a cada backup**:

```
Incluir as fotos corporais neste backup?
Elas aumentam bastante o arquivo e contêm imagens sensíveis.

[ Só medidas (recomendado) ]   [ Incluir fotos ]
```

- O padrão é **não incluir**. A escolha vale só pra esse arquivo; nada é
  lembrado entre backups.
- `montarBackup({ incluirFotos })` (assíncrono quando `true`, pois lê os
  blobs). Com fotos, o envelope traz `fotosCorporais`:
  `[{ id, avaliacaoId, tipoMime, dadosBase64 }]`. Sem fotos, o campo
  simplesmente não existe e as avaliações mantêm os `fotoId` das
  referências (marcam que aquela avaliação **tinha** foto, sem trazê-la).
- Mostrar o tamanho aproximado antes de baixar ("≈ 38 MB com fotos").
- Fica em aberto, com recomendação de **JSON único**: alternativa futura
  de empacotar em ZIP se o tamanho incomodar. JSON único evita
  dependência nova e mantém o padrão de um arquivo só.

### 8.2 Restauração

`restaurarBackup` mescla, nunca apaga o que já existe no aparelho sem
ter equivalente no arquivo:

- avaliações entram por `id` (mesmo `id` → mantém a de `atualizadoEm`
  mais recente; idempotente se reimportar o mesmo arquivo);
- backup **sem** fotos não remove fotos que já estão no aparelho;
- backup **com** fotos grava cada blob por `fotoId` (idempotente);
- avaliação restaurada sem a foto presente mostra a vista como "foto não
  incluída no backup" em vez de quebrar.

### 8.3 Migração de backup

Envelope `versao` **5 → 6** (`migrarBackupDe5Para6`): backup antigo não
tinha avaliações, migra com `avaliacoesCorporais: []` (nunca `undefined`).
Segue as quatro propriedades (preguiçosa, idempotente, silenciosa, segura
na falha) — seção 2.2 de `armazenamento-local-especificacao.md`.

## 9. Migração de esquema do banco

`VERSAO_BANCO` **3 → 4**, `MIGRACOES_BANCO[4]` cria as lojas
`avaliacoesCorporais` (índice `porAluno`) e `fotosCorporais` (índice
`porAvaliacao`) sem tocar nas existentes — receita da seção 2.3 do
documento de armazenamento. Acrescentar as duas linhas (banco 3→4 e
backup 5→6) no registro da seção 2.4 e as duas lojas na tabela da
seção 2 daquele documento, junto com a implementação.

## 10. Fluxo de telas

```
sistema.html
   └─> corpo_menu.html (📏, histórico + gráficos por métrica + "Nova avaliação")
          ├─> corpo_avaliacao_nova.html (assistente; também edita: ?editar=<id>)
          └─> corpo_comparar.html?a=<id>&b=<id> (duas avaliações)
```

Arquivos seguem o padrão do projeto: `js/paginas/corpo-menu.js`,
`corpo-avaliacao-nova.js`, `corpo-comparar.js` e `css/paginas/corpo-*.css`.

### 10.1 Assistente de nova avaliação

Passos, cada um com ilustração própria, instrução curta e botão de
**pular**: Preparação → Peso → Fotos → Cintura → Quadril → Braços →
Coxas → Panturrilhas → Revisão → Salvar.

- **Preparação:** checklist curto (mesma fita e balança, roupa e horário
  semelhantes, mesmo local e luz). Só orienta, nunca bloqueia.
- **Repetir condições:** mostra o que foi registrado na última avaliação
  ("08:12, roupa mínima, em jejum — tente repetir") e há quanto tempo foi.
- **Primeira avaliação:** tela de boas-vindas ("Ela será o seu ponto
  inicial") e, depois de salvar, um resumo da referência inicial.

### 10.2 Fotos e câmera

- `navigator.mediaDevices.getUserMedia` com `<video>` ao vivo, funciona
  offline e só em contexto seguro (HTTPS/`localhost`, igual ao service
  worker). **Alternativa por upload** (`<input type="file" accept="image/*">`,
  com `capture` no celular) pra quem nega a câmera ou está em `file://`.
- Guia de enquadramento sobreposto (SVG): linha central, marcas de cabeça
  e pés, silhueta translúcida.
- **Temporizador** 3/5/10 s (autoavaliação é o caso comum).
- Cada etapa já sabe a `vista` (frente/lado/costas): o usuário nunca
  informa "essa foto é frontal" depois. Após capturar: [Refazer] /
  [Usar esta foto].
- Orientações: fundo simples, luz uniforme sem contraluz, câmera nivelada
  na altura do centro do corpo, corpo inteiro, mesma distância e roupa
  semelhante entre avaliações, postura natural sem contrair.
- Futuro, não MVP: detecção local de enquadramento (corpo inteiro, pés
  fora do quadro) pra ajudar a padronizar — nunca pra inferir medida.

### 10.3 Histórico e gráficos

Reaproveita `js/grafico-linha.js` (D3 vendorizado, mesmo padrão de
`treino_exercicio_progresso.html`): uma série por métrica (peso, cintura,
quadril e cada lado de braço/coxa/panturrilha), filtro de intervalo
(1 mês / 3 meses / 6 meses / 1 ano / tudo) e cartão de variação desde a
avaliação anterior. Séries com `metodo` diferente aparecem separadas.

### 10.4 Comparação

Duas avaliações escolhidas pelo usuário, por vista:
lado a lado, **slider** antes/depois e **sobreposição com opacidade**.
Sempre o mesmo enquadramento de exibição (mesma escala/recorte) pra não
criar falsa impressão de mudança.

## 11. PWA e offline

- Novas páginas, scripts e CSS entram na lista de pré-cache do `sw.js`;
  subir `CACHE_NOME` e `VERSAO_APP` (`js/versao.js`) — ver
  [pwa-offline-especificacao.md](./pwa-offline-especificacao.md).
- Ilustrações das medidas: **SVG próprios do Nosso Treino** em
  `imagens/corpo/` (corpo + linha da fita + marcos anatômicos), no estilo
  visual existente. Nenhuma figura ou texto do material de referência é
  copiado.

## 12. Critérios de aceite do MVP

- criar uma avaliação só com peso, só com medidas, só com fotos ou completa;
- fotografar frente/lado/costas pela câmera (e por upload), com a vista
  associada automaticamente e possibilidade de refazer;
- registrar cintura, quadril e braço/coxa/panturrilha esquerdo e direito,
  com dupla medição opcional;
- protocolo (`nosso-treino` v1) e método de cada medida gravados;
- histórico e gráficos por métrica, atravessando vários planos do mesmo aluno;
- comparar duas avaliações (lado a lado, slider, sobreposição);
- excluir foto ou avaliação removendo de fato os blobs;
- fotos sem EXIF/GPS e nunca saindo do aparelho sem ação explícita;
- backup pergunta se inclui fotos (padrão: não); backup sem fotos não
  contém nenhum dado binário de foto; restauração mescla e é idempotente;
- funciona 100% offline (depois da primeira carga);
- migrações de banco (3→4) e de backup (5→6) presentes e registradas.

## 13. Futuro (fora do MVP)

- sincronização via API e fila de saída (seção 6.2);
- compartilhamento explícito com professor/treinador (com escolha do que
  compartilhar, validade e revogação);
- análise local de enquadramento e alinhamento automático de fotos;
- medidas extras (tórax, abdômen, pescoço, antebraço, altura, envergadura);
- indicadores derivados (relação cintura/quadril, IMC se houver altura);
- captura por voz.

## 14. Material de referência privado

O guia em PDF usado como inspiração conceitual é material privado do
projeto: **nunca** entra no Git (a pasta `referencias/` está no
`.gitignore`), nunca é publicado nem distribuído pelo site, e nem seu
texto nem suas figuras são reproduzidos. Esta especificação, as
instruções e as ilustrações são conteúdo original do Nosso Treino.
