# Especificação — Apoio ao projeto (Pix)

## 1. Objetivo e princípio central

Hoje a seção de apoio existe só em [index.html](../index.html), com Pix
"a definir" e um link morto pro GitHub Sponsors. Dentro do sistema — onde
a pessoa de fato treina — não existe nenhum pedido de apoio.

Princípio que guia toda esta spec:

> O usuário conhece o projeto → faz alguns treinos → percebe que é
> gratuito de verdade → só então recebe um pedido discreto de
> contribuição.

Consequências diretas:

- **Nunca** um pop-up de apoio antes de entrar no sistema ou antes do
  primeiro treino.
- O pedido é sempre dispensável num toque, nunca bloqueia nada.
- Fora do gatilho pós-treino (seção 4), apoio é só um link discreto —
  nunca inundar a tela com isso.

### 1.1 Compatibilidade com uma futura versão com servidor

Existe um plano (fora de escopo por ora, seção 7) de no futuro oferecer
uma versão com servidor — sincronização de plano/histórico entre
aparelhos em vez de só `localStorage` — que será **paga**. Decisões já
tomadas sobre como isso convive com os princípios de hoje:

- **Mesma marca, mesmo repositório.** `nossotreino.com.br` continua
  sendo o produto — não haverá um site/marca separado pro serviço com
  servidor. O código do servidor, quando existir, entra neste mesmo
  repositório, sob a mesma licença AGPL-3.0 (qualquer um pode se
  auto-hospedar de graça; o que se cobra é a conveniência de hospedagem
  pronta, não o software).
- **O uso local nunca deixa de ser gratuito.** A sincronização com
  servidor será uma camada **opcional** por cima do que já existe — nunca
  uma substituição, nunca uma condição pra usar o que já funciona hoje
  (importar dados, treinar, ver histórico, tudo via `localStorage`).
- **Por isso os textos absolutos de `index.html` foram escopados pro "uso
  local"** em vez de prometerem "isso nunca vai ter servidor/custo, nunca,
  sob nenhuma circunstância" — que ficaria factualmente falso quando a
  versão com servidor existir. Ex.: "Gratuito" e "Seus dados são só seus"
  (seção de princípios) e a nota final da seção "Privacidade" deixam
  explícito que qualquer recurso futuro com servidor será opcional e não
  muda o uso local. Isso é uma correção de precisão, não uma mudança de
  direção — o princípio continua o mesmo, só a frase ficou exata.
- Nenhum detalhe da versão com servidor (preço, prazo, recursos) é
  anunciado publicamente ainda — os textos só evitam prometer algo que
  se tornaria falso, sem anunciar o que ainda não existe.

## 2. Meio de contribuição: só Pix

Decisão (confirmada): **sem GitHub Sponsors**. Só Pix. Isso simplifica a
spec original (sem níveis em dólar, sem "apoiar mensalmente" via
Sponsors).

### 2.1 Conteúdo que só Bonafé pode fornecer

Esta spec **não** inclui lógica pra montar um payload Pix (BR Code/EMV) a
partir de chave + valor — implementar isso errado gera um QR que falha
na validação do banco de quem for pagar, e é um instrumento de
pagamento, não algo pra reinventar. Em vez disso:

- Bonafé gera, no próprio app do banco/PSP, uma ou mais strings **"Pix
  copia e cola"** prontas (uma pra cada valor sugerido, mais uma de valor
  livre — seção 2.2) e cola essas strings literais num arquivo de dados
  do site (ex. `js/dados-apoio.js`, um objeto simples `{ valor: "...",
  payload: "00020126..." }[]`).
- O código só **exibe** essas strings: botão de copiar (texto literal
  pra `navigator.clipboard`) e QR Code gerado a partir delas — nunca
  constrói, calcula ou modifica o payload.

### 2.2 Valores sugeridos

Botões de valor são só uma forma de trocar **qual QR/payload já pronto**
está sendo exibido (não preenchem nada dinamicamente):

- R$ 5
- R$ 10
- R$ 25
- R$ 50
- Valor livre (payload sem valor embutido, quem paga digita no app do
  banco)

Cada opção = uma string "copia e cola" diferente, fornecida por Bonafé
(seção 2.1) em `js/dados-apoio.js`. Uma opção sem `payload` (ainda `null`)
fica oculta até existir a string real — hoje é o caso só do "Valor
livre", os quatro valores fixos (5/10/25/50) já estão preenchidos.

### 2.3 QR Code: gerado no navegador, lib vendorizada

