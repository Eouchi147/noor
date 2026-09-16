#!/usr/bin/env python3
"""NOOR - what is IN a plate, step by step, so a brief can be timed to it.

    python3 plateplan.py sieve road teachers

A brief says how many pieces of the drawing land under each sentence. Getting
that right needs to know what the pieces ARE and what order they come in, and
that is a property of the figure rather than of the topic. This prints it.
"""
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))


def inner_of(seg):
    seg = re.sub(r"^<[a-zA-Z][\w-]*[^>]*>", "", seg, flags=re.S)
    return re.sub(r"</[a-zA-Z][\w-]*>\s*$", "", seg, flags=re.S)


def split_top(body):
    """(tag, source) for every element child, in document order"""
    out, i, n = [], 0, len(body)
    while i < n:
        m = re.compile(r"<([a-zA-Z][\w-]*)").search(body, i)
        if not m: break
        tag, j = m.group(1), m.start()
        if tag in ("g", "text", "tspan", "a", "switch"):
            depth, p = 0, j
            while p < n:
                mm = re.compile(r"<(/?)([a-zA-Z][\w-]*)[^>]*?(/?)>").search(body, p)
                if not mm: break
                if mm.group(1): depth -= 1
                elif mm.group(3) != "/": depth += 1
                p = mm.end()
                if depth == 0: break
            seg = body[j:p]
        else:
            p = body.find(">", j) + 1
            seg = body[j:p]
        if tag not in ("title", "desc", "style", "defs", "metadata"):
            out.append((tag, seg))
        i = p
    return out

def main():
    info = json.loads(open(os.path.join(HERE, "web", "plates.js")).read()
                      .rsplit("window.NOORPLATEINFO = ", 1)[1].rstrip().rstrip(";"))
    plates = json.loads(open(os.path.join(HERE, "web", "plates.js")).read()
                        .split("window.NOORPLATE = ", 1)[1]
                        .split(";\nwindow.NOORPLATEINFO", 1)[0])
    for name in sys.argv[1:]:
        if name not in plates:
            print("  no plate", name); continue
        body = re.sub(r"^<svg[^>]*>", "", plates[name], flags=re.S)
        body = re.sub(r"</svg>\s*$", "", body, flags=re.S)
        body = re.sub(r"<style>.*?</style>", "", body, flags=re.S)
        print("\n===== %s   viewBox %s" % (name, " ".join("%.0f" % v for v in info[name]["vb"])))
        #  the same rule web/plate.js uses: a figure with fewer than twelve
        #  top level pieces is opened up one level, because a drawing with
        #  four pieces cannot carry a nine line script.
        tops = split_top(body)
        if len(tops) < 12:
            ex = []
            for tag, seg in tops:
                k2 = split_top(inner_of(seg)) if tag == "g" else []
                if len(k2) >= 2: ex.extend(k2)
                else: ex.append((tag, seg))
            tops = ex
        for k, (tag, seg) in enumerate(tops):
            cls = re.search(r'class="([^"]*)"', seg)
            words = " ".join(re.findall(r">([^<>]+)</text>", seg))[:64]
            if not words and tag == "text":
                words = re.sub(r"<[^>]*>", "", seg)[:64]
            print("  %2d  %-9s %-14s %s" % (k, tag, (cls.group(1) if cls else "")[:14], words))
        continue
        i, n, k = 0, len(body), 0
        while i < n:
            m = re.compile(r"<([a-zA-Z][\w-]*)").search(body, i)
            if not m: break
            tag, j = m.group(1), m.start()
            if tag in ("g", "text", "tspan", "a"):
                depth, p = 0, j
                while p < n:
                    mm = re.compile(r"<(/?)([a-zA-Z][\w-]*)[^>]*?(/?)>").search(body, p)
                    if not mm: break
                    if mm.group(1): depth -= 1
                    elif mm.group(3) != "/": depth += 1
                    p = mm.end()
                    if depth == 0: break
                seg = body[j:p]
            else:
                p = body.find(">", j) + 1
                seg = body[j:p]
            if tag not in ("title", "desc"):
                cls = re.search(r'class="([^"]*)"', seg)
                words = " ".join(re.findall(r">([^<>]+)</text>", seg))[:64]
                print("  %2d  %-9s %-14s %s" % (k, tag, (cls.group(1) if cls else "")[:14], words))
                k += 1
            i = p
    return 0

if __name__ == "__main__":
    sys.exit(main())
