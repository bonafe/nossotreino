#!/usr/bin/env python3
"""Servidor HTTP local para testar os treinos (necessário por causa do fetch() dos JSONs)."""

import http.server
import os
import sys

PORTA = int(sys.argv[1]) if len(sys.argv) > 1 else 8000

os.chdir(os.path.dirname(os.path.abspath(__file__)))

handler = http.server.SimpleHTTPRequestHandler
with http.server.ThreadingHTTPServer(("localhost", PORTA), handler) as httpd:
    print(f"Servindo em http://localhost:{PORTA} (Ctrl+C para parar)")
    httpd.serve_forever()
