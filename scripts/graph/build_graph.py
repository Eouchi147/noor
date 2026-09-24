#!/usr/bin/env python3
"""NOOR Content Graph, step 2: one node per entity, one edge per real reference.

    python3 build_graph.py [--repo .] [--out build/graph]

Ported from the content audit's build_graph.py (/root/audit/content/scripts/,
15 September 2026) into the repository on 24 September 2026 so masterplan
step 5 can rebuild the graph without a path outside the repository. The only
changes from the audit's copy: the defaults read the repository this file
lives in and write under build/graph (git ignored, kept out of the Vercel
deployment by /scripts/ and /build/ in .vercelignore); the `generated` date
is the newest content file this run actually opened, not the clock, so two
runs over an unchanged tree write byte-identical files; and every node now
also carries `canonical`, filled from scripts/graph/same-as.json (content-003:
63 records the audit found are one thing under two ids).

Reads every content collection in the repository (JSON directly, the JavaScript
data through out/js/*.json written by extract_js.mjs), builds one node per
entity and one edge per real reference, validates that every edge endpoint is
a node, and writes:

    <out>/noor-content-graph.json   the graph
    <out>/inventory.csv             one row per collection
    <out>/out/validation.json       counts by type and by rel, dangling refs
    <out>/out/quality.json          every flag, by node, for the findings

Nothing under the repository is written. Re-runnable; deterministic.

Edge rules (the brief's): `links` for hyperlinks and id cross references,
`mentions` for a name matched in prose (exact title or slug, with a
confidence), `same_entity_as` for one entity recorded in two collections,
`part_of` for containment, `reel_of` for a reel card to what it was cut from,
`source_of` for a verse or a hadith cited by an entity, `derived_from` for a
text written from another record.
"""
import argparse, csv, glob, hashlib, html as htmlmod, json, os, re, sys, unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_DEFAULT = os.path.normpath(os.path.join(HERE, '..', '..'))
OUT_DEFAULT = os.path.join(REPO_DEFAULT, 'build', 'graph')

ap = argparse.ArgumentParser()
ap.add_argument('--repo', default=REPO_DEFAULT)
ap.add_argument('--out', default=OUT_DEFAULT)
ap.add_argument('--rooms', default=None, help='rendered rooms (optional; not read by this step, kept for the audit\'s command line)')
args = ap.parse_args()
REPO, OUT = args.repo, args.out
JS = os.path.join(OUT, 'out', 'js')
os.makedirs(os.path.join(OUT, 'out'), exist_ok=True)
sys.path.insert(0, os.path.join(REPO, 'scripts'))

# every content file a rd()/rj()/jsd() call actually opens, so `generated`
# below can be the newest one's own mtime rather than the clock (arch-020:
# a build run twice over an unchanged tree must write the same bytes)
OPENED = []
def _mtime(path):
    try: OPENED.append(os.path.getmtime(path))
    except OSError: pass

def rd(rel):
    p = os.path.join(REPO, rel); _mtime(p)
    return open(p, encoding='utf-8').read()
def rj(rel):
    p = os.path.join(REPO, rel); _mtime(p)
    return json.load(open(p, encoding='utf-8'))
def jsd(name):
    # out/js/*.json is written by extract_js.mjs at the start of *this* run,
    # so its own mtime is never a content date; not tracked for `generated`
    return json.load(open(os.path.join(JS, name + '.json'), encoding='utf-8'))

# ----------------------------------------------------------------- helpers
DASH = re.compile('[\u2013\u2014]')
PLACEHOLDER = re.compile(r'\b(TODO|TBD|FIXME|lorem ipsum|xxx+)\b|\?\?\?|\[citation needed', re.I)
TOKEN = re.compile(r'\{\{([ncpw]):([^|}]+)\|([^{}]*)\}\}')
REF = re.compile(r'(?<![\d:])(\d{1,3}):(\d{1,3})(?:-(\d{1,3}))?(?![\d:])')

def slug(s):
    s = unicodedata.normalize('NFKD', str(s)).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')

def fold(s):
    """api/page.js fold(): lowercase, strip accents and apostrophes, one space between words."""
    s = unicodedata.normalize('NFD', str(s or '')).lower()
    s = re.sub('[̀-ͯ]', '', s)
    s = re.sub("[‘’'ʻʼ`]", '', s)
    return re.sub('[^a-z0-9؀-ۿ]+', ' ', s).strip()

def first_sentence(t):
    t = re.sub(r'\s+', ' ', str(t or '')).strip()
    t = re.sub(r'\{\{[ncpw]:[^|}]+\|([^{}]*)\}\}', r'\1', t)
    if not t: return None
    m = re.match(r'(.+?[.!?])(\s|$)', t)
    return (m.group(1) if m else t)[:300]

def h8(s):
    return hashlib.sha1(s.encode('utf-8')).hexdigest()[:8]

def text_flags(*parts):
    """the owner's rules and the obvious placeholders, over any text"""
    t = ' '.join(str(p) for p in parts if p)
    f = []
    if DASH.search(t): f.append('dash')
    if PLACEHOLDER.search(t): f.append('placeholder')
    return f

# ----------------------------------------------------------------- the Qur'an table
Q = rj('tools/reels/quran-uthmani.json')
SURAHS = {int(k): v for k, v in Q['surahs'].items()}
AYAT = Q['verses']
SAHIH = rj('tools/reels/verses.json')['verses']

def valid_ref(s, a, b=None):
    s, a = int(s), int(a)
    b = int(b) if b else a
    if s not in SURAHS or a < 1 or b < a: return None
    if b > SURAHS[s]['count']: return None
    return (s, a, b)

def ref_id(s, a, b=None):
    return f'{s}-{a}' + (f'-{b}' if b and b > a else '')

def refs_in(text):
    """validated Qur'an references written as s:a or s:a-b anywhere in a text"""
    out = []
    for m in REF.finditer(str(text or '')):
        v = valid_ref(m.group(1), m.group(2), m.group(3))
        if v: out.append(v)
    return out

# ----------------------------------------------------------------- hadith citations
COLL = [
    (r"(?:Sahih\s+(?:al-)?)?Bukhari", 'bukhari'), (r"(?:Sahih\s+)?Muslim", 'muslim'),
    (r"(?:Jami['’]?\s+(?:at-)?)?Tirmidhi", 'tirmidhi'), (r"(?:Sunan\s+)?Abu\s+Daw(?:u|oo)d", 'abu-dawud'),
    (r"(?:Sunan\s+)?(?:an-)?Nasa['’]?i", 'nasai'), (r"(?:Sunan\s+)?Ibn\s+Majah", 'ibn-majah'),
    (r"(?:Musnad\s+)?Ahmad", 'ahmad'), (r"(?:Muwatta['’]?\s+)?Malik|Muwatta['’]?", 'malik'),
    (r"(?:al-)?Hakim", 'hakim'), (r"(?:al-)?Bayhaqi", 'bayhaqi'), (r"(?:at-)?Tabarani", 'tabarani'),
    (r"Ibn\s+Hibban", 'ibn-hibban'), (r"(?:ad-)?Darimi", 'darimi'), (r"(?:al-)?Adab\s+al-Mufrad", 'adab-al-mufrad'),
    (r"Ibn\s+Khuzaymah", 'ibn-khuzaymah'), (r"Abu\s+Ya['’]?la", 'abu-yala'), (r"(?:al-)?Bazzar", 'bazzar'),
    (r"Riyad\s+(?:as|us)-Salihin", 'riyad-as-salihin'), (r"Mishkat(?:\s+al-Masabih)?", 'mishkat'),
    (r"Sahih\s+al-Jami['’]?", 'sahih-al-jami'), (r"Ibn\s+Abi\s+Shaybah", 'ibn-abi-shaybah'),
]
CITE = re.compile(r"\b(" + "|".join(f"(?:{p})" for p, _ in COLL) + r")\s*(?:no\.?\s*|#|:)?\s*(\d{1,5})([a-z]?)\b")
COLL_RE = [(re.compile(p + r'$', re.I), c) for p, c in COLL]

def coll_of(name):
    for r, c in COLL_RE:
        if r.search(name): return c
    return slug(name)

def citations(text):
    return [(coll_of(m.group(1)), m.group(2) + m.group(3)) for m in CITE.finditer(str(text or ''))]

# ----------------------------------------------------------------- state
nodes = {}
edges = []
edge_seen = set()
quality = defaultdict(lambda: {'missing': [], 'flags': []})
inventory = []

def add_node(nid, **kw):
    if nid in nodes:
        quality[nid]['flags'].append('duplicate_id')
        return nodes[nid]
    n = {'id': nid, 'type': nid.split(':', 1)[0], 'title': None, 'arabic': None, 'translit': None, 'url': None,
         'source_file': None, 'sources': [], 'langs': ['en'], 'summary': None, 'era': None, 'date': None,
         'has_video': False, 'reel_ids': [], 'quality': {'missing': [], 'flags': []}}
    n.update(kw)
    nodes[nid] = n
    return n

def add_edge(a, b, rel, confidence=None, via=None, weight=None):
    key = (a, b, rel)
    if a == b: return
    if key in edge_seen: return
    edge_seen.add(key)
    e = {'from': a, 'to': b, 'rel': rel}
    if confidence is not None: e['confidence'] = confidence
    if via: e['via'] = via
    # how many times the name was actually found in the source text scanned
    # for it (mentions_in's own count); a shelf ranks a repeated name over a
    # single passing one at the same confidence, so only worth keeping past 1
    if weight and weight > 1: e['weight'] = weight
    edges.append(e)

def flag(nid, f):
    quality[nid]['flags'].append(f)
def missing(nid, f):
    quality[nid]['missing'].append(f)

# ================================================================== PAGES (static HTML)
# every HTML file that is not a typed entity page becomes a page node; typed
# pages (words, kids, stories) are built by their own collection below.
HTML = []
for d, subs, files in os.walk(REPO):
    rel = os.path.relpath(d, REPO)
    top = rel.split(os.sep)[0]
    if top in ('.git', 'node_modules', 'scripts', 'tests', 'api', 'tools', 'build', 'study 2', 'text', 'i18n', 'sw', 'locales', 'assets', '.build-src'):
        continue
    for f in files:
        if f.endswith('.html'):
            HTML.append(os.path.normpath(os.path.join(rel, f)) if rel != '.' else f)
HTML.sort()
LANG_DOORS = {'ar','bn','de','es','fa','fr','ha','hi','id','ja','ko','ku','pa','prs','ps','ru','so','sw','tr','ur','zh'}

