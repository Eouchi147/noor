#!/usr/bin/env python3
"""The Lantern Films · the two frames, and the clock.

A film is described once and laid out twice. Nothing is cropped: the wide
frame and the tall frame are two compositions of the same scene, because a
16:9 film squeezed into 9:16 reads as a mistake and a 9:16 film letterboxed
into 16:9 reads as an accident. The layout is done in CSS off one attribute
on <html>, so the scene description never mentions a pixel.
"""

FPS = 30

WIDE = {"name": "wide", "w": 1920, "h": 1080}
TALL = {"name": "tall", "w": 1080, "h": 1920}
FRAMES = {"wide": WIDE, "tall": TALL}

#  The picture is rendered a frame at a time by a headless browser: the
#  timeline is built PAUSED and seeked to an exact millisecond, so a slow
#  machine makes a slow render and never a dropped frame. Measured on a
#  runner with no GPU, at 1080p: 85 ms a frame wide, 101 ms tall. A twelve
#  minute film is about half an hour of rendering per frame shape, which is
#  why chapters are rendered as separate segments and concatenated: a chapter
#  that changes costs one chapter.
JPEG_Q = 95
