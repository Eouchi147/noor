#!/usr/bin/env python3
"""The frame, and the part of it the platforms leave alone.

Instagram and Facebook paint their own furniture over a reel: a header at the
top, a rail of buttons down the right, and the username, caption and audio
ticker along the bottom. Meta's published organic guidance is 270 clear at the
top, about 320 at the bottom and 65 each side. These are tighter on every edge,
and the right margin clears the button rail rather than only the frame edge.

Nothing a reader has to read may enter that border. `webreel.py --audit`
measures the rendered alpha of the type layer against this rectangle every
fifth frame of every card, so a word that bleeds while it is still animating is
caught as surely as one that never fitted.
"""
W, H, FPS = 1080, 1920, 30
SAFE_TOP, SAFE_BOTTOM = 270, 1500
SAFE_L, SAFE_R = 84, 950


def ease(t):
    """smooth in, no bounce: this is reading, not play"""
    t = max(0.0, min(1.0, t))
    return 1 - pow(1 - t, 3)
