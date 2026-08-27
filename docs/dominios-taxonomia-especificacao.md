# Rascunho de visão — Taxonomia de domínios/subdomínios pela comunidade

> **Este documento é um registro de debate e direção, não uma spec
> fechada.** Diferente dos outros `docs/*-especificacao.md`, não descreve
> algo implementado nem compromete uma arquitetura, um cronograma ou uma
> decisão de produto — só mapeia o espaço de perguntas pra quando (e se)
> o projeto decidir avançar nessa direção, seguindo o mesmo princípio do
> projeto de registrar direções em `docs/` mesmo antes de existir código.

## 1. Motivação

Hoje existem dois níveis de classificação de atividade no projeto,
ambos rasos e locais:

- `DOMINIOS` (`js/dominios-biblioteca.js`) — dois domínios fixos,
  hardcoded no código: `musculacao` e `alongamento`. Cada um carrega um
  formulário completo de cadastro de exercício (nome, vídeo, grupo
  muscular...). Sem hierarquia, sem edição pelo usuário.
- `tiposAtividade` (ver
  [atividade-livre-especificacao.md](./atividade-livre-especificacao.md)) —
  árvore local, editável pelo próprio usuário, mas **só nesse
  navegador**: dois navegadores diferentes podem acabar com árvores de
  "Dança" completamente diferentes, sem nenhuma forma de comparar ou
  consolidar.

A pergunta de fundo (levantada pelo mantenedor, ver histórico de
conversa): pilates, natação, dança, artes marciais — onde entram? Dança
de salão é subdomínio de dança; salsa é subdomínio de dança de salão;
karatê é subdomínio de artes marciais. Diferentes pessoas podem
classificar o mesmo item de formas diferentes (uma escola pode ver
karatê como "luta", outra como "arte marcial tradicional", outra como
"esporte de combate"). Não existe uma resposta única e objetiva — a
pergunta é como o projeto lida com essa pluralidade.

## 2. Papel do Nosso Treino como curador vs. comunidade como fonte

O projeto já tem um mecanismo parecido pra **conteúdo** de exercício: a
crítica da comunidade (`js/critica-comunidade.js`, ver
[critica-comunidade-especificacao.md](./critica-comunidade-especificacao.md)).
Hoje é inteiramente manual — um botão abre uma mensagem de WhatsApp
pré-formatada com uma tag greppável (`[ref:dominio:id:categoria]`); do
lado do servidor, o webhook (`src/python/whatsapp/`) é um esqueleto —
`salvar_feedback` é hoje só um `print()`, sem gravação real, sem
moderação, sem consolidação automática. A correção de fato acontece fora
do sistema: alguém humano lê a mensagem e decide se edita o
`biblioteca-exercicios.json` versionado no git.

Uma árvore de domínio/subdomínio **comunitária** seria o mesmo princípio
— comunidade como fonte de sugestão, Nosso Treino como curador que
decide o que vira "oficial" — aplicado a taxonomia em vez de conteúdo de
exercício. A pergunta não é "construir do zero", é "generalizar o
mecanismo que já existe".

## 3. Perguntas em aberto

Registradas como perguntas — nenhuma tem resposta escolhida ainda:

- **Consolidação de edições conflitantes.** Se dois usuários classificam
  karatê em lugares diferentes da árvore, quem vence? Última edição?
  Votação? Um "dono" por item (quem criou decide, outros só sugerem)?
  Múltiplas árvores coexistindo, cada uma com seus seguidores, e o
  sistema mostra a mais popular?
- **Score de confiança.** Caberia atribuir um score a cada classificação,
  proporcional a quantos usuários (ou quão "confiáveis") concordam com
  ela? Como esse score se atualizaria com o tempo, e como evitaria virar
  alvo de manipulação (poucas contas concordando artificialmente entre
  si)?
- **Sincronização entre o local e o comunitário.** A árvore local de
  `tiposAtividade` (hoje 100% offline, por navegador) poderia um dia
  alimentar uma árvore comunitária? Envio unidirecional (usuário sugere
  uma posição na árvore comunitária, curador aprova, muda pra todo
  mundo) ou bidirecional (o usuário também recebe atualizações da árvore
  comunitária de volta, e precisa de alguma forma de resolver conflito
  com o que já tinha localmente)?
- **Geração da biblioteca oficial a partir da comunidade.** Hoje
  `biblioteca-exercicios.json` é escrito/curado por quem mantém o
  projeto, com apoio de IA. Se um dia esse arquivo passar a ser **gerado**
  a partir de contribuição da comunidade (não só corrigido depois de
  publicado), quem decide o que entra? É a mesma pergunta de moderação
  que já existe informalmente no fluxo de crítica via WhatsApp, mas em
  escala e automação maiores.
- **Convergência de `tiposAtividade` e `DOMINIOS`.** No dia em que a
  biblioteca de exercícios também vier de contribuição da comunidade, faz
  sentido os dois conceitos (domínio pesado de biblioteca vs. tipo leve
  de atividade cronometrada) convergirem num único modelo de
  domínio/subdomínio? Ou continuam propositalmente separados, porque um
  exige o peso de um formulário de cadastro de exercício e o outro não?
  Uma primeira ponte, só de navegação (nenhum dado convergiu, nenhuma
  pergunta acima foi respondida), já existe: `biblioteca_dominios.html`
  deixa a árvore de `tiposAtividade` navegável e, quando um nó coincide
  com um domínio real de `DOMINIOS`, manda pra `biblioteca.html`; um nó
  sem domínio abre a biblioteca vazia, pronta pra ganhar itens se um dia
  esses dois modelos convergirem de fato.

## 4. Não-escopo explícito

Nenhum compromisso de cronograma, nenhuma decisão de arquitetura de
backend/consolidação/moderação. Este documento existe pra registrar o
espaço de perguntas enquanto ele ainda está fresco na conversa — não pra
prometer quando ou como qualquer uma delas será respondida.
