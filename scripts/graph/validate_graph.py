#!/usr/bin/env python3
"""Validate a NOOR Content Graph file: every edge endpoint is a node, ids are
unique and well formed, and print the counts by type and by rel.
    python3 validate_graph.py noor-content-graph.json
Exit 1 on any failure."""
import json, re, sys
from collections import Counter
g = json.load(open(sys.argv[1], encoding='utf-8'))
ids = [n['id'] for n in g['nodes']]
dup = [k for k, c in Counter(ids).items() if c > 1]
bad_id = [i for i in ids if not re.fullmatch(r'[a-z]+:[A-Za-z0-9._-]+', i)]
idset = set(ids)
dangling = [e for e in g['edges'] if e['from'] not in idset or e['to'] not in idset]
bad_type = [n['id'] for n in g['nodes'] if n['type'] not in g['types'] or not n['id'].startswith(n['type'] + ':')]
rels = {'mentions', 'links', 'derived_from', 'same_entity_as', 'part_of', 'reel_of', 'source_of'}
bad_rel = [e for e in g['edges'] if e['rel'] not in rels]
fuzzy_without_conf = [e for e in g['edges'] if e['rel'] == 'mentions' and 'confidence' not in e]
req = ['id', 'type', 'title', 'arabic', 'translit', 'url', 'source_file', 'sources', 'langs', 'summary', 'era', 'date', 'has_video', 'reel_ids', 'quality']
missing_fields = [n['id'] for n in g['nodes'] if any(k not in n for k in req)]
print(f"nodes {len(ids)}, edges {len(g['edges'])}, generated {g['generated']}, version {g['version']}")
print('by type:', dict(sorted(Counter(n['type'] for n in g['nodes']).items())))
print('by rel: ', dict(sorted(Counter(e['rel'] for e in g['edges']).items())))
problems = {'duplicate ids': dup, 'malformed ids': bad_id, 'dangling edges': dangling[:5], 'type mismatch': bad_type[:5], 'unknown rel': bad_rel[:5], 'mentions without confidence': fuzzy_without_conf[:5], 'nodes missing a required field': missing_fields[:5]}
ok = True
for k, v in problems.items():
    if v: ok = False; print(f'FAIL {k}: {v}')
print('VALID' if ok else 'INVALID')
sys.exit(0 if ok else 1)