def page_url(rel):
    p = '/' + rel[:-5]
    if p.endswith('/index'): p = p[:-6] or '/'
    return p

def page_id_of(rel):
    u = page_url(rel)
    return 'page:' + (slug(u.strip('/')) or 'home')

def title_of(html):
    m = re.search(r'<title>([^<]*)</title>', html, re.I)
    return htmlmod.unescape(m.group(1)).strip() if m else None

def strip_chrome(html):
    """the baked header and the menu sheet carry 40+ links on every old page; the
    page's own links are what the graph wants"""
    html = re.sub(r'<header id="site-header"[\s\S]*?</header>', ' ', html, count=1)
    html = re.sub(r'<div id="nav-sheet"[\s\S]*?\n</div>\n', ' ', html, count=1)
    html = re.sub(r'<script[\s\S]*?</script>', ' ', html)
    html = re.sub(r'<style[\s\S]*?</style>', ' ', html)
    return html

PAGE_LINKS = {}   # page rel -> set of hrefs (site-relative, without query/hash)
PAGE_TEXT = {}
for rel in HTML:
    html = rd(rel)
    PAGE_TEXT[rel] = html
    body = strip_chrome(html)
    hrefs = set()
    for m in re.finditer(r'<a\s[^>]*href="([^"#?]+)', body):
        h = m.group(1)
        if h.startswith(('http', 'mailto:', 'tel:', 'javascript:')): continue
        if not h.startswith('/'):
            base = os.path.dirname(rel)
            h = '/' + os.path.normpath(os.path.join(base, h)).replace('\\', '/')
        if h.endswith('.html'): h = h[:-5]
        if h.endswith('/index'): h = h[:-6] or '/'
        hrefs.add(h.rstrip('/') or '/')
    PAGE_LINKS[rel] = hrefs

# language coverage of a page's prose, from the text packs the runtime swaps in
try:
    import importlib.util
    spec = importlib.util.spec_from_file_location('xt', os.path.join(REPO, 'scripts', 'extract-text.py'))
    xt = importlib.util.module_from_spec(spec); spec.loader.exec_module(xt)
    PACKS = {}
    for f in glob.glob(os.path.join(REPO, 'i18n', 'text', '*.json')):
        lang = os.path.basename(f)[:-5]
        if lang in LANG_DOORS:
            PACKS[lang] = set(json.load(open(f, encoding='utf-8')).get('s', {}).keys())
except Exception as e:
    xt, PACKS = None, {}
    print('text packs not read:', e)

def page_langs(html):
    """languages in which at least 90 percent of this page's harvested strings have a translation"""
    if not xt: return ['en'], {}
    keys = set(xt.key(s) for s in xt.strings_of(html))
    if not keys: return ['en'], {}
    cov = {l: round(100 * len(keys & ks) / len(keys)) for l, ks in PACKS.items()}
    return ['en'] + sorted(l for l, c in cov.items() if c >= 90), cov

# ================================================================== 1. LIGHTS
LIGHTS = rj('lights/all.json')['lights']
LI18N = {}
for f in glob.glob(os.path.join(REPO, 'lights', 'i18n', '*.json')):
    _mtime(f)
    d = json.load(open(f, encoding='utf-8'))
    LI18N[d['lang']] = d.get('lights', {})
light_ids = set()
for L in LIGHTS:
    nid = 'light:' + L['id']
    if nid in nodes: flag(nid, 'duplicate_id'); continue
    light_ids.add(L['id'])
    langs = ['en'] + sorted(l for l, m in LI18N.items() if L['id'] in m and m[L['id']].get('s'))
    date = None
    if L.get('w'):
        w = L['w']; date = f"{w.get('y')}" + (f"-{w['m']:02d}" if w.get('m') else '') + (f"-{w['d']:02d}" if w.get('d') else '')
    n = add_node(nid, title=L['t'], url='/light/' + L['id'], source_file='lights/all.json', sources=[L['src']] if L.get('src') else [],
                 langs=langs, summary=first_sentence(L['s']), era=L.get('c'), date=date or L.get('d'),
                 kind=L['k'], level=L.get('lvl'), tags=L.get('tags', []), rendered_by=['/light/' + L['id'], '/light', '/today'])
    if L.get('lvl') in ('quran', 'sunnah', 'debated') and not L.get('src'): missing(nid, 'src')
    if not L.get('src'): missing(nid, 'source')
    for f in text_flags(L['t'], L['s'], L.get('d')): flag(nid, f)
    wc = len(L['s'].split())
    if wc < 60 or wc > 190: flag(nid, f'story_words_{wc}')
    add_edge(nid, 'page:light', 'part_of')

# ================================================================== 2. WORDS (the dictionary)
DICT = {}
for f in sorted(glob.glob(os.path.join(REPO, 'build', 'dict-*.json'))):
    _mtime(f)
    for e in json.load(open(f, encoding='utf-8')):
        if e['id'] in DICT: flag('word:' + e['id'], 'duplicate_id_across_domains')
        DICT[e['id']] = (e, os.path.relpath(f, REPO))
word_pages = set(os.path.basename(p)[:-5] for p in HTML if p.startswith('dictionary/'))
for wid, (e, src) in DICT.items():
    nid = 'word:' + wid
    n = add_node(nid, title=e['term'], arabic=e.get('ar'), translit=e['term'], url='/dictionary/' + wid, source_file=src, sources=[],
                 summary=e.get('short'), era=e.get('cat'), level=e.get('k'), also=e.get('also', []), rendered_by=['/dictionary/' + wid, '/dictionary'])
    missing(nid, 'source')   # the model has no source field at all
    if e.get('k') in ('quran', 'sunnah', 'debated'): flag(nid, 'evidence_badge_without_source')
    if wid not in word_pages: flag(nid, 'no_page_file')
    if not e.get('ar'): missing(nid, 'arabic')
    if not e.get('long'): missing(nid, 'long')
    for f in text_flags(e.get('short'), e.get('long')): flag(nid, f)
    seen = set()
    for s in e.get('see', []):
        if s == wid: flag(nid, 'see_self'); continue
        if s in seen: flag(nid, 'see_duplicate:' + s); continue
        seen.add(s)
        if s not in DICT: flag(nid, 'see_dangling:' + s); continue
        add_edge(nid, 'word:' + s, 'links', via='see')
    add_edge(nid, 'page:dictionary', 'part_of')
for p in word_pages - set(DICT):
    flag('word:' + p, 'page_without_entry')
    add_node('word:' + p, title=title_of(rd('dictionary/' + p + '.html')), url='/dictionary/' + p, source_file='dictionary/' + p + '.html')

# ================================================================== 3. CHAPTERS (the Path)
NODES = {}
for f in glob.glob(os.path.join(REPO, 'node', '*.json')):
    _mtime(f)
    d = json.load(open(f, encoding='utf-8')); NODES[int(d['id'])] = d
I18N = {}
for f in glob.glob(os.path.join(REPO, 'i18n', '*.json')):
    lang = os.path.basename(f)[:-5]
    if lang in LANG_DOORS:
        d = json.load(open(f, encoding='utf-8'))
        I18N[lang] = d if isinstance(d, dict) else {}
chapter_hadith = []
for cid in sorted(NODES):
    d = NODES[cid]; nid = f'chapter:{cid}'
    langs = ['en'] + sorted(l for l, p in I18N.items() if str(cid) in (p.get('nodes') or {}) and (p['nodes'][str(cid)].get('details')))
    year = next((f['value'] for f in d.get('facts', []) if f.get('label', '').lower() in ('year', 'date', 'when')), None)
    srcs = [h.get('source', '') for h in d.get('hadith', []) if h.get('source')]
    n = add_node(nid, title=d['titleEn'], arabic=d.get('titleAr'), url=f'/path/{cid}', source_file=f'node/{cid}.json',
                 sources=srcs, langs=langs, summary=d.get('summary'), era=d.get('period'), date=year,
                 image=d.get('image'), rendered_by=[f'/path/{cid}', '/path', '/#timeline', '/characters'])
    if not d.get('image'): missing(nid, 'image')
    if not d.get('hadith'): missing(nid, 'hadith')
    if not d.get('quran'): missing(nid, 'quran')
    if not d.get('facts'): missing(nid, 'facts')
    for f in text_flags(d.get('details'), d.get('summary'), json.dumps(d.get('facts'), ensure_ascii=False)): flag(nid, f)
    for c in d.get('connections', []):
        if c in NODES: add_edge(nid, f'chapter:{c}', 'links', via='connections')
        else: flag(nid, f'connection_dangling:{c}')
    for q in d.get('quran', []):
        m = REF.search(str(q.get('ref', '')))
        v = valid_ref(m.group(1), m.group(2), m.group(3)) if m else None
        if not v: flag(nid, 'quran_ref_invalid:' + str(q.get('ref'))); continue
        chapter_hadith.append(('verse', nid, v))
    for h in d.get('hadith', []):
        chapter_hadith.append(('hadith', nid, h))
    add_edge(nid, 'page:path', 'part_of')

# ================================================================== 4. SURAHS (the Qur'an rooms)
for f in sorted(glob.glob(os.path.join(REPO, 'study', '*.json')), key=lambda p: int(os.path.basename(p)[:-5])):
    _mtime(f)
    d = json.load(open(f, encoding='utf-8')); s = int(d['n']); nid = f'surah:{s}'
    row = SURAHS.get(s, {})
    v = d.get('virtue') or {}
    n = add_node(nid, title=row.get('translit') or f'Surah {s}', arabic=row.get('name'), translit=row.get('translit'), url=f'/surah/{s}',
                 source_file=f'study/{s}.json', sources=[v['src']] if v.get('src') else [], summary=first_sentence((d.get('context') or [''])[0]),
                 era=row.get('type'), date=f"revelation order {row.get('order')}" if row.get('order') else None, level=v.get('level'),
                 verse_count=row.get('count'), rendered_by=[f'/surah/{s}', '/quran'])
    if v.get('level') in ('sunnah', 'debated') and not v.get('src'): flag(nid, 'virtue_badge_without_source')
    if not v: missing(nid, 'virtue')
    for f2 in text_flags(json.dumps(d, ensure_ascii=False)): flag(nid, f2)
    for c in d.get('connections', []):
        t = c.get('to')
        if isinstance(t, int) and t in SURAHS: add_edge(nid, f'surah:{t}', 'links', via='connections')
        else: flag(nid, f'connection_dangling:{t}')
    for p in d.get('passages', []):
        m = REF.search(str(p.get('ref', '')))
        vv = valid_ref(m.group(1), m.group(2), m.group(3)) if m else None
        if not vv: flag(nid, 'passage_ref_invalid:' + str(p.get('ref'))); continue
        if vv[0] != s: flag(nid, 'passage_outside_surah:' + p['ref'])
        chapter_hadith.append(('verse', nid, vv))
    add_edge(nid, 'page:quran', 'part_of')
