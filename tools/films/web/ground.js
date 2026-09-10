/* NOOR film · the ground.
   ---------------------------------------------------------------------------
   Every pixel of it is drawn here, from numbers: there is no photograph, no
   footage and no stock in this film, so there is nothing in it that anyone
   else owns.

   It must also be a PURE FUNCTION OF TIME. The film is rendered a frame at a
   time by a headless browser that seeks the timeline to an exact millisecond
   and takes one screenshot; nothing may depend on how many frames have gone
   before, or the render would drift from the preview and from itself. So the
   drift, the blooms and the grain are all evaluated from t, and the noise is
   a seeded hash rather than Math.random.
*/
(function () {
  "use strict";
  var c = document.getElementById("ground"), x = c.getContext("2d", { alpha: false });
  var film = null;
  var W = 0, H = 0, grain = null;

  /* a small integer hash: the same cell always gets the same speck */
  function h2(i, j, s) {
    var n = (i * 374761393 + j * 668265263 + s * 1442695040888963407) >>> 0;
    n = (n ^ (n >>> 13)) >>> 0; n = (n * 1274126177) >>> 0;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  }

  /* THE GROUND IS DRAWN SMALL AND BLOWN UP.
     Measured: with the ground redrawing at full size, a frame took 572 ms;
     with it switched off entirely, 174. Seventy per cent of the whole render
     was two radial gradients being filled across two million pixels in
     software, thirty times a second, on a runner with no GPU.

     Nothing in the ground has an edge. It is gradients, and a gradient
     upscaled from a quarter of its size is the same gradient -- so the
     expensive part is drawn on a canvas a quarter as wide and a quarter as
     tall, sixteen times fewer pixels, and stretched. The grain goes on
     afterwards at full size, because grain is the one thing here that is
     supposed to be sharp, and it is a tiled drawImage rather than a fill. */
  var SHRINK = 6;
  var lo = null, lx = null;

  function size() {
    W = c.width = window.innerWidth; H = c.height = window.innerHeight;
    lo = document.createElement("canvas");
    lo.width = Math.max(2, Math.ceil(W / SHRINK));
    lo.height = Math.max(2, Math.ceil(H / SHRINK));
    lx = lo.getContext("2d", { alpha: false });
    /* the grain is one tile, made once, laid down at a low alpha. Making it
       per frame would cost more than the rest of the ground together. */
    var g = document.createElement("canvas"); g.width = g.height = 256;
    var gx = g.getContext("2d"), d = gx.createImageData(256, 256), p = d.data;
    for (var i = 0; i < 256 * 256; i++) {
      var v = 128 + (h2(i % 256, (i / 256) | 0, 7) - 0.5) * 46;
      p[i * 4] = p[i * 4 + 1] = p[i * 4 + 2] = v; p[i * 4 + 3] = 255;
    }
    gx.putImageData(d, 0, 0); grain = g;
    /* the grain layer: one tile, repeated by CSS, oversized so a translate of
       up to a tile never uncovers an edge */
  }

  /* One light, and one answer to it. The first pass had three blooms of
     roughly equal weight and the ground came out a brown wash: light from
     everywhere is light from nowhere. A room is lit by a source. */
  var BLOOM = [
    { x: 0.24, y: 0.16, r: 0.62, a: 0.34, px: 47.0, py: 61.0, ax: 0.055, ay: 0.040, hue: "233,200,106" },
    { x: 0.82, y: 0.86, r: 0.52, a: 0.11, px: 71.0, py: 53.0, ax: 0.045, ay: 0.035, hue: "96,132,208" }
  ];

  function draw(tms) {
    if (!W) size();
    var t = tms / 1000, w = lo.width, h = lo.height;

    var g = lx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#010206"); g.addColorStop(0.38, "#050A18");
    g.addColorStop(0.70, "#03060F"); g.addColorStop(1, "#010206");
    lx.fillStyle = g; lx.fillRect(0, 0, w, h);

    lx.globalCompositeOperation = "lighter";
    for (var i = 0; i < BLOOM.length; i++) {
      var b = BLOOM[i];
      var cx = (b.x + Math.sin(t / b.px * 6.2831853) * b.ax) * w;
      var cy = (b.y + Math.cos(t / b.py * 6.2831853) * b.ay) * h;
      var rr = b.r * Math.max(w, h) * (0.94 + 0.06 * Math.sin(t / 23.0 * 6.2831853 + i));
      var rg = lx.createRadialGradient(cx, cy, 0, cx, cy, rr);
      rg.addColorStop(0, "rgba(" + b.hue + "," + b.a + ")");
      rg.addColorStop(0.42, "rgba(" + b.hue + "," + (b.a * 0.30) + ")");
      rg.addColorStop(1, "rgba(" + b.hue + ",0)");
      lx.fillStyle = rg; lx.fillRect(0, 0, w, h);
    }

    /* a horizon: one band of light lying across the frame, drifting slowly.
       It is what stops the ground reading as a flat gradient with a smudge
       on it, and it gives the type something to sit above. */
    var hy = (0.62 + 0.035 * Math.sin(t / 83.0 * 6.2831853)) * h;
    var hg = lx.createLinearGradient(0, hy - h * 0.16, 0, hy + h * 0.16);
    hg.addColorStop(0, "rgba(233,200,106,0)");
    hg.addColorStop(0.5, "rgba(233,200,106,.052)");
    hg.addColorStop(1, "rgba(233,200,106,0)");
    lx.fillStyle = hg; lx.fillRect(0, 0, w, h);
    lx.globalCompositeOperation = "source-over";

    /* bilinear, not the expensive resampler: this is a gradient, and the
       difference between the two filters on a gradient is nothing you can
       see and about eighty milliseconds a frame that you can. */
    x.imageSmoothingEnabled = true;
    x.imageSmoothingQuality = "low";
    x.drawImage(lo, 0, 0, w, h, 0, 0, W, H);

    /* THE GRAIN IS NOT DRAWN HERE AT ALL ANY MORE.
       It was forty tiled drawImage calls across the full frame every frame;
       then one composited DOM layer, which was cheaper to draw and more
       expensive to screenshot. Grain is a video-domain thing, so it is added
       by ffmpeg at encode time -- see render.py -- where it costs nothing and
       lands on the finished picture rather than on the browser. */
  }

  window.NOORGROUND = { draw: draw, size: size };
})();
