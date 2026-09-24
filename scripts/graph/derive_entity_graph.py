#!/usr/bin/env python3
"""NOOR Content Graph, step 4: rebuild assets/entity-graph.json from the graph.

    python3 derive_entity_graph.py [--graph build/graph/noor-content-graph.json] [--out assets/entity-graph.json]

assets/entity-graph.json was derived by hand on 16 September 2026 from the
audit's Content Graph so api/page.js could give the prophet, companion,
character, place and name rooms a "Read beside it" shelf (batch 5). Its own
`_about` said it had to be rebuilt from the graph when the collections
change, and nothing in the repository could do that; this script is that
rebuild, run by scripts/graph/run.sh after build_graph.py.

The rules are the ones api/page.js already documents at its own read of this
file (const entityGraph, above besideEntity()) and the ones the file's own
`_about` states, applied to the graph's edges rather than written by hand:

    lights      light -> mentions -> entity: a place at confidence 0.8 and
                above, a person (prophet, companion, character, a Name) only
                at 1.0, since a single word can share a place's name with a
                person (Mansa Musa, Musa) but only a full name is trusted for
                a person.
    chapters    a chapter tied to the entity by a {{n:..}}/{{c:..}}/{{p:..}}
                token, in either its own prose or the chapter's, by a
                mentions edge at 0.8 and above (either direction), or by a
                same_entity_as edge (the entity's own chapter of the Path,
                at 0.8 and above).
    word        the entity's own dictionary word: a same_entity_as edge to a
                word: node at 0.8 and above (content-003's genuine
                duplicates only; see scripts/graph/same-as.json).
    words       words that name it: mentions edges from a word: node at 0.8
                and above (its own word above can also appear here, when the
                dictionary entry's own text names the entity as well as
                being it: two edges, kept apart).
    people      other prophets, companions and characters tied to it by a
                token or a mentions edge at 0.8 and above, either direction.
    places      places tied to it the same way.
    stories     the Name a story of the eight was written from
                (derived_from), and any of the eight whose own prose names
                the entity at 0.8 and above (mentions): a story can name a
                prophet or a place as well as the Name it retells.
    unseen      for a character only: the same figure's entry on /unseen,
                when characters.js and unseen-data.js describe it twice
                (content-003) and same-as.json says so.

A room's key stays out of the file if the graph gives it nothing: the
original file has no empty {} entries, and this script matches that so a
missing key means "nothing to show", the same thing api/page.js already
reads it as (`_about`: "a missing file costs the rooms their related shelf
and never an error"; an absent key inside the file behaves the same way,
since edgesOf() returns {} for a key it does not find).
"""
import argparse, json, os
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_DEFAULT = os.path.normpath(os.path.join(HERE, '..', '..'))

ap = argparse.ArgumentParser()
ap.add_argument('--graph', default=os.path.join(REPO_DEFAULT, 'build', 'graph', 'noor-content-graph.json'))
ap.add_argument('--out', default=os.path.join(REPO_DEFAULT, 'assets', 'entity-graph.json'))
ap.add_argument('--same-as', default=os.path.join(HERE, 'same-as.json'))
args = ap.parse_args()

g = json.load(open(args.graph, encoding='utf-8'))
nodes = {n['id']: n for n in g['nodes']}

# same-as.json is the hand-kept curation of which of the graph's own
# same_entity_as edges are a genuine content-003 duplicate (word:hasan is
# the hadith grade, not the companion Hasan, even though the two titles
# match); `word` and `unseen` below are the two fields that claim "this is
# the same record", so they read only a curated pair, never a raw edge
CURATED = set()
same_as_file = json.load(open(args.same_as, encoding='utf-8'))
for k, v in same_as_file.get('same_as', {}).items():
    CURATED.add((k, v)); CURATED.add((v, k))
def curated(a, b):
    return (a, b) in CURATED

mentions_from = defaultdict(list)   # nid -> [(to, confidence, order)]
mentions_to = defaultdict(list)     # nid -> [(from, confidence, order)]
same_as = defaultdict(list)         # nid -> [(other, confidence)], both directions
token_either = defaultdict(set)     # nid -> {other, ...}: a {{n:..}}/{{c:..}}/{{p:..}} token names
                                     # it, in the chapter's own prose or in the entity's own (both
                                     # directions exist: a character's "details" can token a chapter
                                     # number just as a chapter's can token a character or a place)
