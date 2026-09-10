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
#  95 and 90 encode in the same time and 90 is forty per cent of the bytes,
#  which is forty per cent less for ffmpeg to decode on the other end of the
#  pipe. The frames are an intermediate; the film is encoded from them at
#  CRF 17, and no eye has ever met the JPEGs.
JPEG_Q = 90

#  How many samples of the light layer each finished pixel is boxed down from,
#  in each direction: 2 means the scene is drawn at four times the area and
#  resolved by the shader that composites the bloom. This is the antialiasing,
#  and it is the difference between an edge and a staircase.
#
#  The first cut of this went the other way -- it drew the layer at 62% of the
#  frame and let the browser stretch it up, on the reasoning that bloom is low
#  frequency. Bloom is. The silhouettes inside it are not, and magnifying them
#  magnified every step. See the note in web/lume.js.
LUME_SS = 2
