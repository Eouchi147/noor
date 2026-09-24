#!/usr/bin/env python3
"""NOOR Content Graph: rebuild assets/reel-subjects.json from the shelf.

    python3 derive_reel_subjects.py [--repo .] [--out assets/reel-subjects.json]

api/_insights.js's subject fold (masterplan step 8, the learning loop) needs
to know, for a reel on the shelf, which Light group, which surah, which
dictionary category or which achievements-room field it belongs to, so the
console can show "Surah al-Baqarah reaches more than Surah an-Nas" rather
than only "verse reels beat word reels". The first version of this read
lights/all.json, assets/dict-index.json and tools/reels/quran-uthmani.json
live, through api/page.js's own lightById(), groupOf(), dictionary() and
surahRow() -- and a refuter's review found the deploy gap: api/page.js's
includeFiles is set on api/page.js and api/sitemap.js alone, and none of
api/insights.js, api/house.js (through api/_flow.js's collect()) or
api/warm.js carried it, so on Vercel those files would be missing and the
subject fold would ship silently empty, no error, just nothing to say.

This script is the same fix scripts/graph/derive_person_words.py already
is for relatedWords()'s person-word exemptions: one small file, computed
here where every source file is on disk, deployed with includeFiles the way
any other assets/*.json already is, so api/_insights.js reads a plain JSON
object and never touches lights/, tools/reels/ or api/page.js at all. Rerun
scripts/graph/run.sh whenever the Lights, the dictionary or the shelf's
plan change; do not hand edit the output.

The four kinds a subject can be derived for, the same four api/_insights.js
documented before this script existed:

    reel:light  the card's own id IS a Light's id (lights/all.json); its
                group is the same first-shared-tag grouping api/page.js's
                groupOf() gives the Light's own room (ported here, since
                this script cannot import a Vercel function file).
    reel:verse  the card's id is "verse-<surah>-<ayah...>"; the surah's own
                translit name comes from tools/reels/quran-uthmani.json.
    reel:word   the card's id is "word-<slug>"; the dictionary entry
                (assets/dict-index.json) names its own category.
    reel:short  a film's card carries `room`, "heroes.html#f-<field>"; the
                field after f- is the subject.

A Name, a Did you know, a This day and a du'a reel are not tied to one of
these four rooms in the shelf's own data (a Did you know's source Light is
kept in tools/reels/know.json, outside reels/index.json), so they carry no
entry here, the same absence subjectOf() already returned for them.
"""
import argparse, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_DEFAULT = os.path.normpath(os.path.join(HERE, '..', '..'))

ap = argparse.ArgumentParser()
ap.add_argument('--repo', default=REPO_DEFAULT)
ap.add_argument('--out', default=None)
args = ap.parse_args()
REPO = args.repo
OUT = args.out or os.path.join(REPO, 'assets', 'reel-subjects.json')


def read_json(rel):
    p = os.path.join(REPO, rel)
    try:
        with open(p, encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return None


# ---------------------------------------------------------------------------
# groupOf, ported from api/page.js: a Light's group is the first tag at
# least one other Light also carries, then its own first tag, then its
# kind. groupLabel turns "early-islam" into "Early Islam".
# ---------------------------------------------------------------------------
def group_label(g):
    return ' '.join(w[:1].upper() + w[1:] for w in str(g).split('-') if w)


def build_light_groups(lights):
    tag_count = {}
    for L in lights:
        for t in L.get('tags') or []:
            tag_count[t] = tag_count.get(t, 0) + 1
    out = {}
    for L in lights:
        tags = L.get('tags') or []
        g = next((t for t in tags if tag_count.get(t, 0) > 1), None)
        if g is None:
            g = tags[0] if tags else (L.get('k') or 'light')
        out[L['id']] = g
    return out


def main():
    lights = (read_json('lights/all.json') or {}).get('lights', [])
    light_group = build_light_groups(lights)

    dict_words = (read_json('assets/dict-index.json') or {}).get('words', {})

    surahs = (read_json('tools/reels/quran-uthmani.json') or {}).get('surahs', {})

    manifest = read_json('reels/index.json') or {}
    cards = manifest.get('cards') if isinstance(manifest, dict) else manifest
    cards = cards if isinstance(cards, list) else []

    subjects = {}
    for c in cards:
        if not isinstance(c, dict):
            continue
        cid = c.get('id')
        kind = c.get('kind')
        if not cid or not kind:
            continue

        if kind == 'light':
            g = light_group.get(cid)
            if g:
                subjects[cid] = {'group': 'light:' + g, 'label': group_label(g)}

        elif kind == 'verse':
            m = re.match(r'^verse-(\d+)-', cid)
            if m:
                n = m.group(1)
                row = surahs.get(n) or {}
                label = 'Surah ' + n + (' (' + row['translit'] + ')' if row.get('translit') else '')
                subjects[cid] = {'group': 'surah:' + n, 'label': label}

        elif kind == 'word':
            slug = cid[len('word-'):] if cid.startswith('word-') else cid
            e = dict_words.get(slug) or {}
            if e.get('cat'):
                subjects[cid] = {'group': 'word:' + e['cat'], 'label': e['cat']}

        elif kind == 'short':
            room = c.get('room') or ''
            m = re.search(r'#f-([a-z-]+)', room)
            if m:
                field = m.group(1)
                subjects[cid] = {'group': 'film:' + field, 'label': group_label(field)}

    out = {
        '_about': 'Generated by scripts/graph/derive_reel_subjects.py from lights/all.json, '
                  'assets/dict-index.json, tools/reels/quran-uthmani.json and reels/index.json. '
                  'Do not hand edit; rerun scripts/graph/run.sh. Read by api/_insights.js\'s '
                  'subjectOf() so the subject fold never has to touch lights/, tools/reels/ or '
                  'api/page.js on the deployed site.',
        'subjects': {k: subjects[k] for k in sorted(subjects)}
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=1, ensure_ascii=False)
        f.write('\n')
    print(f"wrote {OUT}: {len(subjects)} reels with a subject")


if __name__ == '__main__':
    main()