story_of = defaultdict(set)         # nid -> {story:.., ..}: the Name it was written from
                                     # (derived_from), plus any entity its prose names at 0.8+

# how many distinct edges the graph itself records between two nodes, either
# direction, any relation: a real count of connectedness (a pair tied by
# both a mentions edge and, say, a token or a same_entity_as edge is more
# tied than a pair the graph records only once), unlike mentions_in's own
# per-text occurrence count (kept on the edge as `weight`, but a text
# repeating a name is a fact about that one text, not about how tied the
# two are across the library, so it is not used to rank the shelf)
tie_count = defaultdict(int)
for e in g['edges']:
    pair = (e['from'], e['to']) if e['from'] < e['to'] else (e['to'], e['from'])
    tie_count[pair] += 1
def ties(a, b):
    return tie_count[(a, b) if a < b else (b, a)]

for order, e in enumerate(g['edges']):
    rel = e['rel']
    if rel == 'mentions':
        conf = e.get('confidence', 0)
        mentions_from[e['from']].append((e['to'], conf, order))
        mentions_to[e['to']].append((e['from'], conf, order))
        if e['from'].startswith('story:') and conf >= 0.8: story_of[e['to']].add(e['from'])
    elif rel == 'same_entity_as':
        conf = e.get('confidence', 0)
        same_as[e['from']].append((e['to'], conf))
        same_as[e['to']].append((e['from'], conf))
    elif rel == 'links' and e.get('via') == 'token':
        token_either[e['from']].add(e['to'])
        token_either[e['to']].add(e['from'])
    elif rel == 'derived_from' and e['from'].startswith('story:'):
        story_of[e['to']].add(e['from'])

def by_relevance(nid, rows):
    """rank candidates the way a reader's shelf should, for the entity
    `nid`: the strongest confidence first, then how strongly the two are
    tied (ties(), the graph's own distinct-edge count between the pair),
    then the order build_graph.py met the edge walking the source files
    (earlier is not "better", but it is a real, deterministic fact about
    the source, and a fairer tie-break than the accident of an id's
    spelling), and only then the id itself, so two edges tied on
    everything else still sort the same way on every machine. `rows` is
    [(id, confidence, order), ...]; duplicates by id (the same pair can be
    found from more than one field) keep the strongest row."""
    best = {}
    for other, conf, order in rows:
        row = (conf, ties(nid, other), order)
        if other not in best or row > best[other]: best[other] = row
    ranked = sorted(best.items(), key=lambda kv: (-kv[1][0], -kv[1][1], kv[1][2], kv[0]))
    return [other for other, _ in ranked]

def is_person(nid):
    """prophet, companion, or a character that is not the Unseen page's own copy"""
    t = nid.split(':', 1)[0]
    if t in ('prophet', 'companion'): return True
    return t == 'figure' and not nid.startswith('figure:unseen-')

def is_place(nid):
    return nid.startswith('place:')

def family_key(nid):
    """the room family api/page.js renders this id under, in its own id form"""
    t, i = nid.split(':', 1)
    if t == 'prophet': return 'prophet:' + i
    if t == 'companion': return 'companion:' + i
    if t == 'figure' and not nid.startswith('figure:unseen-'): return 'character:' + i
    if t == 'place': return nid
    if t == 'name':
        order = nodes[nid].get('order')
        return f'name:{order}' if order else None
    return None

def entity_ids():
    for nid, n in nodes.items():
        if n['type'] in ('prophet', 'companion', 'place'): yield nid
        elif n['type'] == 'figure' and not nid.startswith('figure:unseen-'): yield nid
        elif n['type'] == 'name': yield nid

def strip(nid):
    return nid.split(':', 1)[1]

