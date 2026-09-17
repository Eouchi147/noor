#!/usr/bin/env python3
"""Put one file on the house's shelf (Vercel Blob) from a Mac, with no node.

    python3 blobput.py put <local file> <pathname>      prints the public URL

The twin of tools/reels/blob.mjs, for the one machine that renders the films
and has no node and no npm: the owner's Mac. Same store, same rule (a fixed
pathname, no random suffix, overwrite allowed, one year of cache), so a film
put here and a reel put by the reels workflow sit on one shelf under one
naming law, and a re-render keeps its URL.

WHAT IT SENDS, and why it is exactly this. The request is the one
@vercel/blob 2.8.0 makes for put() without multipart (read out of the
package's dist on 17 September 2026, src/api.ts and src/put.ts):

    PUT https://vercel.com/api/blob/?pathname=<the pathname, url encoded>
    authorization:            Bearer <the token>
    x-api-version:            12
    x-vercel-blob-store-id:   <the store id, the fourth piece of the token>
    x-vercel-blob-access:     public
    x-content-type:           <by extension>
    x-add-random-suffix:      0
    x-allow-overwrite:        1
    x-cache-control-max-age:  31536000
    body: the file's bytes

and the answer is JSON with "url". Under 50 MB a single PUT is what the SDK
does too; publish-shorts.sh never hands this anything larger.

THE TOKEN. It is read from BLOB_READ_WRITE_TOKEN in the environment, the
owner's own shell, and goes to curl on its standard input as a config line
(-K -), never on a command line where `ps` would show it, never into a file,
never printed. curl is used rather than urllib because curl on a Mac trusts
the system keychain, while a python.org Python trusts nothing until its
certificate script has been run, and that is not a thing the owner should
have to know at midnight.

With BLOB_FAKE_DIR set the file is copied there and a file:// URL is
printed, exactly as blob.mjs does for the tests; nothing else should set it.
"""
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.parse

#  VERCEL_BLOB_API_URL is the SDK's own override name; the tests point it at
#  a local server that records what arrived. Nothing else sets it.
API = (os.environ.get("VERCEL_BLOB_API_URL") or "https://vercel.com/api/blob").rstrip("/") + "/"
API_VERSION = "12"
TYPES = {".mp4": "video/mp4", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
         ".json": "application/json", ".png": "image/png", ".txt": "text/plain"}
MAX_BYTES = 52428800
TRIES = 4


def store_id(token):
    """the fourth underscore piece of a read write token, the way the SDK
    reads it (vercel_blob_rw_<store>_<secret>); "" when the token has no
    such shape, and the server then says so itself"""
    parts = token.split("_")
    return parts[3] if len(parts) > 3 else ""


def content_type(pathname):
    return TYPES.get(os.path.splitext(pathname)[1].lower(), "application/octet-stream")


def put(local, pathname):
    fake = os.environ.get("BLOB_FAKE_DIR")
    if fake:
        dest = os.path.join(fake, pathname)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        shutil.copyfile(local, dest)
        return "file://" + dest
    token = os.environ.get("BLOB_READ_WRITE_TOKEN", "")
    if not token:
        raise SystemExit("BLOB_READ_WRITE_TOKEN is not set. Export it first.")
    if not os.path.isfile(local):
        raise SystemExit("no such file: " + local)
    size = os.path.getsize(local)
    if size > MAX_BYTES:
        raise SystemExit("%s is %d bytes, over the 50 MB ceiling this sends in one request" % (local, size))
    if not shutil.which("curl"):
        raise SystemExit("curl not found on PATH.")
    url = API + "?" + urllib.parse.urlencode({"pathname": pathname})
    #  everything but the token is an ordinary argument; the token rides in
    #  on standard input as a curl config line and is never on the command line
    config = 'header = "authorization: Bearer %s"\n' % token
    args = ["curl", "-sS", "-K", "-", "-X", "PUT", url,
            "-H", "x-api-version: " + API_VERSION,
            "-H", "x-vercel-blob-store-id: " + store_id(token),
            "-H", "x-vercel-blob-access: public",
            "-H", "x-content-type: " + content_type(pathname),
            "-H", "x-add-random-suffix: 0",
            "-H", "x-allow-overwrite: 1",
            "-H", "x-cache-control-max-age: 31536000",
            #  the SDK sends a bare byte body with no content-type of its own
            #  (the stored type travels in x-content-type); curl would add a
            #  form type and an Expect line by itself, so both are switched off
            "-H", "content-type:",
            "-H", "Expect:",
            "--data-binary", "@" + local,
            "-w", "\n%{http_code}"]
    last = ""
    for attempt in range(1, TRIES + 1):
        r = subprocess.run(args, input=config, capture_output=True, text=True)
        out = r.stdout.rstrip("\n")
        body, _, code = out.rpartition("\n")
        if r.returncode != 0:
            last = "curl: " + (r.stderr.strip() or ("exit " + str(r.returncode)))
        elif code.startswith("2"):
            try:
                doc = json.loads(body)
            except ValueError:
                raise SystemExit("the shelf answered 2xx without JSON: " + body[:200])
            if not doc.get("url"):
                raise SystemExit("the shelf answered without a url: " + body[:200])
            return doc["url"]
        elif code in ("500", "502", "503", "504", "429"):
            last = "HTTP " + code + ": " + body[:200]
        else:
            #  a 4xx other than rate limiting is final: a wrong token, a bad
            #  pathname, a store that is not there. Retrying it changes nothing.
            raise SystemExit("the shelf refused (HTTP %s): %s" % (code, body[:300]))
        if attempt < TRIES:
            time.sleep(2 * attempt)
    raise SystemExit("upload failed after %d tries: %s" % (TRIES, last))


def probe():
    """Ten seconds instead of fourteen minutes.

    The first real run made all twenty two delivery copies (fourteen minutes
    of ffmpeg) and only then discovered that not one upload would be
    accepted, because the answer from the shelf was never looked at until
    the first file was already encoded. This sends twelve bytes to
    reels/__probe.txt and says plainly what came back, so a wrong or expired
    key is known before any work is done. publish-shorts.sh calls it first;
    it is also worth running alone."""
    import tempfile
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as f:
        f.write("noor probe\n")
        tmp = f.name
    try:
        url = put(tmp, "reels/__probe.txt")
    finally:
        try:
            os.unlink(tmp)
        except OSError:
            pass
    print("SHELF OK   " + url)


def main(argv):
    if len(argv) == 4 and argv[1] == "put":
        print(put(argv[2], argv[3]))
        return 0
    if len(argv) == 2 and argv[1] == "probe":
        probe()
        return 0
    print("blobput.py put <local file> <pathname>\nblobput.py probe", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
