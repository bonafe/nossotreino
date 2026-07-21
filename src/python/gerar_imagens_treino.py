#!/usr/bin/env python3
"""CLI para gerar imagens de exercício e de alongamento (biblioteca + plano
de treino) via API de imagens da OpenAI.

Uso:
    python3 gerar_imagens_treino.py \\
        --biblioteca ../../biblioteca-exercicios/biblioteca-exercicios.json \\
        --plano ../../dados/treino-bonafe-v1.json \\
        --saida ../../biblioteca-exercicios/imagens \\
        [--categoria ambas|exercicios|alongamentos] \\
        [--treino-id treino-a] [--treino-alongamento-id mobilidade-quadril-pos-treino] \\
        [--genero ambos|masculino|feminino] \\
        [--tamanho 1024x1024] [--qualidade auto] [--fundo auto] \\
        [--limite N] [--dry-run]
"""

import argparse
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

from openai_imagens import GENEROS_VALIDOS, gerar_imagem_exercicio

DIRETORIO_SCRIPT = Path(__file__).resolve().parent

# `--saida` é sempre o diretório-base `biblioteca-exercicios/imagens/` — cada
# categoria grava na sua própria subpasta, já que os dois catálogos
# (bibliotecas.exercicios/bibliotecas.alongamentos) podem ter ids repetidos
# entre si (ver docs/especificacao-biblioteca-exercicios.md).
PASTA_POR_CATEGORIA = {
    "exercicios": "musculacao",
    "alongamentos": "alongamento",
}


def analisar_argumentos():
    parser = argparse.ArgumentParser(
        description="Gera imagens de exercício e/ou alongamento via API de imagens da OpenAI."
    )
    parser.add_argument("--biblioteca", required=True, type=Path, help="Caminho de biblioteca-exercicios.json")
    parser.add_argument("--plano", required=True, type=Path, help="Caminho do JSON do plano de treino")
    parser.add_argument(
        "--categoria",
        choices=("ambas", "exercicios", "alongamentos"),
        default="ambas",
        help="Gera só exercícios de musculação, só alongamentos, ou ambos (default)",
    )
    parser.add_argument(
        "--treino-id",
        default=None,
        help="Restringe exercícios ao treino de musculação com este id (default: todos os treinos do plano)",
    )
    parser.add_argument(
        "--treino-alongamento-id",
        default=None,
        help="Restringe alongamentos ao treino de alongamento com este id (default: todos os treinosAlongamento do plano)",
    )
    parser.add_argument(
        "--saida",
        required=True,
        type=Path,
        help="Diretório-base onde salvar as imagens (uma subpasta por categoria: musculacao/, alongamento/)",
    )
    parser.add_argument("--genero", choices=("ambos", *GENEROS_VALIDOS), default="ambos")
    parser.add_argument("--tamanho", default="1024x1024", help="Ex.: 1024x1024, 1024x1536, 1536x1024, auto")
    parser.add_argument("--qualidade", default="auto", help="low, medium, high ou auto")
    parser.add_argument("--fundo", default="auto", help="transparent, opaque ou auto")
    parser.add_argument(
        "--limite", type=int, default=None, help="Para depois de gerar N imagens novas no total (proteção de custo)"
    )
    parser.add_argument("--dry-run", action="store_true", help="Só lista o que seria gerado/pulado, sem chamar a API")
    return parser.parse_args()


def carregar_json(caminho: Path) -> dict:
    with caminho.open(encoding="utf-8") as arquivo:
        return json.load(arquivo)


def resolver_treinos(plano: dict, treino_id) -> list:
    treinos = plano.get("treinos", [])
    if treino_id is None:
        return treinos
    encontrados = [t for t in treinos if t.get("id") == treino_id]
    if not encontrados:
        sys.exit(f"Treino '{treino_id}' não encontrado no plano.")
    return encontrados


def resolver_treinos_alongamento(plano: dict, treino_alongamento_id) -> list:
    treinos = plano.get("treinosAlongamento", [])
    if treino_alongamento_id is None:
        return treinos
    encontrados = [t for t in treinos if t.get("id") == treino_alongamento_id]
    if not encontrados:
        sys.exit(f"Treino de alongamento '{treino_alongamento_id}' não encontrado no plano.")
    return encontrados


def coletar_exercicio_ids(treinos: list) -> list:
    """Um exercicioId por item + suas alternativas (cada alternativa também
    vira card próprio na interface, então também precisa de imagem),
    deduplicado preservando a primeira ordem em que aparece."""
    vistos = []
    vistos_set = set()
    for treino in treinos:
        for item in treino.get("exercicios", []):
            candidatos = [item.get("exercicioId")]
            candidatos += [alt.get("exercicioId") for alt in item.get("alternativas", [])]
            for exercicio_id in candidatos:
                if exercicio_id and exercicio_id not in vistos_set:
                    vistos_set.add(exercicio_id)
                    vistos.append(exercicio_id)
    return vistos


