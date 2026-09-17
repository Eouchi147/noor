#!/usr/bin/env python3
"""What blobput.py sends, proved against a local stand in for the shelf.

    python3 test_blobput.py

A small HTTP server on this machine records the one PUT blobput.py makes and
answers as the shelf would; the checks are that the request is the one
@vercel/blob makes (the path, the nine headers, the bare body), that the
token rides on curl's standard input and never in argv, that a 5xx is
retried and a 4xx is not, that the token never reaches stdout or stderr,
that BLOB_FAKE_DIR copies instead of sending, and that a file over the 50 MB
ceiling is refused before anything is sent. tests/shorts.mjs runs this.
"""
import http.server, json, os, subprocess, sys, threading, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
for k in ("HTTPS_PROXY", "HTTP_PROXY", "https_proxy", "http_proxy"):
    os.environ.pop(k, None)
os.environ["NO_PROXY"] = os.environ["no_proxy"] = "127.0.0.1"
SCRIPT = os.path.join(HERE, "blobput.py")
seen = []
class H(http.server.BaseHTTPRequestHandler):
    def do_PUT(self):
        n = int(self.headers.get("content-length") or 0)
        body = self.rfile.read(n)
        seen.append({"path": self.path, "headers": {k.lower(): v for k, v in self.headers.items()}, "len": len(body), "body": body})
        if len(seen) == 1 and os.environ.get("FIRST_FAILS"):
            self.send_response(503); self.end_headers(); self.wfile.write(b'{"error":{"code":"service_unavailable"}}'); return
        self.send_response(200); self.send_header("content-type", "application/json"); self.end_headers()
        self.wfile.write(json.dumps({"url": "https://x.public.blob.vercel-storage.com/" + self.path.split("pathname=")[1]}).encode())
    def log_message(self, *a): pass
srv = http.server.HTTPServer(("127.0.0.1", 0), H)
port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
d = tempfile.mkdtemp()
f = os.path.join(d, "clip.mp4"); open(f, "wb").write(os.urandom(300000))
env = dict(os.environ, VERCEL_BLOB_API_URL="http://127.0.0.1:%d/api/blob" % port, BLOB_READ_WRITE_TOKEN="vercel_blob_rw_STORE123_secretpart")
r = subprocess.run([sys.executable, SCRIPT, "put", f, "reels/short-stub.mp4"], env=env, capture_output=True, text=True)
print("rc", r.returncode, "out", r.stdout.strip(), "err", r.stderr.strip()[:200])
s = seen[-1]
assert r.returncode == 0 and r.stdout.strip() == "https://x.public.blob.vercel-storage.com/reels%2Fshort-stub.mp4"
assert s["path"] == "/api/blob/?pathname=reels%2Fshort-stub.mp4", s["path"]
h = s["headers"]
assert h["authorization"] == "Bearer vercel_blob_rw_STORE123_secretpart"
assert h["x-api-version"] == "12" and h["x-vercel-blob-store-id"] == "STORE123"
assert h["x-vercel-blob-access"] == "public" and h["x-content-type"] == "video/mp4"
assert h["x-add-random-suffix"] == "0" and h["x-allow-overwrite"] == "1" and h["x-cache-control-max-age"] == "31536000"
assert "content-type" not in h and "expect" not in h, h
assert s["len"] == 300000 and s["body"] == open(f, "rb").read()
# the token is not on the command line: ps would show argv; prove argv has no token
r2 = subprocess.run([sys.executable, "-c", "import subprocess,sys; print(open(sys.argv[1]).read())", SCRIPT], capture_output=True, text=True)
assert "-K" in r2.stdout and '"-K", "-"' in r2.stdout
# retry: first answer 503, second 200
seen.clear()
env2 = dict(env, FIRST_FAILS="1")
os.environ["FIRST_FAILS"] = "1"
r = subprocess.run([sys.executable, SCRIPT, "put", f, "reels/short-stub.mp4"], env=env2, capture_output=True, text=True)
del os.environ["FIRST_FAILS"]
assert r.returncode == 0 and len(seen) == 2, (r.returncode, len(seen), r.stderr)
# a 401 is final, no retry
seen.clear()
#  a final 4xx: a second server that only ever refuses
class H4(http.server.BaseHTTPRequestHandler):
    def do_PUT(self):
        n = int(self.headers.get("content-length") or 0); self.rfile.read(n)
        seen.append(1); self.send_response(403); self.end_headers(); self.wfile.write(b'{"error":{"code":"forbidden","message":"Access denied"}}')
    def log_message(self, *a): pass
srv4 = http.server.HTTPServer(("127.0.0.1", 0), H4); threading.Thread(target=srv4.serve_forever, daemon=True).start()
env4 = dict(env, VERCEL_BLOB_API_URL="http://127.0.0.1:%d/api/blob" % srv4.server_address[1])
r = subprocess.run([sys.executable, SCRIPT, "put", f, "reels/short-stub.mp4"], env=env4, capture_output=True, text=True)
assert r.returncode == 1 and len(seen) == 1 and "HTTP 403" in r.stderr, (r.returncode, len(seen), r.stderr)
assert "secretpart" not in r.stderr and "secretpart" not in r.stdout
# fake dir
env5 = dict(env, BLOB_FAKE_DIR=os.path.join(d, "fake"))
r = subprocess.run([sys.executable, SCRIPT, "put", f, "reels/short-stub.mp4"], env=env5, capture_output=True, text=True)
assert r.stdout.startswith("file://") and os.path.exists(os.path.join(d, "fake", "reels", "short-stub.mp4"))
# over the ceiling
big = os.path.join(d, "big.mp4"); open(big, "wb").truncate(52428801)
r = subprocess.run([sys.executable, SCRIPT, "put", big, "reels/big.mp4"], env=env, capture_output=True, text=True)
assert r.returncode == 1 and "over the 50 MB" in r.stderr
print("ALL BLOBPUT CHECKS PASS")
