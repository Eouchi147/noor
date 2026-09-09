#!/usr/bin/env python3
"""The compilations, held.

Three tiny reels are made with ffmpeg (a test pattern and a sine tone, the
house's own frame and sound settings, two seconds each) and a fake manifest
is written around them. Then: the join is a stream copy that comes out the
length of its inputs; the chapters land where the reels start; the duration
guard splits a long selection; a theme picks the verses whose meaning
carries its words; the letter blocks hold the words; the thumbnail is
1280x720; and the description holds no word that is not in the manifest's
own text or the fixed lines. yt_upload's requests are built against a
stubbed HTTP layer, so no byte leaves the machine.

    python3 -m pytest -q test_compile.py      with pytest
    python3 test_compile.py                   without it
"""
import json, os, re, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import compile as C          # noqa: E402  (the module beside this file, not the builtin)
import yt_upload as Y        # noqa: E402

# the tests read the fake manifest alone, not the plan.json beside the module
C.plan_order = lambda: {}

FFMPEG = shutil.which("ffmpeg") and shutil.which("ffprobe")
WHY_NOT = "ffmpeg and ffprobe are not on this machine (apt-get install -y ffmpeg); the join tests are skipped"

_TMP = None


def workdir():
    global _TMP
    if _TMP is None:
        _TMP = tempfile.mkdtemp(prefix="noor-test-compile-")
        os.makedirs(os.path.join(_TMP, "reels"))
    return _TMP


def make_reel(cid, secs=2.0, freq=440, size="1080x1920", rate=48000):
    """one synthetic reel, cut the way the renderer cuts them"""
    path = os.path.join(workdir(), "reels", cid + ".mp4")
    if os.path.exists(path): return path
    r = subprocess.run(["ffmpeg", "-y", "-v", "error",
                        "-f", "lavfi", "-i", "testsrc=size=%s:rate=30:duration=%s" % (size, secs),
                        "-f", "lavfi", "-i", "sine=frequency=%d:sample_rate=%d:duration=%s" % (freq, rate, secs),
                        "-c:v", "libx264", "-preset", "ultrafast", "-profile:v", "high", "-pix_fmt", "yuv420p", "-r", "30",
                        "-c:a", "aac", "-ar", str(rate), "-ac", "2", "-b:a", "96k", "-shortest", path],
                       capture_output=True, text=True)
    assert r.returncode == 0, r.stderr
    return path


# the fake manifest: the text is the only source the description may draw on
ROWS = [
    {"id": "name-ar-rahman", "kind": "name", "hook": "Ar-Rahman", "caption": "Ar-Rahman. The Most Merciful.", "secs": 2},
    {"id": "name-ar-raheem", "kind": "name", "hook": "Ar-Raheem", "caption": "Ar-Raheem. The Especially Merciful.", "secs": 2},
    {"id": "name-al-malik", "kind": "name", "hook": "Al-Malik", "caption": "Al-Malik. The King.", "secs": 2},
    {"id": "verse-94-5-6", "kind": "verse", "hook": "Ash-Sharh · 94:5-6", "verse": "94:5-6", "reciter": "Abdul Basit Abd us-Samad",
     "meaning": "For indeed, with hardship will be ease. Indeed, with hardship will be ease.", "caption": "94:5-6\n\nFor indeed, with hardship will be ease.\n\nRecited by Abdul Basit Abd us-Samad. noorcodex.com/quran", "secs": 16},
    {"id": "verse-2-152", "kind": "verse", "hook": "Al-Baqarah · 2:152", "verse": "2:152", "reciter": "Mishary Rashid Alafasy",
     "meaning": "So remember Me; I will remember you. And be grateful to Me and do not deny Me.", "caption": "2:152\n\nSo remember Me; I will remember you.\n\nRecited by Mishary Rashid Alafasy.", "secs": 14},
    {"id": "verse-39-53", "kind": "verse", "hook": "Az-Zumar · 39:53", "verse": "39:53", "reciter": "Mishary Rashid Alafasy",
     "meaning": "Do not despair of the mercy of Allah. Indeed, Allah forgives all sins.", "caption": "39:53\n\nDo not despair of the mercy of Allah.", "secs": 30},
    {"id": "verse-3-134", "kind": "verse", "hook": "Ali 'Imran · 3:134", "verse": "3:134", "reciter": "Saad al-Ghamdi",
     "meaning": "Who spend in ease and hardship and who restrain anger and who pardon the people.", "caption": "3:134\n\nplease note nothing here.", "secs": 20},
    {"id": "verse-4-79", "kind": "verse", "hook": "An-Nisa · 4:79", "verse": "4:79", "reciter": "Saad al-Ghamdi",
     "meaning": "What comes to you of good is from Allah.", "caption": "4:79\n\nWhat comes to you of good is from Allah. Please read.", "secs": 20},
    {"id": "word-taqwa", "kind": "word", "hook": "Taqwa", "caption": "Taqwa. An alert awareness of Allah.", "secs": 14},
    {"id": "word-adab", "kind": "word", "hook": "Adab", "caption": "Adab. Good manners.", "secs": 14},
    {"id": "word-ilm", "kind": "word", "hook": "'Ilm", "caption": "'Ilm. Knowledge.", "secs": 14},
    {"id": "word-sabr", "kind": "word", "hook": "Sabr", "caption": "Sabr. Patience.", "secs": 14},
    {"id": "word-dhikr", "kind": "word", "hook": "Dhikr", "caption": "Dhikr. Remembrance.", "secs": 14},
    {"id": "word-zakat", "kind": "word", "hook": "Zakat", "caption": "Zakat. The alms.", "secs": 14},
    {"id": "word-qalb", "kind": "word", "hook": "Qalb", "caption": "Qalb. The heart.", "secs": 14},
]
ROWS += [{"id": "know-%02d" % i, "kind": "know", "hook": "Fact number %d" % i, "caption": "Fact number %d." % i, "secs": 13}
         for i in range(1, 86)]


