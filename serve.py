#!/usr/bin/env python3
"""Static dev server that disables caching, so edits show up on reload.

Port comes from the PORT environment variable when set (that is how the
preview harness assigns a free port), then from argv, then the default.
"""

import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

DEFAULT_PORT = 4181


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()


def resolve_port():
    from_env = os.environ.get('PORT')
    if from_env:
        return int(from_env)
    if len(sys.argv) > 1:
        return int(sys.argv[1])
    return DEFAULT_PORT


if __name__ == '__main__':
    port = resolve_port()
    print(f'serving on http://127.0.0.1:{port}', flush=True)
    ThreadingHTTPServer(('127.0.0.1', port), NoCacheHandler).serve_forever()