for s in SURAHS:
    if f'surah:{s}' not in nodes: add_node(f'surah:{s}', title=SURAHS[s]['translit'], arabic=SURAHS[s]['name'], url=f'/surah/{s}', source_file='tools/reels/quran-uthmani.json'); missing(f'surah:{s}', 'study')

# ================================================================== 5. VERSES
VERSE_NOTES = {}
for f in sorted(glob.glob(os.path.join(REPO, 'verse', '[0-9]*.json'))):  # sorted: its read order becomes edge order below
    _mtime(f)
    d = json.load(open(f, encoding='utf-8'))
    for a, v in d['v'].items(): VERSE_NOTES[(int(d['n']), int(a))] = v
SHELF = []
for line in rd('tools/reels/verses.txt').split('\n'):
    line = line.split('#')[0].strip()
    m = re.match(r'^(\d{1,3}):(\d{1,3})(?:-(\d{1,3}))?$', line)
    if m: SHELF.append(valid_ref(m.group(1), m.group(2), m.group(3)) or ('invalid', line))
MANIFEST = rj('reels/index.json')['cards']
MAN_BY_ID = {c['id']: c for c in MANIFEST}
verse_ref_pending = []   # (from-entity, (s,a,b), via)

def verse_node(v, via=None):
    s, a, b = v
    nid = 'verse:' + ref_id(s, a, b)
    if nid in nodes: return nid
    ar = ' '.join(AYAT.get(f'{s}:{i}', '') for i in range(a, b + 1)).strip()
    en = ' '.join((SAHIH.get(f'{s}:{i}') or {}).get('text', '') for i in range(a, b + 1)).strip()
    row = MAN_BY_ID.get('verse-' + ref_id(s, a, b))
    label = f'{s}:{a}' + (f'-{b}' if b > a else '')
    n = add_node(nid, title="Qur'an " + label, arabic=ar or None, url='/verse/' + ref_id(s, a, b), source_file='tools/reels/quran-uthmani.json',
                 sources=["Qur'an " + label], summary=en[:300] if en else None, era=SURAHS[s]['type'], has_video=bool(row),
                 surah=s, on_shelf=v in SHELF, in_sitemap=bool(row), rendered_by=['/verse/' + ref_id(s, a, b), f'/quran?surah={s}&ayah={a}'])
    if not ar: missing(nid, 'arabic')
    if not en: missing(nid, 'translation')
    note = VERSE_NOTES.get((s, a))
    if note:
        n['source_file'] = f'verse/{s}.json'
        n['has_note'] = True
        for nt in note.get('notes', []):
            if nt.get('lvl') in ('sunnah', 'debated') and not nt.get('src'): flag(nid, 'note_badge_without_source')
            if nt.get('src'): n['sources'].append(nt['src'])
        for f in text_flags(note.get('sense'), json.dumps(note.get('notes'), ensure_ascii=False)): flag(nid, f)
    add_edge(nid, f'surah:{s}', 'part_of')
    return nid

for v in SHELF:
    if v[0] == 'invalid': flag('page:verses', 'shelf_ref_invalid:' + v[1]); continue
    verse_node(v)
for (s, a), note in VERSE_NOTES.items():
    nid = verse_node((s, a, a))
    for lk in note.get('links', []):
        m = REF.search(str(lk.get('ref', '')))
        vv = valid_ref(m.group(1), m.group(2), m.group(3)) if m else None
        if vv: add_edge(nid, verse_node(vv), 'links', via='verse-note')
        else: flag(nid, 'link_ref_invalid:' + str(lk.get('ref')))
    for nt in note.get('notes', []):
        for c in citations(nt.get('src', '')): chapter_hadith.append(('cite', nid, c, nt.get('src')))

# ================================================================== 6. THE 99 NAMES
NAMES = jsd('names')['NAMES']
name_by_translit = {}
for i, r in enumerate(NAMES):
    ar, tr, meaning = r[0], r[1], r[2]
    more = r[3] or []
    sl = slug(tr)
    nid = 'name:' + sl
    if nid in nodes:
        # two Names share one transliteration (Al-Majid, 48 and 65); the reel plan suffixes the position
        flag(nid, 'translit_shared_with:' + f'name:{sl}-{i + 1}')
        nid = f'name:{sl}-{i + 1}'; flag(nid, 'translit_shared_with:name:' + sl)
    else:
        name_by_translit[tr] = nid
    essay = more[2] if len(more) > 2 else ''
    ref = more[3] if len(more) > 3 else ''
    # the room is /name/<position>, 1 to 99 (api/page.js nameRow(): names()[n-1]),
    # not this id: two Names share one transliteration (Al-Majid, 48 and 65,
    # content-004) so the position, not the slug, is the site's own address
    n = add_node(nid, title=tr, arabic=ar, translit=tr, url=f'/name/{i + 1}', source_file='allah.html', sources=["Qur'an " + ref] if ref else [],
                 summary=meaning, root=more[0] if more else None, rendered_by=[f'/allah#{i + 1}', f'/name/{i + 1}'], order=i + 1)
    if not essay: missing(nid, 'essay')
    if not ref: missing(nid, 'verse')
    if len(more) < 8: flag(nid, 'short_record')
    for f in text_flags(meaning, essay, more[7] if len(more) > 7 else ''): flag(nid, f)
    for v in refs_in(ref): chapter_hadith.append(('verse', nid, v))
    add_edge(nid, 'page:allah', 'part_of')
if len(NAMES) != 99: flag('page:allah', f'names_count_{len(NAMES)}')

# ================================================================== 7. PROPHETS
PROPHETS = jsd('prophets')
prophet_by_name = {}
for p in PROPHETS:
    nid = 'prophet:' + p['id']
    prophet_by_name[p['en']] = nid
    srcs = []
    for h in p.get('hadith', []) if isinstance(p.get('hadith'), list) else []:
        src = h.get('src') or h.get('source') if isinstance(h, dict) else None
        if src: srcs.append(src)
    n = add_node(nid, title=p['en'], arabic=p.get('ar'), translit=p['en'], url='/prophet/' + p['id'], source_file='prophets-data.js',
                 sources=srcs + [f"Qur'an {v['ref']}" for v in p.get('verses', []) if v.get('ref')][:0],
                 summary=p.get('blurb'), era=p.get('era'), date=None, mentions=p.get('mentions'), place=p.get('place'),
                 rendered_by=['/prophets#' + p['id'], '/prophet/' + p['id']])
    for k in ('story', 'verses', 'hadith'):
        if not p.get(k): missing(nid, k)
    if not p.get('ar'): missing(nid, 'arabic')
    for f in text_flags(p.get('blurb'), ' '.join(p.get('story', [])), json.dumps(p.get('hadith'), ensure_ascii=False)): flag(nid, f)
    for v in p.get('verses', []):
        m = REF.search(str(v.get('ref', '')))
        vv = valid_ref(m.group(1), m.group(2), m.group(3)) if m else None
        if vv: chapter_hadith.append(('verse', nid, vv))
        else: flag(nid, 'verse_ref_invalid:' + str(v.get('ref')))
    for h in p.get('hadith', []) if isinstance(p.get('hadith'), list) else []:
        if isinstance(h, dict): chapter_hadith.append(('hadith', nid, {'text': h.get('text') or h.get('t') or '', 'source': h.get('src') or h.get('source') or ''}))
    add_edge(nid, 'page:prophets', 'part_of')

# ================================================================== 8. COMPANIONS and FIGURES (characters.js), PLACES, PATH WORDS (du'as)
CHARS = jsd('characters'); PLACES = jsd('places'); PWORDS = jsd('path-words')
char_ids, place_ids, pword_ids = {}, {}, {}
def entity_kind_of(cid):
    if cid.startswith('c-'): return 'companion'
    if cid.startswith('p-'): return 'place'
    if cid.startswith('w-'): return 'dua'
    return 'figure'
token_pending = []   # (from nid, kind, target id, label)

# the room a figure's or a companion's own id renders at (api/page.js
# characterRoom(): a companion is /companion/<id>, everything else
# characters.js carries (angel, jinn, animal, end time figure) is
# /character/<id>); a place is /place/<id>; a du'a (words.js) has no room
# of its own, only an anchor on /words, so it keeps none here
def room_url(typ, eid):
    if typ == 'companion': return '/companion/' + eid
    if typ == 'figure': return '/character/' + eid
    if typ == 'place': return '/place/' + eid
    return None

def load_hub(data, src, typ_of, page, id_map):
    for section, lst in data.items():
        for e in lst:
            typ = typ_of(e['id'])
            nid = f'{typ}:{e["id"]}'
            id_map[e['id']] = nid
            srcs = [h.get('source', '') for h in e.get('hadith', []) if isinstance(h, dict) and h.get('source')]
            url = room_url(typ, e['id'])
            n = add_node(nid, title=e.get('titleEn'), arabic=e.get('titleAr'), translit=e.get('translit') or e.get('titleEn'), url=url, source_file=src,
                         sources=srcs, summary=e.get('summary'), era=e.get('role'), section=section,
                         rendered_by=[f'{page}?open={e["id"]}'] + ([url] if url else []))
            for k in ('details', 'facts', 'quran', 'hadith'):
                if not e.get(k): missing(nid, k)
            if not e.get('titleAr'): missing(nid, 'arabic')
            for f in text_flags(e.get('details'), e.get('summary'), json.dumps(e.get('facts'), ensure_ascii=False)): flag(nid, f)
            for m in TOKEN.finditer(str(e.get('details', ''))): token_pending.append((nid, m.group(1), m.group(2), m.group(3)))
            for q in e.get('quran', []) if isinstance(e.get('quran'), list) else []:
                m = REF.search(str(q.get('ref', ''))) if isinstance(q, dict) else None
                vv = valid_ref(m.group(1), m.group(2), m.group(3)) if m else None
                if vv: chapter_hadith.append(('verse', nid, vv))
                else: flag(nid, 'quran_ref_invalid:' + str(q.get('ref') if isinstance(q, dict) else q))
            for h in e.get('hadith', []) if isinstance(e.get('hadith'), list) else []:
                if isinstance(h, dict): chapter_hadith.append(('hadith', nid, h))
            add_edge(nid, page_id_of(page.strip('/') + '.html'), 'part_of')
