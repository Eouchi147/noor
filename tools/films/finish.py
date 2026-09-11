#!/usr/bin/env python3
"""Join the chapters, lay the score under them, and make the copies that travel.

A master is encoded once, at quality, and stays where it was made. What
crosses to a person's disk is a second file, made in one pass from the master,
sized so that each chapter fits through in a single piece -- because the only
thing worse than a slightly smaller file is a file that arrives in nineteen
numbered fragments.
"""
import glob, json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
DEL = "/mnt/user-data/outputs"
CAP = 18_800_000


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        sys.stderr.write(" ".join(cmd) + "\n" + r.stderr[-1500:] + "\n")
    return r.returncode == 0


def dur(p):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "default=nw=1:nk=1", p], capture_output=True, text=True)
    try: return float(r.stdout.strip())
    except Exception: return 0.0


def main():
    slug = sys.argv[1] if len(sys.argv) > 1 else "what-is-islam"
    frame = sys.argv[2] if len(sys.argv) > 2 else "wide"
    segs = sorted(glob.glob(os.path.join(OUT, "%s-0*-%s.mp4" % (slug, frame))))
    if not segs:
        sys.exit("no chapters rendered yet")
    print("chapters:")
    for s in segs:
        print("   %-46s %6.1fs %7.1f MB" % (os.path.basename(s), dur(s), os.path.getsize(s)/1e6))

    lst = os.path.join(OUT, "_join.txt")
    with open(lst, "w", encoding="utf-8") as f:
        for s in segs:
            f.write("file '%s'\n" % os.path.abspath(s))
    silent = os.path.join(OUT, "%s-%s-silent.mp4" % (slug, frame))
    run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
         "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", silent])
    os.remove(lst)

    score = os.path.join(OUT, "%s-score.wav" % slug)
    master = os.path.join(OUT, "%s-%s.mp4" % (slug, frame))
    if os.path.exists(score):
        run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
             "-i", silent, "-i", score, "-map", "0:v:0", "-map", "1:a:0",
             "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ac", "2",
             "-shortest", "-movflags", "+faststart", master])
    else:
        master = silent
    print("\nmaster  %s  %.1fs  %.1f MB" % (os.path.basename(master), dur(master),
                                            os.path.getsize(master)/1e6))

    #  the copies that travel: one per chapter, each in one piece
    os.makedirs(DEL, exist_ok=True)
    made, at = [], 0.0
    for s in segs:
        name = os.path.basename(s).replace(slug + "-", "").replace("-" + frame + ".mp4", "")
        d = dur(s)
        kbps = min(5200, max(900, int((CAP * 8 / 1000) / max(0.1, d) * 0.90)))
        dst = os.path.join(DEL, "%s.mp4" % name)
        ok = run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                  "-ss", "%.3f" % at, "-t", "%.3f" % d, "-i", master,
                  "-c:v", "libx264", "-preset", "slow", "-b:v", "%dk" % kbps,
                  "-maxrate", "%dk" % int(kbps * 1.35), "-bufsize", "%dk" % int(kbps * 2.2),
                  "-pix_fmt", "yuv420p", "-color_primaries", "bt709", "-color_trc", "bt709",
                  "-colorspace", "bt709", "-c:a", "aac", "-b:a", "128k",
                  "-movflags", "+faststart", dst])
        at += d
        if ok:
            sz = os.path.getsize(dst)
            made.append({"name": name, "secs": round(d, 1), "mb": round(sz/1e6, 1),
                         "path": dst, "fits": sz <= CAP})
            print("   %-24s %5.1fs  %4d kbps  %5.1f MB  %s"
                  % (name, d, kbps, sz/1e6, "" if sz <= CAP else "STILL TOO BIG"))
    with open(os.path.join(DEL, "_manifest.json"), "w", encoding="utf-8") as f:
        json.dump({"master": os.path.basename(master), "parts": made}, f, indent=1)
    print("\nmanifest -> " + os.path.join(DEL, "_manifest.json"))


if __name__ == "__main__":
    main()