Mesmo padrão já usado pra `d3.v7.min.js`/`webtorrent.min.js`: uma lib de
geração de QR Code sem dependências (ex.
[`davidshimjs/qrcodejs`](https://github.com/davidshimjs/qrcodejs), MIT)
vendorizada na raiz como `qrcode.min.js`, sem CDN. O QR é gerado
client-side a partir da string "copia e cola" (seção 2.1) — trocar a
chave/valor no futuro é só trocar a string em `js/dados-apoio.js`, o QR
se atualiza sozinho, sem precisar gerar imagem nenhuma à mão.

### 2.4 Botão de copiar

Um toque, sempre — nunca deixar só o texto da chave pra copiar
manualmente:

```js
navigator.clipboard.writeText(payloadAtual)
```

Com fallback visual "Copiado!" por ~2s (mesmo espírito dos toasts já
usados em `sistema.js`) e, se `navigator.clipboard` não existir
(contexto inseguro/navegador antigo), um `<input readonly>` com o texto
selecionável como reserva — nunca falhar silenciosamente.

## 3. Onde o pedido aparece

### 3.1 `index.html` — painel completo (já existe, expandir)

A seção "Apoie o projeto" (hoje só um parágrafo + Pix "a definir" + link
morto) vira o painel completo:

- QR Code + botão de copiar (seção 2.3/2.4).
- Botões de valor sugerido (seção 2.2).
- Explicação concreta do destino (lista fixa, só itens que realmente
  existem):
  - manutenção do site e do domínio;
  - criação e revisão da biblioteca de exercícios;
  - imagens didáticas de execução;
  - testes em celulares e navegadores;
  - melhorias de acessibilidade;
  - desenvolvimento de novos tipos de treino.
- Nova seção "Quem faz o Nosso Treino" (seção 5), logo abaixo ou acima do
  painel de apoio.

`id="apoio"` na section, pra permitir link `index.html#apoio` a partir de
dentro do sistema (seção 3.2/3.3).

### 3.2 Link discreto no menu principal (`sistema.html`)

Um item simples "❤️ Apoiar o Nosso Treino" — mesmo estilo visual dos
outros itens de link da tela (perto da engrenagem de configurações ou no
rodapé do card "Meus Treinos", ao lado de "Carregar/atualizar dados do
treino"). Linka pra `index.html#apoio`. Sempre visível, sem gatilho nem
contador — é só um caminho permanente pra quem quiser apoiar por conta
própria a qualquer momento.

### 3.3 Banner pós-treino (o principal ponto de conversão)

Aparece na tela de conclusão de um treino, **quando o gatilho da seção 4
disser que deve aparecer**. Não é um overlay bloqueante — um card
dispensável dentro da própria tela de conclusão, abaixo do resumo:

```
Você já concluiu {total} treinos com o Nosso Treino 🎉
O sistema é gratuito, aberto e não vende seus dados. Se ele está
te ajudando, uma contribuição via Pix já ajuda a manter o projeto.

[Apoiar com Pix →]     Agora não     Não mostrar novamente
```

`{total}` é a soma dos três históricos (seção 4.1). "Apoiar com Pix" leva
pra `index.html#apoio`. "Agora não" só fecha o card (reaparece no próximo
gatilho natural, seção 4.2). "Não mostrar novamente" grava a
dispensa permanente (seção 4.3) — visualmente menor/secundário, não
compete com os outros dois.

Aparece nas três telas de conclusão:

- `treino_execucao.html` (`#concluido`, seção 8.7 de
  [treino-exercicios-especificacao.md](./treino-exercicios-especificacao.md)).
- `treino_alongamento.html` (`#concluido`, seção 5 de
  [treino-alongamento-especificacao.md](./treino-alongamento-especificacao.md)).
- `treino_bicicleta.html` — aqui não existe uma seção `#concluido`
  separada (o estado "fim" já usa a mesma tela, `body.fim`, seção 3 de
  [treino-bicicleta-especificacao.md](./treino-bicicleta-especificacao.md));
  o banner é inserido dentro da mesma tela quando `info.phase === "fim"`.

Implementado por um módulo compartilhado, `js/apoio.js` — mesma ideia de
`js/detalhes-modal.js`: um `deveExibirPedidoApoio()` (lógica da seção 4)
e um `renderizarPedidoApoio(containerEl)` (monta o HTML do banner acima e
liga os três botões), chamado pelas três telas assim que a
sessão é marcada concluída.

## 4. Gatilho e cadência

### 4.1 Contador: soma dos três pilares

```js
total = historico.sessaoBicicleta.v1.length
      + historico.sessaoMusculacao.v1.length
      + historico.sessaoAlongamento.v1.length
```

Qualquer sessão concluída, em qualquer um dos três fluxos, conta —
decisão confirmada (não é só musculação).

### 4.2 Quando mostrar

Novas chaves em `localStorage` (ver seção 6):

| Chave | Conteúdo |
|---|---|
| `apoio.ultimaExibicaoContador.v1` | `total` (seção 4.1) no momento em que o banner foi mostrado pela última vez — `null` se nunca foi mostrado |
| `apoio.ultimaExibicaoData.v1` | ISO 8601 de quando foi mostrado pela última vez — `null` se nunca |
| `apoio.dispensadoPermanentemente.v1` | `true` depois de "Não mostrar novamente" — nunca mais mostra |

Regra (`deveExibirPedidoApoio()`):

1. Se `apoio.dispensadoPermanentemente.v1` é `true` → **não** mostra.
2. Se `apoio.ultimaExibicaoData.v1` é `null` (nunca mostrado) → mostra
   quando `total >= 3`.
3. Senão (já mostrado antes) → mostra de novo quando
   `total - apoio.ultimaExibicaoContador.v1 >= 10` **ou**
   `diasDesde(apoio.ultimaExibicaoData.v1) >= 30` (o que vier primeiro).

Ao mostrar (em qualquer um dos casos acima), grava
`apoio.ultimaExibicaoContador.v1 = total` e
`apoio.ultimaExibicaoData.v1 = new Date().toISOString()` imediatamente —
mesmo que a pessoa dispense com "Agora não" logo em seguida (o
cooldown já reinicia a partir da exibição, não da dispensa).

### 4.3 "Não mostrar novamente"

Grava `apoio.dispensadoPermanentemente.v1 = true`. Sem UI pra reverter
isso por enquanto (fora de escopo, seção 7) — quem se arrepender pode
apoiar a qualquer momento pelo link fixo do menu (seção 3.2).

## 5. "Quem faz o Nosso Treino" (`index.html`)

Nova seção, texto fornecido por Bonafé:

> **Quem faz o Nosso Treino?**
>
> Sou Bonafé, programador desde 2000. Quero fazer software que ajude as
> pessoas de verdade — o Nosso Treino nasceu disso: acredito que
> organizar e acompanhar treino não deveria depender de mensalidade,
> anúncio ou venda de dados.

Decisão (confirmada): só texto por enquanto, sem foto/avatar nem links
pra outros perfis — mais simples de manter, dá pra adicionar depois.

## 6. Armazenamento local

Três chaves novas em `js/storage.js` (`TreinosStorage.chaves`), seguindo
a convenção de
[armazenamento-local-especificacao.md](./armazenamento-local-especificacao.md#2-convenção-de-chaves):

| Chave (sem prefixo) | Conteúdo |
|---|---|
| `apoio.ultimaExibicaoContador.v1` | Inteiro — `total` de treinos concluídos na última exibição do banner, ou ausente/null se nunca exibido |
| `apoio.ultimaExibicaoData.v1` | ISO 8601 da última exibição, ou ausente/null |
| `apoio.dispensadoPermanentemente.v1` | Booleano — `true` depois de "Não mostrar novamente" |

Não entram em `TreinosStorage.montarBackup()`/`restaurarBackup()` — é
preferência de UI local ao aparelho, não dado de treino (mesmo
tratamento hoje dado a `preferencias.generoImagem.v1`, que também fica de
fora do backup).

## 7. Fora de escopo (por ora)

- **Meta mensal com valor arrecadado** ("Meta mensal: R$ 300 — Recebido:
  R$ 85"): exige saber quanto foi recebido de fato, o que não dá pra
  automatizar sem integração com o Pix/banco (fora do alcance de um site
  estático sem backend). Documentado aqui como direção futura — quando
  houver esse dado (atualizado à mão, por exemplo), cabe uma seção
  parecida no painel de apoio.
- Botão de "reverter" o "Não mostrar novamente" pela interface.
- Qualquer meio de apoio além de Pix (GitHub Sponsors, APOIA.se, etc.) —
  decisão explícita de não usar por ora.
- Link de pagamento com valor aberto (Mercado Pago etc.) além do Pix
  "copia e cola" — pode entrar depois, mesma lógica da seção 2.1 (Bonafé
  fornece o link pronto, o código só exibe).
- **Versão com servidor** (sincronização de plano/histórico entre
  aparelhos, paga) — só a compatibilidade de princípios/texto foi
  resolvida por enquanto (seção 1.1). Arquitetura, preço e prazo ainda
  não foram desenhados.
