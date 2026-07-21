"""Geração de imagem de exercício via API de imagens da OpenAI (gpt-image-1)."""

import base64

GENEROS_VALIDOS = ("masculino", "feminino")

_DESCRICAO_PERSONAGEM = {
    "masculino": (
        "- homem adulto baseado no homem da fotografia de referência;\n"
        "- porte físico grande e forte, com aparência natural;\n"
        "- cabelo castanho escuro, curto e cacheado;\n"
        "- barba cheia grisalha, bem definida;\n"
        "- vestir camiseta esportiva ajustada em tom verde-azulado, bermuda "
        "esportiva preta e tênis de treino neutro."
    ),
    "feminino": (
        "- mulher adulta baseada na mulher da fotografia de referência;\n"
        "- corpo com proporções naturais e aparência saudável;\n"
        "- cabelos loiros escuros ou castanho-claros, ondulados/cacheados, "
        "presos parcialmente para não atrapalhar o exercício;\n"
        "- vestir regata esportiva vermelha, legging preta e tênis de treino neutro."
    ),
}

_TEMPLATE_PROMPT = """\
Crie uma imagem didática e fotorrealista para uma biblioteca de exercícios \
de musculação. Mantenha consistência visual entre todas as imagens da coleção.

PERSONAGEM: {genero_label}
{descricao_personagem}

EXERCÍCIO: {nome}
Representar o exercício com técnica biomecânica correta, incluindo:
- posicionamento correto dos pés, mãos, coluna, cabeça e articulações;
- pegada correta no equipamento;
- amplitude segura e adequada;
- alinhamento corporal natural;
- equipamento com dimensões realistas;
- musculatura corporal proporcional;
- expressão facial neutra e concentrada;
- ausência de esforço exagerado ou deformações anatômicas.

COMPOSIÇÃO:
- imagem horizontal;
- dois quadros lado a lado;
- quadro esquerdo mostrando a posição inicial;
- quadro direito mostrando a posição final ou o ponto principal do movimento;
- o mesmo personagem, roupa, equipamento, iluminação e ângulo nos dois quadros;
- corpo inteiro visível, incluindo mãos, pés e equipamento;
- câmera na altura aproximada do tronco;
- ângulo de visão que melhor demonstre a execução do exercício, preferencialmente \
lateral ou em três quartos;
- enquadramento limpo, sem partes do corpo cortadas;
- distância suficiente para compreender toda a trajetória do movimento;
- pequena seta gráfica discreta indicando a direção principal do movimento, \
somente quando ela ajudar na compreensão.

AMBIENTE:
- academia moderna, organizada e minimalista;
- fundo neutro e levemente desfocado;
- poucos equipamentos ao fundo;
- iluminação natural e uniforme de estúdio;
- contraste suficiente para separar o personagem do fundo;
- piso emborrachado;
- sem outras pessoas na cena.

ESTILO:
- fotografia profissional de instrução esportiva;
- aparência realista, não ilustrada;
- alta definição;
- anatomia humana correta;
- cores naturais;
- imagem clara e objetiva;
- sem sexualização;
- sem suor excessivo;
- sem aparência de fisiculturista extremo;
- sem logotipos ou marcas comerciais;
- sem textos, títulos, números, legendas ou marcas-d'água;
- não alterar o rosto ou a roupa entre os dois quadros."""


def montar_prompt(exercicio: dict, genero: str) -> str:
    """Monta o prompt de imagem a partir do template didático fixo (mesmo
    personagem/roupa/composição em toda a coleção), preenchendo só o gênero
    e o nome do exercício — não depende de mais nenhum campo do registro."""
    nome = exercicio.get("nome") or exercicio.get("id", "exercício")
    return _TEMPLATE_PROMPT.format(
        genero_label=genero.upper(),
        descricao_personagem=_DESCRICAO_PERSONAGEM[genero],
        nome=nome,
    )


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
