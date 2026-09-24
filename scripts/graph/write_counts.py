#!/usr/bin/env python3
"""NOOR Content Graph, step 5: the one block of counts CONTENT_STATUS.md is
allowed to have written for it (content-010: NOOR.md and CONTENT_STATUS.md
quote counts the source files no longer have, because nothing rebuilt them).

    python3 write_counts.py [--graph build/graph/noor-content-graph.json] [--file CONTENT_STATUS.md]

Replaces only the text between the two marker comments; every other line of
the file is left exactly as a person wrote it. If the markers are not found,
the block is appended at the end, once, so a first run does not need a
hand-edit first.
"""
import argparse, json, os, re
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_DEFAULT = os.path.normpath(os.path.join(HERE, '..', '..'))

ap = argparse.ArgumentParser()
ap.add_argument('--graph', default=os.path.join(REPO_DEFAULT, 'build', 'graph', 'noor-content-graph.json'))
ap.add_argument('--file', default=os.path.join(REPO_DEFAULT, 'CONTENT_STATUS.md'))
args = ap.parse_args()

g = json.load(open(args.graph, encoding='utf-8'))
by_type = Counter(n['type'] for n in g['nodes'])
reel_nodes = {n['id']: n for n in g['nodes'] if n['type'] == 'reel'}
reel_of = {e['from'] for e in g['edges'] if e['rel'] == 'reel_of'}
plan_reels = [nid for nid in reel_nodes if not nid.startswith('reel:short-')]
short_reels = [nid for nid in reel_nodes if nid.startswith('reel:short-')]
untraced_plan = [nid for nid in plan_reels if nid not in reel_of]
untraced_short = sorted(nid for nid in short_reels if nid not in reel_of)

# no `generated` date here: this file is committed, and a date read from a
# content file's mtime is only as stable as the checkout that set it, so a
# runner and a person's own machine would disagree on a tree that has not
# changed at all. build/graph/noor-content-graph.json (not committed) keeps
# its own `generated`, for a person reading it on the machine that built it.
START, END = '<!-- graph-counts:start -->', '<!-- graph-counts:end -->'
lines = [START,
         '### The graph\'s own counts',
         '',
         'Written by `scripts/graph/write_counts.py`, part of `scripts/graph/run.sh`; do not edit by hand,'
         ' it is overwritten on the next run. Source: `build/graph/noor-content-graph.json`.',
         '',
         '| type | count |', '|---|---|']
for t in sorted(by_type):
    lines.append(f'| {t} | {by_type[t]} |')
lines += ['',
          f'The reel plan: {len(plan_reels)} cards, {len(plan_reels) - len(untraced_plan)} traced to a content'
          f' object by a `reel_of` edge, {len(untraced_plan)} not.',
          '',
          f'The heroes and Hajj "short" films (masterplan\'s flagship derivatives, outside the plan, named by a'
          f' `room` field): {len(short_reels)} total, {len(short_reels) - len(untraced_short)} traced, either a'
          f' `room` fragment naming exactly one graph node, a field-section film matched to one gift by its own'
          f' brief (`tools/films/briefs/plate-<x>.json`), or a hajj.html fragment naming nothing traced honestly'
          f' to the page itself; {len(untraced_short)} not, listed by scripts/graph/build_graph.py\'s own'
          f' `short_untraced` flag rather than guessed from the reel\'s own title:']
reasons = Counter()
for nid in untraced_short:
    for f in reel_nodes[nid]['quality']['flags']:
        if f.startswith('short_untraced:'):
            # the fragment or the node list a reason names varies reel to
            # reel; group by the reason's own shape, not its exact words
            reasons[re.sub(r'"[^"]*"', '"..."', f[len('short_untraced:'):])] += 1
for reason, n in sorted(reasons.items(), key=lambda kv: (-kv[1], kv[0])):
    lines.append(f'- {n}: {reason}')
lines.append(END)
block = '\n'.join(lines) + '\n'

text = open(args.file, encoding='utf-8').read() if os.path.exists(args.file) else ''
pat = re.compile(re.escape(START) + r'.*?' + re.escape(END), re.S)
if pat.search(text):
    text = pat.sub(block.rstrip('\n'), text)
else:
    sep = '\n\n' if text and not text.endswith('\n\n') else ('\n' if text and not text.endswith('\n') else '')
    text = text + sep + block

with open(args.file, 'w', encoding='utf-8') as f:
    f.write(text)
print(f'graph-counts block written to {args.file}')
