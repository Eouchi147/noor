#!/usr/bin/env python3
"""A compilation goes up to YouTube, from a GitHub Actions runner.

The site's own YouTube path (api/_youtube.js) sends a two megabyte Short in
one multipart request from a Vercel function. A compilation is three hundred
megabytes, which no function may hold, so it is built and sent from a
workflow instead, with the same three values the site uses, copied by the
owner into the repository's secrets: YT_CLIENT_ID, YT_CLIENT_SECRET and
YT_REFRESH_TOKEN. The access token is minted exactly as the site mints it,
at the same token URL with the same four fields.

The upload is the resumable protocol: one request opens a session and
answers with its URI, the file goes up in pieces of thirty-two megabytes,
and a piece that fails is asked after and sent again from where the server
says it stopped. Then the thumbnail is set, and the video is put on the
playlist of its kind, made if it is not there.

What it costs. YouTube gives 10,000 units a day; videos.insert is 1,600,
thumbnails.set 50, playlists.list 1, playlists.insert 50 and
playlistItems.insert 50, so a compilation is about 1,750 and four a run are
7,000, leaving the day's Shorts their share. `--max` holds the line, and a
quotaExceeded answer stops the run cleanly: the mp4s stay as run artifacts
and the next run sends what is left.

Unlisted by default; `--public` publishes. A project that has not passed
the YouTube API audit keeps every upload private whatever it asked for, and
that is reported rather than passed off as published. The playlist step
needs the `youtube` scope, which the site's consent (upload and readonly)
does not carry; when YouTube refuses it for that reason the video is still
up and the line says what the consent lacks.

compilations.json is the ledger: name -> {video, url, date, ids, secs}. A
name on it is skipped unless --again.

    python3 yt_upload.py out/                  every <name>.mp4 with a <name>.json beside it
    python3 yt_upload.py out/names.mp4         one
    python3 yt_upload.py out/ --public --max 2
"""
import argparse, json, os, sys, time, urllib.error, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
LEDGER = os.path.join(HERE, "compilations.json")

TOKEN_URL = "https://oauth2.googleapis.com/token"
API = "https://www.googleapis.com/youtube/v3"
UPLOAD = "https://www.googleapis.com/upload/youtube/v3"
CATEGORY_EDUCATION = "27"
CHUNK = 32 * 1024 * 1024               # a multiple of 256 KiB, as the protocol asks
MAX_UPLOADS = 4                        # 4 x ~1,750 units, under the day's 10,000 with the Shorts
COST = {"insert": 1600, "thumbnail": 50, "playlists.list": 1, "playlists.insert": 50, "playlistItems.insert": 50}


def env(k):
    return (os.environ.get(k) or "").strip()


def configured():
    return bool(env("YT_CLIENT_ID") and env("YT_CLIENT_SECRET") and env("YT_REFRESH_TOKEN"))


# ---------------------------------------------------------------- HTTP