def manifest_words():
    words = set()
    for r in ROWS:
        for k in ("hook", "caption", "meaning", "reciter", "verse", "id"):
            words |= set(re.findall(r"[A-Za-z']+", str(r.get(k, ""))))
    return {w.lower().strip("'") for w in words}


def fixed_words():
    text = " ".join([C.LIBRARY_LINE % (C.SITE, ""), C.CHAPTERS_LINE, C.RECITED_LINE, C.MEANING_LINE] + list(C.ROOM.values()))
    return {w.lower().strip("'") for w in re.findall(r"[A-Za-z']+", text)}


# ---------------------------------------------------------------- selection, split, words

def test_catalogue_names_in_order():
    cat = C.catalogue(ROWS)
    kind, title, rows = cat["names"]
    assert kind == "name"
    assert [r["id"] for r in rows] == ["name-ar-rahman", "name-ar-raheem", "name-al-malik"]
    assert title.startswith("3 of the 99 Names of Allah")     # the count is honest when the shelf is short


def test_theme_selection():
    pat = [r["id"] for r in C.theme_rows(ROWS, "patience")]
    assert pat == ["verse-94-5-6", "verse-3-134"]                 # "ease" is not found inside "please"
    assert [r["id"] for r in C.theme_rows(ROWS, "mercy")] == ["verse-39-53"]
    assert [r["id"] for r in C.theme_rows(ROWS, "gratitude")] == ["verse-2-152"]
    assert [r["id"] for r in C.theme_rows(ROWS, "remembrance")] == ["verse-2-152"]
    cat = C.catalogue(ROWS)
    assert cat["verses-patience"][1] == "Two verses on patience, recited, with meaning"
    assert "verses-gratitude" in cat


def test_theme_cap():
    many = [dict(r, id="verse-x-%d" % i) for i, r in enumerate([ROWS[3]] * 40)]
    assert len(C.theme_rows(many, "patience")) == C.THEME_CAP


def test_word_blocks():
    b = {blk: [r["hook"] for r in C.block_rows(ROWS, blk)] for blk, _, _ in C.BLOCKS}
    assert b["a-d"] == ["Adab", "Dhikr"]
    assert b["e-k"] == ["'Ilm"]                                    # the apostrophe does not decide the letter
    assert b["l-r"] == ["Qalb"]
    assert b["s-z"] == ["Sabr", "Taqwa", "Zakat"]
    cat = C.catalogue(ROWS)
    assert cat["words-a-d"][1] == "The words of the Path, A to D, explained"


