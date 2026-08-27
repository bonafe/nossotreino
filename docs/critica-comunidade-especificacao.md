# Especificação — Crítica da comunidade sobre a biblioteca (WhatsApp)

## 1. Objetivo e princípio central

A biblioteca de exercícios e alongamentos do Nosso Treino (ver
[especificacao-biblioteca-exercicios.md](./especificacao-biblioteca-exercicios.md))
é aberta, gratuita e gerada com apoio de IA. A IA vai alucinar em alguns
casos — o retorno de quem usa é o mecanismo de correção. Isso é um
princípio central do projeto, não um detalhe de implementação (ver
`index.html`, seção "Nossos princípios"):

> A biblioteca melhora com a comunidade. Garantir pra todo mundo um
> compilado aberto de exercícios de musculação, alongamento e outras
> modalidades que venham a existir depende de quem usa avisar quando algo
> está errado ou pode melhorar.

Consequência direta de modelagem: todo item que a biblioteca expõe numa
tela precisa ter um jeito fácil de ser criticado. Esta spec descreve o
mecanismo v1 (WhatsApp) e o esqueleto do backend que vai processar essas
mensagens.

## 2. Extensibilidade — não é só musculação/alongamento

O mecanismo é parametrizado por `dominio`/`id`/`nome` — o mesmo
vocabulário já usado por `caminhoImagemExercicio`/`ligarImagemExercicio`
em `js/imagem-exercicio.js` (`"musculacao"`/`"alongamento"`, o mesmo
`dominio` das subpastas de `biblioteca-exercicios/imagens/`). Hoje só está
ligado nos dois domínios com imagem própria e tela de execução
individual — musculação e alongamento — mas nada no desenho impede
estender a cardio (`bibliotecas.cardio.modalidades`) ou a domínios
futuros.

Em particular, `classificacao.categoria` e `movimento.padrao`
(especificacao-biblioteca-exercicios.md §5.3/§5.4) já são listas abertas
de "valores sugeridos", não enums fechados — uma modalidade nova (ex.: um
passo de dança, balé/samba/salsa) entraria como um item comum de
`bibliotecas.exercicios` com uma `categoria` nova (`"danca"`), sem
mudança de schema. Adicionar o botão de crítica a uma tela desse domínio
futuro é só chamar `ligarBotaoCritica`/`criarCriticaModal` com o
`dominio` certo — não exige tocar neste módulo.

## 3. UX — quatro pontos de acesso, um único texto "💬 Relatar"

O botão é sempre rotulado **"💬 Relatar"** (verbo em português — evita o
anglicismo "Feedback" no rótulo clicável) e nunca fica solto/flutuante
sem contexto: sempre dentro do fluxo normal de botões da tela, nunca
sobreposto (`position: absolute`) a uma imagem que pode nem existir ainda.

- **Telas de lista** (`treino_musculacao_exercicios.html`, `treino_alongamento_exercicios.html`,
  via `#itemCard` de `js/paginas/treino-musculacao-exercicios.js`/`treino-alongamento-exercicios.js`):
  botão de texto+ícone (`.critica-botao`, tom neutro — mesma família visual
  de `.video-botao`) na `.item-acoes`, ao lado de "Ver progresso"/"Ver
  vídeo".
- **Lightbox de imagem** (`#imagemOverlay`/`.imagem-card`, aberto ao tocar
  na miniatura de 76×76px da lista): botão `#imagemCriticaBtn` estático
  logo abaixo da imagem ampliada — cobre o caso de "vi a imagem errada,
  quero avisar" sem precisar voltar pro card da lista.
- **Telas de execução** (`treino_execucao.html`, `treino_alongamento.html`):
  botão `#criticaBtn` (`.video-botao`) dentro da seção `#execucao`, junto
  dos outros botões de ação (ao lado de "Vídeo…") — não depende da
  imagem existir, porque é parte do fluxo de botões do card, não uma
  sobreposição nela.
- **Modal de detalhes** (`#detalhesOverlay`/`.detalhes-card`, aberto pelo
  botão ⓘ): botão `#detalhesCriticaBtn`, ao lado de "Vídeo…" — é o único
  ponto de acesso em `treino_musculacao_novo.html`/`treino_alongamento_novo.html`
  (tela de montagem de treino, que não tem card de item com imagem
  própria), e um ponto adicional nas telas de execução.

