"""Extrai a tag `[ref:<dominio>:<id>:<categoria>]` da mensagem de crítica
(formato definido em docs/critica-comunidade-especificacao.md e montado
pelo frontend em js/critica-comunidade.js) — o resto do texto é livre, só
a tag precisa ser reconhecida sem ambiguidade."""

import re

PADRAO_REFERENCIA = re.compile(r"\[ref:([a-z0-9-]+):([a-z0-9-]+):(erro|sugestao|outro)\]")


def extrair_referencia(texto):
    encontrado = PADRAO_REFERENCIA.search(texto)
    if not encontrado:
        return None
    dominio, item_id, categoria = encontrado.groups()
    return {"dominio": dominio, "id": item_id, "categoria": categoria}
