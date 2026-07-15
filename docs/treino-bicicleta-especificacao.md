# Especificação — Treino de Bicicleta genérico

## 1. Objetivo

Hoje o treino de bicicleta (`treino_bicicleta_15_minutos_azul_vermelho.html`) tem os
parâmetros (duração total, tempo em cada intensidade) fixos no código. Esta
especificação define como transformar o treino em um "motor" genérico, que
recebe os parâmetros de fora (arquivo JSON), e como criar um menu que lista os
treinos disponíveis para o usuário escolher antes de começar.

## 2. Parâmetros configuráveis

Cada treino de bicicleta passa a ser descrito por 5 parâmetros:

| Campo (PT-BR)             | Chave no JSON            | Tipo               | Exemplo |
|----------------------------|---------------------------|--------------------|---------|
| Séries                     | `series`                  | inteiro             | `10`    |
| Tempo de Estímulo          | `tempoEstimuloSegundos`   | inteiro (segundos)  | `60`    |
| Recuperação                | `tempoRecuperacaoSegundos`| inteiro (segundos)  | `30`    |
| Intensidade do Estímulo    | `intensidadeEstimulo`     | `"leve"` \| `"maxima"` | `"maxima"` |
| Intensidade Recuperação    | `intensidadeRecuperacao`  | `"leve"` \| `"maxima"` | `"leve"` |

Um "ciclo" (série) é sempre `Recuperação` seguida de `Estímulo`. O treino
repete esse ciclo `series` vezes. A duração total é:

```
duração total (s) = series * (tempoEstimuloSegundos + tempoRecuperacaoSegundos)
```

A primeira recuperação do treino funciona como aquecimento (mesmo comportamento
que a versão fixa de 15 minutos, que começava em intensidade baixa).

## 3. Mapeamento intensidade → estilo visual/sonoro

O motor não sabe se uma fase é "estímulo" ou "recuperação" para decidir cor e
som — quem decide é a intensidade daquela fase:

| Intensidade | Cor de fundo | Rótulo grande | Som                                   |
|-------------|--------------|----------------|----------------------------------------|
| `leve`      | Azul         | LEVE           | 3 bipes onda quadrada, agudo → grave   |
| `maxima`    | Vermelho     | MÁXIMA         | 3 bipes onda quadrada, grave → agudo   |

O subtítulo da tela mostra qual fase é essa (`Recuperação` / `Estímulo`),
enquanto a palavra grande mostra a intensidade (`LEVE` / `MÁXIMA`), já que é
isso que dita o ritmo que a pessoa deve pedalar.

## 4. Arquivo de treino (JSON)

Cada treino é um arquivo `.json` dentro da pasta `treinos-bicicleta/`, versionado
no repositório (não é dado pessoal, então não entra no `.gitignore`).

Esquema:

```json
{
  "id": "treino-1",
  "nome": "Treino 1",
  "series": 10,
  "tempoEstimuloSegundos": 60,
  "tempoRecuperacaoSegundos": 30,
  "intensidadeEstimulo": "maxima",
  "intensidadeRecuperacao": "leve"
}
```

### 4.1 Treinos definidos

| Arquivo                        | Séries | Tempo de Estímulo | Recuperação | Intensidade Estímulo | Intensidade Recuperação |
|---------------------------------|--------|--------------------|-------------|------------------------|----------------------------|
| `treinos-bicicleta/treino-1.json` | 10     | 60s                | 30s         | Máxima                 | Leve                       |
| `treinos-bicicleta/treino-2.json` | 3      | 3min (180s)         | 2min (120s) | Máxima                 | Leve                       |
| `treinos-bicicleta/treino-3.json` | 3      | 4min (240s)         | 60s         | Máxima                 | Leve                       |

### 4.2 Índice de treinos

Um arquivo `treinos-bicicleta/indice.json` lista os treinos disponíveis, para
que o menu não precise ser editado manualmente a cada novo treino adicionado:

```json
[
  { "id": "treino-1", "arquivo": "treino-1.json" },
  { "id": "treino-2", "arquivo": "treino-2.json" },
  { "id": "treino-3", "arquivo": "treino-3.json" }
]
```

Adicionar um treino novo = criar o `.json` do treino + acrescentar uma linha
nesse índice. Nenhum código HTML/JS precisa mudar.

## 5. Telas / fluxo

```
index.html
   └─> treino_bicicleta_menu.html   (lista os treinos do indice.json)
          └─> treino_bicicleta.html?treino=treino-1   (motor genérico)
```

### 5.1 Menu (`treino_bicicleta_menu.html`)

- Lê `treinos-bicicleta/indice.json`.
- Para cada entrada, busca o respectivo `.json` e mostra um cartão com:
  Nome do treino, Séries, Tempo de Estímulo, Recuperação, Intensidade do
  Estímulo, Intensidade de Recuperação.
- Cada cartão é um link para `treino_bicicleta.html?treino=<id>`.

### 5.2 Motor genérico (`treino_bicicleta.html`)

- Antigo `treino_bicicleta_15_minutos_azul_vermelho.html`, renomeado.
- Lê o parâmetro de query `?treino=<id>`.
- Busca `treinos-bicicleta/<id>.json` (via `fetch`) e usa os 5 campos para
  calcular fases, tempos e o mapeamento de intensidade descrito na seção 3.
- Se não houver `treino` na URL ou o `fetch` falhar, mostra uma mensagem de
  erro com link de volta para o menu (não assume mais um treino fixo).

## 6. Observação sobre hospedagem

O motor passa a depender de `fetch()` para carregar o JSON do treino. Isso
exige que os arquivos sejam servidos por HTTP (GitHub Pages, `python3
serve.py`, etc.). Abrir o `.html` diretamente do disco (`file://`) bloqueia
o `fetch` de arquivos locais no Chrome/Edge por causa de CORS — deixar essa
limitação documentada no rodapé do menu.

Para testar localmente, use o script `serve.py` (stdlib, sem dependências):

```
python3 serve.py        # sobe em http://localhost:8000
python3 serve.py 8934   # porta customizada
```

## 7. Fora de escopo

- Intensidades além de `leve`/`maxima` (ex.: "moderada") — não usadas em
  nenhum dos 3 treinos definidos, não implementadas agora.
- Edição dos treinos pela interface (os `.json` são editados manualmente).