out = {}
for nid in entity_ids():
    key = family_key(nid)
    if not key: continue
    rec = {}

    # lights: a place at 0.8 and above, a person (prophet, companion, character, name) only at 1.0;
    # besideEntity() shows only the first 8, so the order here is the order a reader sees, ranked
    # by relevance (by_relevance), not by the accident of a Light's own id
    thresh = 0.8 if is_place(nid) else 1.0
    lights = by_relevance(nid, ((f, c, o) for f, c, o in mentions_to.get(nid, []) if f.startswith('light:') and c >= thresh))
    if lights: rec['lights'] = [strip(f) for f in lights]

    # chapters: a token either way, a mentions edge either way at 0.8 and
    # above, or the entity's own chapter of the Path by same_entity_as
    chapters = set()
    for o in token_either.get(nid, ()):
        if o.startswith('chapter:'): chapters.add(int(strip(o)))
    for f, conf, order in mentions_to.get(nid, []) + mentions_from.get(nid, []):
        if f.startswith('chapter:') and conf >= 0.8: chapters.add(int(strip(f)))
    for other, conf in same_as.get(nid, []):
        if other.startswith('chapter:') and conf >= 0.8: chapters.add(int(strip(other)))
    if chapters: rec['chapters'] = sorted(chapters)

    # word: the entity's own dictionary word, by same_entity_as at 0.8 and
    # above, curated: a title or Arabic match the graph found is a claim
    # this is the same record, and same-as.json is the check that it truly
    # is (word:hasan matches companion:c-hasan by title alone, but the word
    # is the hadith grade; same-as.json leaves it out, so it must not appear
    # here even though the graph's own edge exists)
    word_candidates = sorted((strip(o) for o, c in same_as.get(nid, []) if o.startswith('word:') and c >= 0.8 and curated(nid, o)))
    word = word_candidates[0] if word_candidates else None
    if word: rec['word'] = word

    # words: words that name it, by mentions at 0.8 and above (its own word
    # above is a same_entity_as match; a word can also earn its way in here
    # on its own, by mentioning the entity in its own text, the two edges
    # kept apart rather than one collapsed into the other); besideEntity()
    # shows only the first 8, ranked by relevance the same way as lights
    words = by_relevance(nid, ((f, c, o) for f, c, o in mentions_to.get(nid, []) if f.startswith('word:') and c >= 0.8))
    if words: rec['words'] = [strip(f) for f in words]

    # people and places named either way: a token either of the two carries,
    # or a mentions edge either way at 0.8 and above
    tied = set(token_either.get(nid, ())) | {o for o, c, order in mentions_from.get(nid, []) + mentions_to.get(nid, []) if c >= 0.8}
    tied.discard(nid)
    people = sorted({family_key(o) for o in tied if is_person(o) and family_key(o)})
    if people: rec['people'] = people
    places = sorted({strip(o) for o in tied if is_place(o)})
    if places: rec['places'] = places

    # stories: the Name it was written from, and any story whose prose names it
    stories = sorted({strip(s) for s in story_of.get(nid, ())})
    if stories: rec['stories'] = stories

    # the same figure's own entry on the Unseen page (content-003), curated
    # the same way as word above: same-as.json is the check, not the raw edge
    if nid.startswith('figure:') and not nid.startswith('figure:unseen-'):
        unseen_partner = next((o for o, _ in same_as.get(nid, []) if o.startswith('figure:unseen-') and curated(nid, o)), None)
        if unseen_partner: rec['unseen'] = '/unseen#' + strip(unseen_partner)[len('unseen-'):]

    if rec: out[key] = rec

ABOUT = ("Derived by scripts/graph/derive_entity_graph.py from the Content Graph "
         "(build/graph/noor-content-graph.json, built by scripts/graph/build_graph.py). "
         "For each room family api/page.js renders (prophet, companion, character, "
         "place, name) the rooms its edges tie it to: lights that name it (mentions: "
         "a place at confidence 0.8 and above, a person only at 1.0, a whole name, "
         "since a given name alone matched Mansa Musa to the prophet Musa), chapters "
         "(links by token, mentions at 0.8 and above, same_entity_as), its dictionary "
         "word (same_entity_as at 0.8 and above), words that name it (mentions at 0.8 "
         "and above), people and places named either way, the stories written from a "
         "Name, and the entry on the Unseen page. Run scripts/graph/run.sh (build, "
         "validate, derive) whenever the Lights, the dictionary, the Path, the "
         "prophets, characters.js, places.js, words.js, unseen-data.js or the stories "
         "change; a missing file costs the rooms their related shelf and never an "
         "error.")
result = {"_about": ABOUT}
result.update({k: out[k] for k in sorted(out)})  # plain string sort: the file's own original order

os.makedirs(os.path.dirname(args.out), exist_ok=True)
with open(args.out, 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, separators=(',', ':'))
print(f'{len(out)} entities written to {args.out}')
