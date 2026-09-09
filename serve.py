#!/usr/bin/env python3
"""Static dev server that disables caching, so edits show up on reload."""

import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4180
    ThreadingHTTPServer(('127.0.0.1', port), NoCacheHandler).serve_forever()