load_hub(CHARS, 'characters.js', entity_kind_of, '/characters', char_ids)
for cid, nid in char_ids.items():
    if nid.startswith('companion:'): add_edge(nid, 'page:companions', 'part_of')
load_hub(PLACES, 'places.js', lambda i: 'place', '/places', place_ids)
load_hub(PWORDS, 'words.js', lambda i: 'dua', '/words', pword_ids)

# ================================================================== 9. HEROES and the GIFTS
HER = rj('build/heroes.json'); GIFTS = rj('build/contributions.json')
hero_by_name = {}
for era in HER['eras']:
    for p in era['people']:
        nid = 'hero:' + p['id']
        hero_by_name[p['name']] = nid
        n = add_node(nid, title=p['name'], arabic=p.get('ar'), translit=p['name'], url=None, source_file='build/heroes.json',
                     sources=[], summary=p.get('light'), era=era['title'], date=p.get('dates'), place=p.get('place'), role=p.get('role'),
                     caveat=p.get('caveat'), rendered_by=['/heroes#' + p['id']])
        prose = ' '.join(p.get('ps', []))
        n['sources'] = sorted(set(f'{c} {num}' for c, num in citations(prose)))
        if not n['sources']: missing(nid, 'citation')
        if not p.get('ar'): missing(nid, 'arabic')
        for f in text_flags(prose, p.get('light')): flag(nid, f)
        for c in citations(prose): chapter_hadith.append(('cite', nid, c, prose[:0]))
        for v in refs_in(prose): chapter_hadith.append(('verse', nid, v))
        add_edge(nid, 'page:heroes', 'part_of')
for fld in GIFTS['fields']:
    for g in fld['gifts']:
        gid = 'hero:gift-' + slug(g['t'])
        n = add_node(gid, title=g['t'], url=None, source_file='build/contributions.json', sources=[], summary=first_sentence(' '.join(g.get('ps', []))),
                     era=fld['title'], date=g.get('who'), place=g.get('where'), level=g.get('level'), kind='gift', rendered_by=['/heroes#' + slug(g['t'])])
        for f in text_flags(' '.join(g.get('ps', [])), g.get('today')): flag(gid, f)
        for name, hid in hero_by_name.items():
            if name in g.get('who', '') or name in ' '.join(g.get('ps', [])): add_edge(gid, hid, 'mentions', 1.0, via='who')
        add_edge(gid, 'page:heroes', 'part_of')

# ================================================================== 10. UNSEEN (angels, jinn, signs) as figures
UNSEEN = jsd('unseen')['entries']
for e in UNSEEN:
    nid = 'figure:unseen-' + e['id']
    ev = e.get('evidence') or {}
    refs = []
    for c in ev.get('claims', []): refs += c.get('refs', [])
    n = add_node(nid, title=e.get('title'), arabic=e.get('ar'), url=None, source_file='unseen-data.js', sources=sorted(set(refs)),
                 summary=e.get('hook'), era=e.get('cat'), level=ev.get('level'), rendered_by=['/unseen#' + e['id']])
    if not refs: missing(nid, 'refs')
    prose = ' '.join(e.get('body', []))
    for f in text_flags(prose, e.get('hook')): flag(nid, f)
    for c in citations(' '.join(refs) + ' ' + prose): chapter_hadith.append(('cite', nid, c, ''))
    for v in refs_in(' '.join(refs)): chapter_hadith.append(('verse', nid, v))
    add_edge(nid, 'page:unseen', 'part_of')

# ================================================================== 11. STORIES
STORIES = []
for f in ('build/stories-a.json', 'build/stories-b.json'):
    for s in rj(f)['stories']: STORIES.append((s, f))
story_pages = set(os.path.basename(p)[:-5] for p in HTML if p.startswith('stories/') and p != 'stories/index.html')
for s, f in STORIES:
    nid = 'story:' + s['slug']
    html = PAGE_TEXT.get('stories/' + s['slug'] + '.html', '')
    langs, cov = page_langs(html) if html else (['en'], {})
    n = add_node(nid, title=s['title'], arabic=s.get('name_ar'), translit=s.get('name_en'), url='/stories/' + s['slug'], source_file=f,
                 sources=["Qur'an " + s['ayah']['ref']] if s.get('ayah', {}).get('ref') else [], langs=langs, summary=s.get('reader_note'),
                 era=s.get('setting'), rendered_by=['/stories/' + s['slug'], '/stories'])
    if s['slug'] not in story_pages: flag(nid, 'no_page_file')
    prose = ' '.join(p for m in s.get('movements', []) for p in m.get('ps', []))
    for fl in text_flags(prose, s.get('title'), s.get('reader_note')): flag(nid, fl)
    tr = s.get('name_en')
    if tr in name_by_translit: add_edge(nid, name_by_translit[tr], 'derived_from', 1.0, via='name_en')
    else:
        alt = next((v for k, v in name_by_translit.items() if fold(k) == fold(tr)), None)
        if alt: add_edge(nid, alt, 'derived_from', 0.9, via='name_en folded'); flag(nid, f'name_spelling_differs:{tr}!={nodes[alt]["title"]}')
        else: flag(nid, 'name_not_in_99:' + str(tr))
    for v in refs_in(s.get('ayah', {}).get('ref', '')): chapter_hadith.append(('verse', nid, v))
    add_edge(nid, 'page:stories', 'part_of')
for p in story_pages - set(s['slug'] for s, _ in STORIES): flag('story:' + p, 'page_without_entry')

# ================================================================== 12. KIDS: the games and the Madrasa curriculum
KIDS = jsd('kids-hub')
listed = {x['f']: x for x in (KIDS.get('G') or []) + (KIDS.get('HEROES') or [])}
for rel in sorted(p for p in HTML if p.startswith('kids/')):
    sl = os.path.basename(rel)[:-5]
    nid = 'kid:' + sl
    html = PAGE_TEXT[rel]
    langs, cov = page_langs(html)
    n = add_node(nid, title=title_of(html), url='/kids/' + sl, source_file=rel, langs=langs, lang_coverage=cov,
                 summary=(listed.get(rel) or {}).get('l'), era='kids', rendered_by=['/kids/' + sl, '/kids'])
    n['sources'] = sorted(set(f'{c} {num}' for c, num in citations(strip_chrome(html))))
    if rel not in listed: flag(nid, 'not_listed_on_kids_hub')
    for f in text_flags(re.sub(r'<[^>]+>', ' ', strip_chrome(html))): flag(nid, f)
    for c in citations(strip_chrome(html)): chapter_hadith.append(('cite', nid, c, ''))
    add_edge(nid, 'page:kids', 'part_of')
MAD = jsd('madrasa')['tracks']
lesson_ids = set()
for t in MAD:
    tid = 'kid:track-' + t['id']
    add_node(tid, title=t['name'], arabic=t.get('ar'), url=None, source_file='madrasa-data.js', summary=t.get('desc'), era=t.get('stage'),
             rendered_by=['/madrasa#t-' + t['id']], lessons=len(t.get('lessons', [])))
    add_edge(tid, 'page:madrasa', 'part_of')
    for l in t.get('lessons', []):
        lid = f'kid:lesson-{t["id"]}-{l["id"]}'
        if lid in lesson_ids: flag(lid, 'duplicate_id')
        lesson_ids.add(lid)
        cards = l.get('cards', [])
        text = ' '.join(str(c.get(k, '')) for c in cards for k in ('h', 'p', 'en', 'ref'))
        srcs = sorted(set(f'{c} {num}' for c, num in citations(text)))
        n = add_node(lid, title=l['name'], url=None, source_file='madrasa-data.js', sources=srcs, summary=first_sentence(next((c.get('p') for c in cards if c.get('p')), '')),
                     era=t.get('stage'), minutes=l.get('mins'), cards=len(cards), quiz=bool(l.get('quiz')), rendered_by=['/madrasa#t-' + t['id']])
        if not cards: missing(lid, 'cards')
        if not l.get('quiz'): missing(lid, 'quiz')
        for f in text_flags(text): flag(lid, f)
        for c in cards:
            if c.get('t') == 'ayah' and c.get('ref'):
                for v in refs_in(c['ref']): chapter_hadith.append(('verse', lid, v))
        for c in citations(text): chapter_hadith.append(('cite', lid, c, ''))
        add_edge(lid, tid, 'part_of')

# ================================================================== 13. DAYS (the Hijri calendar) and the reels
CAL = rj('tools/reels/calendar.json')
for key, d in CAL.get('FIXED', {}).items():
    hm, hd = key.split('-')
    nid = 'day:' + d['key']
    add_node(nid, title=d.get('name'), url=None, source_file='tools/reels/calendar.json', sources=[d['basis']] if d.get('basis') else [],
             summary=d.get('what'), date=f'{hd} of month {hm} (Hijri)', level=d.get('lvl'), status=d.get('status'), rendered_by=['/today'])
    if not d.get('basis'): missing(nid, 'basis')
for mnum, d in CAL.get('MONTHS', {}).items():
    nid = f'day:month-{mnum}'
    add_node(nid, title=d.get('name'), url=None, source_file='tools/reels/calendar.json', sources=[d['basis']] if d.get('basis') else [],
             summary=d.get('what'), date=f'month {mnum} (Hijri)', level=d.get('lvl'), kind='month', rendered_by=['/today'])
    if d.get('lvl') in ('sunnah', 'debated') and not d.get('basis'): flag(nid, 'badge_without_source')