def test_know_chunks():
    cat = C.catalogue(ROWS)
    assert len(cat["know-1"][2]) == 40 and len(cat["know-2"][2]) == 40 and len(cat["know-3"][2]) == 5
    assert cat["know-1"][1] == "Did you know? Forty true things from Islamic history, part 1"
    assert cat["know-3"][1] == "Did you know? Five true things from Islamic history, part 3"
    assert C.expand(["know"], cat) == ["know-1", "know-2", "know-3"]
    assert C.expand(["names", "verses"], cat)[0] == "names"


def test_split_at_the_duration_guard():
    rows = [{"id": "v%d" % i, "kind": "verse", "secs": 3600} for i in range(30)]     # thirty hours
    parts = C.split(rows, C.LIMIT)
    assert len(parts) == 3
    assert [len(p) for p in parts] == [11, 11, 8]                  # 11 x 3600 = 39,600 < 43,140; 12 would not fit
    assert sum(len(p) for p in parts) == 30
    assert all(sum(r["secs"] for r in p) <= C.LIMIT for p in parts)
    assert C.split(rows[:3], C.LIMIT) == [rows[:3]]                # one part when it fits
    named = C.parts_of("verses-patience", "verse", "Thirty verses on patience, recited, with meaning", rows)
    assert [n for n, _, _ in named] == ["verses-patience-part1", "verses-patience-part2", "verses-patience-part3"]
    assert named[0][1].endswith(", part 1 of 3")


def test_chapters_and_hms():
    lines = C.chapters(ROWS[:3], [20.0, 20.4, 19.6])
    assert lines == ["0:00 Ar-Rahman", "0:20 Ar-Raheem", "0:40 Al-Malik"]
    assert C.chapters(ROWS[:2], [3700, 5], gap=0.6)[1] == "1:01:40 Ar-Raheem"
    assert C.hms(0) == "0:00" and C.hms(65) == "1:05" and C.hms(3600) == "1:00:00"


def test_description_uses_only_manifest_text():
    allowed = manifest_words() | fixed_words()
    cat = C.catalogue(ROWS)
    for name, (kind, title, rows) in cat.items():
        lines = C.chapters(rows, [C.secs_of(r) for r in rows])
        desc = C.description(kind, rows, lines)
        words = {w.lower().strip("'") for w in re.findall(r"[A-Za-z']+", desc)} - {""}
        stray = words - allowed
        assert not stray, "%s: words not in the manifest: %s" % (name, sorted(stray))
        assert desc.startswith("From NOOR Codex of Light")
        assert C.ROOM[kind] in desc
        assert lines[0] in desc
        if kind == "verse":
            assert "Recited by: " in desc and "Saheeh International" in desc
            for r in rows: assert r["reciter"] in desc
        else:
            assert "Recited by" not in desc


def test_description_fits_youtube():
    rows = [{"id": "know-%d" % i, "kind": "know", "hook": "A very long hook about a thing " * 3, "secs": 13} for i in range(400)]
    lines = C.chapters(rows, [13.0] * 400)
    assert len(C.description("know", rows, lines)) <= 5000


def test_pending_skips_the_ledger(monkeypatch=None):
    cat = C.catalogue(ROWS)
    old = C.LEDGER
    tmp = os.path.join(workdir(), "ledger.json")
    json.dump({"names": {"video": "abc"}, "verses-patience": {"video": "def"}}, open(tmp, "w"))
    C.LEDGER = tmp
    try:
        assert C.pending(cat, 2) == ["verses-mercy", "verses-gratitude"]
        assert "names" not in C.pending(cat, 99)
    finally:
        C.LEDGER = old


def test_meaning_and_ref_fallbacks():
    row = {"id": "verse-1-1", "kind": "verse", "hook": "Al-Fatihah · 1:1",
           "caption": "1:1\n\nIn the name of Allah.\n\nRecited by Someone."}
    assert C.meaning_of(row) == "In the name of Allah."
    assert C.verse_ref(row) == "1:1"
    assert C.number_word(30) == "Thirty" and C.number_word(28) == "Twenty-eight" and C.number_word(99) == "99"


# ---------------------------------------------------------------- the join, with ffmpeg

def _skip():
    if not FFMPEG:
        try:
            import pytest; pytest.skip(WHY_NOT)
        except ImportError:
            print("  SKIP:", WHY_NOT); return True
    return False


