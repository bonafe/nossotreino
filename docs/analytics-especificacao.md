# Especificação — Analytics de uso (Google Analytics, opt-in)

## 1. Objetivo e princípio central

O Nosso Treino promete, em `index.html` (seção "Privacidade"), que o
plano de treino, o histórico de execução e o cadastro de aluno nunca
saem do navegador de quem usa. Essa promessa continua valendo sem
exceção. Separado dela, o projeto precisa de uma forma de saber quantas
pessoas usam o site e quais páginas usam mais, pra entender como o
sistema está indo — isso é resolvido com Google Analytics (GA4), mas
só depois de autorização explícita da pessoa, nunca por padrão.

Consequência direta de modelagem: **dado de domínio (aluno/plano/histórico)
e estatística de uso são dois mecanismos completamente separados**,
endereçados por armazenamentos diferentes (ver seção 3) — um nunca
alimenta o outro.

## 2. O que é coletado e o que nunca é

- **Coletado (só com autorização):** visitas de página padrão do GA4 —
  qual página foi aberta, referência de origem, tipo de dispositivo. Não
  há eventos customizados nesta versão (ex.: "treino criado", "exercício
  substituído") — só o pageview automático do `gtag.js`.
- **Nunca coletado, com ou sem autorização:** nome/id de aluno, plano de
  treino, histórico de séries/sessões, qualquer conteúdo do IndexedDB
  (`js/storage.js`). O script do GA não tem acesso a esses dados —
  simplesmente não são passados a ele em nenhum lugar do código.

## 3. Consentimento — `localStorage`, opt-in, uma vez só, site inteiro

`js/consentimento-analytics.js` concentra a lógica inteira: lê/grava a
chave `nossoTreinoConsentimentoAnalytics` em `localStorage` (valores
`"aceito"` / `"recusado"`) — **primeiro e único uso de `localStorage` no
projeto** (ver nota na seção 7 de
[armazenamento-local-especificacao.md](./armazenamento-local-especificacao.md)
sobre por que essa chave fica fora do IndexedDB).

- Nenhuma resposta ainda: mostra um banner fixo, não bloqueante
  (`.analytics-banner`, `css/componentes.css`) — o site funciona
  normalmente mesmo sem responder.
- "Aceitar": grava `"aceito"`, injeta o script `gtag.js` do Google e
  configura o Measurement ID.
- "Recusar": grava `"recusado"`, não carrega nenhum script do Google.
  Nenhuma requisição de rede sai pra domínio do Google antes disso.
- Resposta já dada (aceitou ou recusou): banner não aparece de novo em
  nenhuma página — a escolha vale pro site inteiro até a pessoa limpar
  os dados do navegador. Não há hoje uma tela pra mudar de ideia depois
  (fora de escopo desta versão, seção 7).

Como todas as páginas do site importam `js/storage.js` (via
`TreinosStorage`), e este por sua vez importa
`consentimento-analytics.js` antes do seu próprio `await` de hidratação
do banco (mesmo truque já usado por `js/versao.js`), o banner/script
aparece em todas as páginas sem precisar editar HTML/markup de cada uma
individualmente.

## 4. Por que não usar o "Consent Mode" do Google

O Consent Mode (v2) do Google carrega o `gtag.js` sempre e manda pings
"cookieless" mesmo antes da pessoa responder, ajustando o comportamento
via `gtag('consent', ...)`. Isso significa contato com servidores do
Google acontecendo antes de qualquer autorização — o oposto do que foi
decidido aqui: **nenhum script do Google é carregado, nenhuma
requisição sai, até o clique em "Aceitar"**.

## 5. Configuração do Measurement ID

`MEASUREMENT_ID` em `js/consentimento-analytics.js` aponta pra
propriedade GA4 "Nosso Treino" (fluxo web `nossotreino.com.br`, código de
fluxo `15489361107`, ID de métrica `G-BP092QVYP1`).

## 6. Service worker

`js/consentimento-analytics.js` está na lista de pré-cache do app shell
(`ARQUIVOS_PARA_CACHE` em `sw.js`), igual a qualquer outro módulo
JS/CSS local. O script externo do Google (`googletagmanager.com`) **não**
é pré-cacheado — `sw.js` só intercepta GET de mesma origem (ver seção
"Arquitetura" de `CLAUDE.md`), então, offline, a chamada ao GA
simplesmente falha silenciosamente sem quebrar a página, mesma filosofia
de falha de gravação do `TreinosStorage`.

## 7. Fora de escopo desta versão

- Eventos customizados por funcionalidade (ex.: contagem de treinos
  criados por domínio).
- Tela/link de "gerenciar preferências de analytics" pra mudar a
  resposta depois de dada — hoje só limpando dados do navegador.
- Qualquer analytics de servidor/logs (o site continua 100% estático,
  sem backend).