def coletar_alongamento_ids(treinos_alongamento: list) -> list:
    """Mesma ideia de coletar_exercicio_ids, mas para treinosAlongamento[] —
    sem alternativas, já que um treino de alongamento é sempre lista plana
    simples (ver docs/treino-alongamento-especificacao.md)."""
    vistos = []
    vistos_set = set()
    for treino in treinos_alongamento:
        for item in treino.get("alongamentos", []):
            alongamento_id = item.get("alongamentoId")
            if alongamento_id and alongamento_id not in vistos_set:
                vistos_set.add(alongamento_id)
                vistos.append(alongamento_id)
    return vistos


def generos_selecionados(genero_arg: str) -> list:
    if genero_arg == "ambos":
        return list(GENEROS_VALIDOS)
    return [genero_arg]


def gerar_para_categoria(rotulo_catalogo, ids, catalogo, pasta_saida, generos, cliente, modelo, args, contadores):
    pasta_saida.mkdir(parents=True, exist_ok=True)

    for item_id in ids:
        item = catalogo.get(item_id)
        if item is None:
            print(f"[ausente] {item_id} não existe em {rotulo_catalogo} — pulando.", file=sys.stderr)
            contadores["ausentes"] += 1
            continue

        for genero in generos:
            destino = pasta_saida / f"{item_id}__{genero}.png"
            nome_relativo = f"{pasta_saida.name}/{destino.name}"

            if destino.exists():
                print(f"[já existe] {nome_relativo}")
                contadores["puladas"] += 1
                continue

            # Conta tentativa (sucesso ou falha), não só sucesso — se a API
            # estiver rejeitando tudo (limite de faturamento, chave
            # inválida etc.), --limite ainda precisa parar rápido em vez de
            # esgotar a lista inteira tentando de novo pra cada item.
            if args.limite is not None and contadores["tentativas"] >= args.limite:
                print(f"[limite atingido] {nome_relativo} não gerada nesta execução.")
                continue

            if args.dry_run:
                print(f"[geraria] {nome_relativo}")
                contadores["tentativas"] += 1
                continue

            contadores["tentativas"] += 1
            try:
                imagem_bytes = gerar_imagem_exercicio(
                    item,
                    genero,
                    tamanho=args.tamanho,
                    qualidade=args.qualidade,
                    fundo=args.fundo,
                    modelo=modelo,
                    cliente=cliente,
                )
                destino.write_bytes(imagem_bytes)
                print(f"[gerada] {nome_relativo}")
                contadores["geradas"] += 1
            except Exception as erro:
                print(f"[falha] {nome_relativo}: {erro}", file=sys.stderr)
                contadores["falhas"] += 1


def main():
    args = analisar_argumentos()
    load_dotenv(DIRETORIO_SCRIPT / ".env")

    biblioteca = carregar_json(args.biblioteca)
    plano = carregar_json(args.plano)

    generos = generos_selecionados(args.genero)
    args.saida.mkdir(parents=True, exist_ok=True)

    cliente = None
    modelo = os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-1")
    if not args.dry_run:
        chave = os.environ.get("OPENAI_API_KEY")
        if not chave:
            sys.exit(
                "OPENAI_API_KEY não encontrada. Copie src/python/.env.example para "
                "src/python/.env e preencha a chave antes de rodar sem --dry-run."
            )
        from openai import OpenAI

        cliente = OpenAI(api_key=chave)

    contadores = {"geradas": 0, "puladas": 0, "ausentes": 0, "falhas": 0, "tentativas": 0}

    if args.categoria in ("ambas", "exercicios"):
        exercicios_biblioteca = biblioteca.get("bibliotecas", {}).get("exercicios", {})
        treinos = resolver_treinos(plano, args.treino_id)
        exercicio_ids = coletar_exercicio_ids(treinos)
        gerar_para_categoria(
            "bibliotecas.exercicios",
            exercicio_ids,
            exercicios_biblioteca,
            args.saida / PASTA_POR_CATEGORIA["exercicios"],
            generos,
            cliente,
            modelo,
            args,
            contadores,
        )

    if args.categoria in ("ambas", "alongamentos"):
        alongamentos_biblioteca = biblioteca.get("bibliotecas", {}).get("alongamentos", {})
        treinos_alongamento = resolver_treinos_alongamento(plano, args.treino_alongamento_id)
        alongamento_ids = coletar_alongamento_ids(treinos_alongamento)
        gerar_para_categoria(
            "bibliotecas.alongamentos",
            alongamento_ids,
            alongamentos_biblioteca,
            args.saida / PASTA_POR_CATEGORIA["alongamentos"],
            generos,
            cliente,
            modelo,
            args,
            contadores,
        )

    print(
        f"\nResumo: {contadores['geradas']} geradas, {contadores['puladas']} já existiam, "
        f"{contadores['ausentes']} id ausente na biblioteca, {contadores['falhas']} falharam."
    )


if __name__ == "__main__":
    main()