def test_join_is_a_stream_copy():
    if _skip(): return
    for cid in ("name-ar-rahman", "name-ar-raheem", "name-al-malik"): make_reel(cid)
    out = os.path.join(workdir(), "out")
    rec = C.build("names", "name", "Three Names", ROWS[:3], out, reels_dir=os.path.join(workdir(), "reels"))
    assert rec["joined"] == "copy"
    assert abs(rec["secs"] - 6.0) < 0.5
    assert rec["ids"] == ["name-ar-rahman", "name-ar-raheem", "name-al-malik"]
    assert rec["chapters"] == ["0:00 Ar-Rahman", "0:02 Ar-Raheem", "0:04 Al-Malik"]
    txt = open(os.path.join(out, "names.chapters.txt")).read().splitlines()
    assert txt == rec["chapters"]
    shape, secs = C.probe(os.path.join(out, "names.mp4"))
    assert shape["v"][0] == "h264" and shape["v"][2:4] == (1080, 1920) and shape["a"][0] == "aac"
    js = json.load(open(os.path.join(out, "names.json")))
    assert js["title"] == "Three Names" and js["secs"] == rec["secs"]


def test_thumbnail_is_1280x720():
    if _skip(): return
    make_reel("name-ar-rahman")
    out = os.path.join(workdir(), "out")
    if not os.path.exists(os.path.join(out, "names.jpg")):
        C.build("names", "name", "Three Names", ROWS[:3], out, reels_dir=os.path.join(workdir(), "reels"))
    shape, _ = C.probe(os.path.join(out, "names.jpg"))
    assert shape["v"][2:4] == (1280, 720)


def test_join_falls_back_to_encode_when_a_reel_differs():
    if _skip(): return
    make_reel("name-ar-rahman"); make_reel("name-ar-raheem")
    odd = make_reel("odd", size="720x1280", rate=44100)      # an older cut
    rows = ROWS[:2] + [{"id": "odd", "kind": "name", "hook": "Odd", "caption": "Odd.", "secs": 2}]
    out = os.path.join(workdir(), "out-encode")
    rec = C.build("mixed", "name", "Mixed", rows, out, reels_dir=os.path.join(workdir(), "reels"))
    assert rec["joined"] == "encode"
    assert abs(rec["secs"] - (6.0 + 2 * C.GAP)) < 0.6           # a breath of black between reels
    shape, _ = C.probe(os.path.join(out, "mixed.mp4"))
    assert shape["v"][2:4] == (1080, 1920) and shape["a"][1] == "48000"
    assert rec["chapters"][2] == "0:05 Odd"                       # 2 + 0.6 + 2 + 0.6 = 5.2


# ---------------------------------------------------------------- yt_upload, dry

