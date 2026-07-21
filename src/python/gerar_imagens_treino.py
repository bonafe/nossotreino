#!/usr/bin/env python3
"""CLI para gerar imagens de exercício (biblioteca + plano de treino) via
API de imagens da OpenAI.

Uso:
    python3 gerar_imagens_treino.py \\
        --biblioteca ../../biblioteca-exercicios.json \\
        --plano ../../dados/treino-bonafe-v1.json \\
        --saida ../../dados/imagens-exercicios \\
        [--treino-id treino-a] [--genero ambos|masculino|feminino] \\
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


def analisar_argumentos():
    parser = argparse.ArgumentParser(description="Gera imagens de exercício via API de imagens da OpenAI.")
    parser.add_argument("--biblioteca", required=True, type=Path, help="Caminho de biblioteca-exercicios.json")
    parser.add_argument("--plano", required=True, type=Path, help="Caminho do JSON do plano de treino")
    parser.add_argument(
        "--treino-id", default=None, help="Gera só os exercícios deste treino (default: todos os treinos do plano)"
    )
    parser.add_argument("--saida", required=True, type=Path, help="Diretório onde salvar as imagens")
    parser.add_argument("--genero", choices=("ambos", *GENEROS_VALIDOS), default="ambos")
    parser.add_argument("--tamanho", default="1024x1024", help="Ex.: 1024x1024, 1024x1536, 1536x1024, auto")
    parser.add_argument("--qualidade", default="auto", help="low, medium, high ou auto")
    parser.add_argument("--fundo", default="auto", help="transparent, opaque ou auto")
    parser.add_argument("--limite", type=int, default=None, help="Para depois de gerar N imagens novas (proteção de custo)")
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


def generos_selecionados(genero_arg: str) -> list:
    if genero_arg == "ambos":
        return list(GENEROS_VALIDOS)
    return [genero_arg]


def main():
    args = analisar_argumentos()
    load_dotenv(DIRETORIO_SCRIPT / ".env")

    biblioteca = carregar_json(args.biblioteca)
    plano = carregar_json(args.plano)

    exercicios_biblioteca = biblioteca.get("bibliotecas", {}).get("exercicios", {})
    treinos = resolver_treinos(plano, args.treino_id)
    exercicio_ids = coletar_exercicio_ids(treinos)
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

    geradas = puladas = ausentes = falhas = 0

    for exercicio_id in exercicio_ids:
        exercicio = exercicios_biblioteca.get(exercicio_id)
        if exercicio is None:
            print(f"[ausente] {exercicio_id} não existe na biblioteca — pulando.", file=sys.stderr)
            ausentes += 1
            continue

        for genero in generos:
            destino = args.saida / f"{exercicio_id}__{genero}.png"

            if destino.exists():
                print(f"[já existe] {destino.name}")
                puladas += 1
                continue

            if args.limite is not None and geradas >= args.limite:
                print(f"[limite atingido] {destino.name} não gerada nesta execução.")
                continue

            if args.dry_run:
                print(f"[geraria] {destino.name}")
                continue

            try:
                imagem_bytes = gerar_imagem_exercicio(
                    exercicio,
                    genero,
                    tamanho=args.tamanho,
                    qualidade=args.qualidade,
                    fundo=args.fundo,
                    modelo=modelo,
                    cliente=cliente,
                )
                destino.write_bytes(imagem_bytes)
                print(f"[gerada] {destino.name}")
                geradas += 1
            except Exception as erro:
                print(f"[falha] {destino.name}: {erro}", file=sys.stderr)
                falhas += 1

    print(
        f"\nResumo: {geradas} geradas, {puladas} já existiam, "
        f"{ausentes} exercicioId ausente na biblioteca, {falhas} falharam."
    )


if __name__ == "__main__":
    main()