PLAN = rj('tools/reels/plan.json')
CARDS = PLAN['cards']
posted = rj('tools/reels/posted.json').get('posted', {})
day_by_key = {k: 'day:' + v['key'] for k, v in CAL.get('FIXED', {}).items()}
for cid, c in CARDS.items():
    nid = 'reel:' + cid
    row = MAN_BY_ID.get(cid)
    kind = c.get('kind')
    target = None
    if kind == 'light': target = 'light:' + cid
    elif kind == 'know': target = 'light:' + str(c.get('src'))
    elif kind == 'word': target = 'word:' + str(c.get('src'))
    elif kind == 'name': target = 'name:' + str(c.get('src'))
    elif kind == 'dua': target = 'dua:' + str(c.get('src'))
    elif kind == 'day': target = day_by_key.get(str(c.get('src'))) or (f'day:month-{c["src"][6:]}' if str(c.get('src', '')).startswith('month-') else None)
    elif kind == 'verse':
        m = re.match(r'^(\d+):(\d+)(?:-(\d+))?$', str(c.get('verse', '')))
        v = valid_ref(m.group(1), m.group(2), m.group(3)) if m else None
        target = verse_node(v) if v else None
        if not v: flag(nid, 'verse_ref_invalid:' + str(c.get('verse')))
    title = c.get('hook') or c.get('term') or c.get('translit') or c.get('verse') or cid
    n = add_node(nid, title=title, arabic=c.get('ar'), translit=c.get('translit') or c.get('term'), url=None,
                 source_file='tools/reels/plan.json', sources=[],
                 summary=first_sentence(c.get('caption')), has_video=bool(row), kind=kind, slot=c.get('slot'),
                 video=(row or {}).get('video'), secs=(row or {}).get('secs'), reciter=(row or {}).get('reciter'),
                 posted=cid in posted, rendered_by=[] )
    if not row: flag(nid, 'no_video_in_manifest')
    if row and row.get('cover') is not True and not row.get('cover'): flag(nid, 'no_cover')
    for f in text_flags(c.get('hook'), c.get('caption'), ' '.join(c.get('lines', []) if isinstance(c.get('lines'), list) else [])): flag(nid, f)
    if target and target in nodes:
        add_edge(nid, target, 'reel_of', 1.0)
        nodes[target]['reel_ids'].append(nid)
        if row: nodes[target]['has_video'] = True
        # a card carries its record's own source: the Light's src, the note's verse, the day's basis
        n['sources'] = list(nodes[target]['sources'])[:3]
    elif target:
        flag(nid, 'source_dangling:' + target)
    if kind == 'verse' and target in nodes:
        n['rendered_by'] = [nodes[target]['url']]
# manifest rows with no plan.json card: the 52 "short" films (heroes and
# Hajj), the masterplan's flagship derivatives. Each carries a `room` field
# instead (a page and a fragment, "heroes.html#mansa-musa"); trace it to the
# one graph node the fragment names, where that is unambiguous. heroes.html
# is a hub of hero: ids and eight field sections (each several gifts, never
# one), so a fragment there is read only against hero: ids; any other hub
# (only hajj.html so far) has no id space of its own, so its fragment is
# tried against every collection a section id could coincide with (hajj.html
# genuinely reuses the dictionary's own word ids for its "Ihram" and "Umrah"
# sections). A fragment naming nothing, or naming more than one node, is left
# untraced and flagged with why, never guessed from the reel's own title.
FIELD_ANCHORS = {'f-daily-table', 'f-engineering', 'f-mathematics', 'f-medicine', 'f-our-century', 'f-seeing', 'f-sky-and-sea', 'f-word-and-page'}
def resolve_short_room(room):
    if not room or '#' not in room: return None, None, 'no fragment in room: ' + str(room)
    page, frag = room.split('#', 1)
    page = page[:-5] if page.endswith('.html') else page
    if page == 'heroes':
        if frag in FIELD_ANCHORS: return None, None, 'a field section on heroes.html, several gifts, not one record'
        if f'hero:{frag}' in nodes: return f'hero:{frag}', 0.9, None
        return None, None, 'no hero id "' + frag + '" on heroes.html'
    found = sorted({cid for typ in ('word', 'place', 'prophet', 'companion', 'figure', 'hero')
                     for cid in [('place:p-' + frag) if typ == 'place' else (typ + ':' + frag)] if cid in nodes})
    if len(found) == 1: return found[0], 0.8, None
    if len(found) > 1: return None, None, 'the fragment "' + frag + '" on ' + page + '.html matches more than one node: ' + ', '.join(found)
    return None, None, 'no node matches the fragment "' + frag + '" on ' + page + '.html'
for r in MANIFEST:
    if r['id'] not in CARDS:
        nid = 'reel:' + r['id']
        flag(nid, 'manifest_row_without_card')
        add_node(nid, title=r.get('hook'), source_file='reels/index.json', has_video=True, kind=r.get('kind'), room=r.get('room'))
        # the "short" films are traced in step 15b, once PAGES (14) has made
        # page:hajj and the field gifts (9) are already in place

# ================================================================== 14. PAGES
ROOM_PAGES = {'/light': 'The Lights', '/path': 'The Path', '/verses': 'The verses', '/today': 'Today'}
for rel in HTML:
    if rel.startswith(('dictionary/', 'kids/')) or (rel.startswith('stories/') and rel != 'stories/index.html'): continue
    html = PAGE_TEXT[rel]
    pid = page_id_of(rel)
    top = rel.split('/')[0]
    lang = top if top in LANG_DOORS and rel.endswith('index.html') else None
    langs, cov = page_langs(html)
    body = strip_chrome(html)
    text = re.sub(r'<[^>]+>', ' ', body)
    srcs = sorted(set(f'{c} {num}' for c, num in citations(text)))
    n = add_node(pid, title=title_of(html), url=page_url(rel), source_file=rel, sources=srcs, langs=[lang] if lang else langs,
                 lang_coverage=cov, summary=None, era='language door' if lang else ('masjid' if top == 'masjid' else 'page'),
                 rendered_by=[page_url(rel)], bytes=len(html.encode('utf-8')))
    m = re.search(r'<meta name="description" content="([^"]*)"', html)
    n['summary'] = htmlmod.unescape(m.group(1)) if m else None
    if not n['summary']: missing(pid, 'description')
    noindex = bool(re.search(r'<meta name="robots" content="[^"]*noindex', html))
    if noindex: n['noindex'] = True
    for f in text_flags(text): flag(pid, f)
    for c in citations(text): chapter_hadith.append(('cite', pid, c, ''))
    for v in refs_in(text)[:0]: pass   # prose verse refs on pages are not made edges: too noisy without context
for url, title in ROOM_PAGES.items():
    pid = 'page:' + url.strip('/')
    if pid not in nodes: add_node(pid, title=title, url=url, source_file='api/page.js', summary='rendered on the server', era='room', rendered_by=[url])
for must in ('page:dictionary', 'page:quran', 'page:allah', 'page:prophets', 'page:characters', 'page:companions', 'page:places', 'page:words', 'page:heroes', 'page:unseen', 'page:stories', 'page:kids', 'page:madrasa'):
    if must not in nodes: add_node(must, title=must, url='/' + must.split(':')[1], source_file='(missing)'); flag(must, 'hub_page_missing')

# ================================================================== 15. resolve the pending references
# tokens {{n:2|Adam}} etc. in the Path's prose: exact id references
for src, kind, tid, label in token_pending:
    if kind == 'n':
        t = f'chapter:{tid}'
    elif kind == 'c':
        t = char_ids.get(tid)
    elif kind == 'p':
        t = place_ids.get(tid)
    else:
        t = pword_ids.get(tid)
    if t and t in nodes: add_edge(src, t, 'links', via='token')
    else: flag(src, f'token_dangling:{kind}:{tid}')
for cid, d in NODES.items():
    for m in TOKEN.finditer(str(d.get('details', ''))):
        kind, tid = m.group(1), m.group(2)
        t = f'chapter:{tid}' if kind == 'n' else char_ids.get(tid) if kind == 'c' else place_ids.get(tid) if kind == 'p' else pword_ids.get(tid)
        if t and t in nodes: add_edge(f'chapter:{cid}', t, 'links', via='token')
        else: flag(f'chapter:{cid}', f'token_dangling:{kind}:{tid}')

# ================================================================== 15b. short reels: field gifts, hajj page, Lights
# now that PAGES (14) has made page:hajj, the "short" manifest rows still
# unresolved by resolve_short_room (a heroes.html field section, several
# gifts and not one record, or a hajj.html fragment naming nothing) get one
# more pass using each film's own brief at tools/films/briefs/plate-<x>.json:
#  (a) heroes.html field section: trace to the one gift, or life, whose name
#      or a distinctive title word is shared with the brief's closing
#      eyebrow, at 0.9; more than one match, or none, is left untraced and
#      the brief text that matched is kept as the edge's evidence. The
#      brief's own note is prose, not a name line, and is never matched
#      against: a common word repeated between a note and a gift's title
#      ("every", "house", "prayer") is not the same thing as a name, and a
#      lower-confidence tier that nothing currently needs is not worth the
#      risk of a false trace the day a new brief happens to share one.
#  (b) a brief that cites a Light by id (`[lights/all.json: <id>]`) earns
#      that film an extra reel_of to the Light, on top of (a) or (c).
#  (c) hajj.html fragment naming nothing: trace to page:hajj itself at 0.7,
#      honest that the film is cut from that page's section, not a record.
FIELD_ANCHOR_ORDER = re.findall(r'<section class="rsec fieldsec" id="(f-[a-z-]+)"', rd('heroes.html'))
if set(FIELD_ANCHOR_ORDER) != FIELD_ANCHORS or len(FIELD_ANCHOR_ORDER) != len(GIFTS['fields']):
    flag('page:heroes', 'field_anchor_order_mismatch')
fields_by_anchor = dict(zip(FIELD_ANCHOR_ORDER, GIFTS['fields']))

FIELD_STOPWORDS = set("""the a an of and or to in on for from that this with by at is was were it its as
    into onto per about across through over under after before between during since until while out up
    down off again further once here there when where why how all any both each few more most other
    some such no nor not only own same so than too very can will just now above below one two three
    four five six seven eight nine ten hundred thousand early late modern ancient century centuries year
    years also became known founding founder founded practice general method sky earth science scholar
    scholars scholarly world arabic islamic muslim islam knowledge learning history historic ibn al bin
    abd abdul abu son daughter father every house prayer""".split())

def distinctive_words(*texts):
    out = set()
    for t in texts:
        out |= {w for w in re.findall(r'[a-zA-Z]+', str(t or '').lower()) if len(w) >= 3 and w not in FIELD_STOPWORDS}
    return out

def resolve_field(frag, brief):
    fld = fields_by_anchor.get(frag)
    if not fld: return None, None, None
    # the eyebrow only: a name line, not prose (see the note above the flags)
    eyebrow = (brief.get('lines') or [{}])[-1].get('eyebrow', '')
    if not eyebrow: return None, None, None
    tw = distinctive_words(eyebrow)
    if not tw: return None, None, None
    gift_words = {('hero:gift-' + slug(g['t'])): distinctive_words(g['t'], g.get('who')) for g in fld['gifts']}
    hit = sorted(gid for gid, gw in gift_words.items() if gw & tw)
    if len(hit) == 1: return hit[0], 0.9, 'brief eyebrow: "' + eyebrow + '"'
    if len(hit) > 1: return None, None, 'brief eyebrow names more than one gift: ' + ', '.join(hit)
    return None, None, None
    return None, None, None