class FakeHTTP:
    """answers the way YouTube does, and keeps every request"""
    def __init__(self, fail_first_chunk=False, no_playlist_scope=False, private=False, no_id=False):
        self.calls, self.fail_first_chunk, self.no_playlist_scope, self.private = [], fail_first_chunk, no_playlist_scope, private
        self.no_id, self.got = no_id, 0

    def __call__(self, method, url, headers=None, body=None, timeout=None):
        headers = {k.lower(): v for k, v in (headers or {}).items()}
        self.calls.append((method, url, headers, body))
        if url == Y.TOKEN_URL:
            form = dict(x.split("=") for x in body.decode().split("&"))
            assert form == {"refresh_token": "R", "client_id": "I", "client_secret": "S", "grant_type": "refresh_token"}
            return 200, {}, b'{"access_token": "TOK", "expires_in": 3599}'
        assert headers.get("authorization") == "Bearer TOK", url
        if "/upload/youtube/v3/videos" in url:
            assert "uploadType=resumable" in url and "part=snippet%2Cstatus" in url
            j = json.loads(body)
            assert j["snippet"]["categoryId"] == "27" and j["status"]["privacyStatus"] in ("unlisted", "public")
            self.size = int(headers["x-upload-content-length"])
            return 200, {"location": "https://upload.example/session"}, b""
        if url == "https://upload.example/session":
            cr = headers["content-range"]
            if cr.startswith("bytes */"):
                return 308, {"range": "bytes=0-%d" % (self.got - 1)} if self.got else {}, b""
            a, b_, total = re.match(r"bytes (\d+)-(\d+)/(\d+)", cr).groups()
            assert int(a) == self.got, (a, self.got)
            if self.fail_first_chunk:
                self.fail_first_chunk = False
                return 503, {}, b'{"error": {"message": "backend"}}'
            self.got = int(b_) + 1
            if self.got < int(total):
                return 308, {"range": "bytes=0-%d" % (self.got - 1)}, b""
            if self.no_id: return 200, {}, b'{"kind": "youtube#video"}'
            return 200, {}, json.dumps({"id": "VID123", "status": {"privacyStatus": "private" if self.private else "unlisted"}}).encode()
        if "/thumbnails/set" in url:
            assert "videoId=VID123" in url and headers["content-type"] == "image/jpeg"
            return 200, {}, b"{}"
        if "/youtube/v3/playlists?" in url and method == "GET":
            return 200, {}, json.dumps({"items": [{"id": "PL1", "snippet": {"title": "One verse"}}]}).encode()
        if "/youtube/v3/playlists?part=snippet,status" in url and method == "POST":
            if self.no_playlist_scope:
                return 403, {}, b'{"error": {"errors": [{"reason": "insufficientPermissions"}], "message": "Insufficient Permission: Request had insufficient authentication scopes."}}'
            return 200, {}, json.dumps({"id": "PLNEW", "snippet": json.loads(body)["snippet"]}).encode()
        if "/youtube/v3/playlistItems" in url:
            j = json.loads(body)
            assert j["snippet"]["resourceId"] == {"kind": "youtube#video", "videoId": "VID123"}
            return 200, {}, b'{"id": "item"}'
        raise AssertionError("unexpected request " + url)


def _env(monkeypatch=None):
    os.environ.update({"YT_CLIENT_ID": "I", "YT_CLIENT_SECRET": "S", "YT_REFRESH_TOKEN": "R"})


def _files(name="names", playlist="The 99 Names of Allah"):
    d = os.path.join(workdir(), "up-" + name); os.makedirs(d, exist_ok=True)
    mp4 = os.path.join(d, name + ".mp4")
    with open(mp4, "wb") as f: f.write(os.urandom(700_000))
    with open(os.path.join(d, name + ".jpg"), "wb") as f: f.write(b"\xff\xd8\xff" + b"0" * 100)
    json.dump({"name": name, "title": "The 99 Names of Allah, with their meaning · NOOR Codex of Light",
               "description": "From NOOR", "tags": ["NOOR", "Islam"], "playlist": playlist, "ids": ["a", "b"], "secs": 4.0},
              open(os.path.join(d, name + ".json"), "w"))
    return d, mp4


def test_upload_requests_built_right():
    _env()
    fake = FakeHTTP()
    Y.HTTP = fake
    Y.CHUNK = 256 * 1024
    try:
        d, mp4 = _files()
        tok = Y.access_token()
        assert tok == "TOK"
        rec = json.load(open(os.path.join(d, "names.json")))
        out = Y.upload_one(tok, mp4, rec, public=False, log=lambda *a: None)
    finally:
        Y.HTTP = Y._http; Y.CHUNK = 32 * 1024 * 1024
    assert out["video"] == "VID123" and out["url"] == "https://www.youtube.com/watch?v=VID123"
    assert out["privacy"] == "unlisted" and out["playlist"] == "PLNEW" and out["notes"] == []
    assert out["ids"] == "a b"
    assert fake.got == 700_000
    puts = [c for c in fake.calls if c[0] == "PUT"]
    assert len(puts) == 3                                         # 700,000 bytes in 256 KiB pieces
    assert all(c[2]["content-type"] == "video/mp4" for c in puts)
    kinds = [c[1].split("?")[0].split("/")[-1] for c in fake.calls]
    assert kinds == ["token", "videos", "session", "session", "session", "set", "playlists", "playlists", "playlistItems"]
    assert out["units"] == 1600 + 50 + 1 + 50 + 50


