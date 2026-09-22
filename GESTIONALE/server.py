import http.server, socketserver, webbrowser, threading, os
from pathlib import Path
PORT=8787
ROOT=Path(__file__).resolve().parent
os.chdir(ROOT)
class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control","no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma","no-cache")
        super().end_headers()
with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
    url=f"http://127.0.0.1:{PORT}/index.html"
    print(f"DELGROSSO Gestionale: {url}")
    threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try: httpd.serve_forever()
    except KeyboardInterrupt: pass