LIGHT_CITE = re.compile(r'\[lights/all\.json:\s*([a-z0-9-]+)\]')
def light_from_brief(brief):
    m = LIGHT_CITE.search(json.dumps(brief))
    return m.group(1) if m and m.group(1) in light_ids else None

BRIEFS = {}
for f in sorted(glob.glob(os.path.join(REPO, 'tools', 'films', 'briefs', 'plate-*.json'))):
    BRIEFS['short-' + os.path.basename(f)[len('plate-'):-len('.json')]] = rj('tools/films/briefs/' + os.path.basename(f))

for r in MANIFEST:
    if r.get('kind') != 'short' or r['id'] in CARDS: continue
    nid = 'reel:' + r['id']
    if nid not in nodes: continue
    room = r.get('room')
    brief = BRIEFS.get(r['id'])
    target, conf, why = resolve_short_room(room)
    if target:
        add_edge(nid, target, 'reel_of', conf)
        nodes[target]['reel_ids'].append(nid)
    else:
        page, frag = (room.split('#', 1) + [''])[:2] if room and '#' in room else (None, None)
        page = page[:-5] if page and page.endswith('.html') else page
        if page == 'heroes' and frag in FIELD_ANCHORS and brief:
            g_target, g_conf, evidence = resolve_field(frag, brief)
            if g_target:
                add_edge(nid, g_target, 'reel_of', g_conf, via=evidence)
                nodes[g_target]['reel_ids'].append(nid)
            else:
                flag(nid, 'short_untraced:' + (evidence or 'no gift in ' + frag + ' shares a name with the brief'))
        elif page == 'hajj':
            add_edge(nid, 'page:hajj', 'reel_of', 0.7, via='section:' + frag)
            nodes['page:hajj']['reel_ids'].append(nid)
            flag(nid, 'short_traced_to_page:hajj')
        else:
            flag(nid, 'short_untraced:' + (why or 'no fragment in room: ' + str(room)))
    if brief:
        lid = light_from_brief(brief)
        if lid:
            add_edge(nid, 'light:' + lid, 'reel_of', 1.0, via='brief cites lights/all.json: ' + lid)
            nodes['light:' + lid]['reel_ids'].append(nid)

# hadith: one node per citation; entries whose one source string names two or
# three citations joined by a separator are the same report, so they merge.
parent = {}
def find(x):
    while parent.setdefault(x, x) != x:
        parent[x] = parent[parent[x]]; x = parent[x]
    return x
def union(a, b): parent[find(a)] = find(b)
hadith_texts = defaultdict(list)      # citation -> [(text, from)]
hadith_entries = []
for item in chapter_hadith:
    if item[0] != 'hadith': continue
    _, src, h = item
    text, source = str(h.get('text', '')).strip(), str(h.get('source', '')).strip()
    cs = citations(source)
    if cs and len(cs) <= 3 and re.fullmatch(r'[^;]*', source):
        for c in cs[1:]: union(cs[0], c)
    hadith_entries.append((src, text, source, cs))
    if not cs:
        if not source: flag(src, 'hadith_without_source')
        else: flag(src, 'hadith_source_unnumbered:' + source[:40])
    for c in cs: hadith_texts[c].append((text, src))
PRIORITY = ['bukhari', 'muslim', 'tirmidhi', 'abu-dawud', 'nasai', 'ibn-majah', 'ahmad', 'malik']
def canon(c):
    if c not in parent: return c
    root = find(c)
    grp = [k for k in list(parent) if find(k) == root] or [c]
    grp.sort(key=lambda k: (PRIORITY.index(k[0]) if k[0] in PRIORITY else 99, int(re.sub(r'\D', '', k[1]) or 0)))
    return grp[0]
def hadith_node(c, text=None, src_file=None):
    cc = canon(c)
    nid = f'hadith:{cc[0]}-{cc[1]}'
    if nid not in nodes:
        add_node(nid, title=None, url=None, source_file=src_file, sources=[], summary=None, collection=cc[0], number=cc[1], cited_by=0)
    n = nodes[nid]
    lab = f'{c[0]} {c[1]}'
    if lab not in n['sources']: n['sources'].append(lab)
    if text and not n['title']: n['title'] = text[:120]
    if text and n['summary'] is None: n['summary'] = first_sentence(text)
    return nid
for src, text, source, cs in hadith_entries:
    if not cs:
        nid = 'hadith:u-' + h8(text or source)
        if nid not in nodes: add_node(nid, title=(text or source)[:120], source_file=nodes[src]['source_file'], sources=[source] if source else [], summary=first_sentence(text)); flag(nid, 'unnumbered_source')
        add_edge(nid, src, 'source_of', via='hadith[]'); nodes[nid]['cited_by'] = nodes[nid].get('cited_by', 0) + 1
        continue
    for c in cs:
        nid = hadith_node(c, text, nodes[src]['source_file'])
        add_edge(nid, src, 'source_of', via='hadith[]'); nodes[nid]['cited_by'] += 1
for item in chapter_hadith:
    if item[0] == 'cite':
        _, src, c, _ = item
        nid = hadith_node(c, None, nodes[src]['source_file'])
        add_edge(nid, src, 'source_of', via='citation'); nodes[nid]['cited_by'] += 1
    elif item[0] == 'verse':
        _, src, v = item
        add_edge(verse_node(v), src, 'source_of', via='quran[]')
# a hadith cited with two different numbers of the same collection, or the same
# number carrying two texts, is worth a flag for the cross checks
for c, lst in hadith_texts.items():
    texts = set(t[:60] for t, _ in lst if t)
    if len(texts) > 1: flag(hadith_node(c), f'same_number_several_excerpts:{len(texts)}')

# ================================================================== 16. hyperlinks: static pages, then the rooms' own logic
def node_of_url(u):
    u = u.split('?')[0].split('#')[0].rstrip('/') or '/'
    if u.startswith('/light/'): return 'light:' + u[7:]
    if u.startswith('/dictionary/'): return 'word:' + u[12:]
    if u.startswith('/path/'): return 'chapter:' + u[6:]
    if u.startswith('/surah/'): return 'surah:' + u[7:]
    if u.startswith('/verse/'): return 'verse:' + u[7:]
    if u.startswith('/stories/'): return 'story:' + u[9:]
    if u.startswith('/kids/'): return 'kid:' + u[6:]
    return 'page:' + (slug(u.strip('/')) or 'home')
for rel, hrefs in PAGE_LINKS.items():
    a = node_of_url(page_url(rel))
    if a not in nodes: continue
    for h in sorted(hrefs):  # a set, whose own order is not stable run to run
        b = node_of_url(h)
        if b in nodes: add_edge(a, b, 'links', via='href')
        else: flag(a, 'href_dangling:' + h)
# rendered rooms: replicate api/page.js relatedWords()/relatedLights() so the
# Light, chapter and verse rooms' "Read beside it" links are in the graph
DICT_KEYS = {wid: [k for k in (fold(e['term']), fold(wid.replace('-', ' '))) if len(k) >= 3] for wid, (e, _) in DICT.items()}
def related_words(text, limit=6):
    hay = ' ' + fold(text) + ' '
    out = [wid for wid, keys in DICT_KEYS.items() if any((' ' + k + ' ') in hay for k in keys)]
    return sorted(out, key=lambda w: -len(fold(DICT[w][0]['term'])))[:limit]
tagn = Counter(t for L in LIGHTS for t in L.get('tags', []))
def group_of(L):
    t = L.get('tags', [])
    return next((x for x in t if tagn[x] > 1), t[0] if t else L['k'])
def related_lights(L, limit=4):
    tags = set(L.get('tags', []))
    sc = []
    for x in LIGHTS:
        if x['id'] == L['id']: continue
        s = len(tags & set(x.get('tags', []))) * 2 + (2 if group_of(x) == group_of(L) else 0) + (1 if x.get('c') == L.get('c') else 0)
        if s > 0: sc.append((-s, (x.get('w') or {}).get('y', 10**9), x['id']))
    return [i for _, _, i in sorted(sc)[:limit]]
for L in LIGHTS:
    a = 'light:' + L['id']
    for w in related_words(L['t'] + ' ' + L['s']): add_edge(a, 'word:' + w, 'links', via='room:relatedWords')
    for x in related_lights(L): add_edge(a, 'light:' + x, 'links', via='room:relatedLights')
for cid, d in NODES.items():
    a = f'chapter:{cid}'
    for w in related_words(d['titleEn'] + ' ' + d.get('summary', '') + ' ' + ' '.join(d.get('lessons', []))): add_edge(a, 'word:' + w, 'links', via='room:relatedWords')
    if cid - 1 in NODES: add_edge(a, f'chapter:{cid - 1}', 'links', via='room:prev')
    if cid + 1 in NODES: add_edge(a, f'chapter:{cid + 1}', 'links', via='room:next')
for v in SHELF:
    if v[0] == 'invalid': continue
    a = verse_node(v); row = MAN_BY_ID.get('verse-' + ref_id(*v))
    en = nodes[a]['summary'] or ''
    for w in related_words(((row or {}).get('caption', '') + ' ' + en)): add_edge(a, 'word:' + w, 'links', via='room:relatedWords')
# every surah room links its shelf verses, the Mushaf and its neighbours; every word page its `see` words (already), the dictionary and the domain
for s in SURAHS:
    a = f'surah:{s}'
    if s - 1 in SURAHS: add_edge(a, f'surah:{s - 1}', 'links', via='room:prev')
    if s + 1 in SURAHS: add_edge(a, f'surah:{s + 1}', 'links', via='room:next')
for v in SHELF:
    if v[0] != 'invalid': add_edge(f'surah:{v[0]}', verse_node(v), 'links', via='room:shelf')

# ================================================================== 17. mentions by the house's own name table (scripts/build.mjs AUTOLINK)
AUTO = jsd('autolink')['AUTOLINK']
def auto_target(t):
    if re.fullmatch(r'\d+', str(t)): return f'chapter:{t}'
    return char_ids.get(t) or place_ids.get(t) or pword_ids.get(t)
NAME_TABLE = []   # (name, target nid, confidence)
for name, t in AUTO.items():
    nid = auto_target(t)
    if nid: NAME_TABLE.append((name, nid, 1.0 if ' ' in name else 0.8))
