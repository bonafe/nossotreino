#!/usr/bin/env python3
"""Servidor HTTP local para testar os treinos (conveniência de desenvolvimento — o site não depende mais de fetch/CORS)."""

import http.server
import os
import sys

PORTA = int(sys.argv[1]) if len(sys.argv) > 1 else 8000

os.chdir(os.path.dirname(os.path.abspath(__file__)))


class SemCacheHandler(http.server.SimpleHTTPRequestHandler):
    """Desliga cache do navegador — os .json/.html/.js mudam com frequência
    durante o desenvolvimento local e o SimpleHTTPRequestHandler não manda
    nenhum Cache-Control por padrão, então o navegador pode servir uma
    versão antiga de um arquivo mesmo depois dele mudar em disco."""

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()


handler = SemCacheHandler
with http.server.ThreadingHTTPServer(("localhost", PORTA), handler) as httpd:
    print(f"Servindo em http://localhost:{PORTA} (Ctrl+C para parar)")
    httpd.serve_forever()