Todos os quatro reaproveitam a mesma função `ligarBotaoCritica` de
`js/critica-comunidade.js` — cada tela só precisa saber o `dominio`/`id`/`nome`
do item no momento do clique, o resto (mensagem, modal de categoria,
abertura do WhatsApp) é genérico.

O clique abre um modal de escolha de categoria (`#criticaOverlay`,
reaproveitando o padrão visual `.overlay`/`.confirm-card`/`.confirm-botoes`
já usado em `sistema.html`/`alunos.html`/`planos.html`) com três opções:
Erro, Sugestão, Outro. Escolher uma abre o WhatsApp
(`window.open(url, "_blank", "noopener")`, mesmo padrão de
`js/video-player-modal.js`).

## 4. Formato da mensagem e da tag de referência

Tag de referência — contrato entre o frontend (`js/critica-comunidade.js`)
e o backend (`src/python/whatsapp/referencia.py`):

```text
[ref:<dominio>:<id>:<categoria>]
```

- `dominio`: `musculacao` | `alongamento` (futuro: `cardio` etc.)
- `id`: `exercicioId`/`alongamentoId` (formato §3.2 de
  especificacao-biblioteca-exercicios.md — lowercase, hífen)
- `categoria`: `erro` | `sugestao` | `outro`

Regex de extração: `\[ref:([a-z0-9-]+):([a-z0-9-]+):(erro|sugestao|outro)\]`

Exemplo real: `[ref:musculacao:supino-reto-com-halter:erro]`

A tag fica sempre ao final da mensagem, isolada do texto livre que a
pessoa escrever acima dela — assim o regex continua encontrando a
referência mesmo que a mensagem seja editada antes de enviar. Mensagem
completa gerada por `construirMensagemCritica`:

```text
Feedback sobre a biblioteca do Nosso Treino

Item: Supino reto com halteres (exercício)
Categoria: Erro

Descreva aqui o que você notou ou sugere:


[ref:musculacao:supino-reto-com-halter:erro]
```

## 5. Número de WhatsApp

`NUMERO_WHATSAPP_CRITICA` em `js/critica-comunidade.js` — formato E.164
sem `+`/espaços/traços (exigido por `wa.me`).

## 6. Backend — esqueleto em `src/python/whatsapp/`

Módulo Python irmão de `src/python/gerar_imagens_treino.py` (mesma
convenção de `.env`/`.venv` locais, gitignorados — ver `.gitignore`).
Modela o formato de webhook do WhatsApp Business Cloud API (Meta): a
abordagem oficial/padrão para receber mensagens, sem simular sessão de
navegador.

- `webhook.py` — app FastAPI. `GET /webhook` faz o handshake de
  verificação da Meta (`hub.mode`/`hub.verify_token`/`hub.challenge`);
  `POST /webhook` recebe o payload de mensagem, extrai o texto e chama
  `extrair_referencia`.
- `referencia.py` — regex da seção 4.
- `armazenamento.py` — `salvar_feedback`, hoje só um `print` (**TODO**:
  gravação de verdade — arquivo? banco? planilha? — ainda não decidido).
- `acoes.py` — `disparar_proxima_acao`, hoje um stub vazio (**TODO**: o
  caso óbvio é uma crítica de categoria "erro" numa imagem virar gatilho
  pra regenerar via `gerar_imagens_treino.py` com um prompt ajustado, mas
  isso depende de decidir automático vs. revisão humana antes — por isso
  fica isolado num ponto único, pra esse fio não se espalhar pelo
  webhook).
- `requirements.txt` (`fastapi`, `uvicorn`, `python-dotenv`) e
  `.env.example` (`WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN`) —
  reais só quando existir conta Meta for Developers/WhatsApp Business.

## 7. Fora de escopo desta versão

- UI de crítica em cardio ou domínios futuros (dança etc.) — mecanismo já
  suporta, tela ainda não foi construída.
- Resposta automática pelo WhatsApp (bot conversacional).
- Moderação/triagem das mensagens recebidas.
- Gravação real em banco e disparo automático de regeneração de imagem —
  ambos permanecem `TODO` explícitos no esqueleto (seção 6).
