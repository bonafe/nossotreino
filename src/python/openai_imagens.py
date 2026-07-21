"""Geração de imagem de exercício via API de imagens da OpenAI (gpt-image-1)."""

import base64
import re

GENEROS_VALIDOS = ("masculino", "feminino")

# Categorias de cor/raça do IBGE (branca, preta, parda, amarela, indígena),
# usadas aqui pra sortear a etnia do personagem em cada imagem gerada —
# mesmo espírito do sorteio de gênero: em vez de fixar sempre a mesma
# aparência, cada exercício/alongamento acaba representado por uma
# variedade de pessoas ao longo da biblioteca, sem escolha manual.
ETNIAS_VALIDAS = ("branca", "preta", "parda", "amarela", "indigena")

_DESCRITOR_ETNIA = {
    "branca": "branco",
    "preta": "negro",
    "parda": "pardo",
    "amarela": "asiático",
    "indigena": "indígena",
}

# `descricao` na biblioteca vem sempre estruturada assim (ver
# docs/especificacao-biblioteca-exercicios.md), o que encaixa direto nos
# dois quadros do prompt (início/fim) e resolve ambiguidades que o nome do
# equipamento sozinho não resolve — ex.: "banco reto" não diz se é deitado
# ou sentado, mas a descrição diz "deite no banco reto".
_PADRAO_DESCRICAO = re.compile(
    r"^Posição inicial:\s*(?P<inicial>.+?)\s*Movimento:\s*(?P<movimento>.+?)\s*Posição final:\s*(?P<final>.+)$",
    re.DOTALL,
)


def humanizar_id(identificador: str) -> str:
    return identificador.replace("-", " ")


def _descrever_pessoa(genero: str, etnia: str) -> str:
    artigo = "um homem" if genero == "masculino" else "uma mulher"
    descritor = _DESCRITOR_ETNIA[etnia]
    # Concordância de gênero do descritor de etnia (negro/negra, pardo/parda
    # etc.) — só "asiático"/"indígena" não variam com -o/-a de forma trivial,
    # tratados à parte.
    if genero == "feminino" and descritor.endswith("o"):
        descritor = descritor[:-1] + "a"
    return f"{artigo} {descritor}"


def montar_prompt(exercicio: dict, genero: str, etnia: str) -> str:
    """Monta o prompt de imagem a partir do nome, dos grupos musculares e da
    `descricao` do exercício na biblioteca."""
    pessoa = _descrever_pessoa(genero, etnia)
    nome = exercicio.get("nome") or exercicio.get("id", "exercício")
    grupos = exercicio.get("gruposMusculares", {}).get("principais", [])
    descricao = exercicio.get("descricao") or ""
    etapas = _PADRAO_DESCRICAO.match(descricao)

    partes = [
        f'Ilustração instrutiva de fitness, estilo flat/vetor, mostrando {pessoa} '
        f'executando o exercício "{nome}" com a forma correta.'
    ]
    if grupos:
        partes.append(f"Ênfase visual nos músculos: {', '.join(humanizar_id(g) for g in grupos)}.")

    if etapas:
        partes.append(
            "Composição em dois quadros lado a lado, mesmo personagem, roupa e ângulo nos dois. "
            f"Quadro da esquerda, posição inicial: {etapas['inicial']} "
            f"Quadro da direita, posição final: {etapas['final']} "
            f"Movimento entre os dois quadros: {etapas['movimento']}"
        )
    else:
        if descricao:
            partes.append(f"Descrição da execução: {descricao}")
        partes.append(
            "Composição em dois quadros lado a lado, mesmo personagem, roupa e "
            "ângulo nos dois: o quadro da esquerda mostra a posição inicial do "
            "movimento, o da direita mostra a posição final (ou o ponto de maior "
            "amplitude) — juntas, as duas posições devem deixar claro o que "
            "precisa ser feito."
        )

    partes.append(
        "Fundo neutro e limpo, sem texto, sem marca d'água, corpo inteiro "
        "visível em cada quadro."
    )
    return " ".join(partes)


def gerar_imagem_exercicio(
    exercicio: dict,
    genero: str,
    etnia: str,
    *,
    tamanho: str = "1024x1024",
    qualidade: str = "auto",
    fundo: str = "auto",
    modelo: str,
    cliente,
) -> bytes:
    """Gera uma imagem para o exercício e devolve os bytes do arquivo
    (PNG). `cliente` é uma instância de `openai.OpenAI` já configurada com
    a chave de API — passada de fora pra essa função não precisar saber
    de onde a chave veio (facilita reusar/testar isolado)."""
    if genero not in GENEROS_VALIDOS:
        raise ValueError(f"genero inválido: {genero!r} (use 'masculino' ou 'feminino')")
    if etnia not in ETNIAS_VALIDAS:
        raise ValueError(f"etnia inválida: {etnia!r} (use um de {ETNIAS_VALIDAS!r})")

    prompt = montar_prompt(exercicio, genero, etnia)

    resposta = cliente.images.generate(
        model=modelo,
        prompt=prompt,
        size=tamanho,
        quality=qualidade,
        background=fundo,
        n=1,
    )

    return base64.b64decode(resposta.data[0].b64_json)