def _http(method, url, headers=None, body=None, timeout=600):
    """one request; (status, headers dict, body bytes). Tests replace HTTP."""
    req = urllib.request.Request(url, data=body, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, {k.lower(): v for k, v in r.headers.items()}, r.read()
    except urllib.error.HTTPError as e:
        return e.code, {k.lower(): v for k, v in (e.headers or {}).items()}, e.read()


HTTP = _http


def call(method, url, headers=None, body=None, tries=3, timeout=600):
    """HTTP with a wait and another try on a hiccup"""
    for attempt in range(tries):
        try:
            st, h, b = HTTP(method, url, headers, body, timeout)
        except (urllib.error.URLError, TimeoutError, OSError, ConnectionError) as e:
            if attempt < tries - 1: time.sleep(10.0 * (attempt + 1)); continue
            raise RuntimeError("no answer from %s: %s" % (url.split("?")[0], str(e)[:120]))
        if st in (500, 502, 503, 504) and attempt < tries - 1:
            time.sleep(10.0 * (attempt + 1)); continue
        return st, h, b
    return st, h, b


def jbody(b):
    try: return json.loads(b.decode("utf-8") if isinstance(b, bytes) else b)
    except (ValueError, AttributeError): return None


def reason_of(b):
    j = jbody(b) or {}
    err = j.get("error") if isinstance(j, dict) else None
    if isinstance(err, dict):
        first = (err.get("errors") or [{}])[0]
        return str(first.get("reason") or err.get("status") or ""), str(err.get("message") or "")
    return "", (b[:200].decode("utf-8", "replace") if isinstance(b, bytes) else str(b)[:200])


class Quota(Exception):
    """the day's units are spent: stop, keep the files, try tomorrow"""


class Scope(Exception):
    """the consent does not carry the scope this step needs"""


class Unconfirmed(Exception):
    """the session was opened (the units are spent, the video may well be
    on the channel) but no video id came back: the ledger keeps the session
    so the same file is not sent again without --again"""
    def __init__(self, record):
        super().__init__(record.get("why", "unconfirmed")); self.record = record


def check(st, b, what):
    if st in (200, 201): return
    reason, msg = reason_of(b)
    if "quota" in (reason + msg).lower(): raise Quota("%s: %s %s" % (what, reason, msg))
    if st == 403 and ("insufficient" in (reason + msg).lower() or "scope" in msg.lower()):
        raise Scope("%s: the consent lacks the scope (%s)" % (what, msg[:120]))
    raise RuntimeError("%s: http %s %s %s" % (what, st, reason, msg[:200]))


# ---------------------------------------------------------------- the token

def access_token():
    """minted from the refresh token, exactly as api/_youtube.js does"""
    form = urllib.parse.urlencode({"refresh_token": env("YT_REFRESH_TOKEN"), "client_id": env("YT_CLIENT_ID"),
                                   "client_secret": env("YT_CLIENT_SECRET"), "grant_type": "refresh_token"}).encode()
    st, h, b = call("POST", TOKEN_URL, {"content-type": "application/x-www-form-urlencoded"}, form, timeout=60)
    j = jbody(b) or {}
    if st != 200 or not j.get("access_token"):
        why = j.get("error_description") or j.get("error") or ("http %s" % st)
        if "invalid_grant" in str(j.get("error", "")):
            why = "invalid_grant: the consent was revoked or the OAuth app was left in Testing; consent again at /api/youtube?action=auth"
        raise RuntimeError("YouTube token: " + str(why))
    return j["access_token"]


def auth(tok, extra=None):
    h = {"authorization": "Bearer " + tok}
    if extra: h.update(extra)
    return h


# ---------------------------------------------------------------- the upload

def metadata(rec, public=False):
    """the snippet and status of a compilation, from its <name>.json"""
    title = str(rec.get("title") or rec.get("name") or "NOOR").strip()
    if len(title) > 100: title = title[:99].rsplit(" ", 1)[0] + "…"
    tags = [str(t) for t in (rec.get("tags") or ["NOOR", "Islam"])][:15]
    return {"snippet": {"title": title, "description": str(rec.get("description", ""))[:5000],
                        "tags": tags, "categoryId": CATEGORY_EDUCATION, "defaultLanguage": "en"},
            "status": {"privacyStatus": "public" if public else "unlisted",
                       "selfDeclaredMadeForKids": False, "embeddable": True}}


def open_session(tok, meta, size):
    """the resumable session: YouTube answers with the URI the bytes go to"""
    body = json.dumps(meta).encode("utf-8")
    st, h, b = call("POST", UPLOAD + "/videos?" + urllib.parse.urlencode({"uploadType": "resumable", "part": "snippet,status"}),
                    auth(tok, {"content-type": "application/json; charset=UTF-8", "content-length": str(len(body)),
                               "x-upload-content-type": "video/mp4", "x-upload-content-length": str(size)}),
                    body, timeout=60)
    check(st, b, "videos.insert")
    uri = h.get("location")
    if not uri: raise RuntimeError("videos.insert: no session URI in the answer")
    return uri


def resume_point(tok, uri, size):
    """where the server stopped, asked with an empty range"""
    st, h, b = call("PUT", uri, auth(tok, {"content-length": "0", "content-range": "bytes */%d" % size}), b"", timeout=60)
    if st in (200, 201): return size, jbody(b)
    if st == 308:
        r = h.get("range", "")
        return (int(r.split("-")[-1]) + 1) if r else 0, None
    check(st, b, "upload status")
    return 0, None


def send_file(tok, uri, path, size, chunk=None, log=print):
    """the bytes, in pieces; a piece that fails is sent again from where the
    server says it has got to"""
    chunk = chunk or CHUNK
    pos, stalls = 0, 0
    with open(path, "rb") as f:
        while pos < size:
            f.seek(pos)
            data = f.read(min(chunk, size - pos))
            end = pos + len(data) - 1
            try:
                st, h, b = HTTP("PUT", uri, auth(tok, {"content-length": str(len(data)), "content-type": "video/mp4",
                                                       "content-range": "bytes %d-%d/%d" % (pos, end, size)}), data, 900)
            except (urllib.error.URLError, TimeoutError, OSError, ConnectionError) as e:
                st, h, b = 0, {}, str(e).encode()
            if st in (200, 201):
                return jbody(b)
            if st == 308:
                r = h.get("range", "")
                pos = (int(r.split("-")[-1]) + 1) if r else end + 1
                stalls = 0
                log("  %d%%" % (100 * pos // size)); continue
            if st in (0, 408, 429, 500, 502, 503, 504):
                stalls += 1
                if stalls > 6: raise RuntimeError("upload: gave up after %d failed pieces (last http %s)" % (stalls, st))
                time.sleep(min(120.0, 5.0 * 2 ** stalls))
                pos, done = resume_point(tok, uri, size)
                if done: return done
                continue
            check(st, b, "upload")
    pos, done = resume_point(tok, uri, size)
    if done: return done
    raise RuntimeError("upload: the server has %d of %d bytes and no video" % (pos, size))


def set_thumbnail(tok, vid, jpg):
    with open(jpg, "rb") as f: data = f.read()
    st, h, b = call("POST", UPLOAD + "/thumbnails/set?" + urllib.parse.urlencode({"videoId": vid, "uploadType": "media"}),
                    auth(tok, {"content-type": "image/jpeg", "content-length": str(len(data))}), data, timeout=120)
    check(st, b, "thumbnails.set")


def playlist_id(tok, title, public=False):
    """the playlist of this name among the channel's own, or a new one"""
    page = ""
    while True:
        q = {"part": "snippet", "mine": "true", "maxResults": "50"}
        if page: q["pageToken"] = page
        st, h, b = call("GET", API + "/playlists?" + urllib.parse.urlencode(q), auth(tok), timeout=60)
        check(st, b, "playlists.list")
        j = jbody(b) or {}
        for it in j.get("items", []):
            if str(it.get("snippet", {}).get("title", "")).strip().lower() == title.strip().lower():
                return it["id"], False
        page = j.get("nextPageToken")
        if not page: break
    body = json.dumps({"snippet": {"title": title, "description": "From NOOR Codex of Light, a free Islamic library: noorcodex.com"},
                       "status": {"privacyStatus": "public" if public else "unlisted"}}).encode()
    st, h, b = call("POST", API + "/playlists?part=snippet,status",
                    auth(tok, {"content-type": "application/json; charset=UTF-8"}), body, timeout=60)
    check(st, b, "playlists.insert")
    return (jbody(b) or {})["id"], True


def add_to_playlist(tok, pid, vid):
    body = json.dumps({"snippet": {"playlistId": pid, "resourceId": {"kind": "youtube#video", "videoId": vid}}}).encode()
    st, h, b = call("POST", API + "/playlistItems?part=snippet",
                    auth(tok, {"content-type": "application/json; charset=UTF-8"}), body, timeout=60)
    check(st, b, "playlistItems.insert")


def upload_one(tok, mp4, rec, public=False, log=print):
    """the whole of one compilation: the video, its thumbnail, its playlist.
    Returns the ledger record; `notes` says what did not go the whole way."""
    size = os.path.getsize(mp4)
    meta = metadata(rec, public)
    uri = open_session(tok, meta, size)
    base = {"date": time.strftime("%Y-%m-%d"), "ids": " ".join(rec.get("ids") or []), "secs": rec.get("secs"),
            "title": meta["snippet"]["title"]}
    try:
        j = send_file(tok, uri, mp4, size, log=log) or {}
    except RuntimeError as e:
        raise Unconfirmed(dict(base, video="", unconfirmed=True, session=uri, why=str(e)[:200]))
    vid = j.get("id")
    if not vid:
        raise Unconfirmed(dict(base, video="", unconfirmed=True, session=uri,
                               why="YouTube answered without a video id", response=json.dumps(j)[:300]))
    privacy = str(j.get("status", {}).get("privacyStatus") or meta["status"]["privacyStatus"])
    out = dict(base, video=vid, url="https://www.youtube.com/watch?v=" + vid, privacy=privacy,
               units=COST["insert"], notes=[])
    if privacy == "private" and meta["status"]["privacyStatus"] != "private":
        out["notes"].append("YouTube kept it private: the project has not passed the API audit, so only the owner can see it")
    jpg = os.path.splitext(mp4)[0] + ".jpg"
    if os.path.exists(jpg):
        try:
            set_thumbnail(tok, vid, jpg); out["units"] += COST["thumbnail"]
        except (RuntimeError, Scope) as e:
            out["notes"].append("thumbnail not set: %s" % str(e)[:160])
    name = str(rec.get("playlist") or "NOOR")
    try:
        pid, made = playlist_id(tok, name, public)
        out["units"] += COST["playlists.list"] + (COST["playlists.insert"] if made else 0)
        add_to_playlist(tok, pid, vid); out["units"] += COST["playlistItems.insert"]
        out["playlist"] = pid
    except Scope as e:
        out["notes"].append("not put on the playlist \"%s\": the consent carries upload and readonly, not the youtube scope; "
                            "the video is up all the same" % name)
    except RuntimeError as e:
        out["notes"].append("not put on the playlist \"%s\": %s" % (name, str(e)[:160]))
    return out


# ---------------------------------------------------------------- the ledger and the run

def ledger():
    try:
        d = json.load(open(LEDGER, encoding="utf-8"))
        return d if isinstance(d, dict) else {}
    except (OSError, ValueError):
        return {}


def save(d):
    with open(LEDGER, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, indent=1, sort_keys=True)


def candidates(paths):
    """every <name>.mp4 with a <name>.json beside it, in name order"""
    mp4s = []
    for p in paths:
        if os.path.isdir(p):
            mp4s += [os.path.join(p, f) for f in sorted(os.listdir(p)) if f.endswith(".mp4")]
        elif p.endswith(".mp4"):
            mp4s.append(p)
    out = []
    for m in mp4s:
        j = os.path.splitext(m)[0] + ".json"
        if not os.path.exists(j):
            print("  no %s beside %s: skipped" % (os.path.basename(j), os.path.basename(m))); continue
        out.append((m, json.load(open(j, encoding="utf-8"))))
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("paths", nargs="+", help="out/ or out/<name>.mp4")
    ap.add_argument("--public", action="store_true", help="publish; unlisted otherwise")
    ap.add_argument("--again", action="store_true", help="upload a name the ledger already has")
    ap.add_argument("--max", type=int, default=MAX_UPLOADS, help="uploads this run, for the day's quota")
    ap.add_argument("--summary", default=None, help="append a markdown line per upload to this file")
    a = ap.parse_args(argv)

    todo = candidates(a.paths)
    if not todo:
        print("nothing to upload"); return 0
    if not configured():
        print("YouTube is not connected: YT_CLIENT_ID, YT_CLIENT_SECRET and YT_REFRESH_TOKEN are not all set; "
              "the %d video(s) stay as run artifacts" % len(todo))
        return 0
    book = ledger()
    tok = None                          # minted when there is something to send
    sent, units, rc = 0, 0, 0
    lines = []
    for mp4, rec in todo:
        name = rec.get("name") or os.path.splitext(os.path.basename(mp4))[0]
        if name in book and not a.again:
            had = book[name]
            print("  %s: %s (--again to send it again)" % (name, ("unconfirmed upload of %s, look for it in YouTube Studio" % had.get("date"))
                                                          if had.get("unconfirmed") else "already up as " + str(had.get("url") or had.get("video"))))
            continue
        if sent >= a.max:
            print("  %s: left for the next run (%d uploads is the run's cap)" % (name, a.max)); continue
        print("%s: %.1f MB, %s" % (name, os.path.getsize(mp4) / 1e6, rec.get("title", "")), flush=True)
        try:
            tok = tok or access_token()
            out = upload_one(tok, mp4, rec, a.public)
        except Quota as e:
            print("  YouTube's quota for today is spent (%s): the rest stay as run artifacts" % str(e)[:120])
            rc = 0; break
        except Unconfirmed as e:
            # the units are spent and the video may be on the channel under
            # this title: the ledger says so, and it is not sent again by
            # itself. The owner looks in Studio; --again sends it once more.
            sent += 1; units += COST["insert"]
            book[name] = e.record; save(book)
            print("  UNCONFIRMED %s: %s. Look for \"%s\" in YouTube Studio; --again sends it again"
                  % (name, e.record.get("why"), e.record.get("title")))
            lines.append("- **%s** · unconfirmed: %s (look in YouTube Studio)" % (e.record.get("title"), e.record.get("why")))
            continue
        except (RuntimeError, Scope) as e:
            print("  FAILED", name, str(e)[:300]); rc = 1; continue
        sent += 1; units += out["units"]
        book[name] = {k: v for k, v in out.items() if k != "units"}
        save(book)
        print("  %s  %s  %s" % (out["video"], out["url"], out["privacy"]))
        for n in out["notes"]: print("  note:", n)
        lines.append("- **%s** · %s · %s%s" % (out["title"], out["url"], out["privacy"],
                                                ("; " + "; ".join(out["notes"])) if out["notes"] else ""))
    print("%d uploaded, about %d units of the day's 10,000" % (sent, units))
    if a.summary and lines:
        with open(a.summary, "a", encoding="utf-8") as f: f.write("\n".join(lines) + "\n")
    return rc


if __name__ == "__main__":
    sys.exit(main())