for p in PROPHETS: NAME_TABLE.append((p['en'], 'prophet:' + p['id'], 1.0 if ' ' in p['en'] else 0.8))
for idmap in (char_ids, place_ids):
    for cid, nid in idmap.items():
        t = nodes[nid]['title'] or ''
        if ' ' in t and not t.startswith('The ') and '&' not in t and t not in AUTO: NAME_TABLE.append((t, nid, 1.0))
for name, hid in hero_by_name.items(): NAME_TABLE.append((name, hid, 1.0))
for tr, nid in name_by_translit.items(): NAME_TABLE.append((tr, nid, 1.0))
NAME_TABLE.sort(key=lambda x: -len(x[0]))
WORDCH = r"[A-Za-z'’-]"
def mentions_in(text, self_id=None):
    """name -> (confidence, count): count is how many times that name is
    actually named in this text (word-boundary matches), not just whether it
    is; a shelf built from these edges (derive_entity_graph.py) reads count
    as how strongly the two are tied, a repeated name outranking a single
    passing one at the same confidence."""
    text = str(text or '')
    found = {}
    for name, nid, conf in NAME_TABLE:
        if nid == self_id or nid in found: continue
        n = 0
        for m in re.finditer(re.escape(name), text):
            b, a = text[m.start() - 1:m.start()], text[m.end():m.end() + 1]
            if not re.match(WORDCH, b or ' ') and not re.match(WORDCH, a or ' '):
                n += 1
        if n: found[nid] = (conf, n)
    return found
COMP_FIRST = defaultdict(list)
GENERIC = {'ibn', 'bint', 'al', 'abu', 'abd', 'ar', 'as', 'an', 'umm', 'the'}
COMP_BIGRAMS = {}
for cid, nid in char_ids.items():
    if nid.startswith('companion:'):
        toks = fold(nodes[nid]['title']).split(' ')
        COMP_FIRST[toks[0]].append(nid)
        COMP_BIGRAMS[nid] = [toks[i] + ' ' + toks[i + 1] for i in range(len(toks) - 1) if not (toks[i] in GENERIC and toks[i + 1] in GENERIC)]
def match_companion(L):
    c = L.get('c', '')
    t = auto_target(AUTO[c]) if c in AUTO else None
    if t: return t
    hay = ' ' + fold(L['id'].replace('-', ' ') + ' ' + L['t'] + ' ' + L['s']) + ' '
    for cid, nid in char_ids.items():
        tail = cid[2:]
        if nid.startswith('companion:') and (tail == slug(c) or L['id'].startswith(tail + '-')): return nid
    cands = COMP_FIRST.get(fold(c).split(' ')[0], []) if fold(c) else []
    if len(cands) == 1: return cands[0]
    # the eyebrow is a short form (Abdurrahman, Zayd): the record whose distinctive name pair is in the card
    norm = lambda w: re.sub(r'h$', '', w)
    hay_n = ' ' + ' '.join(norm(w) for w in hay.split()) + ' '
    score = Counter()
    for nid, bgs in COMP_BIGRAMS.items():
        for bg in bgs:
            a, b = bg.split(' ')
            if (' ' + norm(a) + ' ' + norm(b) + ' ') in hay_n: score[nid] += 1
    if cands: score = Counter({k: v for k, v in score.items() if k in cands}) or score
    best = score.most_common(2)
    if best and (len(best) == 1 or best[0][1] > best[1][1]): return best[0][0]
    return None
for L in LIGHTS:
    a = 'light:' + L['id']
    for nid, (conf, n) in mentions_in(L['t'] + ' ' + L['s'] + ' ' + L.get('d', '')).items(): add_edge(a, nid, 'mentions', conf, via='light text', weight=n)
    # a companion Light's eyebrow is the companion's own name
    c = L.get('c', '')
    if L['k'] != 'companion': continue
    t = match_companion(L)
    if t: add_edge(a, t, 'mentions', 1.0, via='light c')
    else: flag(a, 'companion_without_record:' + c)
for p in PROPHETS:
    a = 'prophet:' + p['id']
    for cid, d in NODES.items():
        if re.search(r'(?<!' + WORDCH + ')' + re.escape(p['en']) + r'(?!' + WORDCH + ')', d['titleEn']):
            add_edge(f'chapter:{cid}', a, 'mentions', 1.0, via='chapter title')
        elif re.search(r'(?<!' + WORDCH + ')' + re.escape(p['en']) + r'(?!' + WORDCH + ')', d.get('details', '')):
            add_edge(f'chapter:{cid}', a, 'mentions', 0.7, via='chapter details')
    for nid, (conf, n) in mentions_in(' '.join(p.get('story', [])), a).items(): add_edge(a, nid, 'mentions', conf, via='story', weight=n)
for era in HER['eras']:
    for p in era['people']:
        a = 'hero:' + p['id']
        for nid, (conf, n) in mentions_in(' '.join(p.get('ps', [])), a).items(): add_edge(a, nid, 'mentions', conf, via='prose', weight=n)
for i, r in enumerate(NAMES):
    a = name_by_translit[r[1]]
    essay = (r[3] or [''] * 3)[2] if r[3] else ''
    for nid, (conf, n) in mentions_in(essay, a).items(): add_edge(a, nid, 'mentions', conf, via='essay', weight=n)
for e in UNSEEN:
    a = 'figure:unseen-' + e['id']
    for nid, (conf, n) in mentions_in(' '.join(e.get('body', [])), a).items(): add_edge(a, nid, 'mentions', conf, via='body', weight=n)
for s, _ in STORIES:
    a = 'story:' + s['slug']
    for nid, (conf, n) in mentions_in(' '.join(p for m in s.get('movements', []) for p in m.get('ps', [])), a).items(): add_edge(a, nid, 'mentions', conf, via='prose', weight=n)
for wid, (e, _) in DICT.items():
    a = 'word:' + wid
    for nid, (conf, n) in mentions_in(e.get('long', ''), a).items(): add_edge(a, nid, 'mentions', conf, via='long', weight=n)
# reels' cards name people and places too (the caption is the library's words)
for cid, c in CARDS.items():
    if c.get('kind') in ('light', 'know', 'day'):
        for nid, (conf, n) in mentions_in(' '.join([c.get('hook', ''), c.get('caption', '')] + list(c.get('lines') or [])), 'reel:' + cid).items():
            add_edge('reel:' + cid, nid, 'mentions', conf, via='caption', weight=n)

# ================================================================== 18. same entity in two collections
def title_key(s): return fold(s).replace(' ', '-')
by_title = defaultdict(list)
for nid, n in nodes.items():
    if n['type'] in ('light', 'reel', 'hadith', 'verse', 'page', 'surah', 'kid', 'story') or not n.get('title'): continue
    k = nid.split(':', 1)[1]
    k = re.sub(r'^(c|p|w|a|j|e|an|unseen|gift|track|lesson)-', '', k)
    by_title[k].append(nid)
    if n['type'] in ('word', 'name', 'prophet', 'companion', 'figure', 'place', 'hero', 'dua', 'story'):
        by_title[title_key(n['title'])].append(nid)
        if n.get('translit') and title_key(n['translit']) != title_key(n['title']): by_title[title_key(n['translit'])].append(nid)
same_pairs = set()
ARTICLE = re.compile(r'^(the|al|ad|as|an|ar|ash|at|az|adh|ath) ')
def heads(nid, k):
    """the shared slug must be the record's whole title once its article is dropped, or its head word
    (Bilal ibn Rabah, Ad-Dajjal; not The Angels of Badr)"""
    n = nodes[nid]
    for t in (n.get('title'), n.get('translit')):
        if not t: continue
        ft = ARTICLE.sub('', fold(t))
        if ft.replace(' ', '-') == k or ft.split(' ')[0] == k.split('-')[0]: return True
    return False
for k, lst in by_title.items():
    lst = sorted(set(lst))
    for i in range(len(lst)):
        for j in range(i + 1, len(lst)):
            a, b = lst[i], lst[j]
            if a.split(':')[0] == b.split(':')[0]: continue
            if not (heads(a, k) and heads(b, k)):
                add_edge(a, b, 'mentions', 0.6, via='slug:' + k); continue
            same_pairs.add((a, b, k))
for a, b, k in sorted(same_pairs):
    add_edge(a, b, 'same_entity_as', 0.9, via='slug:' + k)
    flag(a, 'title_in_two_collections:' + b); flag(b, 'title_in_two_collections:' + a)
# spelling variants of one slug across collections (hudaybiyyah / hudaybiyah, abu-bakr / abubakr,
# jahiliyya / jahiliyyah): hyphens, a trailing h, a doubled letter and the Arabic 'wa' do not make a new entity
def loose(k):
    k = re.sub(r'-(wa|al)-', '-', k).replace('-', '')
    k = re.sub(r'h$', '', k)
    return re.sub(r'(.)\1', r'\1', k)
by_loose = defaultdict(set)
for nid, n in nodes.items():
    if n['type'] in ('word', 'place', 'companion', 'figure', 'prophet', 'hero', 'dua', 'name', 'day'):
        k = re.sub(r'^(c|p|w|a|j|e|an|unseen|gift)-', '', nid.split(':', 1)[1])
        if len(k) >= 6: by_loose[loose(k)].add(nid)
    elif n['type'] == 'chapter':
        k = slug(n['title'].split(':')[0])
        if len(k) >= 6 and ' ' not in n['title'].split(':')[0].strip(): by_loose[loose(k)].add(nid)
for k, lst in by_loose.items():
    lst = sorted(lst)
    for i in range(len(lst)):
        for j in range(i + 1, len(lst)):
            a, b = lst[i], lst[j]
            if a.split(':')[0] == b.split(':')[0] or (a, b, 'same_entity_as') in edge_seen: continue
            add_edge(a, b, 'same_entity_as', 0.8, via='spelling:' + k)
            flag(a, 'spelling_variant_of:' + b); flag(b, 'spelling_variant_of:' + a)
# the explicit ones the site itself asserts: a prophet's chapter (AUTOLINK maps the name to it)
for name, t in AUTO.items():
    if name in prophet_by_name and re.fullmatch(r'\d+', str(t)):
        add_edge(prophet_by_name[name], f'chapter:{t}', 'same_entity_as', 1.0, via='AUTOLINK')
# characters.js angels/jinn/endtime against unseen-data.js
for cid, nid in char_ids.items():
    tail = re.sub(r'^(a|j|e|an)-', '', cid)
    for e in UNSEEN:
        if e['id'] == tail or (nodes[nid].get('arabic') and nodes[nid]['arabic'] == e.get('ar')):
            add_edge(nid, 'figure:unseen-' + e['id'], 'same_entity_as', 1.0, via='id/arabic')