def test_upload_resumes_after_a_failed_piece():
    _env()
    fake = FakeHTTP(fail_first_chunk=True)
    Y.HTTP = fake; Y.CHUNK = 256 * 1024
    real_sleep = Y.time.sleep; Y.time.sleep = lambda s: None
    try:
        d, mp4 = _files("dua", "Du'as of the Path")
        out = Y.upload_one("TOK", mp4, json.load(open(os.path.join(d, "dua.json"))), log=lambda *a: None)
    finally:
        Y.HTTP = Y._http; Y.CHUNK = 32 * 1024 * 1024; Y.time.sleep = real_sleep
    assert out["video"] == "VID123" and fake.got == 700_000
    assert any(c[2].get("content-range", "").startswith("bytes */") for c in fake.calls)   # asked where it stopped


def test_upload_says_when_the_scope_or_the_audit_is_missing():
    _env()
    fake = FakeHTTP(no_playlist_scope=True, private=True)
    Y.HTTP = fake; Y.CHUNK = 256 * 1024
    try:
        d, mp4 = _files("know-1", "Did you know?")
        out = Y.upload_one("TOK", mp4, json.load(open(os.path.join(d, "know-1.json"))), public=True, log=lambda *a: None)
    finally:
        Y.HTTP = Y._http; Y.CHUNK = 32 * 1024 * 1024
    assert out["video"] == "VID123" and out["privacy"] == "private"
    assert any("API audit" in n for n in out["notes"])
    assert any("youtube scope" in n for n in out["notes"]) and "playlist" not in out
    meta = Y.metadata({"title": "x" * 150, "description": "d"}, public=True)
    assert len(meta["snippet"]["title"]) <= 100 and meta["status"]["privacyStatus"] == "public"


def test_main_is_idempotent_and_honest_without_secrets(capsys=None):
    for k in ("YT_CLIENT_ID", "YT_CLIENT_SECRET", "YT_REFRESH_TOKEN"): os.environ.pop(k, None)
    d, mp4 = _files("verses-mercy", "One verse")
    assert Y.main([d]) == 0                                       # no secrets: one line, no failure
    _env()
    fake = FakeHTTP()
    Y.HTTP = fake; Y.CHUNK = 256 * 1024
    old = Y.LEDGER; Y.LEDGER = os.path.join(workdir(), "compilations.json")
    try:
        assert Y.main([d]) == 0
        book = json.load(open(Y.LEDGER))
        assert book["verses-mercy"]["video"] == "VID123" and book["verses-mercy"]["ids"] == "a b"
        n = len(fake.calls)
        assert Y.main([d]) == 0 and len(fake.calls) == n          # already up: nothing sent
        assert Y.main([d, "--again", "--max", "0"]) == 0 and len(fake.calls) == n   # the cap holds
    finally:
        Y.HTTP = Y._http; Y.CHUNK = 32 * 1024 * 1024; Y.LEDGER = old


def test_upload_without_an_id_is_kept_as_unconfirmed():
    _env()
    fake = FakeHTTP(no_id=True)
    Y.HTTP = fake; Y.CHUNK = 256 * 1024
    old = Y.LEDGER; Y.LEDGER = os.path.join(workdir(), "compilations-unconfirmed.json")
    try:
        d, mp4 = _files("words-a-d", "The word")
        assert Y.main([d]) == 0
        book = json.load(open(Y.LEDGER))
        e = book["words-a-d"]
        assert e["unconfirmed"] is True and e["video"] == "" and e["session"] == "https://upload.example/session"
        assert e["ids"] == "a b" and "video id" in e["why"]
        n = len(fake.calls)
        assert Y.main([d]) == 0 and len(fake.calls) == n            # not sent again by itself
        fake.no_id = False; fake.got = 0
        assert Y.main([d, "--again"]) == 0                           # --again sends it once more
        assert json.load(open(Y.LEDGER))["words-a-d"]["video"] == "VID123"
    finally:
        Y.HTTP = Y._http; Y.CHUNK = 32 * 1024 * 1024; Y.LEDGER = old


# ---------------------------------------------------------------- as a script

if __name__ == "__main__":
    tests = [(n, f) for n, f in sorted(globals().items()) if n.startswith("test_") and callable(f)]
    failed = 0
    for n, f in tests:
        try:
            f(); print("  ok  ", n)
        except Exception as e:
            failed += 1; print("  FAIL", n, "-", type(e).__name__, str(e)[:300])
    if _TMP: shutil.rmtree(_TMP, ignore_errors=True)
    print("%d tests, %d failed" % (len(tests), failed))
    sys.exit(1 if failed else 0)
