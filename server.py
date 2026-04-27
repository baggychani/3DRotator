from __future__ import annotations

import argparse
import socket
import threading
import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
WEB_ROOT = ROOT / "web"
DEFAULT_PORT = 8000


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Serve the 3D image rotator web app.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=DEFAULT_PORT, type=int)
    parser.add_argument("--no-browser", action="store_true", help="Do not open the browser.")
    return parser.parse_args()


def find_open_port(host: str, preferred_port: int) -> int:
    for port in range(preferred_port, preferred_port + 50):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
            if probe.connect_ex((host, port)) != 0:
                return port

    msg = f"No open port found between {preferred_port} and {preferred_port + 49}."
    raise RuntimeError(msg)


def open_browser(url: str) -> None:
    threading.Timer(0.4, lambda: webbrowser.open(url)).start()


def main() -> None:
    args = parse_args()
    port = find_open_port(args.host, args.port)
    url = f"http://{args.host}:{port}"
    handler = partial(NoCacheHandler, directory=str(WEB_ROOT))
    server = ThreadingHTTPServer((args.host, port), handler)

    print("3D Rotator is ready.", flush=True)
    print(f"Local address: {url}", flush=True)
    print("Close this window or press Ctrl+C to stop the app.", flush=True)

    if not args.no_browser:
        print("Opening your browser automatically.", flush=True)
        open_browser(url)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
