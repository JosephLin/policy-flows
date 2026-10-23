"""Static dev server that tells the browser never to cache.

Plain `python3 -m http.server` lets the browser keep ES modules, so after an edit a
reload can run a new ui.js against an old scene.js. no-store makes every reload
fetch every file.
"""
import functools
import http.server
import os
import sys


class NoStore(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 5178
handler = functools.partial(NoStore, directory=os.path.dirname(os.path.abspath(__file__)))
print(f"Serving on http://localhost:{port}", flush=True)
http.server.ThreadingHTTPServer(("127.0.0.1", port), handler).serve_forever()
