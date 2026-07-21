"""Geração de imagem de exercício via API de imagens da OpenAI (gpt-image-1)."""

import base64

GENEROS_VALIDOS = ("masculino", "feminino")


def humanizar_id(identificador: str) -> str:
    return identificador.replace("-", " ")


def montar_prompt(exercicio: dict, genero: str) -> str:
    """Monta o prompt de imagem a partir dos campos do exercício na
    biblioteca (nome, movimento, grupos musculares, equipamentos) — não
    depende de nenhum outro dicionário além do próprio registro do
    exercício, os grupos/equipamentos já vêm com id legível o bastante
    pra entrar direto no prompt (ex.: "gluteo-maximo" -> "gluteo maximo")."""
    pessoa = "um homem" if genero == "masculino" else "uma mulher"
    nome = exercicio.get("nome") or exercicio.get("id", "exercício")
    padrao_movimento = exercicio.get("movimento", {}).get("padrao")
    grupos = exercicio.get("gruposMusculares", {}).get("principais", [])
    equipamentos = [
        item.get("equipamentoId")
        for item in exercicio.get("equipamentos", {}).get("obrigatorios", [])
        if item.get("equipamentoId")
    ]

    partes = [
        f'Ilustração instrutiva de fitness, estilo flat/vetor, mostrando {pessoa} '
        f'executando o exercício "{nome}" com a forma correta.'
    ]
    if grupos:
        partes.append(f"Ênfase visual nos músculos: {', '.join(humanizar_id(g) for g in grupos)}.")
    if equipamentos:
        partes.append(f"Equipamento visível: {', '.join(humanizar_id(e) for e in equipamentos)}.")
    if padrao_movimento:
        partes.append(f"Padrão de movimento: {humanizar_id(padrao_movimento)}.")
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

    prompt = montar_prompt(exercicio, genero)

    resposta = cliente.images.generate(
        model=modelo,
        prompt=prompt,
        size=tamanho,
        quality=qualidade,
        background=fundo,
        n=1,
    )

    return base64.b64decode(resposta.data[0].b64_json)
