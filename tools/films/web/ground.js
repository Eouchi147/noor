/* NOOR film · the room.
   ---------------------------------------------------------------------------
   THE ROOM IS NOT PAINTED HERE ANY MORE.  IT IS IN THE SHADER.

   It used to be drawn on this 2D canvas: a four stop sky, three blooms and a
   horizon band, and for speed it was drawn at a sixth of the frame and
   stretched up. That was the grid. A browser cannot paint an eight bit
   gradient exactly, so it dithers -- a fine two pixel checker that averages
   to the value it wants -- and blowing that checker up six times makes a
   twelve pixel lattice you can see. Measured on the lossless still: period
   12.0px, fifty times above the noise floor, in the PNG straight out of the
   browser. Then the CSS vignette laid a second dithered gradient over the
   first, and the two weaves crossed. That is the interlacing.

   The whole room is now computed in float in web/lume.js, in the same shader
   that resolves the light and the bloom, tone mapped once and quantised once
   at the very end with a triangular dither of half a level. There is no
   eight bit stage in the middle for anything to be a pattern in.

   The ELEMENT stays, and the camera still moves it: web/stage.js gives it the
   shot at PARALLAX of the rate the figures get it, and the shader reads its
   matrix each frame. That is where the depth comes from. It simply is not
   painted, and it is covered by an opaque light layer, so what is in it never
   reaches the screen. One flat fill, once, in case the light layer ever fails
   to come up: better a dark room than a white one.
*/
(function () {
  "use strict";
  var c = document.getElementById("ground"), x = c.getContext("2d", { alpha: false });
  var done = false;

  function size() {
    c.width = window.innerWidth; c.height = window.innerHeight;
    x.fillStyle = "#010206"; x.fillRect(0, 0, c.width, c.height);
    done = true;
  }

  function draw() { if (!done) size(); }

  window.NOORGROUND = { draw: draw, size: size };
})();
