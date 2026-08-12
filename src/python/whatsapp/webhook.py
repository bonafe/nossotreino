#!/usr/bin/env python3
"""Esqueleto do webhook do WhatsApp Business Cloud API (Meta) — recebe as
mensagens de feedback disparadas pelo botão de crítica da biblioteca (ver
docs/critica-comunidade-especificacao.md) e extrai a tag de referência
(`[ref:<dominio>:<id>:<categoria>]`) de cada mensagem recebida.

Ainda não fala com nenhum banco real nem dispara nenhuma ação de verdade
— armazenamento.salvar_feedback e acoes.disparar_proxima_acao são só
stubs (ver TODOs neles).

Uso:
    uvicorn webhook:app --reload --port 8001

Configuração (.env, nunca commitado — ver .env.example):
    WHATSAPP_VERIFY_TOKEN  — combinado com a Meta no cadastro do app
    WHATSAPP_ACCESS_TOKEN  — token da Cloud API (não usado ainda: só
                             necessário quando o bot também responder)
"""

import os

from dotenv import load_dotenv
from fastapi import FastAPI, Request, Response

from acoes import disparar_proxima_acao
from armazenamento import salvar_feedback
from referencia import extrair_referencia

load_dotenv()
VERIFY_TOKEN = os.environ.get("WHATSAPP_VERIFY_TOKEN", "")
app = FastAPI()


@app.get("/webhook")
def verificar(request: Request):
    """Handshake de verificação (spec da Meta): confirma que o dono do
    endpoint conhece o token combinado no cadastro do app."""
    params = request.query_params
    if params.get("hub.mode") == "subscribe" and params.get("hub.verify_token") == VERIFY_TOKEN:
        return Response(content=params.get("hub.challenge", ""), media_type="text/plain")
    return Response(status_code=403)


@app.post("/webhook")
async def receber(request: Request):
    payload = await request.json()
    texto = _extrair_texto_da_mensagem(payload)
    if texto is None:
        return {"status": "ignorado"}

    feedback = {"texto": texto, "referencia": extrair_referencia(texto)}
    salvar_feedback(feedback)
    disparar_proxima_acao(feedback)
    return {"status": "recebido"}


def _extrair_texto_da_mensagem(payload):
    """entry[].changes[].value.messages[0].text.body — formato da Cloud API."""
    try:
        return payload["entry"][0]["changes"][0]["value"]["messages"][0]["text"]["body"]
    except (KeyError, IndexError, TypeError):
        return None