# ================================================================== 19. finish the nodes: quality, summaries, duplicates within a collection
title_seen = defaultdict(list)
for nid, n in nodes.items():
    if n['title']: title_seen[(n['type'], fold(n['title']))].append(nid)
for k, lst in title_seen.items():
    if len(lst) > 1:
        for nid in lst: flag(nid, 'duplicate_title_in_collection:' + ','.join(x for x in lst if x != nid))
for nid, n in nodes.items():
    q = quality.get(nid)
    if q:
        n['quality']['missing'] = sorted(set(q['missing']))
        n['quality']['flags'] = sorted(set(q['flags']))
    if n['type'] == 'hadith' and not n['title']: n['title'] = n['sources'][0] if n['sources'] else n['id']; n['text_known'] = False
    elif n['type'] == 'hadith': n['text_known'] = True
    if not n['title']: n['quality']['missing'].append('title')
    if n['type'] not in ('hadith', 'reel', 'page', 'verse') and not n['summary']: n['quality']['missing'].append('summary')
    n['reel_ids'] = sorted(set(n['reel_ids']))
    n['sources'] = [s for s in n['sources'] if s]
    for k in [k for k, v in n.items() if v is None and k not in ('title', 'arabic', 'translit', 'url', 'summary', 'era', 'date', 'source_file')]:
        del n[k]

# ================================================================== 19b. canonical: same-as.json (content-003)
# The audit found 63 records that are one thing under two ids; scripts/graph/same-as.json
# hand-picks the pairs that are a genuine duplicate (a companion also written as a
# dictionary word, an angel described twice, a place spelled two ways), each one
# verified by title or Arabic against the source files, never a guess. A Path
# chapter that retells a prophet's, a place's or a word's story is not folded in
# here: the chapter is its own stop on the discovery path, not the same record.
same_as_path = os.path.join(HERE, 'same-as.json')
try:
    SAME_AS = json.load(open(same_as_path, encoding='utf-8')).get('same_as', {})
except FileNotFoundError:
    SAME_AS = {}
same_as_bad = [f'{a} -> {c}' for a, c in SAME_AS.items() if a not in nodes or c not in nodes]
if same_as_bad:
    print('WARNING same-as.json names an id the graph does not have:', same_as_bad, file=sys.stderr)
for nid, n in nodes.items():
    n['canonical'] = SAME_AS.get(nid, nid)

# ================================================================== 20. validate and write
node_ids = set(nodes)
dangling = [e for e in edges if e['from'] not in node_ids or e['to'] not in node_ids]
edges = [e for e in edges if e['from'] in node_ids and e['to'] in node_ids]
by_type = Counter(n['type'] for n in nodes.values())
by_rel = Counter(e['rel'] for e in edges)
by_rel_type = Counter((e['rel'], e['from'].split(':')[0], e['to'].split(':')[0]) for e in edges)
# the newest mtime among every content file this run actually opened (not
# out/js/*.json, which extract_js.mjs writes fresh every run): so two runs
# over an unchanged tree agree, and the date moves only when a source does
GENERATED = datetime.fromtimestamp(max(OPENED), tz=timezone.utc).strftime('%Y-%m-%d') if OPENED else None
types = sorted(by_type)
graph = {}
if GENERATED: graph['generated'] = GENERATED
graph.update({'version': 1, 'repo': os.path.basename(os.path.normpath(REPO)), 'types': types,
         'counts': {'nodes': len(nodes), 'edges': len(edges), 'by_type': dict(sorted(by_type.items())), 'by_rel': dict(sorted(by_rel.items()))},
         'rels': {'links': 'a hyperlink or an id cross reference (see, connections, {{n:2|Adam}} tokens, room links)',
                  'mentions': 'a name matched in prose; confidence 1.0 for a multi word name or the record\'s own eyebrow, 0.8 for a single word name, 0.7 in a chapter\'s details',
                  'same_entity_as': 'one person, place or thing recorded in two collections',
                  'part_of': 'containment: verse in surah, lesson in track, entity on the page that renders it',
                  'reel_of': 'a reel card to the record it was cut from',
                  'source_of': 'a verse or a hadith cited by the record',
                  'derived_from': 'a text written from another record (a story from a Name)'},
         'nodes': [nodes[k] for k in sorted(nodes)], 'edges': edges})
with open(os.path.join(OUT, 'noor-content-graph.json'), 'w', encoding='utf-8') as f:
    json.dump(graph, f, ensure_ascii=False, indent=0)

# inventory: one row per collection
def inv(collection, file, ids, with_source, with_arabic, with_url, langs, issues):
    inventory.append({'collection': collection, 'file': file, 'count': len(ids), 'with_source': with_source, 'with_arabic': with_arabic,
                      'with_url': with_url, 'langs': langs, 'issues': issues})
def issues_of(ids):
    c = Counter()
    for nid in ids:
        for f in nodes[nid]['quality']['flags']: c[re.sub(r':.*', '', f)] += 1
        for m in nodes[nid]['quality']['missing']: c['missing_' + m] += 1
    return '; '.join(f'{k} {v}' for k, v in sorted(c.items(), key=lambda kv: -kv[1])[:8])
def langs_of(ids):
    c = Counter(l for nid in ids for l in nodes[nid]['langs'])
    return ' '.join(f'{l}:{n}' for l, n in sorted(c.items(), key=lambda kv: (-kv[1], kv[0])))
def row(collection, file, pred):
    ids = [nid for nid, n in nodes.items() if pred(nid, n)]
    inv(collection, file, ids, sum(1 for i in ids if nodes[i]['sources']), sum(1 for i in ids if nodes[i]['arabic']),
        sum(1 for i in ids if nodes[i]['url']), langs_of(ids), issues_of(ids))
row('Lights', 'lights/all.json', lambda i, n: n['type'] == 'light')
row('Dictionary words', 'build/dict-*.json, dictionary/*.html', lambda i, n: n['type'] == 'word')
row('Path chapters', 'node/*.json, nodes-index.js', lambda i, n: n['type'] == 'chapter')
row('Surah rooms', 'study/*.json, tools/reels/quran-uthmani.json', lambda i, n: n['type'] == 'surah')
row('Verses (shelf)', 'tools/reels/verses.txt, reels/index.json', lambda i, n: n['type'] == 'verse' and n.get('on_shelf'))
row('Verses (with a note)', 'verse/*.json', lambda i, n: n['type'] == 'verse' and n.get('has_note'))
row('Verses (cited only)', 'quran[] and refs in the collections', lambda i, n: n['type'] == 'verse' and not n.get('on_shelf') and not n.get('has_note'))
row('The 99 Names', 'allah.html (inline NAMES)', lambda i, n: n['type'] == 'name')
row('Prophets', 'prophets-data.js', lambda i, n: n['type'] == 'prophet')
row('Companions', 'characters.js (companions)', lambda i, n: n['type'] == 'companion')
row('Figures: angels, jinn, animals, end times', 'characters.js (other sections)', lambda i, n: n['type'] == 'figure' and not i.startswith('figure:unseen'))
row('Unseen entries', 'unseen-data.js', lambda i, n: i.startswith('figure:unseen'))
row('Places', 'places.js', lambda i, n: n['type'] == 'place')
row("Du'as of the Path", 'words.js', lambda i, n: n['type'] == 'dua')
row('Heroes (torchbearers)', 'build/heroes.json', lambda i, n: n['type'] == 'hero' and n.get('kind') != 'gift')
row('Heroes (gifts)', 'build/contributions.json', lambda i, n: n['type'] == 'hero' and n.get('kind') == 'gift')
row('Hadith (numbered)', 'hadith[] arrays and citations across the collections', lambda i, n: n['type'] == 'hadith' and not i.startswith('hadith:u-'))
row('Hadith (unnumbered)', 'hadith[] arrays with a source that names no number', lambda i, n: i.startswith('hadith:u-'))
row('Kids pages', 'kids/*.html', lambda i, n: n['type'] == 'kid' and not i.startswith(('kid:track', 'kid:lesson')))
row('Madrasa tracks', 'madrasa-data.js', lambda i, n: i.startswith('kid:track'))
row('Madrasa lessons', 'madrasa-data.js', lambda i, n: i.startswith('kid:lesson'))
row('Stories', 'build/stories-*.json, stories/*.html', lambda i, n: n['type'] == 'story')
row('Calendar days', 'tools/reels/calendar.json', lambda i, n: n['type'] == 'day')
row('Reel cards', 'tools/reels/plan.json, reels/index.json', lambda i, n: n['type'] == 'reel')
row('Pages (static and rooms)', '*.html, api/page.js', lambda i, n: n['type'] == 'page')
with open(os.path.join(OUT, 'inventory.csv'), 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=['collection', 'file', 'count', 'with_source', 'with_arabic', 'with_url', 'langs', 'issues'])
    w.writeheader(); w.writerows(inventory)

flag_counts = Counter()
for n in nodes.values():
    for fl in n['quality']['flags']: flag_counts[(n['type'], re.sub(r':.*', '', fl))] += 1
    for m in n['quality']['missing']: flag_counts[(n['type'], 'missing_' + m)] += 1
validation = {'nodes': len(nodes), 'edges': len(edges), 'dangling_edges_dropped': len(dangling), 'dangling_sample': dangling[:20],
              'by_type': dict(sorted(by_type.items())), 'by_rel': dict(sorted(by_rel.items())),
              'by_rel_and_types': {f'{r} {a}->{b}': c for (r, a, b), c in sorted(by_rel_type.items())},
              'flags_by_type': {f'{t} {f}': c for (t, f), c in sorted(flag_counts.items())},
              'every_edge_endpoint_is_a_node': all(e['from'] in node_ids and e['to'] in node_ids for e in edges)}
json.dump(validation, open(os.path.join(OUT, 'out', 'validation.json'), 'w'), indent=1)
json.dump({nid: n['quality'] for nid, n in nodes.items() if n['quality']['flags'] or n['quality']['missing']},
          open(os.path.join(OUT, 'out', 'quality.json'), 'w'), indent=0, ensure_ascii=False)
print(f'nodes {len(nodes)}  edges {len(edges)}  dangling dropped {len(dangling)}')
print('by type:', dict(sorted(by_type.items())))
print('by rel:', dict(sorted(by_rel.items())))
print('valid:', validation['every_edge_endpoint_is_a_node'])
