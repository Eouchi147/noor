/* NOOR film · the light layer.
   ===========================================================================
   WHY THIS FILE EXISTS

   The first cut of the film drew its diagrams as flat SVG strokes on a
   gradient. It was clean and it was legible and it was a slide. What a viewer
   stays for is not a diagram; it is an OBJECT -- something that appears to be
   made of a material, lit from somewhere, with other things behind it. That
   is the whole difference between an explainer that plays in the background
   and one that is watched.

   So the figures move to a real renderer. Measured on this runner, with no
   GPU at all -- Chromium falls back to SwiftShader, which rasterises in
   software:

       the old layer (canvas ground + SVG figure)      85-101 ms a frame
       this layer, 1920x1080, two-pass bloom          ~147 ms a frame
       this layer at half size, same bloom            ~102 ms a frame

   The screenshot is the bottleneck, not the drawing: three of those numbers
   are within a rounding error of each other because most of the time is spent
   encoding a JPEG, not making the picture. Depth and light are therefore very
   nearly free, which is not a thing that is usually true.

   ---------------------------------------------------------------------------
   THE TWO RULES THIS FILE OBEYS

   1 · IT IS A PURE FUNCTION OF TIME. render.py seeks the film to an exact
       millisecond and takes one screenshot; there is no playback. So nothing
       here integrates, accumulates, or asks what happened last frame. Every
       position, rotation and opacity is computed from `ms` alone, including
       the springs -- which are evaluated from the analytic step response of a
       damped oscillator rather than stepped, for exactly this reason. Two
       renders of the same film are identical bit for bit.

   2 · IT OWNS NO CONTENT. Every object in here is generated from numbers.
       There is no model, no photograph, no texture from anywhere, and no
       geometry anyone else drew, so there is nothing in the finished film
       that is not ours.

   ---------------------------------------------------------------------------
   HOW A THING LOOKS MADE OF SOMETHING WITHOUT A SINGLE LIGHT

   There are no lights in this scene, and there is no shading model. Every
   object wears one shader: the surface is dark where it faces you and bright
   where it turns away, which is what a rim light does and what glass, chrome
   and hot gas all do at their edges. Fresnel, one line:

       f = pow(1 - |N·V|, k)

   Two colours, a core and an edge, mixed by f. Under the bloom pass that
   reads as a lit, solid, glowing thing -- and it costs one multiply, which
   matters when the rasteriser is a CPU.

   The palette is the house's and does not move: gold is the light, the deep
   navy is the room, and there is exactly one cool accent, used only where the
   film is putting two things side by side and needs them told apart.
*/
(function () {
  "use strict";

  var T = window.THREE;
  if (!T) { window.NOORLUME = { size: function () {}, mount: function () {}, draw: function () {} }; return; }

  /* ---- the house palette, as linear-ish triples ------------------------ */
  var C = {
    gold:   new T.Color(0xC9A227),
    goldhi: new T.Color(0xE9C86A),
    pale:   new T.Color(0xF4E2AE),
    parch:  new T.Color(0xFFFEF7),
    cool:   new T.Color(0x6C8FD6),   /* the one counter-colour */
    deep:   new T.Color(0x0A1024)
  };

  /* ---- easing: anime.js's own, not a second implementation ------------
     The words are animated by anime.js. This layer cannot BE animated by it
     -- a timeline that is seeked backwards must give the same answer as one
     seeked forwards, and only a closed form guarantees that -- but it can and
     should ask anime.js for the same curves, so a figure rising here and a
     headline arriving in the DOM are the same movement rather than two
     movements that resemble each other.

     anime.createSpring returns { ease, duration }: ease maps 0..1 across the
     spring's own settling time, overshoot included. That overshoot is the
     part a hand-rolled critically damped approximation throws away, and it is
     the part that reads as weight. The fallback below exists only so the
     layer still draws if the library is missing; it is never the intent. */
  var A = window.anime;

  function springEase(stiffness, damping, mass) {
    if (A && A.createSpring) {
      var sp = A.createSpring({ stiffness: stiffness, damping: damping, mass: mass });
      var fn = typeof sp === "function" ? sp : (sp && sp.ease);
      if (typeof fn === "function") return function (t) { return fn(t < 0 ? 0 : t > 1 ? 1 : t); };
    }
    var w0 = Math.sqrt(stiffness / mass), z = damping / (2 * Math.sqrt(stiffness * mass));
    if (z < 1) {
      var wd = w0 * Math.sqrt(1 - z * z);
      return function (t) { t = t < 0 ? 0 : t > 1 ? 1 : t; var x = t * 6 / w0;
        return 1 - Math.exp(-z * w0 * x) * (Math.cos(wd * x) + (z * w0 / wd) * Math.sin(wd * x)); };
    }
    return function (t) { t = t < 0 ? 0 : t > 1 ? 1 : t; var x = t * 6 / w0;
      return 1 - Math.exp(-w0 * x) * (1 + w0 * x); };
  }

  function namedEase(name, fallback) {
    var e = A && A.eases && A.eases[name];
    return typeof e === "function" ? e : fallback;
  }

  /* the four springs stage.js names, taken from the same library it takes
     them from, with the same constants */
  var SP = {
    settle: springEase(92, 16, 1),
    lift:   springEase(74, 14, 1.1),
    snap:   springEase(140, 18, 0.9),
    open:   springEase(60, 15, 1.3)
  };
  var EASE = {
    linear:   namedEase("linear",   function (t) { return t; }),
    outExpo:  namedEase("outExpo",  function (t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); }),
    outQuint: namedEase("outQuint", function (t) { return 1 - Math.pow(1 - t, 5); }),
    outCubic: namedEase("outCubic", function (t) { return 1 - Math.pow(1 - t, 3); }),
    inOutQuad: namedEase("inOutQuad", function (t) { return t < .5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2; }),
    /* the scene camera's own glide pace and the round two Lantern hold both
       need a plain inOutSine, which nothing before this used by name */
    inOutSine: namedEase("inOutSine", function (t) { return 0.5 * (1 - Math.cos(Math.PI * t)); }),
    settle: SP.settle, lift: SP.lift, snap: SP.snap, open: SP.open
  };
  function ease(name, t) { return (EASE[name] || EASE.outExpo)(Math.max(0, Math.min(1, t))); }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  /* THE SPECKS ARE ROUND.
     A three.js point with no map is a square, and a field of squares is a
     field of dust on the lens rather than light in the air. This is one 64px
     radial falloff, made once, shared by every points cloud in the film --
     drawn from numbers, like everything else here. */
  var DOT = null;
  function dotTex() {
    if (DOT) return DOT;
    var c = document.createElement("canvas"); c.width = c.height = 128;
    var x = c.getContext("2d");
    var g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    /* A MOTE MUST NOT HAVE AN EDGE.
       The old sprite held 55% opacity out to a third of its radius and then
       fell away, which is a disc with a soft rim -- and a disc a couple of
       pixels across, seen through a sizeAttenuated point, lands on a
       different set of pixels every frame and scintillates. A gaussian-ish
       falloff with no shoulder covers many pixels faintly instead of a few
       brightly, so the same mote moving across the frame changes smoothly
       instead of popping. */
    g.addColorStop(0.00, "rgba(255,255,255,1)");
    g.addColorStop(0.18, "rgba(255,255,255,.46)");
    g.addColorStop(0.42, "rgba(255,255,255,.13)");
    g.addColorStop(0.70, "rgba(255,255,255,.028)");
    g.addColorStop(1.00, "rgba(255,255,255,0)");
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    DOT = new T.CanvasTexture(c);
    return DOT;
  }

  /* a seeded hash, so anything scattered is scattered the same way twice */
  function hash(i, s) {
    var n = (i * 374761393 + s * 668265263) >>> 0;
    n = (n ^ (n >>> 13)) >>> 0; n = (n * 1274126177) >>> 0;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  }

  /* ---- the one material ------------------------------------------------ */
  /* INSTANCING IS NOT FREE ON A SHADER OF YOUR OWN.
     three.js applies an InstancedMesh's per-instance matrix inside the shader
     chunks its own materials are built from. A ShaderMaterial written by hand
     gets the attribute declared and nothing else -- so the first lattice drew
     all thirty five of its nodes on top of each other at the group's origin,
     which on screen is one dot. The matrix has to be applied here. */
  var LUME_VERT = [
    "varying vec3 vN; varying vec3 vV; varying float vY; varying float vZ; varying vec2 vU;",
    /* object space, so every texture on the surface is nailed to the surface
       and cannot crawl when the camera or the object moves. Procedural grain
       that swims is worse than no grain at all. */
    "varying vec3 vP;",
    "void main(){",
    "  vec3 pos = position; vec3 nrm = normal;",
    "  #ifdef USE_INSTANCING",
    "    pos = (instanceMatrix * vec4(position, 1.0)).xyz;",
    "    nrm = mat3(instanceMatrix) * normal;",
    "  #endif",
    "  vec4 mv = modelViewMatrix * vec4(pos, 1.0);",
    "  vN = normalize(normalMatrix * nrm);",
    "  vV = normalize(-mv.xyz);",
    "  vY = pos.y;",
    "  vZ = -mv.z;",
    "  vU = uv;",
    "  vP = pos;",
    "  gl_Position = projectionMatrix * mv;",
    "}"
  ].join("\n");

  /* TWO TERMS, NOT ONE.
     The first cut of this shader was a fresnel rim alone, and a rim alone is
     not a solid: it is a hole with a ring around it. A sphere lit that way
     came out as a black disc with a gold edge -- exactly the thing that makes
     motion graphics look like motion graphics.

       body  pow(|N.V|, k)      bright where the surface faces you
       rim   pow(1-|N.V|, k)    hot where it turns away

     The body is the material and the rim is the light on its edge. A shell
     sets body to zero and keeps only the rim, which is what glass does. */
  /* THREE TERMS AND THE ROOM.
     body and rim make a solid. The third is a SHEEN -- a tight highlight off
     one fixed direction -- which is the thing the eye reads as a surface
     rather than a paint. Without it a sphere is a shape; with it, it has a
     material and a light in the room with it.

     And distance. Light in a dark room falls off, and a figure with no
     falloff has every one of its parts equally near, which is why the first
     chain of transmission read as a flat scatter of dots however far back the
     nodes actually were. Depth cueing is one smoothstep and it is most of
     what "there is space in this shot" means. */
  var LUME_FRAG = [
    "varying vec3 vN; varying vec3 vV; varying float vY; varying float vZ; varying vec2 vU;",
    "uniform vec3 core; uniform vec3 edge; uniform float rim;",
    "uniform float glow; uniform float alphaU; uniform float body;",
    "uniform float band; uniform float sheen;",
    "uniform float dnear; uniform float dfar; uniform float damt;",
    "uniform float headU; uniform float headOn; uniform float bodyk; uniform float cyc;",
    "uniform float spd;",
    "const vec3 KEY = normalize(vec3(-0.42, 0.68, 0.60));",
    "void main(){",
    "  float alpha = alphaU;",
    "  vec3 N = normalize(vN), V = normalize(vV);",
    "  float ndv = abs(dot(N, V));",
    "  float f = pow(1.0 - ndv, rim);",
    "  float d = pow(ndv, bodyk);",
    "  vec3 H = normalize(KEY + V);",
    "  float sp = pow(max(dot(N, H), 0.0), 42.0) * sheen;",
    /* a whisper of latitude banding, so a sphere has a surface rather than a
       gradient. It is generated, not a texture, and it is a function of the
       geometry only, so it never crawls between frames. */
    "  float b = 1.0 + band * 0.055 * sin(vY * 9.0);",
    "  vec3 c = (core * d * body * b + edge * f + vec3(1.0, 0.97, 0.90) * sp) * glow;",
    /* A PATH THAT IS ALL ONE BRIGHTNESS IS A LINE, NOT A JOURNEY.
       The stream was drawn at one strength end to end and read as a stray
       curve lying in the dark. It is dim ahead of the wavefront and lit
       behind it, with a hot band at the front, so the eye is told where the
       thing has got to and which way it is going. Every other figure passes
       headOn as zero and is untouched. */
    /* AHEAD OF THE LIGHT THERE IS NOTHING.
       The first cut drew the whole path dim and brightened the part that had
       been travelled, so the route was on screen before anything had gone
       along it -- the answer printed before the question. The light draws the
       line now: ahead of the wavefront the tube is not dimmer, it is absent,
       colour and coverage both. */
    "  float lit = smoothstep(headU + 0.035, headU - 0.012, vU.x);",
    "  c *= mix(1.0, lit, headOn);",
    "  alpha *= mix(1.0, lit, headOn);",
    /* pow(x, 2.0) with x < 0 is undefined by the GLSL ES spec, and x is
   negative over the entire length of tube behind the head, every frame.
   It survives only because this compiler folds it to a multiply. */
"  float hx = (vU.x - headU) * 20.0;",
"  float hot = exp(-(hx * hx)) * headOn;",
    /* the band at the wavefront was at full strength and, being the
       brightest thing in the frame, it was what the bloom found -- so the
       head of the stream came out as a white smear a tenth of the frame
       across, wide enough in 9:16 to sit on top of the caption. It marks
       where the light has got to; it is not a headlamp. */
    /* AND THE LIGHT IS BRIGHTER WHEN IT IS MOVING FAST.
       A lamp carried at a run throws a longer, hotter streak than the same
       lamp carried at a walk: the eye reads brightness as speed before it
       reads position as speed. The head's band and the trail behind it are
       both scaled by how fast the wavefront is actually travelling this
       frame, so the acceleration out of the start and the arrival at the end
       are things you SEE rather than things you infer from the position.
       The trail is a smooth exponential in the shader, not a field of
       specks: three hundred points riding fixed lags bunched wherever the
       path compressed, and a bunch of points is a glitter. */
    "  float behind = headU - vU.x;",
    "  float trail = exp(-max(behind, 0.0) * 6.5) * step(0.0, behind) * headOn;",
    "  c += edge * hot * (0.17 + 0.58 * spd) + edge * trail * 0.085 * spd;",
    /* A CYCLE IS NOT A HOOP.
       Three gold rings turning at different rates are, honestly, wireframe:
       the shape says "circle" and nothing about it says "again". What a
       cycle looks like is a light going round -- so one band of brightness
       runs the whole way round each ring and comes back, wrapping through
       the seam instead of stopping at it. The beat is five prayers a day for
       fourteen centuries; the figure should do the coming round, not just
       be the shape of it. */
    "  float dd = abs(fract(vU.x - headU + 0.5) - 0.5);",
    "  c += edge * exp(-pow(dd * 11.0, 2.0)) * cyc;",
    "  c *= 1.0 - smoothstep(dnear, dfar, vZ) * damt;",
    "  gl_FragColor = vec4(c, alpha);",
    "}"
  ].join("\n");


  /* =======================================================================
     FIVE MATERIALS, NOT FIVE PALETTES
     =======================================================================
     The first attempt at "five directions" changed the colours and nothing
     else, and it was right to call that what it was. A direction is not a
     palette; it is what the objects are MADE OF and how light behaves when
     it arrives at them. So there are five object shaders here, they share
     one uniform set and one vertex shader, and every figure in the film --
     the bars, the chain, the rings, the stream -- is re-skinned by choosing
     between them. Nothing in the figures knows which one it got.

       lumen    light itself, in a dark room. Emissive, additive, bloomed.
       origami  folded paper. Faceted, banded shading, hard creases, and the
                sheet glows where the light comes through it edge on.
       leather  tooled hide. Procedural grain that also perturbs the normal,
                so the pebbles catch a raking key, with gold foil stamped on
                the faces that turn toward the lens.
       flat     no lighting at all. Three tones by face direction, a hard
                outline, no gradient anywhere. Vector, printed, deliberate.
       press    letterpress. A solid coverage of ink that pools at the edge
                of every stroke and bites unevenly, read as pigment rather
                than as light by the composite.

     The three that are not emissive use glow as OPACITY rather than as
     brightness, because a figure that ramps its glow from zero has to arrive
     by appearing, and an unlit solid at glow zero is a black hole in the
     picture rather than an absence. */
  var NOISE_GLSL = [
    "float h21(vec2 p){ vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));",
    "  q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }",
    "float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);",
    "  return mix(mix(h21(i), h21(i+vec2(1.0,0.0)), f.x),",
    "             mix(h21(i+vec2(0.0,1.0)), h21(i+vec2(1.0,1.0)), f.x), f.y); }",
    "float fbm2(vec2 p){ return n2(p)*0.55 + n2(p*2.07+11.0)*0.28 + n2(p*4.13+27.0)*0.17; }"
  ].join("\n");

  var MAT_HEAD = [
    "varying vec3 vN; varying vec3 vV; varying float vY; varying float vZ; varying vec2 vU;",
    "varying vec3 vP;",
    "uniform vec3 core; uniform vec3 edge; uniform float rim;",
    "uniform float glow; uniform float alphaU; uniform float body;",
    "uniform float band; uniform float sheen;",
    "uniform float dnear; uniform float dfar; uniform float damt;",
    "uniform float headU; uniform float headOn; uniform float bodyk; uniform float cyc;",
    "uniform float spd;",
    "const vec3 KEY = normalize(vec3(-0.42, 0.68, 0.60));",
    NOISE_GLSL,
    /* the wavefront logic is the film's, not the material's: every shader
       has to honour it or a stream drawn in leather would show its whole
       route before the light had travelled it */
    "float aheadCut(){ return mix(1.0, smoothstep(headU + 0.035, headU - 0.012, vU.x), headOn); }"
  ].join("\n");

  /*  A LIT SURFACE IS NOT A LIGHT SOURCE.
      The first cut of these four ran at the same level as the emissive one
      and every frame came back blown out: leather, paper and flat colour
      were all reading above the bloom threshold, so the bright pass found
      the whole object and smeared it into a white mass. A surface returns a
      FRACTION of the light that falls on it. This is that fraction, and it
      is the single number that turns a render of a material back into a
      photograph of one. */
  var MAT_TAIL = [
    "  c *= 0.46;",
    "  c *= 1.0 - smoothstep(dnear, dfar, vZ) * damt;",
    "  gl_FragColor = vec4(c, a);",
    "}"
  ].join("\n");

  /* ---- origami ---------------------------------------------------------- */
  var ORIGAMI_FRAG = [MAT_HEAD,
    "void main(){",
    "  vec3 N = normalize(vN), V = normalize(vV);",
    "  float cut = aheadCut();",
    "  float lit = clamp(glow, 0.0, 2.0);",
    "  float a = alphaU * clamp(lit * 1.7, 0.0, 1.0) * cut;",
    /* A FOLD IS A DISCONTINUITY, SO THE SHADING MUST BE ONE TOO.
       Smooth lambert on a folded sheet reads as a bent sheet. Quantised into
       four steps it reads as facets meeting at a crease, which is what paper
       does and what a gradient can never say. */
    "  float nl = dot(N, KEY) * 0.5 + 0.5;",
    "  float f = floor(nl * 4.0) / 3.0;",
    "  vec3 c = core * (0.34 + 0.66 * clamp(f, 0.0, 1.0));",
    /* the crease itself: a hard darker line where the surface turns away */
    "  float rf = 1.0 - abs(dot(N, V));",
    "  c *= 1.0 - smoothstep(0.52, 0.94, rf) * 0.60;",
    /* the fibre. Fine, static, in object space, and small enough that it is
       a surface rather than a texture you notice. */
    "  c *= 0.955 + 0.085 * n2(vP.xy * 260.0 + vP.z * 13.0);",
    /* AND PAPER IS TRANSLUCENT. Held edge on to a light it glows, and that
       one behaviour is most of what tells the eye a thing is paper and not
       painted card. */
    "  c += edge * pow(rf, 3.2) * 0.42 * min(lit, 1.4);",
    "  c += vec3(1.0, 0.97, 0.90) * pow(max(dot(N, normalize(KEY + V)), 0.0), 30.0) * sheen * 0.35;",
    "  c *= 1.12 + 0.52 * min(lit, 1.5);",
    MAT_TAIL].join("\n");

  /* ---- leather ---------------------------------------------------------- */
  var LEATHER_FRAG = [MAT_HEAD,
    "void main(){",
    "  vec3 N = normalize(vN), V = normalize(vV), H = normalize(KEY + V);",
    "  float cut = aheadCut();",
    "  float lit = clamp(glow, 0.0, 2.0);",
    "  float a = alphaU * clamp(lit * 1.7, 0.0, 1.0) * cut;",
    "  float nl = max(dot(N, KEY), 0.0);",
    /* the grain is two scales: a broad mottle and a fine pebble */
    "  vec2 gp = vP.xy * 26.0 + vP.z * 3.0;",
    "  float g1 = fbm2(gp), g2 = n2(gp * 11.0);",
    "  float grain = g1 * 0.62 + g2 * 0.38;",
    "  vec3 c = core * (0.16 + 0.62 * nl) * (0.72 + 0.52 * grain);",
    /* AND THE GRAIN IS NOT PAINT, IT IS RELIEF.
       Modulating only the colour gives printed leather. Taking the slope of
       the same noise and lighting THAT gives tooled leather: every pebble
       has a lit side and a shaded one, and the whole surface changes as the
       key moves across it. */
    "  float dh = (n2(gp * 11.0 + vec2(0.06, 0.0)) - g2) * 26.0;",
    "  c += vec3(1.0, 0.90, 0.72) * clamp(dh, 0.0, 1.0) * 0.42 * nl;",
    "  c *= 1.0 - clamp(-dh, 0.0, 1.0) * 0.30;",
    /* gold foil, stamped on the faces that turn toward the lens */
    "  float face = pow(abs(dot(N, V)), 2.4);",
    "  c += edge * face * body * (0.55 + 0.45 * grain) * min(lit, 1.5);",
    "  c += vec3(1.0, 0.95, 0.84) * pow(max(dot(N, H), 0.0), 22.0) * sheen * (0.30 + 0.70 * grain);",
    "  c *= 0.78 + 0.46 * min(lit, 1.5);",
    MAT_TAIL].join("\n");

  /* ---- flat -------------------------------------------------------------- */
  var FLAT_FRAG = [MAT_HEAD,
    "void main(){",
    "  vec3 N = normalize(vN), V = normalize(vV);",
    "  float cut = aheadCut();",
    "  float lit = clamp(glow, 0.0, 2.0);",
    "  float a = alphaU * clamp(lit * 2.0, 0.0, 1.0) * cut;",
    /* THREE TONES AND NOTHING BETWEEN THEM.
       Flat design is not "a render with the lights turned down": it is the
       refusal of the gradient. A face gets one of three values according to
       which way it points, and the step between them is the only shading in
       the picture. */
    "  vec3 an = abs(N);",
    "  float k = (an.z >= an.x && an.z >= an.y) ? 1.0 : ((an.y > an.x) ? 0.80 : 0.60);",
    "  vec3 c = core * k;",
    /* one hard outline, no falloff */
    "  float rf = 1.0 - abs(dot(N, V));",
    "  c = mix(c, edge, step(0.90, rf));",
    "  c *= 0.86 + 0.34 * min(lit, 1.5);",
    MAT_TAIL].join("\n");

  /* ---- letterpress -------------------------------------------------------- */
  var PRESS_FRAG = [MAT_HEAD,
    "void main(){",
    "  vec3 N = normalize(vN), V = normalize(vV);",
    "  float cut = aheadCut();",
    "  float lit = clamp(glow, 0.0, 2.0);",
    "  float a = alphaU * clamp(lit * 1.8, 0.0, 1.0) * cut;",
    "  float nd = abs(dot(N, V));",
    "  vec3 c = core * (0.80 + 0.20 * nd);",
    /* INK POOLS AT THE EDGE OF A STROKE.
       A press pushes the type into damp paper and the ink gathers where the
       shoulder meets it, so every stroke is darker at its border than in its
       middle. It is the one detail that separates a printed line from a
       drawn one. */
    "  float rf = 1.0 - nd;",
    "  c += edge * smoothstep(0.42, 0.96, rf) * 0.60;",
    /* and the plate bites unevenly */
    "  c *= 0.90 + 0.14 * fbm2(vP.xy * 70.0);",
    "  c *= 0.80 + 0.42 * min(lit, 1.5);",
    MAT_TAIL].join("\n");

  var MAT_FRAG = { origami: ORIGAMI_FRAG, leather: LEATHER_FRAG,
                   flat: FLAT_FRAG, press: PRESS_FRAG };
  /* which material each direction is made of */
  var MAT_OF = { night: "lumen", ink: "press", orrery: "leather",
                 girih: "flat", relief: "origami" };
  /* the arrangement the direction asks for, unless the figure names one */
  var LAYOUT_OF = "run";
  /* and, in the flat vector language, the colours the art is drawn in */
  var ART_OF = null;


  /*  ADDITIVE LIGHT MUST NOT WRITE COVERAGE.
      Three.js's AdditiveBlending adds the alpha channel along with the
      colour, so a glow whose colour has faded to nothing still leaves its
      alpha behind in the buffer. While the composite read coverage off
      LUMINANCE that was harmless -- the alpha was simply ignored. The moment
      the composite started trusting the alpha channel, so that opaque flat
      shapes would stop having the room show through them, every one of those
      glows became an OPAQUE BLACK DISC: full coverage, no colour.

      This is additive in colour and a no-op in alpha. Light adds itself to
      the picture and says nothing about how much of the pixel it covers,
      which is the truth about light. */
  var ADD_LIGHT = {
    blending: T.CustomBlending,
    blendEquation: T.AddEquation, blendSrc: T.SrcAlphaFactor, blendDst: T.OneFactor,
    blendEquationAlpha: T.AddEquation, blendSrcAlpha: T.ZeroFactor, blendDstAlpha: T.OneFactor
  };
  function fixAdditive(o) {
    if (!o.material) return;
    [].concat(o.material).forEach(function (m) {
      if (m && m.blending === T.AdditiveBlending) addLight(m);
    });
  }
  function addLight(m) {
    m.blending = ADD_LIGHT.blending;
    m.blendEquation = ADD_LIGHT.blendEquation;
    m.blendSrc = ADD_LIGHT.blendSrc; m.blendDst = ADD_LIGHT.blendDst;
    m.blendEquationAlpha = ADD_LIGHT.blendEquationAlpha;
    m.blendSrcAlpha = ADD_LIGHT.blendSrcAlpha; m.blendDstAlpha = ADD_LIGHT.blendDstAlpha;
    return m;
  }

  function lumeMat(core, edge, opt) {
    opt = opt || {};
    var mm = new T.ShaderMaterial({
      uniforms: {
        core:  { value: core.clone() },
        edge:  { value: edge.clone() },
        rim:   { value: opt.rim === undefined ? 2.2 : opt.rim },
        glow:  { value: opt.glow === undefined ? 1.0 : opt.glow },
        alphaU:{ value: opt.alpha === undefined ? 1.0 : opt.alpha },
        body:  { value: opt.body === undefined ? 1.0 : opt.body },
        band:  { value: opt.band === undefined ? 0.0 : opt.band },
        sheen: { value: opt.sheen === undefined ? 0.55 : opt.sheen },
        spd:   { value: 0.0 },
        dnear: { value: opt.dnear === undefined ? 5.0 : opt.dnear },
        dfar:  { value: opt.dfar === undefined ? 13.0 : opt.dfar },
        damt:  { value: opt.damt === undefined ? 0.72 : opt.damt },
        headU: { value: 0.0 },
        headOn:{ value: opt.head ? 1.0 : 0.0 },
        /* HOW FAST THE BODY FALLS AWAY FROM THE CENTRE.
           At 1.35 a sphere is bright across most of its face and then
           stops: a disc. A source of light is the opposite -- blinding
           in the middle and gone a third of the way out -- and that is
           one exponent, not a different shader. */
        bodyk: { value: opt.bodyk === undefined ? 1.35 : opt.bodyk },
        cyc:   { value: opt.cyc === undefined ? 0.0 : opt.cyc }
      },
      vertexShader: LUME_VERT,
      fragmentShader: MAT_FRAG[MAT_OF[THEME]] || LUME_FRAG,
      /* the four solid materials carry their arrival in the alpha channel,
         so they are transparent whatever the figure asked for */
      transparent: !!MAT_FRAG[MAT_OF[THEME]] || (opt.alpha !== undefined && opt.alpha < 1),
      depthWrite: opt.depthWrite === undefined ? true : opt.depthWrite,
      blending: T.NormalBlending,
      blending: (opt.add && !MAT_FRAG[MAT_OF[THEME]]) ? T.AdditiveBlending : T.NormalBlending,
      side: opt.side || T.FrontSide
    });
    return mm;
  }

  /* ---- the source material ---------------------------------------------
     A LIGHT IS NOT A SPHERE WITH A LIGHT COLOUR ON IT.

     The orb was built as nested shells of glass: a lit surface inside a
     second, fainter lit surface. Every one of those surfaces is brightest
     where it turns away from the lens, because that is what a fresnel rim
     does -- so what came out was a dark middle inside a gold ring inside a
     fainter gold ring. A coin. You could see the boundary of the object,
     which is the one thing a light does not have.

     What a light actually is, on screen, is a radial density: blinding at
     the middle, falling off through its own colour, reaching nothing with no
     edge anywhere. That is a function of distance from the centre IN THE
     PICTURE, not of the angle of a surface -- so it is drawn on a plane that
     faces the lens, and the falloff is computed in its own uv.

     Two falloffs at once, because one is never enough: a wide soft body and
     a tight hot core, summed. Stack three of these at different widths and
     the light has depth in it; squash one along y and it is the streak a
     real lens leaves. Nothing here has a silhouette. */
  var GLOW_VERT = [
    "varying vec2 vU; varying float vZ;",
    "void main(){",
    "  vec3 pos = position;",
    "  #ifdef USE_INSTANCING",
    "    pos = (instanceMatrix * vec4(position, 1.0)).xyz;",
    "  #endif",
    "  vec4 mv = modelViewMatrix * vec4(pos, 1.0);",
    "  vU = uv; vZ = -mv.z;",
    "  gl_Position = projectionMatrix * mv;",
    "}"
  ].join("\n");

  var GLOW_FRAG = [
    "varying vec2 vU; varying float vZ;",
    "uniform vec3 inner; uniform vec3 outer;",
    "uniform float k1; uniform float k2; uniform float gain; uniform float hot;",
    "uniform float squash; uniform float dnear; uniform float dfar; uniform float damt;",
    "void main(){",
    "  vec2 q = (vU - 0.5) * 2.0; q.y *= squash;",
    "  float r = length(q);",
    /* A SOURCE IS A DISC ON A SQUARE, AND THE CORNERS COST THE SAME AS THE
       MIDDLE. Everything outside the inscribed circle evaluates to zero and
       is then blended anyway -- twenty-two per cent of every one of these
       planes, and on a software rasteriser at four times the frame area that
       is real money. */
    "  if (r > 1.0) discard;",
    "  float e = max(0.0, 1.0 - r);",
    "  vec3 c = (outer * pow(e, k1) + inner * pow(e, k2) * hot) * gain;",
    "  c *= 1.0 - smoothstep(dnear, dfar, vZ) * damt;",
    "  gl_FragColor = vec4(c, 1.0);",
    "}"
  ].join("\n");

  function glowMat(inner, outer, opt) {
    opt = opt || {};
    return new T.ShaderMaterial({
      uniforms: {
        inner: { value: inner.clone() }, outer: { value: outer.clone() },
        k1:    { value: opt.k1 === undefined ? 2.4 : opt.k1 },
        k2:    { value: opt.k2 === undefined ? 8.0 : opt.k2 },
        gain:  { value: opt.gain === undefined ? 1.0 : opt.gain },
        hot:   { value: opt.hot === undefined ? 1.6 : opt.hot },
        squash:{ value: opt.squash === undefined ? 1.0 : opt.squash },
        dnear: { value: opt.dnear === undefined ? 6.0 : opt.dnear },
        dfar:  { value: opt.dfar === undefined ? 15.0 : opt.dfar },
        damt:  { value: opt.damt === undefined ? 0.35 : opt.damt }
      },
      vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG,
      transparent: true, depthWrite: false, depthTest: opt.depthTest !== false,
      blending: T.AdditiveBlending, side: T.DoubleSide
    });
  }

  /* A BILLBOARD INSIDE A TURNING GROUP IS NOT A BILLBOARD.
     Copying the camera's rotation onto a child of a group that is itself
     rotating gives you the camera's rotation TIMES the group's, which faces
     the lens only when the group happens to be square to it. The local
     rotation that comes out facing the lens is the parent's world rotation,
     inverted, times the camera's -- one line, and the difference between a
     source of light and an ellipse that swings. */
  var _PQ = new T.Quaternion();
  function lensQ(parent, out) {
    if (parent) { parent.updateWorldMatrix(true, false); parent.getWorldQuaternion(_PQ); }
    else _PQ.identity();
    return out.copy(_PQ).invert().multiply(cam.quaternion);
  }
  function faceLens(obj) { lensQ(obj.parent, obj.quaternion); }

  /* one plane, facing the lens, carrying a source */
  function glowPlane(size, inner, outer, opt) {
    var m = new T.Mesh(new T.PlaneGeometry(size, size), glowMat(inner, outer, opt));
    m.renderOrder = -1;
    return m;
  }

  /* a plain emissive line/point colour, for edges and specks */
  function flatMat(color, alpha, add) {
    return new T.MeshBasicMaterial({
      color: color.clone(), transparent: alpha < 1, opacity: alpha,
      blending: add ? T.AdditiveBlending : T.NormalBlending, depthWrite: false
    });
  }

  /* =======================================================================
     THE FIGURES

     Each one is a factory: it builds its objects once, and exposes an at(u)
     that places them for a normalised time u in [0,1] across its own beat.
     Nothing is created, destroyed or pushed during at(); a frame is only ever
     a set of transforms.
     ======================================================================= */
  var FIG = {};

  /* ---- orb · the one, the source ---------------------------------------
     THE BALL WAS THE PROBLEM.

     Every earlier version of this figure was a sphere with a lit surface --
     first one opaque and gold, then a stack of nearly transparent ones. Both
     are surfaces, and a surface is brightest where it turns away from you, so
     both came out as a dark middle ringed in gold. On screen that is a badge,
     a coin, a coffee stain: a thing with an outline, sitting flat behind the
     word.

     A source of light has no outline. It is blinding at the middle, falls
     away through its own colour and reaches nothing without ever ending. So
     this is built the way a practical light is built for a camera: a small,
     hard, blown-out core; a body of air around it; a wide veil beyond that;
     and the horizontal streak a lens leaves across a bright point. Four
     radial densities, each facing the lens, summed. Plus one real sphere,
     small and dim, so that when the camera moves the light has a body inside
     it to move against and does not read as a sticker.                   */
  FIG.orb = function (o) {
    var g = new T.Group();
    var hot = o.hot || C.pale, warm = o.warm || C.gold;
    var deep = warm.clone().multiplyScalar(0.70).lerp(new T.Color(0xE07A2A), 0.22);

    /* the body inside the light: small, dark at its limb, never a silhouette.
       bodyk is high so it is gone a third of the way out rather than filling
       a disc, and its edge colour is a dim amber limb, not a gold ring. */
    var core = new T.Mesh(new T.SphereGeometry(0.52, 96, 64),
      lumeMat(hot, warm.clone().multiplyScalar(0.16),
              { rim: 2.4, glow: 0.90, bodyk: 3.4, body: 1.0, sheen: 0.0,
                alpha: 1.0, add: true, depthWrite: false, damt: 0.12 }));
    g.add(core);

    /* the light itself. Sizes climb and gains fall, which is what makes the
       falloff read as air with depth in it rather than one soft circle. */
    /* THE FIRST TRY WAS A HEADLAMP.
       Summed, those four densities put six times white at the middle, and
       anything over about three is already pure white after the tone curve --
       so the light clipped to a hard featureless ball with an edge, which is
       the exact fault it was built to cure, arrived at from the other side.
       A light reads as a light when its CENTRE is just over white and its
       FALLOFF is long. These gains total a little under three at the middle,
       and the exponents are low, which is what buys the long falloff. */
    /* THREE, NOT FOUR, AND ONE STREAK, NOT TWO.
       Each of these is a plane large enough to cover the frame, and the frame
       is drawn at four times its own area, so every layer is eight million
       fragments blended in software. Six of them took the orb beats from
       450 ms a frame to 1.6 seconds -- which, over a seven minute film, is
       the difference between rendering it tonight and rendering it tomorrow.
       The fourth layer carried a tenth of the gain at the widest falloff:
       folding it into the third costs a shade of reach at the very edge of
       the glow and nothing that anybody watching would name. */
    var AIR = [
      { s: 4.10, k1: 1.25, k2: 7.0,  gain: 0.255, hot: 1.20, col: hot,  in: hot },
      { s: 8.40, k1: 1.50, k2: 9.0,  gain: 0.345, hot: 0.62, col: warm, in: hot },
      { s: 16.0, k1: 1.70, k2: 12.0, gain: 0.245, hot: 0.26, col: deep, in: warm }
    ];
    var air = [];
    for (var i = 0; i < AIR.length; i++) {
      var A = AIR[i];
      var m = glowPlane(A.s, A.in, A.col,
        { k1: A.k1, k2: A.k2, gain: A.gain, hot: A.hot, damt: 0.30 });
      g.add(m); air.push({ m: m, gain: A.gain });
    }

    /* THE STREAK IS WHAT MAKES IT A PHOTOGRAPH.
       A bright point seen through real glass does not stay a point: it draws
       out sideways. One squashed source, very faint, is the difference
       between a render of a light and a shot of one. */
    var streak = glowPlane(19.0, hot, warm,
      { k1: 1.15, k2: 6.0, gain: 0.215, hot: 0.42, squash: 15.0, damt: 0.25 });
    g.add(streak);

    /* THE DUST IN THE AIR, AND WHY THERE IS LESS OF IT.
       Three hundred points at 0.055 units are, at this distance, sub pixel:
       each one lands on one pixel or between two, and which it is changes
       every frame, so the whole field scintillates. A hundred and forty at
       nearly three times the size cover the same volume with the same total
       light, but each mote is now several pixels across and moves smoothly
       instead of blinking. Nothing in this film twinkles. */
    var n = o.motes === undefined ? 140 : o.motes;
    var pos = new Float32Array(n * 3), base = [];
    for (var q = 0; q < n; q++) {
      var a = hash(q, 3) * Math.PI * 2;
      var r = 1.15 + Math.pow(hash(q, 5), 0.7) * 2.1;
      var y = (hash(q, 7) - 0.5) * 1.7;
      base.push([a, r, y, 0.36 + hash(q, 11) * 0.11]);
      pos[q * 3] = Math.cos(a) * r; pos[q * 3 + 1] = y; pos[q * 3 + 2] = Math.sin(a) * r;
    }
    var pg = new T.BufferGeometry();
    pg.setAttribute("position", new T.BufferAttribute(pos, 3));
    var pts = new T.Points(pg, new T.PointsMaterial({
      color: C.pale.clone(), size: 0.150, map: dotTex(), transparent: true, opacity: 0.30,
      blending: T.AdditiveBlending, depthWrite: false, sizeAttenuation: true
    }));
    g.add(pts);

    return {
      root: g,
      at: function (u, tsec, f) {
        f = f === undefined ? 1 : f;
        var k = ease(o.ease || "lift", u * 2.6);
        g.scale.setScalar(lerp(0.66, 1.12, k) * (PORTRAIT ? 0.74 : 1));
        /* the group does not turn, because a billboard in a turning group is
           no longer facing the lens. The body inside it turns. */
        core.rotation.y = tsec * 0.12;
        pts.rotation.y = tsec * 0.06;
        core.material.uniforms.glow.value = lerp(0.10, 0.90, k) * f;
        /* THE WORD DOES NOT SIT ON THE LAMP.
           Centred behind a title the light simply eats it: white type on a
           white core. Set low and a little to one side, the title rides the
           top of its falloff the way a word on a poster rides a horizon --
           legible, and lit from the thing it is about. */
        g.position.x = o.x === undefined ? (PORTRAIT ? -0.14 : -0.55) : o.x;
        g.position.y = o.y === undefined ? (PORTRAIT ? -0.74 : -1.16) : o.y;

        for (var i = 0; i < air.length; i++) {
          /* the light opens from the inside out, so it grows rather than
             appearing at full size, and it breathes a little once it is up */
          var sk = clamp01(ease("open", u * 2.3 - i * 0.11));
          var br = 1 + Math.sin(tsec * (0.31 + i * 0.07) + i * 1.7) * 0.045;
          air[i].m.material.uniforms.gain.value = air[i].gain * sk * f * br;
          faceLens(air[i].m);
        }
        streak.material.uniforms.gain.value =
          0.215 * clamp01(ease("open", u * 2.0 - 0.25)) * f *
          (1 + Math.sin(tsec * 0.43) * 0.10);
        faceLens(streak);

        pts.material.opacity = 0.30 * k * f;
        var p = pg.attributes.position.array;
        for (var q2 = 0; q2 < base.length; q2++) {
          var b = base[q2], aa = b[0] + tsec * b[3] * 0.22;
          p[q2 * 3] = Math.cos(aa) * b[1]; p[q2 * 3 + 1] = b[2]; p[q2 * 3 + 2] = Math.sin(aa) * b[1];
        }
        pg.attributes.position.needsUpdate = true;
      }
    };
  };

  /* ---- plate · a diagram, drawn exactly, standing in the room -----------
     THE FIGURE THAT CARRIES AN ARGUMENT.

     Everything else in this file is an object: an orb, a chain, a path. They
     are good at atmosphere and useless at exactness, and an explainer lives on
     exactness. A tick has to land on its value; a label has to sit beside the
     thing it names; eleven pixel type has to stay crisp. That is a canvas.

     So the diagrams are drawn in web/diagrams.js, at the frame's own
     proportions, and mapped onto a plane in this same scene. They take the
     same camera, the same bright pass, the same tone curve, the same grain as
     every other figure, which is why a drawn axis in this film glows like the
     objects around it instead of looking like a chart pasted over a video.

     Additive, on a transparent canvas: black is nothing and bright is light,
     which is the right arithmetic for line art over a dark room and the
     reason the bloom finds the strokes.                                    */
  FIG.plate = function (o) {
    var g = new T.Group();
    /* the canvas is drawn at the shape of the frame it will be seen in, so a
       diagram composed for 16:9 is re-composed for 9:16 rather than squeezed */
    var cw = PORTRAIT ? 1180 : 2048, chh = PORTRAIT ? 2040 : 1152;
    var cv = document.createElement("canvas");
    cv.width = cw; cv.height = chh;
    var cx2 = cv.getContext("2d");
    var tex = new T.CanvasTexture(cv);
    tex.minFilter = T.LinearFilter; tex.magFilter = T.LinearFilter;
    tex.generateMipmaps = false;
    if (T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;

    /* SIZED TO THE SHOT THAT READS IT, NOT TO THE WIDEST ONE.
       The study shot finishes at 6.95 units on a 36 degree lens, which is
       4.52 of world from top to bottom of frame. A plate any taller than that
       has its first row of labels outside the picture, which is how the root
       letters and the outward frame both lost their heads. 3.88 leaves a
       little over three tenths of a unit of margin at each edge. */
    var wWide = o.w === undefined ? (PORTRAIT ? 2.58 : 7.40) : o.w;
    var hHigh = wWide * chh / cw;
    var m = new T.Mesh(new T.PlaneGeometry(wWide, hHigh),
      new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false,
                                blending: T.AdditiveBlending }));
    g.add(m);

    var fn = (window.NOORDIAG || {})[o.draw];
    var warned = false;

    return {
      root: g,
      at: function (u, tsec, f) {
        f = f === undefined ? 1 : f;
        cx2.clearRect(0, 0, cw, chh);
        if (fn) { fn(cx2, cw, chh, clamp01(u), tsec); }
        else if (!warned) { warned = true; }
        tex.needsUpdate = true;
        m.material.opacity = f;
        /* lifted clear of the band the caption is set in, and held square to
           the lens: a diagram read at an angle is a diagram misread */
        g.position.y = o.y === undefined ? (PORTRAIT ? 0.26 : 0.02) : o.y;
        g.position.x = o.x === undefined ? 0 : o.x;
        faceLens(m);
      }
    };
  };

  /* ---- field · how many, and what share of them --------------------------
     THE FIGURE FOR A NUMBER YOU CANNOT PICTURE.

     "About one person in four" is a sentence nobody feels. A field of lights
     is: you see that there are more than you could count, you see a part of
     them take the light, and you have understood the fraction without a
     single digit on screen. It is also the only honest way to draw this --
     a map would be a claim about borders, and a crowd would be a claim about
     faces, and the film makes neither.

     Two point clouds over the same positions: all of them, dim; and the
     chosen share, brighter and larger, arriving one after another so the
     share is watched being counted out rather than switched on.          */
  FIG.field = function (o) {
    var g = new T.Group();
    var n = o.count || 4200;
    var frac = o.lit === undefined ? 0.236 : o.lit;
    var R = o.radius || 3.0;

    var all = new Float32Array(n * 3);
    var pick = [], order = [];
    for (var i = 0; i < n; i++) {
      /* an even shell, not a ball: a uniform cloud reads as fog, a shell
         reads as a population with an inside you are looking through */
      var z = 1 - 2 * (i + 0.5) / n;
      var r = Math.sqrt(Math.max(0, 1 - z * z));
      var th = i * 2.39996323;                      /* the golden angle */
      var wob = 0.86 + hash(i, 17) * 0.28;
      all[i * 3]     = Math.cos(th) * r * R * wob * (o.kx || 1);
      all[i * 3 + 1] = z * R * wob * (o.ky || 0.88);
      all[i * 3 + 2] = Math.sin(th) * r * R * wob;
      if (hash(i, 23) < frac) { pick.push(i); order.push(hash(i, 31)); }
    }
    var ag = new T.BufferGeometry();
    ag.setAttribute("position", new T.BufferAttribute(all, 3));
    /* AND THEY HAVE TO BE BIG ENOUGH TO BE A CROWD.
       At three hundredths of a unit these were three pixels across on a
       1920 frame and the whole population read as sensor noise. A field is
       only a figure if you can see that it is MADE OF THINGS. */
    var dim = new T.Points(ag, new T.PointsMaterial({
      color: C.pale.clone(), size: 0.078, map: dotTex(), transparent: true,
      opacity: 0.92, blending: T.AdditiveBlending, depthWrite: false, sizeAttenuation: true
    }));
    g.add(dim);

    var m = pick.length, lp = new Float32Array(m * 3), home = new Float32Array(m * 3);
    for (var q = 0; q < m; q++) {
      home[q * 3] = all[pick[q] * 3];
      home[q * 3 + 1] = all[pick[q] * 3 + 1];
      home[q * 3 + 2] = all[pick[q] * 3 + 2];
    }
    var lg = new T.BufferGeometry();
    lg.setAttribute("position", new T.BufferAttribute(lp, 3));
    var lit = new T.Points(lg, new T.PointsMaterial({
      color: C.goldhi.clone(), size: 0.155, map: dotTex(), transparent: true,
      opacity: 1.0, blending: T.AdditiveBlending, depthWrite: false, sizeAttenuation: true
    }));
    g.add(lit);

    return {
      root: g,
      at: function (u, tsec, f) {
        f = f === undefined ? 1 : f;
        /* HOW FAST THE FIELD ARRIVES IS NOT A FRACTION OF THE WHOLE CUE.
           This figure is asked to carry four beats, so u runs over twenty-five
           seconds -- and an opening tied to u took eight of them to come up,
           which meant the first beat of the film was a black frame with a
           sentence on it. openK is how many times faster than the cue the
           figure opens: at 8 a twenty-five second cue is fully present three
           seconds in, which is when the first sentence lands. */
        var open = ease("open", u * (o.openK || 1.9));
        g.scale.setScalar(lerp(0.52, 1, open) * (PORTRAIT ? 0.74 : 1.0));
        g.rotation.y = -0.35 + tsec * 0.045;
        g.rotation.x = Math.sin(tsec * 0.13) * 0.06;
        g.position.y = PORTRAIT ? 0.46 : 0.22;
        dim.material.opacity = 0.92 * open * f;

        /* the share is counted out across the middle of the beat */
        var k = clamp01((u - (o.from === undefined ? 0.30 : o.from)) /
                        (o.over === undefined ? 0.42 : o.over));
        var kk = ease("outCubic", k);
        var p = lg.attributes.position.array;
        for (var q = 0; q < m; q++) {
          if (order[q] > kk) { p[q * 3 + 1] = 99999; continue; }
          p[q * 3]     = home[q * 3];
          p[q * 3 + 1] = home[q * 3 + 1];
          p[q * 3 + 2] = home[q * 3 + 2];
        }
        lg.attributes.position.needsUpdate = true;
        lit.material.opacity = 1.0 * f;
        lit.visible = kk > 0.001;
      }
    };
  };

  /* ---- lattice · a chain of transmission --------------------------------
     The figure NOOR needs more than any other and the one no stock library
     has: a name receiving something, and passing it to several who pass it on
     again, until the thing is held in so many hands at once that losing it is
     not possible. Nodes on rings, edges between generations, and a pulse that
     travels outward so the eye follows the transmission rather than counting
     dots.

     No faces, no names rendered as portraits: a node is a point of light.  */
  FIG.lattice = function (o) {
    var rings = o.rings || [1, 3, 6, 10, 14];      /* how many in each generation */
    var span = o.span === undefined ? 0.98 : o.span;
    var g = new T.Group();
    var nodes = [], edges = [];

    var prev = [];
    for (var r = 0; r < rings.length; r++) {
      var count = rings[r], here = [];
      var z = (r - (rings.length - 1) / 2) * span;
      var rad = r === 0 ? 0 : 0.46 + r * 0.44;
      /* wide: a flat oval, so the chain spreads across the frame.
         tall: a narrow upright one, so it grows up it. Same nodes, same
         generations, same edges -- a different arrangement of them. */
      var kx = PORTRAIT ? 0.58 : 1.0, ky = PORTRAIT ? 1.30 : 0.62;
      for (var i = 0; i < count; i++) {
        var a = (i / count) * Math.PI * 2 + r * 0.4;
        var v = new T.Vector3(Math.cos(a) * rad * kx, Math.sin(a) * rad * ky, z);
        here.push({ p: v, gen: r });
        nodes.push({ p: v, gen: r, i: i });
      }
      /* EVERY NODE TAKES FROM THE NEAREST HAND BEFORE IT.
         The first cut picked prev[j % prev.length], which is arithmetic, not
         transmission: a node on one side of the ring took from one on the
         other and the figure came out as a ball of wool with no direction in
         it. Nearest parent makes it a tree, and a tree is what the eye
         already knows how to read as "this came from that". */
      for (var j = 0; j < here.length; j++) {
        if (!prev.length) continue;
        var best = prev[0], bd = 1e9;
        for (var q = 0; q < prev.length; q++) {
          var dx = prev[q].p.x - here[j].p.x, dy = prev[q].p.y - here[j].p.y;
          var dd = dx * dx + dy * dy;
          if (dd < bd) { bd = dd; best = prev[q]; }
        }
        edges.push({ a: best.p, b: here[j].p, gen: r });
      }
      prev = here;
    }

    /* THE EDGES ARE THREADS, NOT LINES.
       A WebGL line is one pixel wide whatever you ask for -- linewidth has
       been ignored by every desktop driver for a decade -- and a one-pixel
       line with no antialiasing is a scratch on the picture. That is what
       the connections between generations looked like. They are thin
       cylinders now: they have a thickness, they take the rim light, they
       recede with distance like everything else, and they read as threads of
       light between one hand and the next. One instanced draw for all of
       them. */
    var eg = new T.CylinderGeometry(0.0088, 0.0088, 1, 8, 1, true);
    var em = lumeMat(C.goldhi, C.pale, { rim: 1.1, glow: 1.05, body: 0.75, sheen: 0.0, dnear: 4.6, dfar: 11.0, damt: 0.7 });
    var lines = new T.InstancedMesh(eg, em, Math.max(1, edges.length));
    lines.instanceMatrix.setUsage(T.DynamicDrawUsage);
    var UP = new T.Vector3(0, 1, 0), DIR = new T.Vector3(), MID = new T.Vector3();
    var EM = new T.Matrix4(), EQ = new T.Quaternion(), ES = new T.Vector3();
    /* each thread remembers where it starts, which way it goes and how long
       it is, so at() can draw as much of it as the chain has reached */
    var thread = [];
    for (var e = 0; e < edges.length; e++) {
      DIR.subVectors(edges[e].b, edges[e].a);
      var len = DIR.length();
      DIR.normalize();
      EQ.setFromUnitVectors(UP, DIR);
      thread.push({ a: edges[e].a.clone(), dir: DIR.clone(), len: len,
                    q: EQ.clone(), gen: edges[e].gen });
    }
    g.add(lines);

    /* the nodes: instanced spheres, so a thousand of them cost one call */
    var sg = new T.SphereGeometry(0.104, 24, 18);
    var sm = lumeMat(C.gold, C.goldhi, { rim: 2.0, glow: 1.15, body: 1.0, sheen: 0.35, dnear: 4.6, dfar: 10.5, damt: 0.82 });
    var inst = new T.InstancedMesh(sg, sm, nodes.length);
    inst.instanceMatrix.setUsage(T.DynamicDrawUsage);
    g.add(inst);
    var M = new T.Matrix4(), Q = new T.Quaternion(), S = new T.Vector3();
    var ZQ = new T.Quaternion();

    /* EVERY HAND HOLDS A LIGHT, NOT A DOT.
       Shaded spheres at this size are beads of gold: correct, and inert. A
       hand that has been given something glows, and a glow is what tells the
       eye at a glance how far the chain has got -- so each node carries a
       small source of its own, all of them in one instanced draw, all facing
       the lens. It is the single change that turns this figure from a
       molecular diagram into a room filling with light. */
    var hg = new T.PlaneGeometry(0.98, 0.98);
    var hm = glowMat(C.pale, C.gold, { k1: 2.0, k2: 8.5, gain: 0.30, hot: 0.85,
                                       dnear: 4.6, dfar: 12.0, damt: 0.55 });
    var halo = new T.InstancedMesh(hg, hm, nodes.length);
    halo.instanceMatrix.setUsage(T.DynamicDrawUsage);
    halo.renderOrder = -1;
    g.add(halo);
    var HM = new T.Matrix4(), HS = new T.Vector3();

    var maxGen = rings.length - 1;

    return {
      root: g,
      at: function (u, tsec, f) {
        f = f === undefined ? 1 : f;
        /* the whole chain turns slowly: depth you can see rather than infer.
           It is set FIRST, because the node halos need the group's finished
           world rotation to work out which way to face. */
        if (PORTRAIT) {
          /* seen nearly end on, so the chain is compact across the frame,
             and stretched in y so it fills the height it has been given */
          g.rotation.y = -0.16 + Math.sin(tsec * 0.22) * 0.16;
          g.rotation.x = -0.08 + Math.cos(tsec * 0.17) * 0.05;
        } else {
          g.rotation.y = -0.5 + Math.sin(tsec * 0.22) * 0.34;
          g.rotation.x = -0.14 + Math.cos(tsec * 0.17) * 0.06;
        }
        var gs = lerp(0.62, 0.76, ease("open", u * 2.4)) * (PORTRAIT ? 0.54 : 1);
        g.scale.setScalar(gs);
        /* lifted clear of the band the caption is set in */
        g.position.y = PORTRAIT ? 0.68 : 0.26;
        lensQ(g, Q);

        /* the chain builds generation by generation across the first 70% of
           the beat, then a pulse runs the whole length of it */
        var grow = clamp01(u / 0.7);
        var front = grow * (maxGen + 0.9);
        /* one breath for the whole figure, twenty six seconds a cycle, three
           and a half per cent. Slow enough that no two frames differ visibly
           and every element moves together. */
        var BREATH = 1 + 0.035 * Math.sin(tsec * 0.24);
        for (var i = 0; i < nodes.length; i++) {
          var n = nodes[i];
          var k = clamp01(front - n.gen);
          var e = ease("snap", k * 1.6);
          /* NOTHING TWINKLES.
             This used to be 0.85 + 0.35 * sin(tsec * 1.6 + i): every bead
             swinging a third of its size, four seconds a cycle, each one a
             radian out of phase with the one beside it. On a chain of two
             hundred hands that is not life, it is glitter, and it is the
             first thing the eye goes to instead of the argument. The spread
             stays -- a crowded generation still must not pool into one blob
             -- but it is now FIXED per bead, and the only thing that moves in
             time is one slow breath the whole figure shares. */
          var pulse = (0.86 + 0.24 * hash(i, 71)) * BREATH;
          S.setScalar(e * pulse);
          M.compose(n.p, ZQ, S);
          inst.setMatrixAt(i, M);
          /* the halo arrives a shade after the bead and is brightest just as
             the light is handed on, so the chain reads as a wave of lighting
             rather than a set of lamps switched on together */
          /* every hand is not lit to the same degree: a little spread,
             fixed per node, keeps a crowded generation from pooling into
             one blob when their halos land on top of each other */
          var hk = e * (0.66 + 0.34 * hash(i, 53)) * BREATH;
          HS.setScalar(hk);
          HM.compose(n.p, Q, HS);
          halo.setMatrixAt(i, HM);
        }
        inst.instanceMatrix.needsUpdate = true;
        halo.instanceMatrix.needsUpdate = true;
        hm.uniforms.gain.value = 0.17 * f;
        sm.uniforms.glow.value = 1.15 * f;

        /* THE THREAD IS DRAWN FROM ONE HAND TO THE NEXT.
           Every edge used to be on screen from the first frame, fading up as
           a set, so the shape of the whole chain was given away before any of
           it had been passed on -- the same fault as a path that is visible
           before the light has travelled it. Each thread now GROWS from its
           parent toward its child exactly as that generation arrives, which
           is both the honest picture of transmission and the thing that makes
           the figure feel built rather than revealed. */
        for (var e = 0; e < thread.length; e++) {
          var th = thread[e];
          var tk = ease("outCubic", clamp01(front - th.gen + 0.35));
          var L = th.len * tk;
          MID.copy(th.dir).multiplyScalar(L * 0.5).add(th.a);
          ES.set(1, Math.max(0.0001, L), 1);
          EM.compose(MID, th.q, ES);
          lines.setMatrixAt(e, EM);
        }
        lines.instanceMatrix.needsUpdate = true;
        em.uniforms.glow.value = 1.05 * f;
      }
    };
  };

  /*  HOW A THING TRAVELS, IF A PERSON IS CARRYING IT.
      ---------------------------------------------------------------------
      An eased position curve is not a movement, it is a shape. outQuint
      starts at full speed and slows for the rest of the beat, which is the
      motion of a thrown object, and everything animated that way reads as
      mechanical for the same reason: real movement has a launch and an
      arrival, and a long steady middle between them.

      So the profile here is written as a VELOCITY and integrated, rather
      than written as a position and differentiated by eye. It ramps up over
      the first sixth, holds, and comes down over the last quarter. The
      integral is the distance travelled and the velocity itself is handed to
      the shader, which is what lets the light be brighter when it is going
      faster. Both come out of the same table, so they can never disagree. */
  var TRAVEL = (function () {
    /* the launch is quick and the arrival is long: a carried light that
       spends four fifths of its beat still leaving is not travelling, it is
       hesitating. Measured against the old front-loaded ease, this reaches
       the halfway point at about the same moment and still has a real
       acceleration and a real deceleration, which the old one had not. */
    var N = 512, up = 0.11, down = 0.24;
    var v = new Float64Array(N + 1), d = new Float64Array(N + 1), tot = 0;
    function ss(e0, e1, x) { var t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); }
    for (var i = 0; i <= N; i++) {
      var x = i / N;
      v[i] = ss(0, up, x) * (1 - ss(1 - down, 1, x));
    }
    for (i = 1; i <= N; i++) { tot += (v[i] + v[i - 1]) * 0.5 / N; d[i] = tot; }
    for (i = 0; i <= N; i++) d[i] /= tot;
    return function (x) {
      x = clamp01(x);
      var f = x * N, k = Math.min(N - 1, Math.floor(f)), a = f - k;
      return [d[k] + (d[k + 1] - d[k]) * a, v[k] + (v[k + 1] - v[k]) * a];
    };
  })();

  /*  A CAMERA IS HELD BY SOMEBODY.
      ---------------------------------------------------------------------
      The drift on every camera in this film was a sum of two sines. Two
      sines is a Lissajous figure: it repeats, and the eye finds the repeat
      in about fifteen seconds and never unsees it. That is what makes a move
      read as robotic -- not that it is smooth, but that it is PERIODIC.

      A person holding a camera drifts like pink noise: mostly slow, with
      small fast corrections on top, and no two minutes the same. This is
      three octaves of smoothed value noise off the same seeded hash the rest
      of the file uses, so it is organic to look at and still an exact
      function of time -- the eleven thousandth frame is the same on any
      machine, which is the one property the render cannot lose. */
  function wander(tsec, seed) {
    var v = 0, amp = 1, fr = 0.085, norm = 0;
    for (var o = 0; o < 3; o++) {
      var x = tsec * fr, i = Math.floor(x), k = x - i;
      var a = hash(i, seed + o * 37) - 0.5, b = hash(i + 1, seed + o * 37) - 0.5;
      v += (a + (b - a) * (k * k * (3 - 2 * k))) * amp;
      norm += amp; amp *= 0.52; fr *= 2.17;
    }
    return v / norm * 2.0;
  }

  /* ---- stream · something carried across time ---------------------------
     Specks running along a curve, brightest at the head. Used where the film
     says "and it travelled": a text out of a city, a practice down a century. */
  FIG.stream = function (o) {
    var g = new T.Group();
    /* the path is shorter and deeper than the first one, which spanned the
       whole frame and read as a horizon rather than a route */
    var WIDE_PATH = o.path || [
      [-2.75, -1.15, 1.0], [-1.25, 0.5, -0.55], [0.3, -0.3, 0.95], [1.75, 0.8, -0.45], [2.8, -0.1, 0.55]
    ];
    /* the same five waypoints, turned a quarter turn: across the wide frame,
       down the tall one. It is one journey either way. */
    /* THE JOURNEY ENDS ABOVE THE WORDS.
       Turned a quarter turn with the old numbers the path finished low in
       the tall frame, which put the head of the light exactly where the
       caption is set -- so 'And carried.' was read through a glow. Shorter
       and lifted: same five waypoints, same journey, clear of the band the
       words live in. */
    var TALL_PATH = o.tallPath || WIDE_PATH.map(function (q) { return [-q[1] * 0.64, -q[0] * 0.56 + 0.92, q[2] * 0.8]; });
    function makeCurve(pts) {
      return new T.CatmullRomCurve3(pts.map(function (q) { return new T.Vector3(q[0], q[1], q[2]); }));
    }
    var curve = makeCurve(PORTRAIT ? TALL_PATH : WIDE_PATH);

    var tubeM = lumeMat(C.gold, C.pale,
      { rim: 1.5, glow: 1.25, body: 0.9, sheen: 0.4, head: true,
        dnear: 5.0, dfar: 12.0, damt: 0.55 });
    var tube = new T.Mesh(new T.TubeGeometry(curve, 320, 0.029, 18, false), tubeM);
    g.add(tube);

    /* THERE ARE NO SPECKS ANY MORE.
       Three hundred points rode fixed lags behind the head. Wherever the
       path compressed in the frame they bunched, and a bunch of bright
       points on a dark ground is a glitter -- the single least premium thing
       a picture can do. Each one also carried a sin(t) term that slid it
       along the path out of phase with its neighbours, so the whole stream
       crawled. The trail is drawn in the tube shader now: one smooth
       exponential behind the wavefront, scaled by the speed. Nothing in it
       can bunch, because it is not made of things. */

    /* THE HEAD IS A SOURCE, NOT A MARBLE.
       A small sphere shaded bright is a solid object, and the bloom pass
       treats a solid bright object the only way it can -- it smears it. What
       belongs at the front of a travelling light is a light: a hard little
       core inside a short falloff, facing the lens, so it stays a POINT the
       eye can follow however bright it gets. */
    var bead = new T.Mesh(new T.SphereGeometry(0.030, 20, 14),
      lumeMat(C.pale, C.goldhi, { rim: 1.8, glow: 1.30, bodyk: 2.6, body: 1.0,
                                  sheen: 0.4, add: true, depthWrite: false, damt: 0.3 }));
    g.add(bead);
    var beadGlow = glowPlane(1.35, C.pale, C.goldhi,
      { k1: 1.6, k2: 8.0, gain: 0.26, hot: 0.85, damt: 0.35 });
    g.add(beadGlow);

    var V3 = new T.Vector3();

    return {
      root: g,
      at: function (u, tsec, f) {
        f = f === undefined ? 1 : f;
        /* the head crosses the whole path over the first four fifths of the
           beat and then rests at the end, so the last second is the finished
           journey rather than a cut mid-flight */
        /* the group's own drift is set before anything inside it is placed,
           for the same reason the lattice sets its rotation first */
        g.rotation.y = Math.sin(tsec * 0.17) * 0.16;
        g.rotation.x = -0.05 + Math.cos(tsec * 0.13) * 0.045;

        var tv = TRAVEL(u / 0.68), head = tv[0], spd = tv[1];
        tubeM.uniforms.headU.value = head;
        tubeM.uniforms.spd.value = spd;
        /* the pipe itself lifts a little while the light is running through
           it and settles when the light arrives: the same argument as the
           head's brightness, one sixth of the size */
        tubeM.uniforms.glow.value = (1.10 + 0.22 * spd) * f;

        curve.getPointAt(Math.min(0.9999, Math.max(0.0001, head)), V3);
        bead.position.copy(V3);
        beadGlow.position.copy(V3);
        faceLens(beadGlow);
        /* the head is a source, and a source carried fast is a brighter
           source. It does not go out when it arrives; it settles. */
        var hv = f * (0.34 + 0.66 * spd) * (head < 0.999 ? 1 : 0.78);
        bead.material.uniforms.glow.value = 1.30 * hv;
        beadGlow.material.uniforms.gain.value = 0.26 * hv;
        bead.visible = beadGlow.visible = head > 0.004;
      }
    };
  };


  /* ---- bars · a hundred and fourteen of something, to scale --------------
     THE FIGURE THAT IS A DATASET AND STILL A PLACE.

     Every other figure in this file stands for a thing. This one IS the
     thing: one bar per surah, its length the number of verses in it, no
     rounding and no selection. Six thousand two hundred and thirty six
     verses are on the screen at once, at scale, and the shape they make is
     the argument. There is nothing to take on trust.

     AND THEY HAVE WEIGHT.
     Each bar arrives on a real spring whose MASS is its own length: the two
     hundred and eighty six verse chapter takes most of a second to stop
     moving and the three verse one is still in a tenth. That is not a
     flourish. A row of objects that all settle in the same time reads as a
     chart animating; a row that settles in proportion to what each object
     weighs reads as objects, and the eye believes objects.

     Wide, they stand in a row and the camera walks along them. Tall, the
     whole figure is turned a quarter turn -- so the list runs DOWN the frame
     and each bar reaches to the right, which is how a phone reads a list.
     One layout, one rotation, no second composition to keep in step. */
  FIG.bars = function (o) {
    /* the flat vector language is a different figure, not a different skin,
       so the same film description reaches it by asking for the layout */
    if ((o.layout || LAYOUT_OF) === "nut") return FIG.nut(o);
    /*  THREE NESTED GROUPS, AND THE ORDER MATTERS.
        g      places the figure in the room and makes the quarter turn
        pivot  yaws, so the field is seen at an angle
        inner  scales and scrolls, so the thing being spoken about is centred

        The yaw has to be OUTSIDE the scroll. With both on one group,
        three.js builds T*R*S: the rotation turns the run about its own
        middle and the translation is added afterwards, so at the close view
        -- where the scroll is twenty three units -- a fifth of a radian of
        yaw threw the first bars five units toward the camera and out of the
        shot. That is why the opening frames came out empty. Pivoting about
        the point you are looking at is not a nicety; it is what a yaw IS. */
    var g = new T.Group(), pivot = new T.Group(), inner = new T.Group();
    g.add(pivot); pivot.add(inner);
    var D = o.data || [];
    var N = D.length, MAXV = 1;
    for (var i = 0; i < N; i++) MAXV = Math.max(MAXV, D[i].v);

    var STEP = o.step || 0.125;                 /* one bar to the next */
    var THICK = o.thick || 0.052;               /* the bar's own width */
    var LMAX = o.lmax || 3.15;                  /* the longest bar, in units */
    var RUN = (N - 1) * STEP;
    var mark = {}; (o.mark || []).forEach(function (m) { mark[m] = 1; });
    var rise = {}; (o.rise || []).forEach(function (m) { rise[m] = 1; });

    /* the rule the bars stand on: one line, so a length is measured from
       somewhere rather than floating */
    var rule = new T.Mesh(new T.BoxGeometry(RUN + STEP * 2, 0.012, 0.012),
      lumeMat(C.gold, C.goldhi, { rim: 1.4, glow: 0.5, body: 0.6, sheen: 0.2,
                                  dnear: 9.0, dfar: 30.0, damt: 0.7 }));
    rule.position.set(0, 0, 0);

    /*  FOUR WAYS TO PUT A HUNDRED AND FOURTEEN THINGS IN A ROOM.
        A direction that only changes the light is a filter. What changes
        when the material changes is also WHERE THE ARGUMENT LIVES, so each
        one gets its own arrangement of the same numbers, and each says
        something the others cannot.

          run     a line you walk along. The shape of the whole book.
          fan     the same lengths swung round a centre. A dial.
          grid    twelve by ten small multiples. It says "a hundred and
                  fourteen separate things" better than a line can.
          folds   the run, pleated. Alternate bars stand on facets tilted
                  against each other, so the field is a folded sheet seen at
                  an angle and the parallax is depth rather than slide.  */
    var LAYOUT = o.layout || LAYOUT_OF || "run";
    var LINE0 = (LAYOUT === "run" || LAYOUT === "folds");
    var COLS = 12, CW = 0.30, CH = 0.335;
    var FAN0 = -1.28, FAN1 = 1.28, FANR = 1.15;
    if (LINE0) inner.add(rule);

    var bar = [];
    for (i = 0; i < N; i++) {
      var v = D[i].v, L = v / MAXV * LMAX;
      var m = lumeMat(rise[D[i].n] ? C.cool : C.gold, rise[D[i].n] ? C.pale : C.goldhi,
        { rim: 1.7, glow: 0.0, body: 0.86, sheen: 0.45, bodyk: 1.6,
          dnear: 8.0, dfar: 28.0, damt: 0.66 });
      /*  IN A GRID, MAGNITUDE IS AREA, NOT LENGTH.
          A hundred and fourteen cells on a phone are ninety pixels each, and
          a three verse chapter drawn as a length in one of them is half a
          pixel: a hundred of the hundred and fourteen would simply not be on
          the screen. Area encoding puts the same ratio on a square root, so
          the smallest chapter is a tenth of the largest instead of a
          hundredth of it, and every one of them is visible. It is a
          different claim, honestly made: this one says "how much", the run
          says "how they are ordered". */
      /* in the pleated arrangement each bar is a FACET, not a stick: a
         folded sheet is made of planes, and a plane needs width across the
         fold or the crease has nothing to be a crease in */
      var mesh = new T.Mesh(
        LAYOUT === "grid" ? new T.BoxGeometry(1, 1, 0.16)
      : LAYOUT === "folds" ? new T.BoxGeometry(THICK * 0.9, 1, THICK * 6.0)
      : new T.BoxGeometry(THICK, 1, THICK), m);
      if (LAYOUT === "fan") {
        var aa = FAN0 + (i / (N - 1)) * (FAN1 - FAN0);
        mesh.position.set(Math.sin(aa) * FANR, -Math.cos(aa) * FANR, 0);
        mesh.rotation.z = aa;
      } else if (LAYOUT === "grid") {
        mesh.position.set((i % COLS - (COLS - 1) * 0.5) * CW,
                          -(Math.floor(i / COLS) - 4.5) * CH, 0);
      } else {
        mesh.position.x = -RUN * 0.5 + i * STEP;
        if (LAYOUT === "folds") {
          /* the pleat: alternate bars stand on facets tilted against each
             other, so the sheet has a near edge and a far one, and the lens
             finally has something to have a depth of field ABOUT */
          var up = (i % 2 === 0);
          mesh.rotation.x = up ? 0.62 : -0.62;
          mesh.position.z = up ? 0.30 : -0.30;
        }
      }
      inner.add(mesh);
      /* THE SPRING IS THE BAR'S OWN.
         Stiffness fixed, damping fixed, mass = the verse count. A long
         chapter is a heavy object and settles like one. */
      bar.push({ m: mesh, mat: m, L: L, v: v, n: D[i].n, home: mesh.position.y,
                 ease: springEase(120, 17, 0.55 + v / MAXV * 2.6) });
    }

    /* the slope: one line through the tops, drawn once the field is down.
       It is the claim "roughly longest to shortest" made visible, and the
       places it does not hold are then visible as departures from it. */
    var sm = [];
    for (i = 0; i < N; i += 1) {
      var acc = 0, cnt = 0;
      for (var k = Math.max(0, i - 4); k <= Math.min(N - 1, i + 4); k++) { acc += D[k].v; cnt++; }
      sm.push(new T.Vector3(-RUN * 0.5 + i * STEP, acc / cnt / MAXV * LMAX, 0));
    }
    var slopeM = lumeMat(C.pale, C.parch, { rim: 1.2, glow: 0.0, body: 1.0, sheen: 0.0,
                                            head: true, dnear: 9.0, dfar: 30.0, damt: 0.55 });
    slopeM.uniforms.headOn.value = 1;
    var slope = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(sm), 420, 0.0125, 8, false), slopeM);
    /* the trend line is a statement about a SEQUENCE, so it belongs only to
       the arrangements that are one. Through a dial or a grid it would be a
       line drawn between things that are not next to each other. */
    if (LINE0) inner.add(slope);

    /* the one bar the film stops on gets a light at its tip. A nineteen
       verse chapter is six per cent of the longest one, so it cannot be
       found by being made bigger without lying about the scale; it is found
       by being the only lit thing in the frame. */
    var tip = glowPlane(2.1, C.parch, C.goldhi, { k1: 1.5, k2: 7.0, gain: 0.0, hot: 0.72, damt: 0.35 });
    inner.add(tip);

    function seg(u, a, b) { return clamp01((u - a) / (b - a)); }

    return {
      root: g,
      at: function (u, tsec, f) {
        f = f === undefined ? 1 : f;

        /* ---- the framing, first, because the lengths depend on it -------
           A hundred and fourteen rows whose longest is two hundred and
           eighty six verses and whose shortest is three do not fit one
           scale. Close enough to compare seven against two hundred and
           eighty six, the whole run is forty times too long for the frame;
           far enough to hold all of it, a three verse chapter is a third of
           a pixel.

           So the length scale and the distance move TOGETHER, and their
           product is held constant: the bars keep the same length on the
           screen while the list compresses under them. What the camera is
           doing, in chart terms, is rescaling the axis as the data arrives,
           and rescaling in view is more honest than cutting to a new scale
           and hoping nobody checks. */
        var wideView = clamp01(seg(u, 0.30, 0.46));
        var toMark = clamp01(seg(u, 0.72, 0.82)) * (1 - clamp01(seg(u, 0.90, 1.0)));
        var scNear, scFar, KLEN, LINE = LINE0;
        if (LAYOUT === "fan") {
          scNear = PORTRAIT ? 1.45 : 1.80; scFar = PORTRAIT ? 0.50 : 0.70;
          KLEN = PORTRAIT ? 0.88 : 1.18;
        } else if (LAYOUT === "grid") {
          /* the square must never outgrow its cell, or a grid of small
             multiples becomes a grid of overlapping ones */
          scNear = PORTRAIT ? 1.70 : 2.10; scFar = PORTRAIT ? 0.60 : 0.78;
          KLEN = PORTRAIT ? 0.152 : 0.185;
        } else {
          scNear = PORTRAIT ? 3.40 : 4.20; scFar = PORTRAIT ? 0.142 : 0.345;
          KLEN = PORTRAIT ? 1.55 : 2.50;
        }
        var sc = lerp(scNear, scFar, wideView);
        var LS = KLEN / sc;
        /* there was a line here reading `lerp(1.0, STEP / THICK, wide)`,
           copied out of FIG.nut where `wide` is a local. There is no such
           name in this scope and the file is strict, so it threw a
           ReferenceError on the first frame of every film whose layout is
           not "nut" -- five of the eight direction shorts, dead, showing
           the last painted state for their whole length. The value it
           computed was never read. */

        /* ---- when each bar is asked to arrive --------------------------
           The first two are named, so they are given a beat each; the rest
           come in one sweep from the front of the book to the back, which is
           the direction a person reads it. */
        /* THE FIRST BAR IS ON SCREEN IN THE FIRST SECOND.
           Three and a half seconds of empty room is a fine opening for a
           twelve minute film and a lost viewer on a phone. */
        var LEAD = [0.006, 0.032, 0.068, 0.098];
        for (var i = 0; i < bar.length; i++) {
          var b = bar[i];
          var t0 = i < 4 ? LEAD[i] : 0.165 + (i / bar.length) * 0.205;
          var k = b.ease(seg(u, t0, t0 + 0.16));
          var L;
          if (LAYOUT === "grid") {
            L = Math.sqrt(b.v / MAXV) * LS * k;
            b.m.scale.set(Math.max(0.0006, L), Math.max(0.0006, L), 1);
          } else {
            L = b.v / MAXV * LS * k;
            b.m.scale.set(1, Math.max(0.0006, L), 1);
            b.m.position.y = b.home + L * 0.5;
          }
          var on = clamp01(seg(u, t0, t0 + 0.05));
          /* the rises are not a second colour from the start: they are the
             same gold until the film says what they are */
          var hot = rise[b.n] ? seg(u, 0.60, 0.70) : 0;
          var lit = mark[b.n] ? seg(u, 0.78, 0.86) : 0;
          /* the spotlight: at the mark, everything else goes down to a fifth */
          var solo = mark[b.n] ? 1 : (1 - 0.80 * clamp01(seg(u, 0.78, 0.86))
                                          * (1 - clamp01(seg(u, 0.93, 1.0))));
          b.mat.uniforms.glow.value = ((0.58 * on + 0.40 * hot) * solo + 1.35 * lit) * f;
          b.mat.uniforms.core.value.lerpColors(C.gold, rise[b.n] ? C.cool : C.pale,
                                               Math.max(hot, lit));
        }
        rule.material.uniforms.glow.value = 0.40 * clamp01(seg(u, 0.02, 0.09)) * f;
        rule.scale.set(1, 1, 1);

        /* the tip light rides the end of the marked bar */
        var markBar = null;
        for (i = 0; i < bar.length; i++) if (mark[bar[i].n]) markBar = bar[i];
        if (markBar) {
          var tl = clamp01(seg(u, 0.78, 0.87)) * (1 - clamp01(seg(u, 0.94, 1.0)));
          tip.position.set(markBar.m.position.x, markBar.m.scale.y, 0);
          tip.scale.setScalar(1 / Math.max(0.02, LS));
          tip.material.uniforms.gain.value = 0.30 * tl * f;
          faceLens(tip);
        }

        /* the slope draws itself across the tops, front to back. It is built
           once at LMAX and stretched to whatever the length scale is now, so
           it can never disagree with the bars it is drawn through. */
        var slopeOn = clamp01(seg(u, 0.46, 0.50));
        slope.visible = slopeOn > 0.001;
        slope.scale.set(1, LS / LMAX, 1);
        slopeM.uniforms.headU.value = seg(u, 0.46, 0.60);
        slopeM.uniforms.spd.value = 0.55;
        slopeM.uniforms.glow.value = 0.80 * slopeOn * f
                                   * (1 - 0.5 * clamp01(seg(u, 0.74, 0.82)));

        /* ---- the walk along the field, which the figure does itself -----
           A dolly along fourteen units of bars is a move the film's own
           camera cannot make without leaving every other figure behind, so
           the figure carries it: it holds the thing being spoken about in
           the middle of the frame and changes what that is. */
        /* and once the whole run is in the frame it STAYS in the frame: the
           mark shot is a spotlight, not a move, so there is nothing to
           scroll to and nothing to slide out of the top. */
        var cx = LINE ? lerp(-RUN * 0.5 + STEP * 1.2, 0, wideView) : 0;
        var cy = LAYOUT === "grid" ? lerp(4.5 * CH, 0, wideView) : 0;
        inner.scale.setScalar(sc);
        inner.position.set(-cx * sc, -cy * sc, 0);

        /* the quarter turn that makes it a list on a phone: the run goes
           DOWN the frame and each bar reaches to the right */
        g.rotation.z = (PORTRAIT && LINE) ? -Math.PI * 0.5 : 0;
        /* clear of the band the caption is set in */
        g.position.x = (PORTRAIT && LINE) ? -0.98 : 0;
        g.position.y = LINE ? (PORTRAIT ? 0.713 : 0.62)
                            : (LAYOUT === "grid" ? (PORTRAIT ? 0.40 : 0.22)
                                                 : (PORTRAIT ? 0.92 : 0.36));
        /* one breath for the whole field, together, under three per cent */
        g.scale.setScalar(1 + 0.026 * Math.sin(tsec * 0.19));
        /* and a slow look around it, so it is a thing standing in a room and
           not a chart printed on a wall. Organic, not a sine: see wander(). */
        /* THE FIELD IS SEEN FROM SOMEWHERE, AND IT KEEPS MOVING.
           A yaw held on a flat field is what parallax is made of: the near
           end travels further across the frame than the far end, and that
           difference is the only thing that tells the eye the field has
           depth. The pleated arrangement gets twice as much of it, because
           it has twice as much depth to show. */
        var YAW = LAYOUT === "folds" ? 0.34 : (LINE ? 0.22 : 0.14);
        pivot.rotation.y = wander(tsec, 211) * 0.075 + lerp(YAW, YAW * 0.22, wideView);
        pivot.rotation.x = wander(tsec, 223) * 0.030 - (LAYOUT === "folds" ? 0.16 : 0.05);
      }
    };
  };


  /* =======================================================================
     FLAT VECTOR, WITH A CAMERA
     =======================================================================
     Everything above this line lights surfaces. This does not light
     anything. It is flat shapes of solid colour on a coloured ground, which
     is the entire visual grammar of the explainers this is aimed at: no
     material, no specular, no shading model, no attempt at photography.

     What makes it read as film rather than as a slide is the CAMERA, and
     the camera needs something to be a camera about. So the picture is built
     in five planes at real distances -- far wash, three sheets of small
     shapes, the data itself, and a foreground -- and the perspective camera
     does the rest for free: when it moves sideways the near plane travels
     further across the frame than the far one, which is parallax, and the
     aperture pass finds the planes that are not on the focus distance and
     turns their small bright shapes into discs, which is bokeh. The
     foreground plane is deliberately far out of focus and exists for no
     other reason: it is what a lens looking past something looks like.

     Nothing here is 3D in the sense that matters. Every shape is a flat
     polygon facing the lens. The depth is only there so the camera has
     somewhere to move. */
  function pillShape(w, r) {
    var sh = new T.Shape(), hw = w * 0.5;
    r = Math.min(r, hw, 0.5);
    sh.moveTo(-hw + r, 0);
    sh.lineTo(hw - r, 0);
    sh.quadraticCurveTo(hw, 0, hw, r);
    sh.lineTo(hw, 1 - r);
    sh.quadraticCurveTo(hw, 1, hw - r, 1);
    sh.lineTo(-hw + r, 1);
    sh.quadraticCurveTo(-hw, 1, -hw, 1 - r);
    sh.lineTo(-hw, r);
    sh.quadraticCurveTo(-hw, 0, -hw + r, 0);
    return sh;
  }

  /* one flat colour, no lighting, no gradient. The only material in this
     language, used for every shape in it. */
  function flatMat2(hex, opt) {
    opt = opt || {};
    return new T.MeshBasicMaterial({
      color: (hex instanceof T.Color) ? hex.clone() : new T.Color(hex),
      transparent: opt.op !== undefined,
      opacity: opt.op === undefined ? 1 : opt.op,
      depthWrite: opt.dw === undefined ? true : opt.dw,
      depthTest: true,
      side: T.DoubleSide,
      toneMapped: false
    });
  }

  /* stiff, damped just short of overshoot: quick away, exact arrival */
  var SCENE_EASE = springEase(150, 23, 1.0);

  FIG.nut = function (o) {
    var g = new T.Group(), pivot = new T.Group(), inner = new T.Group();
    g.add(pivot); pivot.add(inner);

    var P = o.pal || ART_OF || {};
    var CBASE = new T.Color(P.base === undefined ? 0xF5B93B : P.base);
    var CRISE = new T.Color(P.rise === undefined ? 0xFF6F5E : P.rise);
    var CMARK = new T.Color(P.mark === undefined ? 0x35CFC0 : P.mark);
    var CLINE = new T.Color(P.line === undefined ? 0xFFF3DC : P.line);
    var CFAR  = new T.Color(P.far === undefined ? 0x2A2F63 : P.far);
    var CNEAR = new T.Color(P.near === undefined ? 0x4A3C8C : P.near);

    var D = o.data || [], N = D.length, MAXV = 1;
    for (var i = 0; i < N; i++) MAXV = Math.max(MAXV, D[i].v);
    var STEP = o.step || 0.125, THICK = o.thick || 0.082, LMAX = 3.15;
    var RUN = (N - 1) * STEP;
    var mark = {}; (o.mark || []).forEach(function (m) { mark[m] = 1; });
    var rise = {}; (o.rise || []).forEach(function (m) { rise[m] = 1; });

    /* ---- the planes -------------------------------------------------- */
    /*  THE PLANES HANG OFF THE PIVOT, NOT OFF THE ZOOM.
        Only the data scales when the camera pulls back. If the background
        sheets scaled with it their distances would shrink too -- at the wide
        view a plane nine units back would be one unit back -- and the
        parallax, which is entirely a function of those distances, would
        quietly disappear at exactly the moment the shot most needs it. */
    var FAR = new T.Group();  FAR.position.z = -9.0;   pivot.add(FAR);
    var S1 = new T.Group();   S1.position.z = -6.4;    pivot.add(S1);
    var S2 = new T.Group();   S2.position.z = -4.2;    pivot.add(S2);
    var S3 = new T.Group();   S3.position.z = -2.3;    pivot.add(S3);
    var MAIN = new T.Group();                          inner.add(MAIN);
    /* NAMED, SO THAT IT CAN BE MEASURED.
       The figure's own marks live in here. The three background sheets, the
       soft blooms and the key light live in siblings. Measuring the whole
       scene graph returns the size of the ROOM, which is identical for every
       figure and so says nothing about how far to stand from any of them:
       the first run of measure.py reported a half width of 9.97 for all
       fifteen, which was the background and not the subject. This is the
       only group whose extent means anything. */
    MAIN.name = "MAIN";
    var NEAR = new T.Group(); NEAR.position.z = 2.55;  g.add(NEAR);

    /*  DISTANCE COSTS CONTRAST BEFORE IT COSTS FOCUS.
        The picture read as a collage because everything in it was equally
        solid: a background circle at thirty per cent opacity is still a
        SHAPE, and a shape at the back competing with a shape at the front is
        two stickers on one sheet. Air does not blur distant things first, it
        drains them -- of contrast, then of colour, and only then of edge.
        Every plane here is therefore pulled toward the ground colour by how
        far away it is, so the far wash is a change in the ground rather than
        an object standing in front of it. */
    var CIRC = new T.CircleGeometry(1, 56);
    var SKYC = new T.Color(P.sky === undefined ? 0x060E24 : P.sky);
    function airy(col, k) {   /* k = 0 at the lens, 1 at the back of the room */
      return new T.Color(col).lerp(SKYC, k);
    }
    /*  AND A THING AT THE BACK MUST NOT HAVE AN EDGE.
        A circle at ninety per cent of the ground's own colour is still a
        circle: the eye finds the edge before it reads the value, and an edge
        at the back of the room is a sticker. These are soft falloffs with no
        boundary anywhere, so they change the ground instead of standing in
        front of it. That is the difference between an atmosphere and a
        collage. */
    var farWash = [];
    for (i = 0; i < 4; i++) {
      var fw = airy(i % 2 ? CNEAR : CFAR, 0.35);
      var m = glowPlane(1.0, fw, fw, { k1: 0.55, k2: 1.35, gain: 0.34, hot: 0.0, damt: 0.0 });
      m.position.set((hash(i, 71) - 0.5) * 16.0, (hash(i, 73) - 0.5) * 12.0, -i * 0.4);
      m.scale.setScalar(5.0 + hash(i, 79) * 5.5);
      FAR.add(m); farWash.push(m);
    }

    /* three sheets of small shapes. Same shapes, three distances: that is
       the parallax, and it costs nothing but a z. */
    /* CONFETTI IS NOT PARALLAX.
       The first pass put a hundred and sixty bright dots across three
       planes and the picture read as a party. What the planes are for is
       DEPTH, and depth needs few enough marks that the eye can follow one
       of them across the frame. Fewer, smaller, and the far ones nearly the
       colour of the ground they sit on. */
    /* three sheets, and each one further back is nearer the ground it sits
       on: 0.86 of the way there at the back, 0.55 in the middle, 0.28 in
       front. That ladder is the whole depth cue, and it does more for
       separation than any amount of blur. */
    var SHEET = [ { g: S1, n: 24, r: 0.030, sp: 16.0, air: 0.90 },
                  { g: S2, n: 15, r: 0.042, sp: 12.5, air: 0.72 },
                  { g: S3, n: 8,  r: 0.058, sp: 9.2,  air: 0.50 } ];
    for (var si = 0; si < SHEET.length; si++) {
      var S = SHEET[si];
      for (i = 0; i < S.n; i++) {
        /* the marks in the air are the film's own two hues and nothing else.
           A near-white speck at the back of the room is a star, and there
           are no stars in this argument. */
        var col = [CMARK, CBASE][(hash(i, 101 + si) * 2) | 0];
        var d = new T.Mesh(CIRC, flatMat2(airy(col, S.air), { op: 1.0, dw: true }));
        d.position.set((hash(i, 11 + si) - 0.5) * S.sp,
                       (hash(i, 23 + si) - 0.5) * S.sp * 1.35, 0);
        /* ONE DOT FAMILY. Three sizes, not a continuum: a field where every
           mark is a slightly different size has no rhythm and reads as
           scatter. */
        d.scale.setScalar(S.r * [0.6, 0.85, 1.15][(hash(i, 37 + si) * 3) | 0]);
        S.g.add(d);
      }
    }

    /* the foreground. It is never in focus and it is not supposed to be:
       a lens looking PAST something is the oldest depth cue there is, and
       these are soft sprites rather than geometry so they are already the
       discs the aperture would have made of them. */
    var fore = [];
    for (i = 0; i < 4; i++) {
      var fc = [CBASE, CMARK][(hash(i, 211) * 2) | 0];
      /* A FOREGROUND MOTE IS A DISC OF LIGHT, NOT A DOT.
         These were small and crisp, which is the one thing a thing in front
         of the focus plane cannot be. Three times the size, a third of the
         strength, and a falloff with no shoulder at all: the eye should
         register them as air in front of the lens and never as objects. */
      var fm = glowPlane(1.0, fc, fc, { k1: 0.55, k2: 1.5, gain: 0.11, hot: 0.0, damt: 0.0 });
      fm.position.set((hash(i, 217) - 0.5) * 6.4, (hash(i, 223) - 0.5) * 8.0, hash(i, 227) * 0.6);
      fm.scale.setScalar(0.95 + hash(i, 229) * 1.5);
      NEAR.add(fm); fore.push(fm);
    }

    /* ---- the data ----------------------------------------------------- */
    var GEO = new T.ShapeGeometry(pillShape(THICK, THICK * 0.5), 6);
    var bar = [];
    for (i = 0; i < N; i++) {
      var v = D[i].v;
      var mt = flatMat2(rise[D[i].n] ? CRISE : CBASE, { op: 1.0, dw: true });
      var mesh = new T.Mesh(GEO, mt);
      mesh.position.x = -RUN * 0.5 + i * STEP;
      MAIN.add(mesh);
      bar.push({ m: mesh, mat: mt, v: v, n: D[i].n,
                 ease: springEase(120, 17, 0.55 + v / MAXV * 2.6) });
    }

    /* the rule the lengths are measured from */
    /*  THE LINE ACROSS THE MIDDLE OF THE FRAME.
        The rule is a pill whose WIDTH is the length of the run and whose
        height is one unit, squashed to a hairline. It was also being rotated
        a quarter turn, which stood it up along the axis the list runs down
        -- and since the whole figure is then turned a quarter turn for the
        phone, the two rotations cancelled and the baseline came out
        horizontal, straight across the picture, past the end of the data.
        A measurement line that does not run along the thing it measures is
        not a rule, it is a scratch on the lens. */
    var ruleG = new T.ShapeGeometry(pillShape(RUN + STEP * 2, 0.010), 4);
    var rule = new T.Mesh(ruleG, flatMat2(CLINE, { op: 0.22, dw: false }));
    rule.scale.set(1, 0.012, 1);
    rule.position.set(0, -0.004, -0.01);
    MAIN.add(rule);

    /* the trend, as a flat ribbon rather than a tube */
    var sm = [];
    for (i = 0; i < N; i++) {
      var acc = 0, cnt = 0;
      for (var k = Math.max(0, i - 4); k <= Math.min(N - 1, i + 4); k++) { acc += D[k].v; cnt++; }
      sm.push(new T.Vector2(-RUN * 0.5 + i * STEP, acc / cnt / MAXV * LMAX));
    }
    var slopeShape = new T.Shape();
    slopeShape.moveTo(sm[0].x, sm[0].y - 0.009);
    for (i = 1; i < sm.length; i++) slopeShape.lineTo(sm[i].x, sm[i].y - 0.009);
    for (i = sm.length - 1; i >= 0; i--) slopeShape.lineTo(sm[i].x, sm[i].y + 0.009);
    var slope = new T.Mesh(new T.ShapeGeometry(slopeShape, 2), flatMat2(CLINE, { op: 0.9, dw: false }));
    slope.position.z = 0.02;
    MAIN.add(slope);
    var slopeMat = slope.material;

    /* the Lantern's answer in this language: one soft round behind the
       subject, so the field is lit from somewhere without anything being lit */
    var key = glowPlane(6.4, CBASE, CBASE, { k1: 1.0, k2: 2.2, gain: 0.16, hot: 0.0, damt: 0.0 });
    key.position.set(0, 0, -1.4);
    pivot.add(key);

    function seg(u, a, b) { return clamp01((u - a) / (b - a)); }
    var COL = new T.Color();

    return {
      root: g,
      at: function (u, tsec, f) {
        f = f === undefined ? 1 : f;
        /*  FAST ACCELERATION, ACCURATE DECELERATION.
            A linear ramp between two framings is the most robotic move
            available: it starts at full speed, ends at full speed, and has
            no moment of arrival. This is a spring, stiff and damped just
            short of an overshoot, so the camera leaves quickly, covers most
            of the distance early, and settles onto the new framing instead
            of stopping at it. It is the same curve every object in the film
            arrives on, which is what makes a cut between two of them feel
            like one hand moved both. */
        var wide = SCENE_EASE(clamp01(seg(u, 0.28, 0.50)));
        var scNear = PORTRAIT ? 3.40 : 4.20, scFar = PORTRAIT ? 0.142 : 0.345;
        var KLEN = PORTRAIT ? 1.55 : 2.50;
        var sc = lerp(scNear, scFar, wide);
        var LS = KLEN / sc;
        var WFILL = lerp(1.0, STEP / THICK, wide);

        var LEAD = [0.006, 0.032, 0.068, 0.098];
        for (var i = 0; i < bar.length; i++) {
          var b = bar[i];
          var t0 = i < 4 ? LEAD[i] : 0.165 + (i / bar.length) * 0.205;
          var k = b.ease(seg(u, t0, t0 + 0.16));
          var L = b.v / MAXV * LS * k;
          /*  ONE HUNDRED AND FOURTEEN THINGS, OR ONE SHAPE.
              Close enough to read a single chapter, the bars must be
              separated or they are not chapters. Far enough to see the whole
              book, a hundred and fourteen separated strokes are not a shape,
              they are a texture -- which is exactly why the wide frame was
              unreadable at a glance. So the bar's own width grows with the
              pull-back until it exactly fills its pitch, and the run becomes
              one continuous silhouette without a second piece of geometry
              and without a dissolve between two versions of the truth. */
          b.m.scale.set(WFILL, Math.max(0.0004, L), 1);
          var hot = rise[b.n] ? seg(u, 0.60, 0.70) : 0;
          var lit = mark[b.n] ? seg(u, 0.78, 0.86) : 0;
          /* the spotlight has to be a spotlight: at a third of a stop the
             answer does not separate from a hundred and thirteen neighbours */
          var solo = mark[b.n] ? 1 : (1 - 0.80 * clamp01(seg(u, 0.78, 0.86))
                                         * (1 - clamp01(seg(u, 0.93, 1.0))));
          COL.copy(rise[b.n] ? CBASE : CBASE);
          if (hot > 0) COL.lerp(CRISE, hot);
          if (lit > 0) COL.lerp(CMARK, lit);
          b.mat.color.copy(COL).multiplyScalar(0.42 + 0.58 * solo);
          b.mat.opacity = f;
        }
        rule.material.opacity = 0.30 * clamp01(seg(u, 0.02, 0.09)) * f;
        slope.scale.set(1, LS / LMAX, 1);
        /* no switch anywhere in this film: the ribbon is hidden only once
           its own opacity has already reached zero, so there is no frame in
           which something is there and the next frame in which it is not */
        slope.visible = u > 0.455;
        /* the trend is an argument about the bars, not a rival to them */
        slopeMat.opacity = 0.58 * clamp01(seg(u, 0.46, 0.52)) * f
                         * (1 - 0.45 * clamp01(seg(u, 0.74, 0.82)));
        key.material.uniforms.gain.value = 0.16 * f;
        faceLens(key);
        for (i = 0; i < fore.length; i++) faceLens(fore[i]);
        for (i = 0; i < farWash.length; i++) faceLens(farWash[i]);

        var cx = lerp(-RUN * 0.5 + STEP * 1.2, 0, wide);
        inner.scale.setScalar(sc);
        inner.position.set(-cx * sc, 0, 0);
        NEAR.position.x = wander(tsec, 307) * 0.55;
        NEAR.position.y = wander(tsec, 311) * 0.40;

        g.rotation.z = PORTRAIT ? -Math.PI * 0.5 : 0;
        g.position.x = PORTRAIT ? -0.98 : 0;
        g.position.y = PORTRAIT ? 0.713 : 0.30;
        /* THE MOVE IS ALL LATERAL, AND THAT IS DELIBERATE.
           A push straight in gives no parallax at all: every plane grows by
           the same ratio. What separates the planes is sideways travel, so
           the whole camera language here is a slow lateral drift plus a yaw
           about the thing being looked at. */
        pivot.rotation.y = wander(tsec, 211) * 0.10 + lerp(0.26, 0.04, wide);
        pivot.rotation.x = wander(tsec, 223) * 0.035 - 0.045;
        pivot.position.x = wander(tsec, 233) * 0.16;
      }
    };
  };


  /* =======================================================================
     ONE ROOM, FIVE ARGUMENTS
     =======================================================================
     The scaffolding every flat vector figure stands in: the five planes, the
     air that drains distant things of contrast, the foreground that is never
     in focus, and the key behind the subject. Written once so that five
     different shapes of argument are literally the same system rather than
     five things that resemble each other.
  */
  function nutScene(o) {
    var g = new T.Group(), pivot = new T.Group(), inner = new T.Group();
    g.add(pivot); pivot.add(inner);
    var P = o.pal || ART_OF || {};
    var C_ = {
      base: new T.Color(P.base === undefined ? 0xEFB229 : P.base),
      rise: new T.Color(P.rise === undefined ? 0x0E97A9 : P.rise),
      mark: new T.Color(P.mark === undefined ? 0xFBF4DA : P.mark),
      line: new T.Color(P.line === undefined ? 0xFBF4DA : P.line),
      far:  new T.Color(P.far === undefined ? 0x121D38 : P.far),
      near: new T.Color(P.near === undefined ? 0x1E2B4B : P.near),
      sky:  new T.Color(P.sky === undefined ? 0x060E24 : P.sky)
    };
    function airy(col, k) { return new T.Color(col).lerp(C_.sky, k); }

    var FAR = new T.Group();  FAR.position.z = -9.0;   pivot.add(FAR);
    var S1 = new T.Group();   S1.position.z = -6.4;    pivot.add(S1);
    var S2 = new T.Group();   S2.position.z = -4.2;    pivot.add(S2);
    var S3 = new T.Group();   S3.position.z = -2.3;    pivot.add(S3);
    var MAIN = new T.Group();                          inner.add(MAIN);
    /* NAMED, SO THAT IT CAN BE MEASURED.
       The figure's own marks live in here. The three background sheets, the
       soft blooms and the key light live in siblings. Measuring the whole
       scene graph returns the size of the ROOM, which is identical for every
       figure and so says nothing about how far to stand from any of them:
       the first run of measure.py reported a half width of 9.97 for all
       fifteen, which was the background and not the subject. This is the
       only group whose extent means anything. */
    MAIN.name = "MAIN";
    var NEAR = new T.Group(); NEAR.position.z = 2.55;  g.add(NEAR);

    var CIRC = new T.CircleGeometry(1, 56);
    var soft = [];
    for (var i = 0; i < 4; i++) {
      var fw = airy(i % 2 ? C_.near : C_.far, 0.35);
      var m = glowPlane(1.0, fw, fw, { k1: 0.55, k2: 1.35, gain: 0.34, hot: 0.0, damt: 0.0 });
      m.position.set((hash(i, 71) - 0.5) * 16.0, (hash(i, 73) - 0.5) * 12.0, -i * 0.4);
      m.scale.setScalar(5.0 + hash(i, 79) * 5.5);
      FAR.add(m); soft.push(m);
    }
    var SHEET = [ { g: S1, n: 24, r: 0.030, sp: 16.0, air: 0.90 },
                  { g: S2, n: 15, r: 0.042, sp: 12.5, air: 0.72 },
                  { g: S3, n: 8,  r: 0.058, sp: 9.2,  air: 0.50 } ];
    for (var si = 0; si < SHEET.length; si++) {
      var S = SHEET[si];
      for (i = 0; i < S.n; i++) {
        /* THE ROOM MUST NOT BORROW THE DATA'S COLOURS.
           These forty seven specks are depth: three sheets of them at three
           distances, so the figure has something to move against. They were
           coloured by picking randomly between base and rise, which are the
           two colours the FIGURES use to mean something. So a short whose
           key says teal is a report you may not use had teal dots scattered
           through the background of every frame, and one of them landed on
           the legend itself. The owner spotted it as "a blue ball that does
           not look in place", which is exactly right: it looked like a
           data point because it was painted like one.

           Ambient is now one neutral, well below any mark in both lightness
           and saturation. It still reads as distance and it can never be
           read as a value. */
        var col = airy(C_.line, 0.74);
        var d = new T.Mesh(CIRC, flatMat2(airy(col, S.air), { op: 1.0, dw: true }));
        d.position.set((hash(i, 11 + si) - 0.5) * S.sp, (hash(i, 23 + si) - 0.5) * S.sp * 1.35, 0);
        d.scale.setScalar(S.r * [0.6, 0.85, 1.15][(hash(i, 37 + si) * 3) | 0]);
        S.g.add(d);
      }
    }
    for (i = 0; i < 4; i++) {
      /* and the four soft blooms in the near field, for the same reason. A
         teal bloom is a colour cast the eye reads as meaning something. The
         room is warm; the data is warm or cool; only the data is cool. */
      var fc = C_.base;
      var fm = glowPlane(1.0, fc, fc, { k1: 0.55, k2: 1.5, gain: 0.11, hot: 0.0, damt: 0.0 });
      fm.position.set((hash(i, 217) - 0.5) * 6.4, (hash(i, 223) - 0.5) * 8.0, hash(i, 227) * 0.6);
      fm.scale.setScalar(0.95 + hash(i, 229) * 1.5);
      NEAR.add(fm); soft.push(fm);
    }
    var key = glowPlane(6.4, C_.base, C_.base, { k1: 1.0, k2: 2.2, gain: 0.16, hot: 0.0, damt: 0.0 });
    key.position.set(0, 0, -1.4); pivot.add(key); soft.push(key);

    return {
      g: g, pivot: pivot, inner: inner, MAIN: MAIN, NEAR: NEAR, C: C_, CIRC: CIRC, airy: airy,
      /* every figure calls this once a frame and gets the same room */
      tick: function (tsec, f, wide) {
        key.material.uniforms.gain.value = 0.16 * f;
        for (var q = 0; q < soft.length; q++) faceLens(soft[q]);
        NEAR.position.x = wander(tsec, 307) * 0.55;
        NEAR.position.y = wander(tsec, 311) * 0.40;
        pivot.rotation.y = wander(tsec, 211) * 0.10 + lerp(0.26, 0.04, wide);
        pivot.rotation.x = wander(tsec, 223) * 0.035 - 0.045;
        pivot.position.x = wander(tsec, 233) * 0.16;
      }
    };
  }
  function seg2(u, a, b) { return clamp01((u - a) / (b - a)); }

  /* ---- dots · a proportion, counted -------------------------------------
     A hundred marks, twenty five of them filled. There is no more direct
     way to say "a quarter" and no way at all to argue with it: the reader
     can count. Then the twenty five are themselves divided, because the
     second fact -- that only one Muslim in five is an Arab -- is the one
     that actually surprises people, and it needs the first on screen to
     land. */
  FIG.nutdots = function (o) {
    var S = nutScene(o), C = S.C;
    var N = o.total || 100, LIT = o.lit || 25, SUB = o.sub || 5;
    var COLS = o.cols || 10, GAP = 0.255, R = 0.084;
    var dot = [];
    for (var i = 0; i < N; i++) {
      var m = new T.Mesh(S.CIRC, flatMat2(S.airy(C.base, 0.82), { op: 1.0, dw: true }));
      m.position.set((i % COLS - (COLS - 1) * 0.5) * GAP,
                     -(Math.floor(i / COLS) - (N / COLS - 1) * 0.5) * GAP, 0);
      m.scale.setScalar(R);
      S.MAIN.add(m);
      dot.push({ m: m, mat: m.material, lit: i < LIT, sub: i < SUB });
    }
    var COL = new T.Color();
    return { root: S.g, at: function (u, tsec, f) {
      f = f === undefined ? 1 : f;
      var wide = SCENE_EASE(clamp01(seg2(u, 0.62, 0.86)));
      var fill = seg2(u, 0.10, 0.46), split = seg2(u, 0.56, 0.74);
      for (var i = 0; i < dot.length; i++) {
        var d = dot[i];
        var on = d.lit ? clamp01((fill * LIT * 1.25 - i) * 0.9) : 0;
        COL.copy(S.airy(C.base, 0.82));
        if (on > 0) COL.lerp(C.base, on);
        if (d.sub && split > 0) COL.lerp(C.rise, split);
        d.mat.color.copy(COL);
        d.mat.opacity = f;
        d.m.scale.setScalar(R * (1 + 0.26 * on) * (d.sub ? 1 + 0.18 * split : 1));
      }
      var sc = lerp(PORTRAIT ? 0.92 : 1.20, PORTRAIT ? 0.80 : 1.04, wide);
      S.inner.scale.setScalar(sc);
      S.inner.position.set(0, 0, 0);
      S.g.position.set(0, PORTRAIT ? 0.86 : 0.66, 0);
      S.tick(tsec, f, wide);
    } };
  };

  /* ---- arc · a cycle across one day -------------------------------------
     The five prayers are not five events, they are five points on one
     curve, and drawing them as a list loses the only thing that explains
     them. The sun runs the arc; two of the marks sit below the horizon,
     because Fajr and Isha are the twilight prayers and the library says so
     in those words. */
  FIG.nutarc = function (o) {
    var S = nutScene(o), C = S.C;
    var MK = o.marks || [];
    var RAD = 1.92, Y0 = -0.30;
    function at(t) { var a = Math.PI * (1 - t); return [Math.cos(a) * RAD, Math.sin(a) * RAD * 0.72 + Y0]; }

    /* the horizon: one line, the only straight thing in the figure */
    var hz = new T.Mesh(new T.ShapeGeometry(pillShape(4.6, 0.008), 4),
                        flatMat2(S.airy(C.line, 0.55), { op: 1.0, dw: false }));
    hz.scale.set(1, 0.010, 1); hz.position.set(0, Y0, -0.02); S.MAIN.add(hz);

    /* the path, drawn as a thin ribbon of many segments so it can be
       revealed a piece at a time without a second geometry */
    var seg = [], NSEG = 96;
    for (var i = 0; i < NSEG; i++) {
      var a = at(i / NSEG), b = at((i + 1) / NSEG);
      var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.sqrt(dx * dx + dy * dy);
      var m = new T.Mesh(new T.ShapeGeometry(pillShape(1.0, 0.4), 3),
                         flatMat2(S.airy(C.line, 0.62), { op: 1.0, dw: false }));
      m.scale.set(L * 1.06, 0.014, 1);
      m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, -0.01);
      m.rotation.z = Math.atan2(dy, dx);
      S.MAIN.add(m); seg.push(m);
    }
    var mark = [];
    for (i = 0; i < MK.length; i++) {
      var pt = at(MK[i].t);
      var mm = new T.Mesh(S.CIRC, flatMat2(S.airy(C.base, 0.80), { op: 1.0, dw: true }));
      mm.position.set(pt[0], pt[1], 0.02); mm.scale.setScalar(0.085);
      S.MAIN.add(mm); mark.push({ m: mm, mat: mm.material, t: MK[i].t, below: pt[1] < Y0 });
    }
    var sun = new T.Mesh(S.CIRC, flatMat2(C.mark, { op: 1.0, dw: true }));
    sun.scale.setScalar(0.105); S.MAIN.add(sun);
    var sunGlow = glowPlane(1.1, C.base, C.base, { k1: 1.2, k2: 3.6, gain: 0.14, hot: 0.0, damt: 0.0 });
    S.MAIN.add(sunGlow);
    var COL = new T.Color();
    return { root: S.g, at: function (u, tsec, f) {
      f = f === undefined ? 1 : f;
      var wide = SCENE_EASE(clamp01(seg2(u, 0.04, 0.22)));
      var run = SCENE_EASE(clamp01(seg2(u, 0.20, 0.88)));
      for (var i = 0; i < seg.length; i++)
        seg[i].material.opacity = f * clamp01((run * seg.length * 1.15 - i) * 0.5) * 0.85;
      for (i = 0; i < mark.length; i++) {
        var k = clamp01((run - mark[i].t) * 9.0);
        COL.copy(S.airy(C.base, 0.80)).lerp(mark[i].below ? C.rise : C.base, k);
        mark[i].mat.color.copy(COL);
        mark[i].mat.opacity = f;
        mark[i].m.scale.setScalar(0.085 * (1 + 0.75 * k));
      }
      var pt = at(clamp01(run));
      sun.position.set(pt[0], pt[1], 0.03);
      sunGlow.position.set(pt[0], pt[1], 0.02);
      sun.material.opacity = f * clamp01(seg2(u, 0.16, 0.24));
      sunGlow.material.uniforms.gain.value = 0.14 * f * clamp01(seg2(u, 0.16, 0.24));
      faceLens(sunGlow);
      var sc = lerp(PORTRAIT ? 0.66 : 0.92, PORTRAIT ? 0.76 : 1.04, wide);
      S.inner.scale.setScalar(sc);
      S.g.position.set(0, PORTRAIT ? 0.92 : 0.70, 0);
      S.tick(tsec, f, wide);
    } };
  };

  /* ---- forty · one coin in every forty -----------------------------------
     A percentage is a number you are told. Forty squares with one of them
     taken out is a number you can see, and 2.5 per cent is exactly the kind
     of figure that sounds small until it is drawn at the size it actually
     is. */
  FIG.nutforty = function (o) {
    var S = nutScene(o), C = S.C;
    var N = o.total || 40, TAKE = o.take || 1, COLS = o.cols || 8;
    var GAP = 0.34, SIDE = 0.24;
    var SQ = new T.ShapeGeometry(pillShape(1.0, 0.16), 4);
    var cell = [];
    for (var i = 0; i < N; i++) {
      var m = new T.Mesh(SQ, flatMat2(S.airy(C.base, 0.80), { op: 1.0, dw: true }));
      m.scale.set(SIDE, SIDE, 1);
      m.position.set((i % COLS - (COLS - 1) * 0.5) * GAP,
                     -(Math.floor(i / COLS) - (N / COLS - 1) * 0.5) * GAP - SIDE * 0.5, 0);
      S.MAIN.add(m);
      cell.push({ m: m, mat: m.material, take: i < TAKE, home: m.position.y });
    }
    var COL = new T.Color();
    return { root: S.g, at: function (u, tsec, f) {
      f = f === undefined ? 1 : f;
      var wide = SCENE_EASE(clamp01(seg2(u, 0.06, 0.26)));
      var land = seg2(u, 0.08, 0.52), lift = SCENE_EASE(clamp01(seg2(u, 0.58, 0.80)));
      for (var i = 0; i < cell.length; i++) {
        var c = cell[i];
        var on = clamp01((land * N * 1.2 - i) * 0.8);
        COL.copy(S.airy(C.base, 0.80));
        if (c.take) COL.lerp(C.mark, on * (0.20 + 0.62 * lift));
        else COL.lerp(C.base, on * (1 - 0.42 * lift));
        c.mat.color.copy(COL); c.mat.opacity = f * on;
        c.m.scale.set(SIDE * on * (c.take ? 1 + 0.30 * lift : 1),
                      SIDE * on * (c.take ? 1 + 0.30 * lift : 1), 1);
        c.m.position.y = c.home + (c.take ? lift * 0.26 : 0);
      }
      var sc = lerp(PORTRAIT ? 0.78 : 1.05, PORTRAIT ? 0.94 : 1.22, wide);
      S.inner.scale.setScalar(sc);
      S.g.position.set(0, PORTRAIT ? 0.90 : 0.66, 0);
      S.tick(tsec, f, wide);
    } };
  };

  /* ---- sieve · six hundred thousand down to seven thousand ---------------
     One mark is a thousand reports. Six hundred marks arrive, and seven are
     left. Nothing about that needs a caption: the reduction IS the argument,
     and drawing it at true scale is the only way to feel sixteen years of
     one man's life. */
  FIG.nutsieve = function (o) {
    var S = nutScene(o), C = S.C;
    var N = o.total || 600, KEEP = o.keep || 7;
    var m, i, mote = [];
    for (i = 0; i < N; i++) {
      m = new T.Mesh(S.CIRC, flatMat2(S.airy(C.base, 0.55), { op: 1.0, dw: true }));
      var a = hash(i, 3) * Math.PI * 2, r = Math.sqrt(hash(i, 5)) * 1.62;
      var keep = i < KEEP;
      m.position.set(Math.cos(a) * r, Math.sin(a) * r * 1.30 + 0.55, 0);
      m.scale.setScalar(0.030);
      S.MAIN.add(m);
      mote.push({ m: m, mat: m.material, keep: keep,
                  hx: Math.cos(a) * r, hy: Math.sin(a) * r * 1.30 + 0.55,
                  /* THE SEVEN THAT ARE KEPT ARE THE POINT OF THE PICTURE,
                     so they are drawn at the size of a point being made.
                     They were 0.074 across and 0.40 apart, which is what
                     six hundred motes look like when six hundred are on
                     screen; once the other five hundred and ninety three
                     have gone it is seven specks in an empty frame for half
                     the film. Wider apart and three times the size: the
                     contrast with the cloud is the argument, and the
                     survivors have to be legible for it to land. */
                  tx: (i - (KEEP - 1) * 0.5) * 0.62, ty: -0.58,
                  lag: hash(i, 17) });
    }
    var COL = new T.Color();
    return { root: S.g, at: function (u, tsec, f) {
      f = f === undefined ? 1 : f;
      var wide = SCENE_EASE(clamp01(seg2(u, 0.04, 0.24)));
      var fall = seg2(u, 0.30, 0.86);
      for (var i = 0; i < mote.length; i++) {
        var q = mote[i];
        var on = clamp01((seg2(u, 0.04, 0.30) * mote.length * 1.3 - i) * 0.7);
        var k = SCENE_EASE(clamp01((fall - q.lag * 0.34) * 1.7));
        if (q.keep) {
          q.m.position.set(lerp(q.hx, q.tx, k), lerp(q.hy, q.ty, k), 0.02);
          q.m.scale.setScalar(0.030 + 0.135 * k);
          COL.copy(S.airy(C.base, 0.55)).lerp(C.base, k);
          q.mat.color.copy(COL); q.mat.opacity = f * on;
        } else {
          q.m.position.set(q.hx, q.hy - k * 3.4, 0);
          q.m.scale.setScalar(0.030 * (1 - k * 0.85));
          COL.copy(S.airy(C.base, 0.55)).lerp(C.sky, k * 0.92);
          q.mat.color.copy(COL); q.mat.opacity = f * on * (1 - k * 0.95);
        }
      }
      var sc = lerp(PORTRAIT ? 1.10 : 1.45, PORTRAIT ? 1.02 : 1.34, wide);
      S.inner.scale.setScalar(sc);
      S.g.position.set(0, PORTRAIT ? 0.66 : 0.58, 0);
      S.tick(tsec, f, wide);
    } };
  };


  /* ---- chain · who told whom ---------------------------------------------
     The figure the second film is actually about. A hadith is a text with a
     list of people in front of it, and the list is the evidence. Drawn as
     nodes and the links between them, revealed from the source outward,
     because that is the direction the report travelled and the opposite of
     the direction you read it in.

     It takes ROWS, so two chains can carry the same claim side by side and
     the film can say, honestly, that its two most quoted lines come from two
     different narrations. A film about how we know should be willing to show
     its own working. */
  FIG.nutchain = function (o) {
    var S = nutScene(o), C = S.C;
    var ROWS = o.rows || [{ n: 5 }];
    var STEPX = o.stepx || 0.62, ROWY = o.rowy || 0.86;
    var link = [], node = [];
    for (var r = 0; r < ROWS.length; r++) {
      var N = ROWS[r].n, y = (ROWS.length - 1) * 0.5 * ROWY - r * ROWY;
      var weak = ROWS[r].weak === undefined ? -1 : ROWS[r].weak;
      for (var i = 0; i < N; i++) {
        var x = (i - (N - 1) * 0.5) * STEPX;
        if (i < N - 1) {
          var e = new T.Mesh(new T.ShapeGeometry(pillShape(1.0, 0.4), 3),
                             flatMat2(S.airy(C.line, 0.55), { op: 1.0, dw: false }));
          e.scale.set(STEPX, 0.020, 1);
          e.position.set(x + STEPX * 0.5, y, -0.01);
          S.MAIN.add(e);
          link.push({ m: e, mat: e.material, r: r, i: i, weak: i === weak });
        }
        var m = new T.Mesh(S.CIRC, flatMat2(S.airy(C.base, 0.78), { op: 1.0, dw: true }));
        m.position.set(x, y, 0); m.scale.setScalar(0.001);
        S.MAIN.add(m);
        node.push({ m: m, mat: m.material, r: r, i: i, n: N,
                    weak: (i === weak || i === weak + 1), R: 0.105 });
      }
    }
    var COL = new T.Color();
    return { root: S.g, at: function (u, tsec, f) {
      f = f === undefined ? 1 : f;
      var wide = SCENE_EASE(clamp01(seg2(u, 0.04, 0.24)));
      var draw = SCENE_EASE(clamp01(seg2(u, 0.10, 0.74)));
      var flag = clamp01(seg2(u, 0.78, 0.90));
      for (var q = 0; q < node.length; q++) {
        var d = node[q];
        var k = clamp01((draw * (d.n + 0.6) - d.i) * 1.5);
        d.m.scale.setScalar(d.R * SCENE_EASE(k));
        COL.copy(S.airy(C.base, 0.78)).lerp(C.base, k);
        if (d.weak && flag > 0) COL.lerp(C.rise, flag);
        d.mat.color.copy(COL); d.mat.opacity = f;
      }
      for (q = 0; q < link.length; q++) {
        var e = link[q], N2 = ROWS[e.r].n;
        var kk = clamp01((draw * (N2 + 0.6) - e.i - 0.5) * 1.5);
        e.m.scale.set(STEPX * kk, 0.020, 1);
        e.m.position.x = (e.i - (N2 - 1) * 0.5) * STEPX + STEPX * kk * 0.5;
        COL.copy(S.airy(C.line, 0.55));
        if (e.weak && flag > 0) COL.lerp(C.rise, flag);
        e.mat.color.copy(COL);
        e.mat.opacity = f * 0.85 * (e.weak ? 1 : 1 - 0.35 * flag);
      }
      var wid = (Math.max.apply(null, ROWS.map(function (x) { return x.n; })) - 1) * STEPX;
      var fit = (PORTRAIT ? 2.30 : 5.40) / Math.max(0.001, wid + 0.5);
      var sc = lerp(fit * 0.90, fit, wide);
      S.inner.scale.setScalar(sc);
      /* two rows of chain need the whole upper half to themselves, or the
         second row lands in the caption band */
      S.g.position.set(0, PORTRAIT ? 0.86 : (ROWS.length > 1 ? 1.00 : 0.76), 0);
      S.tick(tsec, f, wide);
    } };
  };

  /* ---- time · a line of years ---------------------------------------------
     One spine the film can come back to. A chronology drawn once and
     returned to is not a repeated figure, it is the film knowing where it
     is; drawing a new timeline every time a date is mentioned is what makes
     a documentary feel like a slideshow. Bands carry the long stretches,
     marks carry the single years. */
  FIG.nuttime = function (o) {
    var S = nutScene(o), C = S.C;
    var A = o.from === undefined ? 610 : o.from, B = o.to === undefined ? 632 : o.to;
    var W = o.w || 3.1;
    function X(y) { return (-0.5 + (y - A) / Math.max(1, B - A)) * W; }

    var axis = new T.Mesh(new T.ShapeGeometry(pillShape(1.0, 0.4), 3),
                          flatMat2(S.airy(C.line, 0.62), { op: 1.0, dw: false }));
    axis.scale.set(W + 0.16, 0.016, 1); axis.position.z = -0.01; S.MAIN.add(axis);

    var band = [];
    (o.bands || []).forEach(function (b) {
      var m = new T.Mesh(new T.ShapeGeometry(pillShape(1.0, 0.30), 3),
                         flatMat2(S.airy(b.rise ? C.rise : C.base, 0.30), { op: 1.0, dw: true }));
      m.position.set((X(b.a) + X(b.b)) * 0.5, 0.115, 0);
      m.scale.set(Math.max(0.001, X(b.b) - X(b.a)), 0.115, 1);
      S.MAIN.add(m);
      band.push({ m: m, mat: m.material, w: X(b.b) - X(b.a), x: (X(b.a) + X(b.b)) * 0.5, a: X(b.a) });
    });
    var tick = [];
    (o.marks || []).forEach(function (k) {
      var m = new T.Mesh(S.CIRC, flatMat2(S.airy(C.base, 0.72), { op: 1.0, dw: true }));
      m.position.set(X(k.y), -0.155, 0.01); m.scale.setScalar(0.001);
      S.MAIN.add(m);
      tick.push({ m: m, mat: m.material, at: (k.y - A) / Math.max(1, B - A), hot: !!k.hot });
    });
    var COL = new T.Color();
    return { root: S.g, at: function (u, tsec, f) {
      f = f === undefined ? 1 : f;
      var wide = SCENE_EASE(clamp01(seg2(u, 0.04, 0.22)));
      var run = SCENE_EASE(clamp01(seg2(u, 0.10, 0.72)));
      axis.material.opacity = f * clamp01(seg2(u, 0.04, 0.16)) * 0.8;
      for (var i = 0; i < band.length; i++) {
        var b = band[i];
        var k = clamp01((run * W - (b.a + W * 0.5)) / Math.max(0.001, b.w));
        b.m.scale.set(Math.max(0.001, b.w * k), 0.115, 1);
        b.m.position.x = b.a + b.w * k * 0.5;
        b.mat.opacity = f;
      }
      for (i = 0; i < tick.length; i++) {
        var t2 = tick[i], kk = clamp01((run - t2.at) * 8.0);
        t2.m.scale.setScalar(0.072 * SCENE_EASE(kk));
        COL.copy(S.airy(C.base, 0.72)).lerp(t2.hot ? C.mark : C.base, kk);
        t2.mat.color.copy(COL); t2.mat.opacity = f;
      }
      var sc = lerp(PORTRAIT ? 0.94 : 1.72, PORTRAIT ? 1.02 : 1.88, wide);
      S.inner.scale.setScalar(sc);
      S.g.position.set(0, PORTRAIT ? 0.88 : 0.72, 0);
      S.tick(tsec, f, wide);
    } };
  };

  /* ---- sort · three verdicts ----------------------------------------------
     What a grading system looks like when it is drawn rather than described:
     a population arriving, and each one landing in one of three places. The
     third column is the argument. A tradition that threw the weak reports
     away would have nothing to show here, and would be much easier to doubt. */
  FIG.nutsort = function (o) {
    var S = nutScene(o), C = S.C;
    var SHARE = o.share || [0.45, 0.30, 0.25], N = o.total || 120;
    var COLW = o.colw || 0.78, ROWS = o.rows || 12, GAP = 0.115;
    var col = [], acc = 0, cut = [];
    for (var i = 0; i < SHARE.length; i++) { acc += SHARE[i]; cut.push(acc); }
    var mote = [];
    for (i = 0; i < N; i++) {
      var f0 = i / N, c = 0;
      while (c < cut.length - 1 && f0 > cut[c]) c++;
      var within = i - Math.round((c ? cut[c - 1] : 0) * N);
      var m = new T.Mesh(S.CIRC, flatMat2(S.airy(C.base, 0.70), { op: 1.0, dw: true }));
      m.scale.setScalar(0.046);
      S.MAIN.add(m);
      mote.push({ m: m, mat: m.material, c: c,
                  /* 1.28 + 0.42 = 1.70, times the 1.40 the scene opens to,
                     plus the 0.60 lift, is 2.98 world units above centre
                     against a half frame of 2.59: the top of the cloud sat
                     outside the picture, and fall does not begin until
                     u = 0.14, so it stayed there about six seconds. */
                  hx: (hash(i, 5) - 0.5) * 2.3, hy: 0.92 + hash(i, 7) * 0.28,
                  tx: (c - (SHARE.length - 1) * 0.5) * COLW + ((within % 5) - 2) * GAP,
                  ty: -0.92 + Math.floor(within / 5) * GAP,
                  lag: hash(i, 11) });
    }
    /* TWO COLOURS FOR THREE GRADES, AND THAT IS THE RIGHT NUMBER.
       This carried a 20% lerp toward sky on the middle column, meant to
       separate it from the first. Measured off a rendered frame the two came
       out RGB(176,132,6) and RGB(177,125,6): seven levels in one channel,
       which is no difference at all on a phone. A darkening does not survive
       the bloom, so the lerp was doing nothing and has gone.

       The obvious repair was a third hue, and the theme only offers cream.
       Tried: cream blooms into a solid glowing slab at this material and
       exposure and the motes stop being countable, which is worse than the
       fault it fixed. Measured delta E between the three then read 7.6 and
       10.9, both under the 15 floor, so it did not even buy separation.

       So the encoding is split instead of doubled. POSITION carries the three
       grades, which is what three columns are for, and COLOUR carries the one
       thing position cannot say: gold is a hadith you may use, teal is one
       you may not. Two channels, two facts, nothing redundant. */
    var COLC = [C.base, C.base, C.rise];
    var COL = new T.Color();
    return { root: S.g, at: function (u, tsec, f) {
      f = f === undefined ? 1 : f;
      var wide = SCENE_EASE(clamp01(seg2(u, 0.04, 0.22)));
      var fall = seg2(u, 0.14, 0.84);
      for (var i = 0; i < mote.length; i++) {
        var q = mote[i];
        var k = SCENE_EASE(clamp01((fall - q.lag * 0.30) * 1.6));
        q.m.position.set(lerp(q.hx, q.tx, k), lerp(q.hy, q.ty, k), 0);
        COL.copy(S.airy(C.base, 0.70)).lerp(COLC[q.c], k);
        /* no darkening needed now that the three are separate hues */
        q.mat.color.copy(COL);
        q.mat.opacity = f * clamp01(seg2(u, 0.04, 0.16));
        q.m.scale.setScalar(0.046 * (1 + 0.22 * k));
      }
      var sc = lerp(PORTRAIT ? 0.96 : 1.30, PORTRAIT ? 1.04 : 1.40, wide);
      S.inner.scale.setScalar(sc);
      S.g.position.set(0, PORTRAIT ? 0.80 : 0.60, 0);
      S.tick(tsec, f, wide);
    } };
  };

  /* ---- path · a journey, or a trade route ---------------------------------
     A line between two places with something moving along it, on the same
     velocity profile every other travelling thing in these films uses: quick
     away, long middle, exact arrival. Takes several legs, so one figure can
     carry a caravan year -- south in winter, north in summer -- or a single
     move that changed a calendar. */
  FIG.nutpath = function (o) {
    var S = nutScene(o), C = S.C;
    var LEG = o.legs || [{ from: [0, 0], to: [1, 0.4] }];
    var HUB = o.hub || [0, 0];
    var leg = [];
    for (var L = 0; L < LEG.length; L++) {
      var a = LEG[L].from, b = LEG[L].to;
      var seg = [], NS = 34;
      for (var i = 0; i < NS; i++) {
        var t0 = i / NS, t1 = (i + 1) / NS;
        var p0 = [lerp(a[0], b[0], t0), lerp(a[1], b[1], t0) + Math.sin(t0 * Math.PI) * (LEG[L].bow || 0)];
        var p1 = [lerp(a[0], b[0], t1), lerp(a[1], b[1], t1) + Math.sin(t1 * Math.PI) * (LEG[L].bow || 0)];
        var dx = p1[0] - p0[0], dy = p1[1] - p0[1], Ln = Math.sqrt(dx * dx + dy * dy);
        var m = new T.Mesh(new T.ShapeGeometry(pillShape(1.0, 0.4), 3),
                           flatMat2(S.airy(C.line, 0.58), { op: 1.0, dw: false }));
        m.scale.set(Ln * 1.08, 0.016, 1);
        m.position.set((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, -0.01);
        m.rotation.z = Math.atan2(dy, dx);
        S.MAIN.add(m); seg.push(m);
      }
      var end = new T.Mesh(S.CIRC, flatMat2(S.airy(C.base, 0.68), { op: 1.0, dw: true }));
      end.position.set(b[0], b[1], 0.01); end.scale.setScalar(0.001);
      S.MAIN.add(end);
      leg.push({ seg: seg, end: end, t0: LEG[L].at === undefined ? L / LEG.length : LEG[L].at,
                 span: LEG[L].span === undefined ? 0.9 / LEG.length : LEG[L].span });
    }
    var hub = new T.Mesh(S.CIRC, flatMat2(C.base, { op: 1.0, dw: true }));
    hub.position.set(HUB[0], HUB[1], 0.02); hub.scale.setScalar(0.001);
    S.MAIN.add(hub);
    var COL = new T.Color();
    return { root: S.g, at: function (u, tsec, f) {
      f = f === undefined ? 1 : f;
      var wide = SCENE_EASE(clamp01(seg2(u, 0.04, 0.24)));
      hub.scale.setScalar(0.115 * SCENE_EASE(clamp01(seg2(u, 0.04, 0.18))));
      hub.material.opacity = f;
      for (var L = 0; L < leg.length; L++) {
        var g2 = leg[L];
        var k = SCENE_EASE(clamp01(seg2(u, 0.12 + g2.t0 * 0.55, 0.12 + g2.t0 * 0.55 + g2.span)));
        for (var i = 0; i < g2.seg.length; i++)
          g2.seg[i].material.opacity = f * clamp01((k * g2.seg.length * 1.2 - i) * 0.6) * 0.85;
        g2.end.scale.setScalar(0.088 * SCENE_EASE(clamp01((k - 0.86) * 7.0)));
        COL.copy(S.airy(C.base, 0.68)).lerp(C.base, clamp01((k - 0.86) * 7.0));
        g2.end.material.color.copy(COL);
        g2.end.material.opacity = f;
      }
      var sc = lerp(PORTRAIT ? 0.92 : 1.24, PORTRAIT ? 1.00 : 1.36, wide);
      S.inner.scale.setScalar(sc);
      S.g.position.set(0, PORTRAIT ? 0.84 : 0.62, 0);
      S.tick(tsec, f, wide);
    } };
  };


  /* ---- lamps · the experiment that settled how seeing works ---------------
     Several lamps outside a small opening, and their images staying separate
     on the wall inside. If light were a thing the eye threw out, or if rays
     mixed on the way, the patches would smear into one. They do not, and
     that is the whole argument: light travels in straight lines and does not
     mix. Drawn rather than described, because a viewer who watches the
     patches stay apart has done the experiment. */
  FIG.nutlamps = function (o) {
    var S = nutScene(o), C = S.C;
    var N = o.lamps || 3, WALLX = o.wallx || 1.35, LAMPX = o.lampx || -1.55, APX = 0.0;
    var lamp = [], ray = [], spot = [];
    for (var i = 0; i < N; i++) {
      var ly = (i - (N - 1) * 0.5) * 0.62;
      var wy = -ly * (WALLX / Math.abs(LAMPX));          /* the image inverts */
      var m = new T.Mesh(S.CIRC, flatMat2(C.base, { op: 1.0, dw: true }));
      m.position.set(LAMPX, ly, 0); m.scale.setScalar(0.001);
      S.MAIN.add(m); lamp.push(m);

      /* the ray, in two straight legs through the aperture */
      var legs = [];
      [[LAMPX, ly, APX, 0], [APX, 0, WALLX, wy]].forEach(function (q) {
        var dx = q[2] - q[0], dy = q[3] - q[1], L = Math.sqrt(dx * dx + dy * dy);
        var e = new T.Mesh(new T.ShapeGeometry(pillShape(1.0, 0.4), 3),
                           flatMat2(S.airy(C.base, 0.45), { op: 1.0, dw: false }));
        e.scale.set(L, 0.012, 1);
        e.position.set((q[0] + q[2]) / 2, (q[1] + q[3]) / 2, -0.01);
        e.rotation.z = Math.atan2(dy, dx);
        S.MAIN.add(e); legs.push(e);
      });
      ray.push(legs);

      /* THE IMAGE IS NOT THE LAMP, SO IT IS NOT THE LAMP'S COLOUR.
         Both were drawn in the base gold, which made the legend a lie: it
         named a lamp and an image in two colours and the figure had one. It
         is also the wrong picture. What lands on the wall is not the lamp,
         it is the lamp's image, and giving it the cream mark says exactly
         that in the palette's own terms. */
      var sp = new T.Mesh(S.CIRC, flatMat2(C.mark, { op: 1.0, dw: true }));
      sp.position.set(WALLX + 0.03, wy, 0.01); sp.scale.setScalar(0.001);
      S.MAIN.add(sp); spot.push(sp);
    }
    /* the wall, and the opening in it */
    var wall = new T.Mesh(new T.ShapeGeometry(pillShape(1.0, 0.30), 3),
                          flatMat2(S.airy(C.line, 0.62), { op: 1.0, dw: false }));
    wall.scale.set(0.030, 2.5, 1); wall.position.set(WALLX, -1.25, -0.02); S.MAIN.add(wall);
    var scr = [];
    for (i = 0; i < 2; i++) {
      var b = new T.Mesh(new T.ShapeGeometry(pillShape(1.0, 0.30), 3),
                         flatMat2(S.airy(C.line, 0.50), { op: 1.0, dw: false }));
      b.scale.set(0.026, 1.02, 1);
      b.position.set(APX, i ? 0.16 : -1.18, -0.02);
      S.MAIN.add(b); scr.push(b);
    }
    return { root: S.g, at: function (u, tsec, f) {
      f = f === undefined ? 1 : f;
      var wide = SCENE_EASE(clamp01(seg2(u, 0.04, 0.22)));
      var on = clamp01(seg2(u, 0.06, 0.26));
      var thru = SCENE_EASE(clamp01(seg2(u, 0.26, 0.72)));
      var land = SCENE_EASE(clamp01(seg2(u, 0.62, 0.86)));
      /* AND THEN ONE LAMP IS COVERED, WHICH IS THE ENTIRE EXPERIMENT.
         The figure drew three lamps, three rays and three patches and then
         stopped, and the short written over it said "cover one lamp and its
         patch goes out" while all three stayed lit. That is a caption
         describing something the picture never does, which is the one thing
         a diagram may never be.

         Ibn al-Haytham's argument is not that three lamps make three
         patches. It is that blocking ONE of them puts out ONE of the
         patches and leaves the others untouched, which no explanation but
         straight independent rays will account for. So the figure performs
         it: the lowest lamp, its ray and the patch it throws all go out
         together at the end, and the other two do not move. */
      var douse = SCENE_EASE(clamp01(seg2(u, 0.80, 0.95)));
      wall.material.opacity = f * on * 0.8;
      scr[0].material.opacity = scr[1].material.opacity = f * on * 0.8;
      for (var i = 0; i < lamp.length; i++) {
        /* the covered one is the first, whose image is the TOP patch: the
           picture inverts, so putting out the bottom lamp puts out the top
           patch, and that inversion is worth seeing happen */
        var live = (i === 0) ? (1 - douse) : 1;
        lamp[i].scale.setScalar(0.098 * SCENE_EASE(clamp01((on * (lamp.length + 0.5) - i) * 1.4)));
        lamp[i].material.opacity = f * live;
        for (var L = 0; L < 2; L++) {
          var k = clamp01(thru * 2 - L);
          ray[i][L].material.opacity = f * k * 0.7 * live;
        }
        spot[i].scale.setScalar(0.072 * land);
        spot[i].material.opacity = f * land * live;
      }
      var sc = lerp(PORTRAIT ? 0.80 : 1.10, PORTRAIT ? 0.88 : 1.22, wide);
      S.inner.scale.setScalar(sc);
      S.g.position.set(0, PORTRAIT ? 0.86 : 0.66, 0);
      S.tick(tsec, f, wide);
    } };
  };

  /* ---- bar · a whole, and how small the error is --------------------------
     Some numbers are only impressive at scale. Two minutes and twenty
     seconds is a shrug; two minutes and twenty seconds out of a year,
     measured in the ninth century, is a bar so long that the error is
     narrower than the line drawn around it. So the figure draws the whole,
     then goes and finds the sliver, which is the only honest way to show a
     quantity that small. */
  FIG.nutbar = function (o) {
    var S = nutScene(o), C = S.C;
    var FRAC = o.frac === undefined ? 0.004 : o.frac, W = o.w || 3.0;
    var whole = new T.Mesh(new T.ShapeGeometry(pillShape(1.0, 0.30), 3),
                           flatMat2(C.base, { op: 1.0, dw: true }));
    whole.scale.set(0.001, 0.17, 1); whole.position.set(0, 0, 0); S.MAIN.add(whole);
    var slice = new T.Mesh(new T.ShapeGeometry(pillShape(1.0, 0.30), 3),
                           flatMat2(C.rise, { op: 1.0, dw: true }));
    slice.position.set(W * 0.5, 0, 0.02); slice.scale.set(0.001, 0.17, 1); S.MAIN.add(slice);
    /* the caliper: two marks that close on the sliver so the eye is told
       where to look before it is asked to see something that small */
    var cal = [];
    for (var i = 0; i < 2; i++) {
      var m = new T.Mesh(new T.ShapeGeometry(pillShape(1.0, 0.4), 3),
                         flatMat2(S.airy(C.line, 0.45), { op: 1.0, dw: false }));
      m.scale.set(0.012, 0.42, 1); m.position.set(0, 0, 0.03);
      S.MAIN.add(m); cal.push(m);
    }
    return { root: S.g, at: function (u, tsec, f) {
      f = f === undefined ? 1 : f;
      var wide = SCENE_EASE(clamp01(seg2(u, 0.04, 0.22)));
      var grow = SCENE_EASE(clamp01(seg2(u, 0.08, 0.46)));
      var find = SCENE_EASE(clamp01(seg2(u, 0.50, 0.78)));
      var zoom = SCENE_EASE(clamp01(seg2(u, 0.60, 0.92)));
      whole.scale.set(Math.max(0.001, W * grow), 0.17, 1);
      whole.position.x = -W * 0.5 + W * grow * 0.5;
      whole.material.opacity = f;
      var sw = W * FRAC;
      slice.scale.set(Math.max(0.0006, sw), 0.17 * (1 + 0.35 * find), 1);
      slice.position.x = W * 0.5 - sw * 0.5;
      slice.material.opacity = f * find;
      for (var i = 0; i < 2; i++) {
        cal[i].material.opacity = f * find * 0.8;
        cal[i].position.x = lerp(i ? W * 0.5 + 0.55 : W * 0.5 - 0.55,
                                 i ? W * 0.5 + sw * 0.5 : W * 0.5 - sw * 0.5, find);
      }
      /* and the camera goes to the sliver rather than the sliver coming to
         the camera, which is the difference between an inspection and a
         graphic */
      var sc = lerp(PORTRAIT ? 0.80 : 1.06, PORTRAIT ? 2.35 : 3.10, zoom);
      S.inner.scale.setScalar(sc);
      S.inner.position.set(-lerp(0, W * 0.5, zoom) * sc, 0, 0);
      S.g.position.set(0, PORTRAIT ? 0.86 : 0.62, 0);
      S.tick(tsec, f, wide);
    } };
  };

  /* =======================================================================
     FIVE FIGURES THAT EACH BELONG TO ONE ARGUMENT

     Films two and three between them had fourteen figure slots and only nine
     drawings: the chain of transmission was doing three jobs, the timeline
     three, the trade route two. A figure used twice is a figure that fits
     neither argument exactly, and the second time it appears the audience
     reads it as the film running out of ideas rather than as a rhyme.

     These five replace the repeats. Each one is shaped by the specific claim
     it carries and would be wrong anywhere else, which is the test.
     ======================================================================= */

  /* ---- valley · thirteen years of being refused --------------------------
     Not a timeline. A timeline says how long and says nothing about what it
     was like. What happened in those years was pressure and departure: a
     community penned into one wadi by a written boycott, and a group who left
     for Abyssinia rather than stay. So the drawing is a squeeze and a leak.
     The walls close, the marks inside compress and dim, and a few break out
     at an angle and are gone. Nothing here is a clock. */
  FIG.nutvalley = function (o) {
    var S = nutScene(o), C = S.C;
    var N = o.n === undefined ? 26 : o.n;
    var LEAVE = o.leave === undefined ? 5 : o.leave;
    var W0 = 2.35, W1 = 0.62;                 /* the valley, open then closed */

    function wall(sign) {
      var m = new T.Mesh(new T.ShapeGeometry(pillShape(1.0, 0.4), 3),
                         flatMat2(S.airy(C.line, 0.42), { op: 1.0, dw: false }));
      m.scale.set(0.022, 2.5, 1);
      m.rotation.z = Math.PI * 0.5 * sign * 0;
      S.MAIN.add(m);
      return m;
    }
    var wl = wall(-1), wr = wall(1);
    wl.scale.set(0.026, 1, 1); wr.scale.set(0.026, 1, 1);

    var dot = [];
    for (var i = 0; i < N; i++) {
      var go = i < LEAVE;
      var d = new T.Mesh(S.CIRC, flatMat2(S.airy(C.base, 0.62), { op: 1.0, dw: true }));
      d.scale.setScalar(0.062);
      S.MAIN.add(d);
      dot.push({
        m: d, mat: d.material, go: go,
        /* where it stands while the valley is still open */
        x: (hash(i, 31) - 0.5) * W0 * 1.7,
        y: (hash(i, 37) - 0.5) * 1.55,
        /* and where it goes if it goes: up and out to the left, which is
           the direction Abyssinia is from Makkah */
        /* OVER the wall, not through it. They were exiting left at the
           height of the left wall, which put them behind it and then off
           frame in about a second: the asylum in Abyssinia, invisible. */
        /*  AND NOT OFF THE TOP EITHER. The scene scales by 1.16 and sits
            0.66 up, so an exit at y 1.55 to 2.40 arrives at 2.5 to 3.4
            against a half frame of 2.52: they were climbing straight out of
            the picture. Measured, not guessed -- the brightest pixel in the
            left third of the frame was 51 of 255, which is nothing. They now
            leave sideways, to the edge and no further, and you watch them
            go. */
        /*  Twice wrong before this. At y 1.55 they climbed out of the top of
            the frame; at x -3.55 they reached 98% of the half frame and the
            vignette, which crushes the edges by design, put them out. The
            room is 4.49 world units to the edge at this standing distance
            and the scene scales by 1.16, so an exit at 2.7 lands at 72% of
            the way out: far enough to read as gone, near enough to be seen
            going. */
        ax: -2.45 - hash(i, 41) * 0.35,
        ay: 0.45 + hash(i, 43) * 0.60,
        lag: hash(i, 47)
      });
    }
    var COL = new T.Color();
    return { root: S.g, at: function (u, tsec, f) {
      f = f === undefined ? 1 : f;
      var wide  = SCENE_EASE(clamp01(seg2(u, 0.04, 0.20)));
      var close = SCENE_EASE(clamp01(seg2(u, 0.22, 0.72)));   /* the boycott */
      var out   = clamp01(seg2(u, 0.46, 0.94));               /* the leaving */
      var half  = lerp(W0, W1, close);

      wl.position.set(-half, -1.25, -0.01);
      wr.position.set( half, -1.25, -0.01);
      wl.scale.set(0.026, 2.5, 1); wr.scale.set(0.026, 2.5, 1);
      wl.material.opacity = wr.material.opacity = f * clamp01(seg2(u, 0.16, 0.16)) * 0.8;

      for (var i = 0; i < dot.length; i++) {
        var q = dot[i];
        var born = f * clamp01(seg2(u, 0.06, 0.26) * (N + 5) - i);
        /* everyone is pressed inward as the walls come in, in proportion to
           how far out they were standing: the squeeze is uniform, so the
           field keeps its shape and only loses its room */
        var px = q.x * lerp(1.0, W1 / W0, close);
        var py = q.y * lerp(1.0, 1.18, close);
        if (q.go) {
          var k = SCENE_EASE(clamp01((out - q.lag * 0.34) * 1.7));
          q.m.position.set(lerp(px, q.ax, k), lerp(py, q.ay, k), 0.02);
          COL.copy(S.airy(C.base, 0.62)).lerp(C.rise, k);
          q.mat.color.copy(COL);
          /* they stay lit the whole way out. A group that leaves is not a
             group that fades; the point is that they went somewhere. */
          q.mat.opacity = born * (1.0 - k * 0.20);
          q.m.scale.setScalar(0.062 * (1 + 0.18 * k));
        } else {
          q.m.position.set(px, py, 0.0);
          /* A GROUP UNDER PRESSURE GETS DENSER, NOT DIMMER. This drained
             them from 62% toward the sky to 80%, so by the end of the
             boycott the people it happened to were nearly the colour of the
             background: the figure said "and then they faded", which is not
             what the record says and not what the caption says either. They
             now concentrate as the walls come in. */
          COL.copy(S.airy(C.base, 0.62)).lerp(S.airy(C.base, 0.42), close);
          q.mat.color.copy(COL);
          /* and the ones who stay are pressed, not extinguished */
          q.mat.opacity = born * (1.0 - 0.08 * close);
          q.m.scale.setScalar(0.062 * (1 - 0.06 * close));
        }
      }
      var sc = lerp(PORTRAIT ? 0.80 : 1.06, PORTRAIT ? 0.88 : 1.16, wide);
      S.inner.scale.setScalar(sc);
      S.g.position.set(0, PORTRAIT ? 0.88 : 0.66, 0);
      S.tick(tsec, f, wide);
    } };
  };

  /* ---- scale · the truce that read as a defeat ---------------------------
     Hudaybiyyah is the one event in the film where the arithmetic of the day
     and the arithmetic of the decade point opposite ways, and his own
     followers said so at the time. A balance is the only figure that can hold
     both at once: the pan with everything visible in it, and the pan with one
     thing, and the beam going the way the one thing says. */
  FIG.nutscale = function (o) {
    var S = nutScene(o), C = S.C;
    var GIVE = o.give === undefined ? 7 : o.give;
    var GET  = o.get === undefined ? 1 : o.get;
    var ARM = 1.62, TIP = 0.30;

    function bar(len, thick, col, air) {
      var m = new T.Mesh(new T.ShapeGeometry(pillShape(1.0, 0.4), 3),
                         flatMat2(S.airy(col, air), { op: 1.0, dw: false }));
      m.scale.set(len, thick, 1); S.MAIN.add(m); return m;
    }
    var beam = bar(ARM * 2, 0.030, C.line, 0.34);
    var post = bar(0.026, 1, C.line, 0.52); post.scale.set(0.026, 1.05, 1);
    post.position.set(0, -1.06, -0.02);

    function pan(sign) {
      var g = new T.Group(); S.MAIN.add(g);
      var tray = new T.Mesh(new T.ShapeGeometry(pillShape(1.0, 0.4), 3),
                            flatMat2(S.airy(C.line, 0.46), { op: 1.0, dw: false }));
      tray.scale.set(0.92, 0.024, 1); g.add(tray);
      var wire = new T.Mesh(new T.ShapeGeometry(pillShape(1.0, 0.4), 3),
                            flatMat2(S.airy(C.line, 0.62), { op: 1.0, dw: false }));
      wire.scale.set(0.014, 0.52, 1); wire.position.set(0, 0.02, -0.01); g.add(wire);
      return { g: g, tray: tray, wire: wire, sign: sign, load: [] };
    }
    var PL = pan(-1), PR = pan(1);

    function load(P, n, col, spread) {
      for (var i = 0; i < n; i++) {
        var d = new T.Mesh(S.CIRC, flatMat2(S.airy(col, 0.70), { op: 1.0, dw: true }));
        d.scale.setScalar(0.072);
        P.g.add(d);
        P.load.push({ m: d, mat: d.material,
                      x: ((i % 4) - 1.5) * 0.20 * spread,
                      y: 0.10 + Math.floor(i / 4) * 0.19 });
      }
    }
    load(PL, GIVE, C.base, 1.0);
    /* THE ONE THING IS THE ARGUMENT, so it is drawn as a light and not as
       another counter. Seven ordinary marks on one side and one lit one on
       the other is the whole sentence; at the same size as the rest it read
       as an eighth mark that happened to be over there. */
    load(PR, GET, C.mark, 0.6);
    /* THE HALO ON THE ONE THING IS EMPHASIS, NOT A CATEGORY.
       It was teal, and teal in this palette is what a figure uses to say
       "the other kind". On a balance where the one lit mark is the SAME kind
       as the seven, only rarer, a cool halo says the opposite of what the
       picture means. It takes the warm light instead. */
    var getGlow = glowPlane(1.15, C.mark, C.base,
                            { k1: 1.1, k2: 3.2, gain: 0.0, hot: 0.0, damt: 0.0 });
    PR.g.add(getGlow);

    return { root: S.g, at: function (u, tsec, f) {
      f = f === undefined ? 1 : f;
      var wide = SCENE_EASE(clamp01(seg2(u, 0.04, 0.20)));
      var fill = clamp01(seg2(u, 0.18, 0.46));        /* what is given up */
      var one  = clamp01(seg2(u, 0.50, 0.62));        /* the one thing back */
      var tips = SCENE_EASE(clamp01(seg2(u, 0.62, 0.92)));

      /* the beam tips TOWARD THE SMALL SIDE, which is the whole point and
         the reason this is a drawing and not a sentence */
      var ang = -TIP * tips;
      beam.rotation.z = ang;
      beam.position.set(0, 0, -0.01);
      beam.material.opacity = f * clamp01(seg2(u, 0.08, 0.14)) * 0.9;
      post.material.opacity = beam.material.opacity;

      var ps = [PL, PR];
      for (var s = 0; s < 2; s++) {
        var P = ps[s];
        var ex = P.sign * ARM, ey = Math.sin(ang) * ex;
        P.g.position.set(ex * Math.cos(ang), ey - 0.60, 0.0);
        P.tray.material.opacity = f * clamp01(seg2(u, 0.12, 0.16)) * 0.8;
        P.wire.material.opacity = P.tray.material.opacity;
        P.wire.position.set(0, 0.024, -0.01);
        for (var i = 0; i < P.load.length; i++) {
          var q = P.load[i];
          var g0 = (P === PL) ? clamp01(fill * (GIVE + 2) - i) : clamp01(one * 3.0);
          var k = SCENE_EASE(g0);
          q.m.position.set(q.x, q.y * k + 0.06, 0.02);
          q.mat.opacity = f * k;
          q.m.scale.setScalar((P === PR ? 0.165 : 0.072) * (0.5 + 0.5 * k));
          if (P === PR) {
            getGlow.position.set(q.x, q.y * k + 0.06, 0.01);
            getGlow.material.uniforms.gain.value = 0.26 * f * k;
            faceLens(getGlow);
          }
        }
      }
      var sc = lerp(PORTRAIT ? 0.86 : 1.10, PORTRAIT ? 0.94 : 1.20, wide);
      S.inner.scale.setScalar(sc);
      S.g.position.set(0, PORTRAIT ? 0.90 : 0.72, 0);
      S.tick(tsec, f, wide);
    } };
  };

  /* ---- split · one speech that is two reports ----------------------------
     The film's own working, drawn. Two lines everyone quotes together arrive
     looking like one line, because that is how the printed versions have them
     and that is how the audience is holding them. Then the single line comes
     apart into two strands that were always there, and they end in different
     places, because they come from different collections. The figure is the
     argument: what looked like one is two, and you can see the seam. */
  FIG.nutsplit = function (o) {
    var S = nutScene(o), C = S.C;
    var X0 = -2.15, X1 = 2.05, FORK = -0.15, SEP = 0.60;
    var NSEG = 54;

    function strand(sign) {
      var seg = [];
      for (var i = 0; i < NSEG; i++) {
        var m = new T.Mesh(new T.ShapeGeometry(pillShape(1.0, 0.4), 3),
                           flatMat2(S.airy(sign < 0 ? C.base : C.rise, 0.58),
                                    { op: 1.0, dw: false }));
        S.MAIN.add(m); seg.push(m);
      }
      var end = new T.Mesh(S.CIRC, flatMat2(sign < 0 ? C.base : C.rise, { op: 1.0, dw: true }));
      end.scale.setScalar(0.10); S.MAIN.add(end);
      return { seg: seg, end: end, sign: sign };
    }
    var A = strand(-1), B = strand(1);

    /*  before the fork the two strands sit exactly on top of one another, so
        the eye reads one line; after it they part on a smooth curve */
    function yAt(x, sign, part) {
      if (x <= FORK) return 0;
      var t = clamp01((x - FORK) / (X1 - FORK));
      var e = t * t * (3 - 2 * t);
      return sign * SEP * e * part;
    }
    return { root: S.g, at: function (u, tsec, f) {
      f = f === undefined ? 1 : f;
      var wide = SCENE_EASE(clamp01(seg2(u, 0.04, 0.20)));
      var draw = SCENE_EASE(clamp01(seg2(u, 0.14, 0.60)));
      var part = SCENE_EASE(clamp01(seg2(u, 0.58, 0.92)));
      var st = [A, B];
      for (var s = 0; s < 2; s++) {
        var ST = st[s];
        for (var i = 0; i < NSEG; i++) {
          var xa = X0 + (X1 - X0) * (i / NSEG);
          var xb = X0 + (X1 - X0) * ((i + 1) / NSEG);
          var ya = yAt(xa, ST.sign, part), yb = yAt(xb, ST.sign, part);
          var dx = xb - xa, dy = yb - ya, L = Math.sqrt(dx * dx + dy * dy);
          var m = ST.seg[i];
          m.scale.set(L * 1.10, 0.026, 1);
          m.position.set((xa + xb) / 2, (ya + yb) / 2, s * 0.001);
          m.rotation.z = Math.atan2(dy, dx);
          /* while they are still together only one of them is drawn, or the
             overlap doubles the brightness and gives the seam away early */
          var solo = (xa <= FORK && s === 1) ? 0.0 : 1.0;
          m.material.opacity = f * clamp01(draw * NSEG * 1.2 - i) * 0.9 * solo;
        }
        var ex = X1, ey = yAt(X1, ST.sign, part);
        ST.end.position.set(ex, ey, 0.03);
        ST.end.material.opacity = f * clamp01((draw - 0.92) * 12.0);
        ST.end.scale.setScalar(0.10 * (1 + 0.55 * part));
      }
      var sc = lerp(PORTRAIT ? 0.80 : 1.06, PORTRAIT ? 0.88 : 1.16, wide);
      S.inner.scale.setScalar(sc);
      S.g.position.set(0, PORTRAIT ? 0.90 : 0.70, 0);
      S.tick(tsec, f, wide);
    } };
  };

  /* ---- converge · many languages, one library ----------------------------
     The trade route figure is a journey: one place to another, with something
     moving along it. Translation is not a journey, it is a confluence, and
     the shape of a confluence is many-to-one. Greek, Syriac, Persian and
     Sanskrit come in from their own directions and the thing they arrive at
     grows every time one lands. */
  FIG.nutconverge = function (o) {
    var S = nutScene(o), C = S.C;
    var SRC = o.from || [
      { a: 2.62, r: 2.45 }, { a: 2.05, r: 2.75 }, { a: -2.05, r: 2.70 },
      { a: -2.62, r: 2.40 }, { a: 3.05, r: 2.20 }
    ];
    var HUB = [0.95, 0.05], NSEG = 30;

    var arm = [];
    for (var i = 0; i < SRC.length; i++) {
      var sx = HUB[0] + Math.cos(SRC[i].a) * SRC[i].r;
      var sy = HUB[1] + Math.sin(SRC[i].a) * SRC[i].r * 0.72;
      var seg = [];
      for (var j = 0; j < NSEG; j++) {
        var m = new T.Mesh(new T.ShapeGeometry(pillShape(1.0, 0.4), 3),
                           flatMat2(S.airy(C.line, 0.60), { op: 1.0, dw: false }));
        S.MAIN.add(m); seg.push(m);
      }
      var src = new T.Mesh(S.CIRC, flatMat2(S.airy(C.base, 0.55), { op: 1.0, dw: true }));
      src.scale.setScalar(0.078); src.position.set(sx, sy, 0.02); S.MAIN.add(src);
      arm.push({ seg: seg, src: src, sx: sx, sy: sy, lag: i / SRC.length });
    }
    var hub = new T.Mesh(S.CIRC, flatMat2(C.base, { op: 1.0, dw: true }));
    hub.position.set(HUB[0], HUB[1], 0.04); S.MAIN.add(hub);
    var hubGlow = glowPlane(1.6, C.base, C.base, { k1: 1.1, k2: 3.0, gain: 0.0, hot: 0.0, damt: 0.0 });
    hubGlow.position.set(HUB[0], HUB[1], 0.03); S.MAIN.add(hubGlow);

    return { root: S.g, at: function (u, tsec, f) {
      f = f === undefined ? 1 : f;
      var wide = SCENE_EASE(clamp01(seg2(u, 0.04, 0.20)));
      var run = clamp01(seg2(u, 0.12, 0.90));
      var landed = 0;
      for (var i = 0; i < arm.length; i++) {
        var A = arm[i];
        /* each route starts at its own moment and takes the same time, so
           they arrive one after another rather than all at once */
        var k = SCENE_EASE(clamp01((run - A.lag * 0.42) * 2.1));
        A.src.material.opacity = f * clamp01((run - A.lag * 0.42) * 6.0);
        for (var j = 0; j < NSEG; j++) {
          var t0 = j / NSEG, t1 = (j + 1) / NSEG;
          var xa = lerp(A.sx, HUB[0], t0), ya = lerp(A.sy, HUB[1], t0);
          var xb = lerp(A.sx, HUB[0], t1), yb = lerp(A.sy, HUB[1], t1);
          var dx = xb - xa, dy = yb - ya, L = Math.sqrt(dx * dx + dy * dy);
          var m = A.seg[j];
          m.scale.set(L * 1.12, 0.019, 1);
          m.position.set((xa + xb) / 2, (ya + yb) / 2, 0.0);
          m.rotation.z = Math.atan2(dy, dx);
          m.material.opacity = f * clamp01(k * NSEG * 1.25 - j) * 0.72;
        }
        if (k > 0.985) landed++;
      }
      /* the library is the sum of what reached it */
      var grow = landed / Math.max(1, arm.length);
      hub.scale.setScalar(0.085 + 0.145 * grow);
      hub.material.opacity = f * clamp01(seg2(u, 0.10, 0.10));
      hubGlow.material.uniforms.gain.value = 0.20 * f * grow;
      hubGlow.scale.setScalar(0.8 + 0.7 * grow);
      faceLens(hubGlow);
      var sc = lerp(PORTRAIT ? 0.72 : 0.96, PORTRAIT ? 0.80 : 1.06, wide);
      S.inner.scale.setScalar(sc);
      S.g.position.set(0, PORTRAIT ? 0.88 : 0.66, 0);
      S.tick(tsec, f, wide);
    } };
  };

  /* ---- twin · the same shape, and no road between them -------------------
     The strongest claim in film three and it was being carried by a borrowed
     drawing. Ibn al-Shatir's lunar model and the one printed in 1543 are
     mathematically the same construction; Roberts and Kennedy showed it in
     1957; no route by which it travelled has ever been found. All three of
     those facts have to be in the picture at once, so: two assemblies built
     from ONE generator, so they are provably identical rather than merely
     similar; built one after the other, three centuries apart; and a probe
     that reaches out from one toward the other and stops, because that is
     what the record actually does. The empty gap is the third fact. */
  FIG.nuttwin = function (o) {
    var S = nutScene(o), C = S.C;
    var GAP = 1.42;

    /*  the construction: a large circle, a smaller one rolling inside it, and
        a point on the smaller one that traces a straight line. Drawn as rings
        of marks rather than as outlines, so it belongs to this film. */
    function build(cx, col) {
      var g = new T.Group(); S.MAIN.add(g);
      g.position.set(cx, 0, 0);
      var big = [], small = [], NB = 30, NS = 18;
      for (var i = 0; i < NB; i++) {
        var d = new T.Mesh(S.CIRC, flatMat2(S.airy(col, 0.62), { op: 1.0, dw: true }));
        var a = (i / NB) * Math.PI * 2;
        d.position.set(Math.cos(a) * 0.92, Math.sin(a) * 0.92, 0);
        d.scale.setScalar(0.030); g.add(d); big.push(d);
      }
      for (i = 0; i < NS; i++) {
        var s = new T.Mesh(S.CIRC, flatMat2(S.airy(col, 0.48), { op: 1.0, dw: true }));
        s.scale.setScalar(0.026); g.add(s); small.push(s);
      }
      var pt = new T.Mesh(S.CIRC, flatMat2(C.mark, { op: 1.0, dw: true }));
      pt.scale.setScalar(0.062); g.add(pt);
      var tr = [], NT = 26;
      for (i = 0; i < NT; i++) {
        var m = new T.Mesh(new T.ShapeGeometry(pillShape(1.0, 0.4), 3),
                           flatMat2(S.airy(col, 0.40), { op: 1.0, dw: false }));
        m.scale.set(0.062, 0.020, 1);
        m.position.set(-0.92 + (i / (NT - 1)) * 1.84, 0, -0.01);
        g.add(m); tr.push(m);
      }
      return { g: g, big: big, small: small, pt: pt, tr: tr, NB: NB, NS: NS, NT: NT };
    }
    var L = build(-GAP, C.base), R = build(GAP, C.base);

    /*  the probe: it leaves the left construction, crosses a third of the
        gap, and stops. It never touches the right one. */
    var probe = [], NP = 9;
    for (var i = 0; i < NP; i++) {
      var m = new T.Mesh(new T.ShapeGeometry(pillShape(1.0, 0.4), 3),
                         flatMat2(S.airy(C.line, 0.72), { op: 1.0, dw: false }));
      /* thicker than a hairline: at 0.016 it was 3 screen pixels and the
         search read as an empty gap rather than as a search */
      m.scale.set(0.098, 0.030, 1);
      m.position.set(-GAP + 1.02 + i * 0.152, 0, 0.02);
      S.MAIN.add(m); probe.push(m);
    }

    function place(K, spin, show) {
      for (var i = 0; i < K.NB; i++) K.big[i].material.opacity = show * clamp01(spin * K.NB * 1.4 - i);
      /* the small circle rolls inside the big one; its centre is at
         (R - r) from the origin and it turns the other way, which is the
         couple that turns a circle into a straight line */
      var a = spin * Math.PI * 2.0;
      var cx = Math.cos(a) * 0.46, cy = Math.sin(a) * 0.46;
      for (i = 0; i < K.NS; i++) {
        var b = (i / K.NS) * Math.PI * 2 - a * 2.0;
        K.small[i].position.set(cx + Math.cos(b) * 0.46, cy + Math.sin(b) * 0.46, 0.01);
        K.small[i].material.opacity = show * clamp01(spin * 4.0) * 0.9;
      }
      K.pt.position.set(cx + Math.cos(-a) * 0.46, cy + Math.sin(-a) * 0.46, 0.03);
      K.pt.material.opacity = show * clamp01(spin * 4.0);
      for (i = 0; i < K.NT; i++)
        K.tr[i].material.opacity = show * clamp01(spin * K.NT * 1.1 - i) * 0.8;
    }

    return { root: S.g, at: function (u, tsec, f) {
      f = f === undefined ? 1 : f;
      var wide = SCENE_EASE(clamp01(seg2(u, 0.04, 0.20)));
      /* Damascus first, then three centuries later the other one, built by
         the same code because that is the claim */
      var a = SCENE_EASE(clamp01(seg2(u, 0.10, 0.42)));
      var b = SCENE_EASE(clamp01(seg2(u, 0.44, 0.76)));
      place(L, a, f);
      place(R, b, f);
      /* and the road that was looked for and not found */
      /* IT HAS TO BE SEEN REACHING, or the empty gap is just empty rather
         than searched. It was starting at 80% of the span and at half
         opacity, which on screen was nothing at all. It now sets out as soon
         as the second construction is standing, and it is bright where it
         starts, because somebody did look. */
      var reach = clamp01(seg2(u, 0.66, 0.93));
      for (var i = 0; i < probe.length; i++) {
        var lit = clamp01(reach * (NP + 1.5) - i);
        probe[i].material.opacity = f * lit * (1.0 - 0.55 * (i / (NP - 1)));
      }
      var sc = lerp(PORTRAIT ? 0.62 : 0.86, PORTRAIT ? 0.70 : 0.94, wide);
      S.inner.scale.setScalar(sc);
      S.g.position.set(0, PORTRAIT ? 0.90 : 0.66, 0);
      S.tick(tsec, f, wide);
    } };
  };

  /* ---- ring · a cycle that closes ---------------------------------------
     Concentric rings on different tilts, counter-turning. For the things in
     this subject that come round: five prayers in a day, a month in a year,
     a life that returns. */
  FIG.ring = function (o) {
    var g = new T.Group();
    var n = o.count || 3, parts = [];
    for (var i = 0; i < n; i++) {
      var rad = 1.0 + i * 0.62;
      var m = new T.Mesh(new T.TorusGeometry(rad, 0.036 + i * 0.007, 24, 360),
        lumeMat(i % 2 ? C.gold : C.goldhi, C.pale,
          { rim: 1.8, glow: 1.15, body: 0.8, sheen: 0.7, cyc: 0.95,
            dnear: 5.2, dfar: 12.0, damt: 0.6 }));
      m.rotation.x = 1.1 - i * 0.34;
      m.rotation.y = i * 0.5;
      g.add(m);
      parts.push({ m: m, dir: i % 2 ? -1 : 1, rad: rad });
    }
    /* one mark riding the outermost ring, so the turn is readable */
    var bead = new T.Mesh(new T.SphereGeometry(0.055, 28, 20),
      lumeMat(C.pale, C.parch, { rim: 1.4, glow: 1.05, bodyk: 2.4, body: 1.0,
                                 add: true, depthWrite: false }));
    g.add(bead);
    var beadGlow = glowPlane(1.55, C.pale, C.goldhi,
      { k1: 1.7, k2: 8.0, gain: 0.24, hot: 0.80, damt: 0.40 });
    g.add(beadGlow);
    var last = parts[parts.length - 1];
    var BEAD = new T.Vector3();

    return {
      root: g,
      at: function (u, tsec, f) {
        f = f === undefined ? 1 : f;
        var k = ease("open", u * 2.6);
        g.scale.setScalar(lerp(0.33, 0.45, k) * (PORTRAIT ? 0.88 : 1));
        /* clear of the band the caption is set in: the words were being read
           through the lower arc of the outermost ring */
        /* the rings are tilted, so their weight sits left of the group
           origin; a nudge the other way puts the figure over the words
           it belongs to rather than beside them */
        g.position.x = PORTRAIT ? 0.10 : 0.34;
        g.position.y = PORTRAIT ? 0.86 : 0.58;
        for (var i = 0; i < parts.length; i++) {
          var p = parts[i];
          p.m.rotation.z = tsec * 0.22 * p.dir * (1 + i * 0.3);
          var on = clamp01(ease("snap", (u * 2.2) - i * 0.18));
          p.m.material.uniforms.glow.value = on * f;
          /* each ring's light comes round at its own rate, the inner ones
             faster, which is what a set of nested cycles actually does */
          p.m.material.uniforms.headU.value =
            (tsec * (0.115 + (parts.length - i) * 0.055) * p.dir) % 1;
          p.m.material.uniforms.cyc.value = 0.95 * on * f;
        }
        /* THE BEAD RIDES THE RING, and the only reliable way to say that is
           to take a point on the ring's own circle and put it through the
           ring's own matrix. Hand-rolling the rotation put it three units off
           to one side, orbiting nothing. */
        var a = tsec * 0.5;
        BEAD.set(Math.cos(a) * last.rad, Math.sin(a) * last.rad, 0);
        last.m.updateMatrix();
        bead.position.copy(BEAD.applyMatrix4(last.m.matrix));
        beadGlow.position.copy(bead.position);
        faceLens(beadGlow);
        bead.material.uniforms.glow.value = 1.05 * k * f;
        beadGlow.material.uniforms.gain.value = 0.24 * k * f;
      }
    };
  };

  /* ---- card · a plane that can hold anything ----------------------------
     "We can even use box cards to fit whatever image or illustration we'd
     need to illustrate points." This is that: a panel in space, lit at its
     edge, whose face is a canvas the film draws into. Because the face is a
     canvas and not a file, the card can carry a page of Uthmani text, a
     drawn map, a chart or a photograph the project owns -- and nothing it
     carries came from anyone else unless we put it there.

     Cards arrive in a stack and fan out; a stack that fans is a comparison
     the viewer understands before a word is spoken. */
  FIG.card = function (o) {
    var g = new T.Group();
    var faces = o.faces || [{}];
    var W = o.w || 2.4, H = o.h || 1.55, D = o.thick === undefined ? 0.075 : o.thick;
    var items = [];

    for (var i = 0; i < faces.length; i++) {
      var f = faces[i];
      var cv = document.createElement("canvas");
      cv.width = 1024; cv.height = Math.round(1024 * H / W);
      var cx = cv.getContext("2d");
      var Wc = cv.width, Hc = cv.height;

      /* A FACE WITH NOTHING ON IT IS A DIV.
         The first card was a flat navy rectangle with a number in the middle
         and a gold outline round it -- which is a web component, drawn at an
         angle. A printed card has a sheet that is lighter where the light
         falls on it, a darkened border where it curves away, and a rule set
         IN from the edge rather than laid on top of it. All three are two
         lines of canvas each and together they are the whole difference. */
      /* AND IT HAS TO BE LIGHT ENOUGH TO SURVIVE THE COLOUR SPACE.
         A canvas is written in sRGB and sampled in linear: #1B2440 is a
         perfectly reasonable navy on a screen and two hundredths of linear
         light in the renderer, which on a black ground is nothing at all.
         That is why the first slabs came back as floating numerals with no
         card under them. The sheet is set two stops up so it reads as a
         surface -- and the whole face is then scaled down at draw time until
         its brightest ink falls under the bloom's threshold, so it is lit
         paper and not a lamp. */
      cx.fillStyle = "#18223C"; cx.fillRect(0, 0, Wc, Hc);
      var bg = cx.createLinearGradient(0, 0, Wc * 0.75, Hc);
      bg.addColorStop(0, "rgba(85,103,145,0.50)");
      bg.addColorStop(0.55, "rgba(51,64,100,0.53)");
      bg.addColorStop(1, "rgba(24,34,60,0)");
      cx.fillStyle = bg; cx.fillRect(0, 0, Wc, Hc);

      /* the light in the room falls across the sheet from the upper left */
      var sh = cx.createRadialGradient(Wc * 0.26, Hc * 0.14, Wc * 0.02,
                                       Wc * 0.26, Hc * 0.14, Wc * 0.95);
      sh.addColorStop(0, "rgba(228,196,110,0.30)");
      sh.addColorStop(0.45, "rgba(201,162,39,0.09)");
      sh.addColorStop(1, "rgba(0,0,0,0)");
      cx.fillStyle = sh; cx.fillRect(0, 0, Wc, Hc);

      /* and the sheet darkens at its own border, which is what says "edge" */
      var vg = cx.createRadialGradient(Wc * 0.5, Hc * 0.5, Hc * 0.22,
                                       Wc * 0.5, Hc * 0.5, Wc * 0.68);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.62)");
      cx.fillStyle = vg; cx.fillRect(0, 0, Wc, Hc);

      if (f.draw && window[f.draw]) { window[f.draw](cx, Wc, Hc, f); }
      else if (f.text) {
        cx.fillStyle = "#FBF1D4";
        cx.font = "600 " + Math.round(Hc * 0.27) + "px 'NoorCard', system-ui, sans-serif";
        cx.textAlign = "center"; cx.textBaseline = "middle";
        cx.fillText(String(f.text), Wc / 2, Hc * 0.5);
        if (f.label) {
          cx.fillStyle = "rgba(201,162,39,0.78)";
          cx.font = "500 " + Math.round(Hc * 0.075) + "px system-ui, sans-serif";
          cx.fillText(String(f.label).toUpperCase(), Wc / 2, Hc * 0.815);
        }
      }
      /* THE BORDER IS THE BRIGHTEST THING ON THE CARD AND STILL NOT A LAMP.
         Two rules, inset the way they are on a printed card: a soft wide one
         under the bright pass and a hairline just below it, so the card has
         a crisp edge without the bloom filling the rectangle in. */
      var pad = Math.round(Hc * 0.075);
      cx.strokeStyle = "rgba(201,162,39,0.26)";
      cx.lineWidth = Math.max(2, Math.round(Hc * 0.020));
      cx.strokeRect(pad, pad, Wc - pad * 2, Hc - pad * 2);
      cx.strokeStyle = "rgba(243,222,152,0.88)";
      cx.lineWidth = Math.max(1, Math.round(Hc * 0.0055));
      cx.strokeRect(pad, pad, Wc - pad * 2, Hc - pad * 2);

      var tex = new T.CanvasTexture(cv);
      tex.anisotropy = 8;
      if (T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;

      /* THE CARD HAS A THICKNESS.
         An outlined plane is a shape; a slab with four lit sides is an
         object. The sides wear the same material as everything else in the
         film, so they take the rim light and recede with distance, and the
         gold that used to be painted round the face as a border is now
         light coming off a real edge. The face itself stays dim -- it is lit
         paper, not a lamp -- so the numeral reads and only the edges burn. */
      var faceM = new T.MeshBasicMaterial({ map: tex, color: 0x999999 });
      var backM = new T.MeshBasicMaterial({ color: 0x05070F });
      /* THE SIDES ARE AN EDGE, NOT A STRIP LIGHT.
         At full sheen a slab turned a few degrees catches its own side face
         at a grazing angle, and the bloom turns that into a bright vertical
         bar standing between two cards -- the artefact that appeared down the
         middle of the row. Dim, with almost no specular: an edge you can see
         the thickness of, and nothing more. */
      var sideM = lumeMat(C.gold.clone().multiplyScalar(0.42), C.goldhi,
        { rim: 2.2, glow: 0.48, body: 1.0, sheen: 0.14, dnear: 5.0, dfar: 13.0, damt: 0.62 });
      var slab = new T.Mesh(new T.BoxGeometry(W, H, D),
        [sideM, sideM, sideM, sideM, faceM, backM]);

      /* a breath of light lying on the surface behind it, so a card does not
         float in a vacuum -- it is standing in the same air as the rest */
      var lift = glowPlane(Math.max(W, H) * 2.2, C.pale, C.gold,
        { k1: 2.0, k2: 9.0, gain: 0.150, hot: 0.34, damt: 0.45 });
      lift.position.z = -D * 0.5 - 0.04;

      var card = new T.Group(); card.add(lift); card.add(slab);
      g.add(card);
      items.push({ card: card, slab: slab, face: faceM, side: sideM, lift: lift });
    }

    /* CARDS DO NOT MOVE INTO PLACE THROUGH EACH OTHER.
       They used to be spaced by `slot * step * open`, with open easing from
       zero -- which means that for the first second of the beat all three
       occupied the same cubic inch and slid out of one another. That is the
       overlap: not a spacing bug, an ANIMATION bug. A card's place in the row
       is fixed from the first frame it exists. What arrives is the card
       itself: it rises, comes forward out of the dark and settles, and it
       does that a beat behind its neighbour so the row is read left to right
       rather than appearing as a block. */
    var n = items.length;
    var GAP = 0.26;
    var stepX = W + GAP, stepY = H + GAP * 0.85;
    var spanX = stepX * (n - 1), spanY = stepY * (n - 1);
    /* sized against the tightest shot in the table, not against the old
       one: the row used to be 5.3 units wide, which is a quarter of a card
       outside a frame that is 5.02 across at its closest, and stacked in
       9:16 it put the top card a full unit above the top edge */
    var FITX = 4.40, FITY = 2.25;                 /* what the lens can hold */
    var fitWide = Math.min(1, FITX / Math.max(0.001, spanX + W));
    var fitTall = Math.min(1, FITY / Math.max(0.001, spanY + H));
    var YAW = 0.26;

    return {
      root: g,
      at: function (u, tsec, f) {
        f = f === undefined ? 1 : f;
        var mid = (n - 1) / 2;
        g.position.y = PORTRAIT ? 0.18 : 0.05;
        g.scale.setScalar(PORTRAIT ? fitTall : fitWide);
        /* the whole row turns a few degrees while it is held, which is what
           tells the eye these are objects in a space and not a layout */
        g.rotation.y = Math.sin(tsec * 0.19) * 0.055;
        g.rotation.x = PORTRAIT ? Math.sin(tsec * 0.15) * 0.03 : -0.075 + Math.cos(tsec * 0.13) * 0.028;

        for (var i = 0; i < n; i++) {
          var it = items[i], slot = i - mid;
          var k = ease("lift", (u * 2.15) - i * 0.16);
          var a = clamp01((u * 2.6) - i * 0.16);
          if (PORTRAIT) {
            it.card.position.set(Math.sin(tsec * 0.4 + i) * 0.018,
                                 -slot * stepY + (1 - k) * 0.55,
                                 -Math.abs(slot) * 0.26 - (1 - k) * 1.10);
            it.card.rotation.set(slot * YAW * 0.52, 0, 0);
          } else {
            it.card.position.set(slot * stepX,
                                 Math.sin(tsec * 0.5 + i) * 0.03 - (1 - k) * 0.45,
                                 -Math.abs(slot) * 0.34 - (1 - k) * 1.10);
            it.card.rotation.set(0, -slot * YAW, 0);
          }
          it.card.scale.setScalar(lerp(0.93, 1, k));
          it.face.color.setScalar(0.66 * a * f + 0.0001);
          it.side.uniforms.glow.value = 0.48 * a * f;
          it.lift.material.uniforms.gain.value = 0.150 * a * f;
          it.card.visible = a > 0.002;
        }
      }
    };
  };

  /* =======================================================================
     THE RENDERER, THE BLOOM, AND THE CAMERA
     ======================================================================= */

  var canvas, renderer, scene, cam, W = 0, H = 0;
  var rtScene, rtA, rtB, rtC, rtDof, blurMat, cutMat, dofMat, quadScene, quadCam, comboMat, showMat, DEBUG = "";
  /* THE TALL FRAME IS A SECOND COMPOSITION, NOT A CROP.
     spec.py says it in words -- "a 16:9 film squeezed into 9:16 reads as a
     mistake" -- and the CSS obeys it: the words are laid out twice. This
     layer did not. It had one perspective camera with a fixed vertical field,
     so in 9:16 the horizontal view collapsed to a third and every figure was
     cut off at both edges: the chain lost its outer generations, the path ran
     off both sides, two of the three cards were outside the picture.

     Portrait cannot show a wide figure at the same size -- that is geometry,
     not craft -- so the figures are ARRANGED differently for it. A chain that
     spreads sideways in the wide frame grows upward in the tall one; a path
     that crosses left to right falls top to bottom; cards that fan out stack
     up. Same objects, same beat, same seconds: a second composition. */
  var PORTRAIT = false;
  /* THE GLOW WAS BUILT AT A SIXTH OF THE FRAME AND IT SHOWED.
     A bloom is a very smooth, very low amplitude gradient, and a very smooth
     low amplitude gradient is the hardest thing in the world to store in eight
     bits: the steps between one value and the next are wider than the gradient
     itself, so the halo around a bright numeral comes back as a stack of flat
     bands rather than a falloff. Stretching that from a sixth of the frame to
     the whole of it makes each band six pixels wide, which is what "the glow
     looks pixelated" is. Two changes, both cheap next to the scene pass:
     build the glow at a quarter rather than a sixth, and keep it in half
     floats, where a smooth gradient stays smooth. */
  var current = null, cues = [], BLOOM_DIV = 4, SCALE = 1, SS = 2;
  /* THE CAMERA BELONGS TO THE FILM, NOT TO THE FIGURE.
     It used to take its shot from whichever figure was on screen, which was
     fine while every beat had its own figure and wrong the moment one figure
     was asked to carry four beats: the picture would then hold a single
     twenty-four second move while the words under it cut four times. The
     shots are handed over as their own list, one per beat, and the figures
     come and go underneath them. */
  var shots = [];

  /*  THE LENS.
      A shot is not only where the camera is; it is what glass is on it. This
      is the whole set, in one object, so a direction can put a 35mm at f/8 on
      an architectural subject and a 85mm wide open on a face and mean it.
        focus     distance, in world units, of the plane that is sharp
        aperture  how fast the picture falls off either side of it
        maxR      the largest circle of confusion, in half-res pixels
        tilt*     a BAND of sharpness across the frame instead of a plane in
                  space, which is what a tilt-shift lens does and what makes
                  a real thing look like a model of itself */
  var LENS = { focus: 8.0, aperture: 0.55, maxR: 16.0,
               tiltY: 0.52, tiltBand: 0.30, tiltSoft: 0.26, tiltAmt: 0.0 };

  function makeTargets() {
    var sw = Math.max(4, Math.round(W * SS)), sh = Math.max(4, Math.round(H * SS));
    var bw = Math.max(4, Math.round(W / BLOOM_DIV)), bh = Math.max(4, Math.round(H / BLOOM_DIV));
    [rtScene, rtA, rtB, rtC, rtDof].forEach(function (r) { if (r) r.dispose(); });
    var HDR = (T.HalfFloatType !== undefined) ? { type: T.HalfFloatType } : {};
    rtScene = new T.WebGLRenderTarget(sw, sh,
      Object.assign({ minFilter: T.LinearFilter, magFilter: T.LinearFilter }, HDR));
    if (comboMat) comboMat.uniforms.texel.value.set(1 / sw, 1 / sh);
    rtA = new T.WebGLRenderTarget(bw, bh,
      Object.assign({ minFilter: T.LinearFilter, magFilter: T.LinearFilter }, HDR));
    rtB = new T.WebGLRenderTarget(bw, bh,
      Object.assign({ minFilter: T.LinearFilter, magFilter: T.LinearFilter }, HDR));
    rtC = new T.WebGLRenderTarget(bw, bh,
      Object.assign({ minFilter: T.LinearFilter, magFilter: T.LinearFilter }, HDR));
    /* the scene buffer keeps a depth texture now: the aperture needs to know
       how far away every pixel is, and the only honest source for that is
       the depth the scene pass already wrote and used to throw away */
    if (T.DepthTexture) {
      rtScene.depthTexture = new T.DepthTexture(sw, sh);
      rtScene.depthTexture.type = T.UnsignedIntType;
    }
    /* the defocus is built at half the frame. A circle of confusion is by
       definition the loss of detail, so resolving it at full resolution is
       paying for information the lens has already destroyed. */
    var dw = Math.max(4, Math.round(W / 2)), dh = Math.max(4, Math.round(H / 2));
    rtDof = new T.WebGLRenderTarget(dw, dh,
      Object.assign({ minFilter: T.LinearFilter, magFilter: T.LinearFilter }, HDR));
    if (dofMat) {
      dofMat.uniforms.texel.value.set(1 / dw, 1 / dh);
      dofMat.uniforms.near.value = cam ? cam.near : 0.1;
      dofMat.uniforms.far.value = cam ? cam.far : 200;
    }
  }

  /* THE THRESHOLD COMES BEFORE THE BLUR, NOT AFTER IT.
     The first cut blurred the picture and then asked whether the result was
     bright enough to bloom. That is backwards and it is self-defeating: the
     blur is what makes a bright thing dim, by spreading its energy over a
     hundred times the area, so the test threw away exactly the light it had
     just spread. The halo went missing and the frames came back with hard,
     unhaloed objects on a flat ground -- which is what "not cinema" looks
     like more than any other single thing.

     So: one bright pass decides what is a light source, at full sharpness,
     and only that is blurred. */
  var CUT_FRAG = [
    "varying vec2 v; uniform sampler2D tex; uniform float cut; uniform float knee;",
    "void main(){",
    "  vec4 s = texture2D(tex, v);",
    "  float l = dot(s.rgb, vec3(.2126,.7152,.0722));",
    "  gl_FragColor = vec4(s.rgb * smoothstep(cut, cut + knee, l), 1.0);",
    "}"
  ].join("\n");

  var BLUR_FRAG = [
    "varying vec2 v; uniform sampler2D tex; uniform vec2 dir; uniform vec2 res;",
    "uniform float spread;",
    "void main(){",
    "  float w0=.161, w1=.150, w2=.122, w3=.087, w4=.054, w5=.029, w6=.014;",
    "  vec4 s = texture2D(tex, v) * w0;",
    "  vec2 o = dir * spread / res;",
    "  s += texture2D(tex, v + o*1.0) * w1; s += texture2D(tex, v - o*1.0) * w1;",
    "  s += texture2D(tex, v + o*2.0) * w2; s += texture2D(tex, v - o*2.0) * w2;",
    "  s += texture2D(tex, v + o*3.0) * w3; s += texture2D(tex, v - o*3.0) * w3;",
    "  s += texture2D(tex, v + o*4.0) * w4; s += texture2D(tex, v - o*4.0) * w4;",
    "  s += texture2D(tex, v + o*5.0) * w5; s += texture2D(tex, v - o*5.0) * w5;",
    "  s += texture2D(tex, v + o*6.0) * w6; s += texture2D(tex, v - o*6.0) * w6;",
    "  gl_FragColor = s;",
    "}"
  ].join("\n");


  /*  THE LENS HAS AN APERTURE.
      =====================================================================
      Everything in this film has been rendered by a pinhole: infinite depth
      of field, every plane equally sharp, which is a thing no camera has
      ever done and the reason renders read as renders. A real lens is a
      disc, and every point that is not on the focus plane arrives as a small
      disc rather than a point -- the circle of confusion. Out-of-focus
      HIGHLIGHTS therefore come back as little discs of light, which is what
      bokeh is, and this film is made almost entirely of highlights.

      The pass is a scatter-as-gather: twenty-four taps on a golden-angle
      spiral, each weighted by its own brightness so a bright tap spreads
      into a disc and a dark one does not. The radius is the circle of
      confusion at that pixel, worked out from the depth buffer against a
      focus distance the film sets per shot.

      TILT SHIFT is the same number arrived at differently: instead of a
      focus DISTANCE it is a focus BAND across the frame, everything above
      and below it going soft. It is added to the depth term, so a shot can
      have both -- a shallow lens AND a tilted plane -- which is exactly the
      combination that makes a large thing look like a model and a small
      thing look enormous.

      Nothing that did not write depth is defocused: the Lantern's glow
      planes and the veils are billboards with depthWrite off, and they are
      the subject. A lens focuses on the subject. */
  var DOF_FRAG = [
    "varying vec2 v;",
    "uniform sampler2D tex; uniform sampler2D dep;",
    "uniform vec2 texel; uniform float near; uniform float far;",
    "uniform float focus; uniform float aperture; uniform float maxR;",
    "uniform float tiltY; uniform float tiltBand; uniform float tiltSoft; uniform float tiltAmt;",
    "float viewZ(vec2 uv){",
    "  float d = texture2D(dep, uv).x;",
    "  if (d >= 0.99999) return -1.0;",
    "  float z = d * 2.0 - 1.0;",
    "  return (2.0 * near * far) / (far + near - z * (far - near));",
    "}",
    "float coc(vec2 uv){",
    "  float c = 0.0;",
    "  float z = viewZ(uv);",
    "  if (z > 0.0) c = clamp(abs(z - focus) / max(z, 0.001) * aperture, 0.0, 1.0);",
    "  float ty = abs(uv.y - tiltY);",
    "  c = max(c, tiltAmt * smoothstep(tiltBand, tiltBand + tiltSoft, ty));",
    "  return clamp(c, 0.0, 1.0);",
    "}",
    "void main(){",
    "  float r = coc(v) * maxR;",
    "  vec3 acc = texture2D(tex, v).rgb; float wsum = 1.0;",
    "  for (int i = 0; i < 24; i++) {",
    "    float fi = float(i) + 0.5;",
    "    float a = fi * 2.39996323;",
    "    float rr = sqrt(fi / 24.0) * r;",
    "    vec2 uv = v + vec2(cos(a), sin(a)) * rr * texel;",
    "    vec3 sm = texture2D(tex, uv).rgb;",
    /* a bright tap spreads into a disc and a dark one does not: that
       asymmetry IS bokeh, and averaging without it gives a smear */
    "    float w = (0.10 + dot(sm, vec3(0.45))) * step(rr, coc(uv) * maxR + 1.0);",
    "    acc += sm * w; wsum += w;",
    "  }",
    "  gl_FragColor = vec4(acc / max(wsum, 0.0001), coc(v));",
    "}"
  ].join("\n");

  /* THE RESOLVE. Three things happen here and each of them is a reason the
     first cut looked like a 3D render instead of a photograph of one.

     SUPERSAMPLING. The scene is drawn into a buffer twice the width and twice
     the height of the frame and boxed down here, four samples to a pixel.
     That is real antialiasing and it is the whole answer to a hard, stepped
     silhouette. The first cut did the opposite -- it drew the layer at 62% of
     the frame and let the browser stretch it UP, on the reasoning that bloom
     is low frequency and would not notice. Bloom does not notice. The EDGES
     of the objects inside it are not low frequency at all, and magnifying
     them magnified every step in them. It was the wrong saving and it is the
     thing you can see in the picture.

     TONE MAPPING. A filmic curve rolls the highlights off instead of letting
     them clip flat at white. Clipped highlights are the single loudest tell
     that a picture came out of a renderer: real light never ends at an edge,
     it rolls.

     DITHER. A quarter of a bit of noise, so a gradient across a dark frame
     steps smoothly instead of banding. Eight bits is not enough for a room
     this dark without it. */
  var COMBO_FRAG = [
    "varying vec2 v;",
    "uniform sampler2D base; uniform sampler2D bloom; uniform sampler2D bloom2;",
    "uniform sampler2D dof; uniform float covmode;",
    "uniform float amt; uniform float wide; uniform float exposure; uniform vec2 texel;",
    "vec3 filmic(vec3 x){",
    "  const float a=2.51, b=0.03, c=2.43, d=0.59, e=0.14;",
    "  return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);",
    "}",
    /* ---- the room ------------------------------------------------------
       A port of what web/ground.js used to draw on a 2D canvas, in float and
       on the GPU: a four stop sky, three blooms lit from one key outside the
       frame, and a horizon band. Every number is the same number.
       It answers the shot at a fraction of the rate the figures do -- gxf
       carries the ground layer's own camera move -- which is what depth is. */
    "uniform vec2 res; uniform float gtime; uniform vec3 gxf; uniform float vigamt;",
    "uniform vec3 sky0; uniform vec3 sky1; uniform vec3 sky2; uniform vec3 sky3;",
    "uniform vec3 hue0; uniform vec3 hue1; uniform vec3 hue2; uniform vec3 amps;",
    "uniform vec3 horiz; uniform float horizA;",
    /* mode 0 is light in a dark room. mode 1 is ink on paper: the same light
       layer, the same bloom, the same camera, read as absorption instead of
       emission. It is one line at the end and it is a whole visual language. */
    "uniform float mode; uniform vec3 paper; uniform vec3 inkc; uniform float inkK;",
    "uniform float rtex; uniform vec3 hazeC; uniform float hazeA; uniform float floorY;",
    /* THE FILM STOCK. Everything above this line is the LENS: focus,
       bloom, veil, vignette. These three are the STOCK the lens exposes,
       and they are the difference between a picture and a collage. A
       vector figure composited onto a gradient has no shared noise floor
       and no shared lens defects with the room behind it, which is
       exactly what the eye reads as pasted on. One grain, one halation,
       one field curvature, applied to everything at once and after
       everything else, is what puts the figure and the room on the same
       piece of film. */
    "uniform float grainA; uniform float haloA; uniform float softA;",
    "uniform float paperA;",
    NOISE_GLSL,
    "vec3 skyAt(float y){",
    "  if (y < 0.38) return mix(sky0, sky1, y/0.38);",
    "  if (y < 0.70) return mix(sky1, sky2, (y-0.38)/0.32);",
    "  return mix(sky2, sky3, (y-0.70)/0.30);",
    "}",
    "vec3 bloomAt(vec2 p, vec2 at, float rad, float amp, vec2 per, vec2 amb, vec3 hue, float i, float t){",
    "  float cx = (at.x + sin(t/per.x*6.2831853)*amb.x) * res.x;",
    "  float cy = (at.y + cos(t/per.y*6.2831853)*amb.y) * res.y;",
    "  float rr = rad * max(res.x,res.y) * (0.94 + 0.06*sin(t/23.0*6.2831853 + i));",
    "  float d = clamp(length(p - vec2(cx,cy)) / rr, 0.0, 1.0);",
    "  float a = d < 0.42 ? mix(amp, amp*0.30, d/0.42) : mix(amp*0.30, 0.0, (d-0.42)/0.58);",
    "  return hue * a;",
    "}",
    /*  THE ROOM IS A PLACE, NOT AN ABSENCE.
        The first version of this was three soft blooms on a near black
        gradient, and on a phone at night that is indistinguishable from a
        black rectangle -- which is exactly what came back. A room reads as a
        room when it has three things a void does not: air with structure in
        it, a surface you could touch, and a floor for the objects to stand
        on. All three are here, all three are procedural, and which surface
        it is comes from the direction. */
    "vec3 room(vec2 frag){",
    "  vec2 o = res * 0.5;",
    "  vec2 q = vec2(frag.x, res.y - frag.y);",
    "  vec2 p = o + (q - o - gxf.yz) / max(gxf.x, 0.0001);",
    "  float t = gtime;",
    "  vec2 uv = p / res;",
    "  vec3 c = skyAt(clamp(uv.y, 0.0, 1.0));",
    /* AIR. Very low frequency, very slow, and it drifts: it is the
       difference between a dark room and a switched off screen. */
    /* LOW frequency. At six cycles across the frame this read as a rendered
       concrete wall; at one and a half it reads as air with something in it,
       which is the only thing it was ever for. */
    "  float haze = fbm2(uv * vec2(1.5, 0.95) + vec2(t * 0.0055, -t * 0.0038));",
    "  c += hazeC * (haze - 0.5) * hazeA;",
    /* A FLOOR. One soft plane the objects stand on, lit from the same key,
       fading back into the air. Without it everything in the film is
       hanging in space, and nothing that hangs in space has weight. */
    "  float fl = smoothstep(floorY - 0.16, floorY + 0.34, uv.y);",
    "  c += hazeC * fl * 0.055 * (1.0 - 0.55 * smoothstep(floorY, 1.0, uv.y));",
    "  c *= 1.0 - fl * 0.10;",
    "  c += bloomAt(p, vec2(0.13,0.05), 0.50, amps.x, vec2(47.0,61.0), vec2(0.045,0.032), hue0, 0.0, t);",
    "  c += bloomAt(p, vec2(0.86,0.88), 0.46, amps.y, vec2(71.0,53.0), vec2(0.040,0.030), hue1, 1.0, t);",
    "  c += bloomAt(p, vec2(0.74,0.34), 0.34, amps.z, vec2(89.0,67.0), vec2(0.035,0.028), hue2, 2.0, t);",
    "  float hy = (0.62 + 0.035*sin(t/83.0*6.2831853)) * res.y;",
    "  float ah = (1.0 - clamp(abs(p.y - hy)/(res.y*0.16), 0.0, 1.0)) * horizA;",
    "  c += horiz * ah;",
    /*  AND THE SURFACE. This is where a direction stops being a palette. */
    /*  EVERY BRANCH TESTS BOTH ENDS.
        This was written as a chain of else-ifs on the upper bound alone --
        "else if (rtex < 2.5)" -- which is true for rtex 0. So every
        direction that asked for NO surface at all got the leather grain,
        including the long film, whose room I then spent a while blaming on
        the haze. A texture nobody asked for is the same bug as a texture in
        the wrong place, and it was one missing lower bound. */
    "  if (rtex > 0.5 && rtex < 1.5) {",
    /* PAPER. Two crossed fibre fields at right angles -- which is how a
       sheet is actually made -- plus a very large, very shallow undulation,
       because a sheet of paper is never flat. */
    "    float fib = n2(p * vec2(1.9, 0.28)) * 0.5 + n2(p * vec2(0.28, 1.9) + 31.0) * 0.5;",
    "    c *= 0.955 + 0.090 * fib;",
    "    c *= 0.975 + 0.050 * fbm2(p * 0.010);",
    "  } else if (rtex > 1.5 && rtex < 2.5) {",
    /* LEATHER. The same pebble relief as the objects, at the scale of a
       wall rather than a spine, and lit rather than merely tinted. */
    "    float g = fbm2(p * 0.030) * 0.60 + n2(p * 0.28) * 0.40;",
    "    c *= 0.66 + 0.64 * g;",
    "    float dh = (n2(p * 0.28 + vec2(0.9, 0.0)) - n2(p * 0.28)) * 5.0;",
    "    c += hazeC * clamp(dh, 0.0, 1.0) * 0.10;",
    "  } else if (rtex > 2.5 && rtex < 3.5) {",
    /* FLAT. No gradient at all: the ground is a set of hard bands, which is
       the only honest ground for a direction that refuses shading. */
    "    float k = floor(uv.y * 6.0) / 5.0;",
    "    c = mix(sky1, sky3, k) + horiz * step(0.995, fract(uv.y * 6.0)) * 0.55;",
    "  } else if (rtex > 3.5 && rtex < 4.5) {",
    /* FOLDED. Large facets meeting at hard creases, lit as planes: the room
       itself is a folded sheet. */
    "    float w = 0.168;",
    "    float fx = fract(uv.x / w), col = floor(uv.x / w);",
    "    float face = mix(0.86, 1.16, mod(col, 2.0));",
    "    float slope = mix(0.90, 1.10, abs(fx - 0.5) * 2.0);",
    "    c *= face * slope;",
    "    c += horiz * smoothstep(0.986, 1.0, max(fx, 1.0 - fx)) * 0.22;",
    "  }",
    "  return c;",
    "}",
    /* the lens, not a layer: an ellipse 74 by 66 per cent of the frame,
       centred a little above the middle, exactly the CSS it replaces */
    "float vign(vec2 frag){",
    "  vec2 q = vec2(frag.x, res.y - frag.y);",
    "  vec2 d = vec2((q.x - 0.5*res.x)/(0.74*res.x), (q.y - 0.46*res.y)/(0.66*res.y));",
    "  float r = length(d);",
    "  float a = r < 0.42 ? 0.0 : (r < 0.76 ? 0.38*(r-0.42)/0.34 : min(0.76, 0.38 + 0.38*(r-0.76)/0.24));",
    "  return 1.0 - a * vigamt;",
    "}",
    /* ---- THE SUBSTRATE ---------------------------------------------------
       WHITE NOISE IS NOT A TEXTURE, IT IS STATIC.
       The first grain here was one random value per pixel off a sin hash.
       Two things were wrong with it. A sin based hash is not random, it is a
       very high frequency sine sampled on a lattice, and at some scales it
       lays down faint diagonal moire that the eye reads as a pattern; and
       even a perfect per pixel random has no structure at all, which is what
       sensor static looks like and is the opposite of what paper looks like.

       Paper is FIBROUS. It is correlated at several scales at once: single
       fibres, small clumps of fibres, and broad variation in how thickly the
       sheet was laid down. That is a fractal sum of smooth noise, not a
       random number per pixel, and it is why real paper reads as a material
       and static reads as a fault.

       So: an integer hash with no trigonometry in it, smooth value noise
       built on that hash, and four octaves summed at roughly two, five,
       twelve and twenty seven pixels. Nothing tiles, nothing is quantised to
       a grid, and no octave shares a period with another. */
    "float ihash(vec2 p){",
    "  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));",
    "  q += dot(q, q.yzx + 33.33);",
    "  return fract((q.x + q.y) * q.z);",
    "}",
    "float vnoise(vec2 p){",
    "  vec2 i = floor(p), f = fract(p);",
    "  f = f * f * (3.0 - 2.0 * f);",
    "  return mix(mix(ihash(i), ihash(i + vec2(1.0, 0.0)), f.x),",
    "             mix(ihash(i + vec2(0.0, 1.0)), ihash(i + vec2(1.0, 1.0)), f.x), f.y);",
    "}",
    "float fibre(vec2 p){",
    "  return vnoise(p * 0.476) * 0.42 + vnoise(p * 0.189) * 0.29",
    "       + vnoise(p * 0.0855) * 0.18 + vnoise(p * 0.0370) * 0.11;",
    "}",
    "void main(){",
    /* a 3x3 tent over the supersampled buffer: nine taps weighted 1-2-4,
       which resolves a 3x supersample without the ringing a box gives */
    "  vec4 b = vec4(0.0); float wsum = 0.0;",
    "  for (int j = -1; j <= 1; j++) {",
    "    for (int i = -1; i <= 1; i++) {",
    "      float wq = (i == 0 ? 2.0 : 1.0) * (j == 0 ? 2.0 : 1.0);",
    "      b += texture2D(base, v + texel * vec2(float(i), float(j))) * wq;",
    "      wsum += wq;",
    "    }",
    "  }",
    "  b /= wsum;",
    /* and where the lens could not hold it, the defocused picture takes
       over. The alpha of that buffer is the circle of confusion. */
    "  vec4 df = texture2D(dof, v);",
    "  b.rgb = mix(b.rgb, df.rgb, clamp(df.a * 1.15, 0.0, 1.0));",
    /* FIELD CURVATURE. No lens is as sharp at the corner as it is in the
       middle, and a frame that is equally sharp everywhere is the single
       loudest tell that a picture was computed rather than photographed.
       The defocused buffer is already sitting there, so the corner is
       simply mixed toward it on the fourth power of radius: nothing at
       all across the middle half of the frame, and a soft edge only
       where a real lens gives one. */
    "  vec2 rc = (v - 0.5) * vec2(2.0, 2.0);",
    "  float rr = dot(rc, rc);",
    "  b.rgb = mix(b.rgb, df.rgb, clamp(rr * rr * softA, 0.0, 0.42));",
    /* A BLUR CONSERVES ENERGY, WHICH IS WHY ONE BLUR IS NOT A BLOOM.
       Spreading a bright pixel over a hundred times the area divides its peak
       by a hundred, so a single wide Gaussian comes back as a stain you can
       barely see -- which is exactly what the bloom buffer looked like when I
       finally rendered it on its own. Real glare is not one falloff, it is
       several at once: a tight core around the source and a wide veil in the
       air. Two scales, summed, at a gain that puts the light back. */
    /* THE VEIL IS WARMER THAN THE CORE.
       A real lens does not scatter every wavelength equally: the wide halo
       around a light runs warmer than the light inside it, which is why a
       bloom that is one flat colour reads as a filter and a bloom that shifts
       reads as glass. The tight core keeps the object's own colour; the wide
       veil is pushed a few per cent toward the gold end. */
    "  vec3 bcore = texture2D(bloom, v).rgb;",
    /* GOLD, NOT BRONZE.
       The wide veil was pushed hard toward the warm end on the theory that a
       real lens scatters long wavelengths further. It does, but a six per cent
       lift on red against a fourteen per cent cut on blue is not a lens, it is
       a sepia filter, and over a gold that is already warm it comes out as
       orange bronze. The shift stays, at a quarter of the strength, which
       reads as glass rather than as a colour grade. */
    "  vec3 bveil = texture2D(bloom2, v).rgb * vec3(1.015, 1.0, 0.965);",
    "  vec3 g = (bcore + bveil * wide) * amt;",
    "  vec3 c = filmic((b.rgb + g) * exposure);",
        /* THE COVERAGE IS THE LIGHT, NOT THE ALPHA CHANNEL.
       Every additive material on this layer writes alpha as well as colour,
       and three.js's additive blend ACCUMULATES it: a shell whose colour has
       faded to nothing still leaves a4 behind. Composited over the room, that
       is a black disc where the object used to be -- which is exactly what
       appeared for a third of a second at the head of every beat, on the orb,
       on the rings and on the cards.
       Everything in this layer is light on black. So how much of a pixel is
       covered IS how much light is in it, and reading coverage off the
       luminance cannot go wrong the way an accumulated alpha can. */
    /*  TWO WAYS TO KNOW HOW MUCH OF A PIXEL IS COVERED.
        When the layer is light on black, coverage IS luminance: a dim pixel
        is a pixel with little light in it, and reading the alpha channel of
        an additively blended buffer gives nonsense. When the layer is FLAT
        VECTOR ART -- opaque shapes with real edges -- luminance is exactly
        the wrong answer: a dark blue shape would come out half transparent
        and the room would show through it. There the alpha channel is the
        truth, antialiased for free by the supersample. */
    "  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));",
    "  float lc = clamp(lum * 2.4 + dot(g, vec3(0.35)), 0.0, 1.0);",
    "  float cov = mix(lc, clamp(max(lc, b.a), 0.0, 1.0), covmode);",
    /* THE ROOM IS DRAWN HERE NOW, AND SO IS THE VIGNETTE.
       Both used to be eight bit gradients elsewhere on the page -- one a 2D
       canvas, one a CSS radial -- and a browser cannot paint an eight bit
       gradient without dithering it. Two dithers, laid over each other,
       under a third from the canvas being scaled, is the fine weave that
       reads as interlacing. There is now ONE picture: the room, the light,
       the bloom and the vignette are composited here in float, tone mapped
       once, and quantised once at the end with a proper triangular dither.
       Nothing between this line and the screenshot touches eight bits. */
    "  vec3 gnd = room(gl_FragCoord.xy);",
    "  vec3 outc = c * cov + gnd * (1.0 - cov);",
    /* INK IS THE SAME PICTURE READ BACKWARDS.
       In ink mode the light layer is not added to a dark room, it is
       SUBTRACTED from a lit page: how much light a pixel carries becomes how
       much pigment is in it. Every figure, every camera move, every spring
       is unchanged; only the reading of the result changes, which is why one
       line here buys a whole visual direction and not a filter. */
    "  if (mode > 0.5) {",
    "    float ink = clamp(dot(c * cov, vec3(0.36, 0.44, 0.20)) * inkK, 0.0, 1.0);",
    "    outc = mix(paper + gnd * 0.55, inkc, ink);",
    "  }",
    /* HALATION. On real film the brightest light goes straight through
       the emulsion, reflects off the back of the base and returns as a
       warm ring around the source. It is why a lamp in a dark room on
       film has an orange bloom in the shadow around it and a lamp in a
       render does not. The wide veil is already the light that scattered;
       this puts a red weighted part of it back INTO THE DARK ONLY, so a
       gold figure bleeds into the room instead of sitting on top of it.
       Gated on darkness, which is what makes it a halo and not a wash. */
    "  float dk = 1.0 - smoothstep(0.05, 0.55, dot(outc, vec3(0.2126, 0.7152, 0.0722)));",
    "  outc += bveil * vec3(1.00, 0.42, 0.16) * haloA * dk;",
    "  outc *= vign(gl_FragCoord.xy);",
    /* GRAIN, AND WHY IT IS NOT THE DITHER.
       The line below this used to be the whole story: a triangular dither
       half a level deep, whose entire job is to break up banding and be
       invisible. It does that job and it stays. But invisible is the
       opposite of what the picture needed. Silver halide is a physical
       grain and the image is BUILT out of it, so every part of a
       photograph shares one noise floor. Give a computed frame the same
       floor and the flat vector shapes stop being stickers on a gradient,
       because now the shape and the room behind it are made of the same
       material.

       Three things make it read as grain rather than as video noise:

       IT LIVES IN THE MIDS. Film grain is barely present in a clean black
       and is crushed out of a blown highlight; it peaks in the mid
       shadows. Weighting by pow(lum, 0.38) * (1 - 0.72 * lum) puts it
       where the emulsion actually puts it, which also means the deep
       background stays clean instead of crawling.

       IT IS MOSTLY, NOT ENTIRELY, MONOCHROME. Colour film has three
       emulsion layers whose grain is uncorrelated, so the noise carries a
       little chroma. All-monochrome reads as an overlay; a fifth of the
       amplitude in chroma reads as stock.

       IT IS FIXED TO THE FRAME AND NEW EVERY FRAME. Grain does not track
       objects, it belongs to the film the frame was exposed on, so it is
       computed in screen space off gl_FragCoord and reseeded from gtime.
       That is the opposite of the surface noise warning further up this
       file: procedural grain fixed to a MOVING OBJECT swims and is worse
       than none, procedural grain fixed to the FRAME is what film is. */
    /* NOT gl_ ANYTHING. Every identifier beginning gl_ is reserved in
       GLSL, so naming this one gl_ failed the whole shader to compile
       and every frame came back black. It is worth knowing that a dead
       compositor looks exactly like a dead render. */
    "  float glum = clamp(dot(outc, vec3(0.2126, 0.7152, 0.0722)), 0.0, 1.0);",
    /* THE WEIGHTING HAS A FLOOR, AND THAT IS THE WHOLE POINT.
       The first cut weighted grain by pow(lum, 0.38) * (1 - 0.72 lum), which
       is the honest curve for where an emulsion is densest, and it was wrong
       for THIS picture. Measured off a 1080 still: 1.24 levels of noise on
       the dark ground against roughly seven on the lit shapes. A film that is
       nine tenths deep shadow had texture on the tenth that was not, so the
       figure was textured and the room it sat in was glass, which is a better
       description of a sticker than of a photograph. Grain belongs to the
       MATERIAL, not to the subject, and a real shadow is the grainiest part
       of a frame, not the cleanest. */
    "  float gw = 0.40 + 1.35 * glum * (1.0 - glum);",
    /* TWO LAYERS, BECAUSE THEY ARE TWO DIFFERENT THINGS.

       THE SHEET does not move. It is the substrate the whole picture is laid
       on, so it is fixed to the frame and identical on every frame, exactly
       as the tooth of a sheet of paper is. It is applied MULTIPLICATIVELY,
       because that is what an uneven surface does to light: it does not add
       anything, it varies how much comes back. A sheet that shimmered frame
       to frame would not be a sheet, it would be a fault.

       THE GRAIN does move, and it is new on every frame, because it is the
       exposure and not the paper. It is additive and fine, and it is what
       keeps the picture alive rather than laminated.

       Together they are the one material every element in the frame is made
       of, which is the whole reason they are here: a vector figure and a
       gradient behind it stop being two objects once they are both printed
       on the same sheet. */
    "  float sheet = fibre(gl_FragCoord.xy) - 0.50;",
    "  outc *= 1.0 + sheet * 2.35 * paperA;",
    /* a new offset each frame, drawn from the hash rather than added to the
       coordinate, so the field is decorrelated frame to frame without the
       coordinates growing large enough to cost the hash its precision */
    "  float fr = floor(gtime * 60.0 + 0.5);",
    "  vec2 joff = vec2(ihash(vec2(fr, 7.31)), ihash(vec2(fr, 19.07))) * 384.0;",
    "  float gn = vnoise((gl_FragCoord.xy + joff) * 0.62)",
    "           + vnoise((gl_FragCoord.xy + joff) * 0.27) * 0.5 - 0.75;",
    "  float gc = vnoise((gl_FragCoord.xy + joff.yx) * 0.62) - 0.5;",
    /* colour film has three emulsion layers whose grain does not correlate,
       so a fifth of the amplitude goes into chroma. All monochrome reads as
       an overlay laid on top; a little chroma reads as the stock itself. */
    "  outc += (vec3(gn) + vec3(gc, -gc * 0.6, gc * 0.35) * 0.22) * grainA * gw * 1.9;",
    /* TPDF, half a level either way: the sum of two uniforms is the dither
       that removes the step without the noise changing loudness with the
       signal, and half a level is below anything an eye can find. It is doing
       a different job from everything above: that is the picture, this is the
       quantiser. */
    "  float n1 = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);",
    "  float n2 = fract(sin(dot(gl_FragCoord.xy + 41.7, vec2(39.3468, 11.1357))) * 24634.6345);",
    "  outc += (n1 + n2 - 1.0) * 0.5 / 255.0;",
    "  gl_FragColor = vec4(outc, 1.0);",
    "}"
  ].join("\n");

  var QUAD_VERT = "varying vec2 v; void main(){ v = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";

  function size() {
    if (!canvas) {
      canvas = document.getElementById("lume");
      if (!canvas) return;
      /* OPAQUE, AND ON THE BIG GPU.
         The layer used to be transparent and composited over a 2D canvas
         holding the room. The room is inside the shader now, so this canvas
         IS the picture and has nothing to blend with. "low-power" was right
         for a runner that had no GPU at all; on an M4 it asks for the
         efficiency path on purpose, which is the opposite of the point. */
      renderer = new T.WebGLRenderer({ canvas: canvas, antialias: false, alpha: false, powerPreference: "high-performance" });
      renderer.setPixelRatio(1);
      renderer.autoClear = false;
      scene = new T.Scene();
      cam = new T.PerspectiveCamera(38, 16 / 9, 0.1, 200);

      quadCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      blurMat = new T.ShaderMaterial({
        uniforms: { tex: { value: null }, dir: { value: new T.Vector2(1, 0) },
                    res: { value: new T.Vector2(1, 1) }, spread: { value: 1.0 } },
        vertexShader: QUAD_VERT, fragmentShader: BLUR_FRAG, depthTest: false, depthWrite: false
      });
      dofMat = new T.ShaderMaterial({
        uniforms: { tex: { value: null }, dep: { value: null },
                    texel: { value: new T.Vector2(1, 1) },
                    near: { value: 0.1 }, far: { value: 200 },
                    focus: { value: 8.0 }, aperture: { value: 0.55 }, maxR: { value: 16.0 },
                    tiltY: { value: 0.52 }, tiltBand: { value: 0.30 },
                    tiltSoft: { value: 0.26 }, tiltAmt: { value: 0.0 } },
        vertexShader: QUAD_VERT, fragmentShader: DOF_FRAG, depthTest: false, depthWrite: false
      });
      cutMat = new T.ShaderMaterial({
        uniforms: { tex: { value: null }, cut: { value: 0.57 }, knee: { value: 0.20 } },
        vertexShader: QUAD_VERT, fragmentShader: CUT_FRAG, depthTest: false, depthWrite: false
      });
      comboMat = new T.ShaderMaterial({
        uniforms: { base: { value: null }, bloom: { value: null }, bloom2: { value: null },
                    amt: { value: 5.8 }, wide: { value: 1.05 },
                    exposure: { value: 0.98 }, texel: { value: new T.Vector2(1, 1) },
                    res: { value: new T.Vector2(1, 1) }, gtime: { value: 0 },
                    gxf: { value: new T.Vector3(1, 0, 0) }, vigamt: { value: 1.0 },
                    sky0: { value: new T.Vector3() }, sky1: { value: new T.Vector3() },
                    sky2: { value: new T.Vector3() }, sky3: { value: new T.Vector3() },
                    hue0: { value: new T.Vector3() }, hue1: { value: new T.Vector3() },
                    hue2: { value: new T.Vector3() }, amps: { value: new T.Vector3() },
                    horiz: { value: new T.Vector3() }, horizA: { value: 0.052 },
                    dof: { value: null }, covmode: { value: 0 },
                    rtex: { value: 0 }, hazeC: { value: new T.Vector3(1, 1, 1) },
                    hazeA: { value: 0.02 }, floorY: { value: 0.72 },
                    mode: { value: 0 }, paper: { value: new T.Vector3() },
                    inkc: { value: new T.Vector3() }, inkK: { value: 1.6 },
                    /* the stock. A theme may set its own; these are the default
                       exposure of it, arrived at by rendering and looking. */
                    grainA: { value: 0.030 }, haloA: { value: 0.110 }, paperA: { value: 0.055 },
                    softA: { value: 0.30 } },
        vertexShader: QUAD_VERT, fragmentShader: COMBO_FRAG,
        depthTest: false, depthWrite: false, transparent: true
      });
      showMat = new T.ShaderMaterial({
        uniforms: { tex: { value: null } }, vertexShader: QUAD_VERT,
        fragmentShader: "varying vec2 v; uniform sampler2D tex;" +
          "void main(){ gl_FragColor = vec4(texture2D(tex, v).rgb, 1.0); }",
        depthTest: false, depthWrite: false
      });
      quadScene = new T.Scene();
      quadScene.add(new T.Mesh(new T.PlaneGeometry(2, 2), blurMat));
      setTheme(THEME);
    }
    /* THE CANVAS IS EXACTLY THE FRAME. THE BUFFER BEHIND IT IS BIGGER.
       Measured: what costs the render is not drawing the scene -- that is 4
       to 8 ms whatever size it is -- it is the browser compositing the canvas
       ELEMENT and reading the page back as a picture, and that cost follows
       the canvas's size on the page and nothing else:

           canvas 1190x669   draw 8 ms   photograph 126 ms
           canvas 1920x1080  draw 6 ms   photograph 206 ms
           canvas 2880x1620  draw 7 ms   photograph 331 ms
           canvas 3840x2160  draw 4 ms   photograph 489 ms

       So the supersampling happens where it is free: in an offscreen buffer,
       resolved down by the shader that already composites the bloom. The page
       only ever sees a canvas the size of the frame. */
    W = window.innerWidth; H = window.innerHeight;
    renderer.setSize(W, H, false);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    cam.aspect = W / H; cam.updateProjectionMatrix();
    makeTargets();
  }

  /* ---- the shot ---------------------------------------------------------
     stage.js moves the WORDS with a CSS transform, which is a zoom: every
     pixel of the layer scales by the same amount. A camera does not do that.
     A camera that walks toward a scene changes what is hidden behind what,
     and the near thing grows faster than the far one -- and that difference
     is the only reason a shot feels like it was filmed rather than resized.

     So this layer answers the same shot names with a real dolly on a real
     perspective camera, and the words keep the CSS move. The two agree in
     direction and disagree in kind, which is exactly right: type is flat, and
     the world is not. */
  /* A CAMERA HAS A POSITION, A TARGET, A ROLL AND A LENS.
     The first cut had a z number that got smaller. That is a dolly and
     nothing else: the frame never tilts, the subject never sits off the
     axis, the lens never changes, and every beat is photographed from the
     same seat. It reads as a slideshow that zooms.

     A shot here moves the camera from one place to another WHILE moving what
     it is pointed at, rolls the horizon by a fraction of a degree, and
     changes the focal length as it goes. Those four together are what makes a
     move feel authored rather than applied -- a crane that rises and levels
     off is a different sentence from a dolly that pushes in, and a beat
     should be given the one that says what it means.

     Every shot also breathes: a slow, smooth, time-driven float of a few
     centimetres, which is what a camera on a human being does even when it is
     locked off. It is a sum of sines, so it is still a pure function of time
     and two renders are still identical.

       approach   walks in and settles          a thing being examined
       withdraw   pulls back and lets go        a thing being left
       reveal     cranes up from below          a thing being disclosed
       descend    comes down onto the subject   a thing being arrived at
       orbit      crosses laterally             a thing with sides, depth
       drift      the slow lateral hold         a thing being watched
       hold       locked off                    a thing that needs no help
     push and pull are kept as the names the older scenes already use.        */
  /* AND A MOVE THAT IS TOO POLITE IS THE SAME AS NO MOVE.
     The first table was correct and timid: every shot sat between six and
     eight units out at thirty eight degrees, so however the camera travelled,
     the subject stayed the same size in the middle of a large dark frame. The
     figure read as a diagram on a slide because it was composed like one.
     These shots start wide and finish LONG -- the focal length climbs by a
     third across a push, which is a lens compressing, not a zoom -- and they
     finish close enough that the subject has to be cropped by the frame,
     which is the whole difference between a shot and a view. */
  var SHOT = {
    approach: { p0: [ 0.55, -0.42,  9.4], p1: [ 0.02,  0.18, 5.10],
                t0: [ 0.16, -0.16,  0  ], t1: [ 0,     0,    0  ],
                roll: [ 0.022, 0.001], fov: [ 46, 31 ], ease: "outQuint" },
    withdraw: { p0: [-0.12,  0.14,  4.9], p1: [ 0.30, -0.20, 9.1 ],
                t0: [ 0,     0.07,  0  ], t1: [-0.12, -0.03, 0  ],
                roll: [-0.016, 0.005], fov: [ 32, 44 ], ease: "outQuint" },
    reveal:   { p0: [ 0.08, -3.05,  6.2], p1: [-0.06,  0.58, 6.9 ],
                t0: [ 0,    -1.55,  0  ], t1: [ 0,     0.08, 0  ],
                roll: [ 0.034, 0    ], fov: [ 52, 33 ], ease: "open" },
    descend:  { p0: [-0.30,  3.05,  7.8], p1: [ 0.08, -0.30, 5.80],
                t0: [ 0,     1.15,  0  ], t1: [ 0,     0,    0  ],
                roll: [-0.027, 0.002], fov: [ 44, 34 ], ease: "outQuint" },
    orbit:    { p0: [-2.35,  0.72,  7.1], p1: [ 2.35,  0.10, 6.10],
                t0: [-0.10,  0.06,  0  ], t1: [ 0.10, -0.03, 0  ],
                roll: [ 0.024, -0.024], fov: [ 41, 35 ], ease: "inOutQuad" },
    drift:    { p0: [-1.25,  0.24,  7.0], p1: [ 1.25, -0.10, 6.1 ],
                t0: [-0.22,  0,     0  ], t1: [ 0.22,  0,    0  ],
                roll: [ 0.011, -0.011], fov: [ 39, 36 ], ease: "linear" },
    hold:     { p0: [ 0,     0.06,  7.1], p1: [ 0,     0.02, 6.6 ],
                t0: [ 0,     0,     0  ], t1: [ 0,     0,    0  ],
                roll: [ 0.004, -0.004], fov: [ 38, 37 ], ease: "linear" }
,
    /* A DIAGRAM IS READ, AND READING NEEDS THE WHOLE OF IT IN FRAME.
       Every other shot here finishes close: approach ends at 5.1 units on a
       31 degree lens, which is five world units of picture, and the diagram
       plate is 7.7 wide. So a chart given one of those shots has its axis
       walked off the side of the frame while the viewer is still reading the
       first label. This one stays back far enough to hold the plate whole,
       moves barely at all, and never moves sideways: a slow lean in, which is
       what a person does when they are looking at something carefully. */
    study:    { p0: [ 0,     0.02,  7.55], p1: [ 0,    0.01, 6.95],
                t0: [ 0,     0,     0   ], t1: [ 0,    0,    0   ],
                roll: [ 0.003, -0.002], fov: [ 38, 36 ], ease: "inOutQuad" }
  };
  SHOT.push = SHOT.approach;
  SHOT["in"] = SHOT.reveal;
  SHOT.pull = SHOT.withdraw;

  /* WHAT THE CLOSEST SHOT CAN HOLD.
     Every figure below is sized against these, not guessed. The tightest
     shot in the table finishes at 5.1 units on a 31 degree lens, which is
     1.41 units of world from the middle of the frame to its top edge and
     2.51 to its side; in 9:16 the same shot sits 16% further back on the
     same vertical field, which is 1.64 up and 0.92 across. A figure that
     wants to be seen whole has to fit inside those, and it has to leave the
     bottom fifth alone, because that is where the caption is set. */
  var CAMP = new T.Vector3(), CAMT = new T.Vector3();

  function shotAt(name, u, tsec) {
    var s = SHOT[name] || SHOT.hold;
    var k = ease(s.ease, u);
    /* the breath: two slow sines per axis, a few centimetres, never repeating
       on the same period, so it never reads as a loop */
    var bx = wander(tsec, 11) * 0.034;
    var by = wander(tsec, 23) * 0.029;
    var bz = wander(tsec, 37) * 0.031;
    /* portrait has less room sideways and wants a little more distance */
    var lat = PORTRAIT ? 0.52 : 1, zk = PORTRAIT ? 1.16 : 1;
    CAMP.set((lerp(s.p0[0], s.p1[0], k) + bx) * lat,
              lerp(s.p0[1], s.p1[1], k) + by,
             (lerp(s.p0[2], s.p1[2], k) + bz) * zk);
    CAMT.set((lerp(s.t0[0], s.t1[0], k) + bx * 0.35) * lat,
              lerp(s.t0[1], s.t1[1], k) + by * 0.35,
              lerp(s.t0[2], s.t1[2], k));
    cam.position.copy(CAMP);
    cam.lookAt(CAMT);
    /* lookAt levels the horizon; the roll goes on after it */
    cam.rotateZ(lerp(s.roll[0], s.roll[1], k) + wander(tsec, 53) * 0.0028);
    var f = lerp(s.fov[0], s.fov[1], k);
    if (Math.abs(cam.fov - f) > 0.001) { cam.fov = f; cam.updateProjectionMatrix(); }
  }

  /* ---- the air in the room ----------------------------------------------
     THE SPACE HAS TO HAVE SOMETHING IN IT.
     Every figure so far hangs in a perfect void, and a perfect void has no
     scale, no depth and no motion: a camera moving through nothing looks like
     a figure being animated. A field of dust does three jobs at once for
     almost nothing -- it gives the move parallax, it gives the light
     somewhere to land, and it tells you the room is a room. It is built once
     and re-hung with each chapter, because mounting empties the scene.     */
  var dust = null;
  /*  DUST BELONGS BEHIND THE SUBJECT, NOT IN FRONT OF THE LENS.
      Eleven hundred motes were scattered through a box twenty four units
      deep with the camera INSIDE it, and a sizeAttenuated point two units
      from the lens is not a mote, it is a soft blob a fiftieth of the frame
      across. Those are the lumps of light that were sitting on the path: not
      residue from the light that traced it, but dust between it and you.
      A cinematographer would not light it and would not shoot through it.
      The field now begins four units behind the plane the figures stand in
      and runs back from there, which is the only place dust does its job --
      giving the eye something to measure the depth against. */
  function makeDust() {
    /* THE FLAT LANGUAGE BRINGS ITS OWN DEPTH.
       Volumetric dust is a photographic idea: it says "there is air between
       you and the subject". In flat vector there is no air, and eight
       hundred sub-pixel specks over a solid colour field read as sensor
       noise on a poster. The planes do that job there instead. */
    if (LAYOUT_OF === "nut") return null;
    /* A SCENE FIGURE STANDS IN A ROOM, NOT A CORRIDOR (round two finding 7).
       This field was sized for a twenty two unit deep corridor with the
       camera passing through it; a scene's wider horizontal lens now
       brings the whole box into frame at once on the head on beats, so
       the same eight hundred points that used to read as a thin haze
       receding behind a figure instead filled the room with gold motes
       everywhere. A quarter of the count and a quarter of the brightness
       (round two) still left points scattered far past the room's own
       walls, out where this theme's lens (focus 7.4) throws them well out
       of focus; on s7's own lens they bloomed into a handful of huge soft
       blobs that dominated the frame (round three finding 3), which no
       amount of thinning fixes on its own, because a single badly
       defocused point is still a large blob. This field was built for a
       corridor the camera walks along, not a sealed room the camera
       stands inside with a wall a few units off in every direction, so a
       scene figure drops it entirely rather than pretend a quarter count
       still belongs here; every corridor film keeps exactly what it
       had. */
    var sceneMode = PACE === "glide";
    if (sceneMode) return null;
    var n = 800, pos = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) {
      pos[i * 3]     = (hash(i, 101) - 0.5) * 34;
      pos[i * 3 + 1] = (hash(i, 103) - 0.5) * 20;
      pos[i * 3 + 2] = -4.0 - hash(i, 107) * 22.0;
    }
    var dg = new T.BufferGeometry();
    dg.setAttribute("position", new T.BufferAttribute(pos, 3));
    return new T.Points(dg, new T.PointsMaterial({
      color: C.pale.clone(), size: 0.062, map: dotTex(), transparent: true,
      opacity: 0.26, blending: T.AdditiveBlending, depthWrite: false,
      sizeAttenuation: true
    }));
  }


  /* =======================================================================
     FIVE WAYS TO LIGHT THE SAME ARGUMENT
     =======================================================================
     Everything above this line is the film: the figures, the springs, the
     camera, the Lantern. None of it changes between the five directions, and
     that is the point of testing them this way -- if the content moved as
     well, the comparison would tell us nothing about the look.

     What a direction is, then, is a small set of numbers: the four stops of
     the sky, the three lights in the room and how strong each is, how hard
     the lens vignettes, how much bloom, and the palette the objects
     themselves are made of. Plus one switch, mode, which decides whether the
     light layer is added to a dark room or subtracted from a lit page.

     They are written here rather than in the film descriptions so that a
     direction, once chosen, is one word in every film that follows. */
  var THEMES = {

    /* 1 · LUMEN -- light itself, in a dark room.
       The house look, but the room is a room now: air with structure in it
       and a floor to stand on. Objects are emissive and bloom. A fast lens
       wide open, so the far end of the field goes to bokeh. */
    night: {
      mode: 0, mat: "lumen", layout: "run", rtex: 0,
      sky: [0x050912, 0x0C1630, 0x081026, 0x040810],
      hues: [0xECCB70, 0x6084D0, 0xD6A65E], amps: [0.400, 0.130, 0.055],
      horiz: 0xE9C86A, horizA: 0.055,
      haze: 0x9FB4E0, hazeA: 0.022, floorY: 0.76,
      vig: 0.72, exposure: 0.98, bloom: 5.8, wide: 1.05,
      lens: { focus: 7.4, aperture: 0.80, maxR: 20.0, tiltAmt: 0.0 },
      pal: { gold: 0xC9A227, goldhi: 0xE9C86A, pale: 0xF4E2AE, parch: 0xFFFEF7, cool: 0x6C8FD6 }
    },

    /* 2 · PRESS -- letterpress on damp paper.
       The light layer is subtracted from a lit page instead of added to a
       dark room, the room is a sheet with crossed fibre in it, and it is
       shot from above on a table with a tilt-shift, which is how a printed
       plate is actually photographed. */
    ink: {
      acov: true, mode: 1, mat: "press", layout: "run", rtex: 1,
      sky: [0x171006, 0x1F160A, 0x1A1207, 0x150F06],
      hues: [0xFFE9B4, 0xB9A277, 0xE8CE96], amps: [0.150, 0.060, 0.035],
      horiz: 0xE8D5A6, horizA: 0.022,
      haze: 0xC8B48A, hazeA: 0.026, floorY: 0.84,
      vig: 0.42, exposure: 1.02, bloom: 0.9, wide: 0.80,
      paper: 0xEFE4CC, ink: 0x2A1D0E, inkK: 2.05,
      lens: { focus: 8.0, aperture: 0.30, maxR: 13.0,
              tiltAmt: 0.85, tiltY: 0.46, tiltBand: 0.16, tiltSoft: 0.26 },
      pal: { gold: 0xC9A227, goldhi: 0xE9C86A, pale: 0xFFF6DC, parch: 0xFFFEF7, cool: 0x8A6A3A }
    },

    /* 3 · LEATHER -- tooled hide and gold foil, on a dial.
       A bound cover under one raking lamp. The grain is relief, not paint:
       every pebble has a lit side, and the wall changes as the key drifts.
       The arrangement is a fan, because a dial is what an instrument bound
       in leather carries. The widest aperture of the five, so the foil
       highlights go to real bokeh discs. */
    orrery: {
      acov: true, mode: 0, mat: "leather", layout: "fan", rtex: 2,
      sky: [0x160C08, 0x2A150E, 0x1C0F09, 0x120906],
      hues: [0xE2B266, 0x6A3A28, 0xC08A50], amps: [0.340, 0.120, 0.070],
      horiz: 0xC9A76A, horizA: 0.040,
      haze: 0xE0B888, hazeA: 0.045, floorY: 0.70,
      vig: 1.05, exposure: 1.04, bloom: 1.7, wide: 0.76,
      lens: { focus: 7.0, aperture: 1.15, maxR: 26.0, tiltAmt: 0.0 },
      pal: { gold: 0x8A5A22, goldhi: 0xE7BE72, pale: 0xFBEAC4, parch: 0xFFFEF7, cool: 0xB07A3C }
    },

    /* 4 · FLAT -- vector, printed, deliberate.
       No lighting, no gradient, no bloom, no depth of field: this direction
       refuses every one of them on purpose, and what is left has to be
       carried by colour, shape and spacing alone. A hundred and fourteen
       small multiples on a banded ground. If a layout works here it works
       anywhere, because there is nothing to hide behind. */
    girih: {
      acov: true, mode: 0, mat: "flat", layout: "grid", rtex: 3,
      sky: [0x0B1A3C, 0x14275A, 0x0E1D44, 0x081430],
      hues: [0xF0D486, 0x2F5FB8, 0x5C86C8], amps: [0.120, 0.100, 0.060],
      horiz: 0xF0D486, horizA: 0.050,
      haze: 0x2F5FB8, hazeA: 0.010, floorY: 0.90,
      vig: 0.22, exposure: 1.06, bloom: 1.2, wide: 0.40,
      lens: { focus: 8.0, aperture: 0.06, maxR: 6.0, tiltAmt: 0.0 },
      pal: { gold: 0xE8B93A, goldhi: 0xF6E7A8, pale: 0xFFF3CE, parch: 0xFFFEF7, cool: 0x3FA6D8 }
    },

    /* 5 · ORIGAMI -- a folded paper model, lit and photographed.
       The room is itself a folded sheet; the objects are folded sheets; the
       shading is quantised into facets, because a fold is a discontinuity
       and a gradient cannot say "crease". The arrangement is pleated, so
       there is real depth in the field, and the lens is tilted hard, which
       is the trick that makes a real thing look like a model -- used here on
       a model, which makes it look real. */
    relief: {
      acov: true, mode: 0, mat: "origami", layout: "folds", rtex: 4,
      sky: [0x0E0B09, 0x171310, 0x100D0B, 0x080706],
      hues: [0xFFEBC4, 0x7A7A86, 0xC8B79A], amps: [0.300, 0.070, 0.055],
      horiz: 0xEADCC0, horizA: 0.022,
      haze: 0xEADCC0, hazeA: 0.026, floorY: 0.74,
      vig: 1.15, exposure: 1.00, bloom: 1.3, wide: 0.86,
      lens: { focus: 7.6, aperture: 0.62, maxR: 22.0,
              tiltAmt: 0.62, tiltY: 0.44, tiltBand: 0.15, tiltSoft: 0.24 },
      pal: { gold: 0xE4D7BC, goldhi: 0xFFF6E4, pale: 0xFFFBF2, parch: 0xFFFEF7, cool: 0xB98A62 }
    }
,
    /*  6, 7, 8 · IN A NUTSHELL -- flat vector, with a camera.
        The language the whole project is aiming at: solid shapes of colour
        on a coloured ground, no material, no shading model, nothing
        photographic. Every cinematic quality in it comes from the CAMERA --
        five planes at real distances so a lateral move gives real parallax,
        an aperture that turns the small bright shapes on the far planes into
        discs, a foreground that is never in focus, and a shutter.

        Three moods, one language. They differ in ground and palette only,
        which is the correct amount of difference INSIDE a visual language
        as opposed to between two of them. */
    /*  THE COLOUR SYSTEM, AND WHY IT IS ONE SYSTEM.
        ---------------------------------------------------------------
        Every colour below is DERIVED, in OKLCH, by tools/films/palette/
        noor_palette.py -- not picked. OKLab is perceptually uniform, so a
        step of 0.05 in lightness looks like the same size step wherever it
        is taken, which is the only way three moods can be recognisably the
        same brand rather than three palettes that happen to share a gold.

          One hue for the whole room.   Hue 266, four lightness stops, chroma
              0.048. The unevenness in the old grounds was two different cool
              hues -- an indigo bloom and a teal one -- competing on a near
              black field. A room with two hues in it does not have a colour,
              it has a stain. Everything in the room is now one hue and the
              only chroma in the frame belongs to the data.

          Two hues for the data.        Amber H82 L0.80 and teal H210 L0.62.
              Measured, not assumed: OKLab Delta E 22.4 under protanopia and
              29.5 under normal vision, against a floor of 8 and a gate of
              15. The pair it replaces -- amber against coral -- collapses
              into one brown for the eight per cent of men who are red-green
              colour blind, which on a channel is eight per cent of the
              audience told nothing.

          And they differ in LIGHTNESS as well as hue.  The first pass had
              both at L 0.78, which is a 1.01:1 luminance ratio: identical in
              greyscale, so the distinction died in a thumbnail and died
              again on a phone in sunlight. At L 0.80 against 0.62 it is
              1.84:1 and survives both.

          Lightness carries the hierarchy.  Ground 0.17, secondary 0.62,
              primary 0.80, the answer 0.965. Contrast against the ground:
              10.1:1, 5.5:1 and 17.4:1. A four step ladder in lightness is
              what still reads at the 120 pixel wide thumbnail that decides
              whether anyone watches at all -- hue differences do not survive
              that size and lightness differences do.

        The three moods are the same hues at three lightness registers. Void
        is the one to lead with: the highest figure-to-ground contrast of the
        three, which is the single measurable property that correlates with a
        thumbnail being noticed in a grid of other thumbnails. */

    /* VOID -- deep indigo, the highest contrast, the default */
    nutvoid: {
      acov: true, mode: 0, mat: "lumen", layout: "nut", rtex: 0,
      sky: [0x060E24, 0x121B33, 0x0B142B, 0x03081D],
      hues: [0x3A4C76, 0x27365C, 0x62502A], amps: [0.200, 0.110, 0.050],
      horiz: 0x3A4C76, horizA: 0.018,
      haze: 0x3A4C76, hazeA: 0.008, floorY: 0.95,
      vig: 0.85, exposure: 1.00, bloom: 1.05, wide: 0.70,
      lens: { focus: 7.4, aperture: 0.95, maxR: 28.0, tiltAmt: 0.0 },
      art: { sky: 0x060E24, base: 0xEFB229, rise: 0x0E97A9, mark: 0xFBF4DA,
             line: 0xFBF4DA, far: 0x121D38, near: 0x1E2B4B },
      pal: { gold: 0xEFB229, goldhi: 0xFBF4DA, pale: 0xFBF4DA, parch: 0xFFFEF7, cool: 0x0E97A9 }
    },

    /* NIGHT -- the same system two stops up, for pieces that are not about
       scale and want the room to be a room rather than a void */
    nutshell: {
      acov: true, mode: 0, mat: "lumen", layout: "nut", rtex: 0,
      sky: [0x18223A, 0x27324C, 0x1F2942, 0x121B33],
      hues: [0x3A4C76, 0x27365C, 0x62502A], amps: [0.160, 0.090, 0.050],
      horiz: 0x3A4C76, horizA: 0.016,
      haze: 0x3A4C76, hazeA: 0.008, floorY: 0.95,
      vig: 0.58, exposure: 1.00, bloom: 1.5, wide: 0.66,
      lens: { focus: 7.5, aperture: 0.72, maxR: 24.0, tiltAmt: 0.0 },
      art: { sky: 0x18223A, base: 0xEFB229, rise: 0x0E97A9, mark: 0xFBF4DA,
             line: 0xFBF4DA, far: 0x2C3856, near: 0x3A486A },
      pal: { gold: 0xEFB229, goldhi: 0xFBF4DA, pale: 0xFBF4DA, parch: 0xFFFEF7, cool: 0x0E97A9 }
    },

    /* DAY -- the same hues inverted onto warm paper. Note the ground hue
       changes to 84: the hue that makes a dark room read as night makes a
       light one read as a hospital. */
    nutday: {
      acov: true, mode: 0, mat: "lumen", layout: "nut", rtex: 0,
      sky: [0xF7EFE1, 0xEDE5D8, 0xF2EADD, 0xE6DFD1],
      hues: [0xFFFBF4, 0xE1D6C2, 0xFFFBF4], amps: [0.100, 0.060, 0.040],
      horiz: 0xFFFBF4, horizA: 0.020,
      haze: 0xFFFBF4, hazeA: 0.006, floorY: 0.95,
      vig: 0.30, exposure: 1.00, bloom: 0.6, wide: 0.35,
      lens: { focus: 7.6, aperture: 0.50, maxR: 20.0, tiltAmt: 0.0 },
      art: { sky: 0xF7EFE1, base: 0xA15B00, rise: 0x007687, mark: 0x3C2A13,
             line: 0x3C2A13, far: 0xF1E8D7, near: 0xEBE1CD },
      pal: { gold: 0xA15B00, goldhi: 0x6E3E00, pale: 0x3C2A13, parch: 0x3C2A13, cool: 0x007687 },
      /* a lit page is almost entirely mid tone, which is where the grain
         weighting puts its peak, so the night amount lands about twice as
         loud here. Halation is a glow into shadow and there is no shadow. */
      grain: 0.014, halo: 0.0, soft: 0.20, paper2: 0.038
    }
  };

  var THEME = "night";

  function v3(hex, out) {
    out = out || new T.Vector3();
    return out.set(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);
  }

  /* Set the direction. Must be called BEFORE the chapter is mounted: the
     figures clone their colours out of C when they are built, so changing C
     afterwards changes nothing that is already on the board. */
  function setTheme(name) {
    var t = THEMES[name] || THEMES.night;
    THEME = THEMES[name] ? name : "night";
    MAT_OF[THEME] = t.mat || "lumen";
    LAYOUT_OF = t.layout || "run";
    ART_OF = t.art || null;
    var L = t.lens || {};
    LENS.focus = L.focus === undefined ? 8.0 : L.focus;
    LENS.aperture = L.aperture === undefined ? 0.55 : L.aperture;
    LENS.maxR = L.maxR === undefined ? 16.0 : L.maxR;
    LENS.tiltAmt = L.tiltAmt === undefined ? 0.0 : L.tiltAmt;
    LENS.tiltY = L.tiltY === undefined ? 0.50 : L.tiltY;
    LENS.tiltBand = L.tiltBand === undefined ? 0.28 : L.tiltBand;
    LENS.tiltSoft = L.tiltSoft === undefined ? 0.26 : L.tiltSoft;
    document.documentElement.setAttribute("data-theme", THEME);
    var pl = t.pal || {};
    for (var k in pl) if (C[k]) C[k].setHex(pl[k]);
    if (!comboMat) return;
    var u = comboMat.uniforms;
    v3(t.sky[0], u.sky0.value); v3(t.sky[1], u.sky1.value);
    v3(t.sky[2], u.sky2.value); v3(t.sky[3], u.sky3.value);
    v3(t.hues[0], u.hue0.value); v3(t.hues[1], u.hue1.value); v3(t.hues[2], u.hue2.value);
    u.amps.value.set(t.amps[0], t.amps[1], t.amps[2]);
    v3(t.horiz, u.horiz.value); u.horizA.value = t.horizA;
    u.vigamt.value = t.vig; u.exposure.value = t.exposure;
    u.amt.value = t.bloom; u.wide.value = t.wide;
    u.mode.value = t.mode;
    u.rtex.value = t.rtex === undefined ? 0 : t.rtex;
    u.covmode.value = t.acov ? 1 : 0;
    v3(t.haze === undefined ? 0xFFFFFF : t.haze, u.hazeC.value);
    u.hazeA.value = t.hazeA === undefined ? 0.02 : t.hazeA;
    u.floorY.value = t.floorY === undefined ? 0.76 : t.floorY;
    v3(t.paper === undefined ? 0xEFE4CC : t.paper, u.paper.value);
    v3(t.ink === undefined ? 0x2A1D0E : t.ink, u.inkc.value);
    u.inkK.value = t.inkK === undefined ? 1.9 : t.inkK;
    /* THE STOCK IS PART OF THE THEME, because it has to be. A grain that
       reads correctly on a dark room is twice as loud on the day theme's
       warm paper, where the whole frame sits in the mids the grain is
       weighted toward, and halation into the dark is meaningless on a
       picture that has no dark. Any theme may name its own; these are the
       defaults for a night piece. */
    u.grainA.value = t.grain === undefined ? 0.030 : t.grain;
    u.paperA.value = t.paper2 === undefined ? 0.055 : t.paper2;
    u.haloA.value  = t.halo  === undefined ? 0.110 : t.halo;
    u.softA.value  = t.soft  === undefined ? 0.30  : t.soft;
  }


  /* =======================================================================
     THE ANNOTATION LAYER

     WHY THE WORDS MOVED OUT OF THE SUBTITLE.

     A silent short began as a headline under a picture, one per beat, and
     that is a slideshow with a diagram behind it. The picture is the
     argument; the words are supposed to name what the picture is doing at
     the moment it does it. Those are two different jobs and they want two
     different objects:

       THE KEY   says what the elements MEAN. One panel, near the figure,
                 arriving once. Without it a silent viewer has to guess why
                 some marks are gold and some are teal, and a guess is not a
                 proof.

       A CALLOUT says what is HAPPENING, next to the part that is happening,
                 while it happens. It is short, it points, and it leaves.

     Both are planes in the world rather than text laid over the finished
     frame, and that is deliberate. Everything in this film is composited
     through one lens and one film stock: bloom, halation, field curvature,
     grain. A label pasted on afterwards is the only thing in the picture
     that was not photographed, and the eye finds it immediately. Hung in the
     room at the figure's own depth, a label is lit by the same pass as the
     thing it points at.
     ===================================================================== */

  function annoCanvas(w, h) {
    var cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    var tx = new T.CanvasTexture(cv);
    tx.minFilter = T.LinearFilter; tx.magFilter = T.LinearFilter;
    tx.generateMipmaps = false;
    if (T.SRGBColorSpace) tx.colorSpace = T.SRGBColorSpace;
    var m = new T.Mesh(new T.PlaneGeometry(1, 1),
      new T.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false,
                                depthTest: false, blending: T.AdditiveBlending }));
    m.renderOrder = 3;
    m.visible = false;

    /* ---- THE SCRIM, AND WHY EVERY LABEL CARRIES ONE ----------------------
       NOTHING MAY CROSS TEXT. A callout is anchored to the part of the figure
       it is naming, so sooner or later the figure draws something exactly
       where the words are. On the balance the pivot needle ran straight down
       the middle of "More than it could take" and cut both lines in half.

       There is no depth answer to it. Everything in this world adds light to
       black, so a label cannot be in FRONT of anything: whatever is behind it
       adds straight through, whatever the render order says. Moving the label
       is not an answer either, because it is pointing at that exact spot, and
       hand tuning six anchors across fifteen shorts is work that has to be
       redone every time a word changes.

       So the label brings its own darkness. A second plane, behind the words,
       MULTIPLYING instead of adding, takes whatever is there down to about a
       fifth before the text is added over it. It is shaped like the words and
       not like a box: a heavy dark stroke and a wide soft shadow drawn from
       the same glyphs, so it reads as the light dimming around the writing
       rather than as a caption card pasted on the picture.

       The scrim canvas is filled WHITE, not cleared, and that is the whole
       trick of multiply blending: white multiplied over the frame changes
       nothing, so only the dark marks do anything. Clearing gives
       rgba(0,0,0,0), and black multiplied over the frame is a black
       rectangle, which is the same bug pointing the other way. */
    var scv = document.createElement("canvas");
    scv.width = w; scv.height = h;
    var stx = new T.CanvasTexture(scv);
    stx.minFilter = T.LinearFilter; stx.magFilter = T.LinearFilter;
    stx.generateMipmaps = false;
    var sm = new T.Mesh(new T.PlaneGeometry(1, 1),
      new T.MeshBasicMaterial({ map: stx, transparent: false, depthWrite: false,
                                depthTest: false, blending: T.MultiplyBlending }));
    sm.renderOrder = 2;
    sm.visible = false;
    var sx = scv.getContext("2d");
    sx.fillStyle = "#ffffff"; sx.fillRect(0, 0, w, h);

    return { cv: cv, cx: cv.getContext("2d"), tex: tx, mesh: m, w: w, h: h,
             scv: scv, scx: sx, stex: stx, smesh: sm };
  }

  /* one piece of text laid into the scrim: a wide soft shadow and a heavy
     stroke, both dark, drawn several times so the darkness builds around the
     glyphs and has fallen away within about thirty pixels of them */
  function scrimText(a, text, x, y, font, align, base, spread) {
    if (!text) return;
    var c = a.scx;
    c.save();
    c.font = font; c.textAlign = align; c.textBaseline = base;
    c.strokeStyle = "rgba(9,10,15,0.56)";
    c.fillStyle = "rgba(9,10,15,0.64)";
    c.lineJoin = "round"; c.lineCap = "round";
    c.shadowColor = "rgba(6,8,16,0.55)";
    for (var i = 0; i < 3; i++) {
      c.shadowBlur = spread * (1.0 - i * 0.28);
      c.lineWidth = Math.max(1, spread * (0.42 - i * 0.10));
      c.strokeText(text, x, y);
      c.fillText(text, x, y);
    }
    c.restore();
  }

  /* and the same for a leader, so the line is not cut by what it crosses */
  function scrimLine(a, x0, y0, x1, y1, spread) {
    var c = a.scx;
    c.save();
    c.strokeStyle = "rgba(9,10,15,0.44)";
    c.lineCap = "round";
    c.shadowColor = "rgba(6,8,16,0.48)";
    for (var i = 0; i < 2; i++) {
      c.shadowBlur = spread * (0.80 - i * 0.30);
      c.lineWidth = Math.max(1, spread * (0.30 - i * 0.12));
      c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    }
    c.restore();
  }

  function annoRGBA(c, a) {
    return "rgba(" + Math.round(c[0]) + "," + Math.round(c[1]) + "," +
           Math.round(c[2]) + "," + a.toFixed(3) + ")";
  }

  var _AR = new T.Vector3(), _AU = new T.Vector3(), _AP2 = new T.Vector3();
  var _AF = new T.Vector3();

  function makeAnno(spec, C) {
    var g = new T.Group();
    var GHI = [233, 200, 106], PALE = [251, 243, 220];

    /* ===================================================================
       HOW BIG A WORD IS, AND WHY IT WAS THE WRONG SIZE FIFTEEN TIMES OVER.

       Every figure in this set is composed to the SAME fraction of the
       frame: 82% of the width or 48% of the height, whichever binds. The
       way that is achieved is by standing the camera at a different
       distance for each one, from 7.18 units for the five dots to 13.75 for
       the sieve. Which means a world unit is not a constant amount of
       screen. It is 389 pixels on the dots and 203 on the sieve.

       A label written as "2.05 world units wide" is therefore 74% of the
       frame on one short and 39% on another, and its type is 54 pixels on
       one and 28 on the other. That is precisely the disproportion the
       contact sheets showed, and no amount of adjusting 2.05 fixes it,
       because there is no single number that is right for both.

       So nothing in this layer is written in world units any more. PXW is
       the screen pixels one world unit covers at the tightest point of the
       push, for THIS figure's standing distance, and every canvas is placed
       at exactly one screen pixel per canvas pixel. A 54 pixel line is 54
       pixels on the delivered frame in all fifteen. S is the same number
       the other way round, for the few places that still want a distance:
       the label bands, which have to sit the same fraction of the way up
       every frame.

           halfHeight = 0.344 * near      the closing frame, from stage.js
           PXW        = 960 / halfHeight  half of 1920, over that
           S          = near / 7.18       1 on the tightest, larger on the rest
       =================================================================== */
    var SHORTA = !!spec.near;
    var S = spec.near ? spec.near / 7.18 : 1;
    var PXW = spec.near ? 960 / (0.344 * spec.near) : 0;

    /* THE VERTICAL PLAN OF A TALL FRAME, written once, in fractions of the
       half height, so the three things that want the screen each have a
       floor and a ceiling and none of them is negotiating with the others:

           1.00 to 0.57   the words. A callout hangs its leader at 0.567 and
                          grows upward from there, and cannot reach 0.95.
           0.48 to -0.48  THE FIGURE, and nothing else is ever drawn here.
           -0.57 down     the legend, hung by its top edge so its height is
                          its own business.

       Which is also why a callout in a short always leans UP. There is one
       lower region and the legend has it. Two objects sharing the floor of
       a 9:16 frame is what put a callout on top of the key on the first
       sheet, and the fix is not to make them both smaller, it is to give
       each of them a side. */
    var BAND_S  = 1.40 * S;        /* where a callout hangs its leader */
    var KEYTOP  = -1.58 * S;       /* the top edge of the legend */
    var FRONT   = 0.30 * S;        /* how far in front of the figure words sit */
    /* the key's swatch colours come out of the LIVE theme, by token, so a
       key can never disagree with the figure it explains */
    function tok(name) {
      var c = C[name] || C.base;
      var r = c.r, g = c.g, b = c.b, m = Math.max(r, g, b, 0.001);
      /* A SWATCH IS AN IDENTIFIER, NOT A SAMPLE.
         Drawn at its literal value the teal was invisible in the panel and
         the legend named a colour nobody could see. The reason is that these
         plates are additive over a scrim that has been multiplied almost to
         black, and teal at (14,151,169) has about half the luminance of the
         gold: a fifteen pixel dot of it, put through halation and the grade,
         comes out as a dark smudge next to a bright one.

         So the swatch is the same HUE at full brightness. Nothing about
         which mark it names changes, and the row can actually be read. */
      r /= m; g /= m; b /= m;
      return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    }

    /* ---- the key ------------------------------------------------------ */
    var key = null, rows = spec.key || [];
    if (rows.length) {
      var KW = 760, RH = 96, KH = 78 + rows.length * RH;
      key = annoCanvas(KW, KH);
      g.add(key.smesh); g.add(key.mesh);
      /* AND IT HAS TO FIT THE FRAME IT IS IN. At the standing distance
         these figures are shot from, a 9:16 frame is only about 1.3 world
         units either side of centre. A panel 2.15 wide anchored at x -1.34
         therefore started off the left edge and ran off the right one: on
         the rendered still only its rim was in shot. Sized and placed
         against that measurement now, and per shape. */
      /* AND IT HAS TO FIT THE FRAME IT IS IN, FOR AS LONG AS IT IS UP.
         At the standing distance these figures are shot from, a 9:16 frame
         is about 1.3 world units either side of centre and the camera pushes
         IN across the short, so the frame shrinks from about 3.06 units tall
         to 1.97. A panel anchored at y 1.74 is inside the opening frame and
         hanging out of the top of the closing one, which is exactly what the
         first render showed: two rows at the start, one row by the middle,
         nothing by the end.

         So the key sits in the floor of the frame, where the arithmetic says
         it clears at every point of the move, and it is TIMED rather than
         permanent. That is a concession to 9:16 and worth stating plainly: a
         tall frame cannot hold a legend, a callout and a headline at once
         without one of them being in the way of another. The legend takes
         the beats that have no headline, says its piece while the colour
         distinction first appears, and gets out of the way of the argument. */
      /* AT ONE SCREEN PIXEL PER CANVAS PIXEL, on a short. The legend was
         1.62 world units wide, which is 630 pixels of a 1080 frame on the
         nearest figure and 320 on the furthest, so its 33 pixel type was
         being delivered at 27 and at 14. */
      key.w3 = SHORTA ? KW / PXW : (spec.keyW || (PORTRAIT ? 1.62 : 2.15));
      /* AND THE KEY GETS A BAND OF ITS OWN, BELOW BOTH OF THEM.
         It sat at -1.35, which is inside the lower label band, so the first
         callout to lean down landed on the legend. Three things want the
         floor of a tall frame and there is only room for them in a row: the
         lower label band at -1.26, the key under it at -1.98, and the
         headline under that, which never shares a beat with a callout. */
      /* AND HUNG BY ITS TOP EDGE, not by its middle. A legend with three
         rows is taller than one with two; anchored at the centre it grows
         off the bottom of the frame in both directions at once, and the
         only way to know whether it still fits is to render it. Anchored at
         the top it grows downward into the room set aside for it, and the
         one number that matters, the gap between the words above and the
         legend below, is fixed. */
      key.at3 = SHORTA ? [0, KEYTOP, FRONT]
              : (spec.keyAt || (PORTRAIT ? [-0.05, -1.98, 0.34] : [-1.42, -1.26, 0.30]));
      /* THE ANCHOR PIXEL, WHICH THE KEY WENT WITHOUT AND SO NEVER APPEARED.
         place() positions a plane by putting one nominated pixel of it on a
         world point. A callout nominates the pixel its leader starts at; the
         key is simply centred, but it still has to SAY so. Leaving ax and ay
         undefined made the offset NaN, the position NaN, and the panel was
         never drawn on any frame. Nothing threw, because NaN is a number. */
      key.ax = KW / 2; key.ay = SHORTA ? 0 : KH / 2;
      var kx = key.cx, PAD = 34, RAD = 16;
      kx.clearRect(0, 0, KW, KH);
      /* the same pane of lit glass the Lantern speaks through, quieter:
         a rim brightest at the corner the light is on and gone by the far
         one. Nothing here is a filled box, because in this world every
         surface is light added to black. */
      var x0 = PAD, y0 = PAD, x1 = KW - PAD, y1 = KH - PAD;
      kx.beginPath();
      kx.moveTo(x0 + RAD, y0); kx.lineTo(x1 - RAD, y0);
      kx.quadraticCurveTo(x1, y0, x1, y0 + RAD); kx.lineTo(x1, y1 - RAD);
      kx.quadraticCurveTo(x1, y1, x1 - RAD, y1); kx.lineTo(x0 + RAD, y1);
      kx.quadraticCurveTo(x0, y1, x0, y1 - RAD); kx.lineTo(x0, y0 + RAD);
      kx.quadraticCurveTo(x0, y0, x0 + RAD, y0); kx.closePath();
      /* the key IS a panel, so its scrim is the panel shape rather than the
         glyphs: a rounded rectangle of dark with a soft edge, which is what
         stops a figure being read through the middle of a legend */
      var sk = key.scx;
      sk.save();
      sk.shadowColor = "rgba(6,8,16,0.55)";
      sk.fillStyle = "rgba(9,10,15,0.46)";
      for (var q = 0; q < 3; q++) {
        sk.shadowBlur = 44 - q * 13;
        sk.beginPath();
        sk.moveTo(x0 + RAD, y0); sk.lineTo(x1 - RAD, y0);
        sk.quadraticCurveTo(x1, y0, x1, y0 + RAD); sk.lineTo(x1, y1 - RAD);
        sk.quadraticCurveTo(x1, y1, x1 - RAD, y1); sk.lineTo(x0 + RAD, y1);
        sk.quadraticCurveTo(x0, y1, x0, y1 - RAD); sk.lineTo(x0, y0 + RAD);
        sk.quadraticCurveTo(x0, y0, x0 + RAD, y0); sk.closePath();
        sk.fill();
      }
      sk.restore();
      key.stex.needsUpdate = true;

      var gi = kx.createRadialGradient(x0, y1, 0, x0, y1, (x1 - x0) * 1.2);
      gi.addColorStop(0, annoRGBA(GHI, 0.040));
      gi.addColorStop(1, annoRGBA(GHI, 0.004));
      kx.fillStyle = gi; kx.fill();
      var gr = kx.createLinearGradient(x0, y1, x1, y0);
      gr.addColorStop(0, annoRGBA(GHI, 0.42));
      gr.addColorStop(0.7, annoRGBA(GHI, 0.15));
      gr.addColorStop(1, annoRGBA(GHI, 0.085));
      kx.strokeStyle = gr; kx.lineWidth = 2.0; kx.stroke();

      for (var r = 0; r < rows.length; r++) {
        var cy = 60 + RH * r + RH / 2, sw = tok(rows[r][0]);
        /* the swatch is the mark itself, at the size it is drawn, with the
           halo it has in the picture. A flat square would be a colour chip;
           this is the thing being named. */
        var hg = kx.createRadialGradient(PAD + 46, cy, 0, PAD + 46, cy, 38);
        hg.addColorStop(0, annoRGBA(sw, 0.60));
        hg.addColorStop(1, annoRGBA(sw, 0.0));
        kx.fillStyle = hg;
        kx.beginPath(); kx.arc(PAD + 46, cy, 38, 0, 6.2832); kx.fill();
        kx.fillStyle = annoRGBA(sw, 1.0);
        kx.beginPath(); kx.arc(PAD + 46, cy, 18, 0, 6.2832); kx.fill();
        kx.font = "500 33px NoorCard, system-ui, sans-serif";
        kx.textAlign = "left"; kx.textBaseline = "middle";
        kx.fillStyle = annoRGBA(PALE, 0.80);
        kx.fillText(String(rows[r][1]), PAD + 86, cy + 1);
      }
      key.tex.needsUpdate = true;
    }

    /* ---- the callouts ------------------------------------------------- */
    var calls = [];
    (spec.calls || []).forEach(function (c) {
      /* WHICH WAY A LABEL LEANS IS A PROPERTY OF THE FRAME.
         In 16:9 there is room beside a figure, so a label sits to one side
         on a horizontal leader. In 9:16 there is almost none: at the
         standing distance these figures are shot from, the frame is about
         1.3 world units either side of centre, which the figure already
         fills, so a side label runs straight across the marks it is naming.
         What a tall frame has instead is a great deal of empty space above
         and below. So a callout leans up or down there, on a short vertical
         leader, into space that is otherwise doing nothing. */
      var vert = (c.side === "up" || c.side === "down");
      /* ONE CANVAS PIXEL PER SCREEN PIXEL on a short, so 1080 wide is the
         delivered frame exactly and a 54 pixel line is 54 pixels. 340 tall
         is the standoff plus the tallest block the wrap can produce, which
         is two lines of headline and two of the line under it. */
      var CW = SHORTA ? 1080 : (vert ? 900 : 980);
      var CH = SHORTA ? 340 : (vert ? 260 : 210);
      var a = annoCanvas(CW, CH);
      a.spec = c;
      a.vert = vert;
      a.w3 = SHORTA ? CW / PXW : (c.w || (vert ? 2.05 : 2.60));
      var cx = a.cx;
      cx.clearRect(0, 0, CW, CH);
      /* ON A SHORT A CALLOUT ALWAYS LEANS UP, whatever the brief says. See
         the vertical plan at the top of makeAnno: there is one region below
         the figure and the legend has it. */
      var up = SHORTA ? true : (c.side !== "down");
      /* ===================================================================
         THE LABEL DOES NOT SIT ON THE PICTURE. IT SITS BESIDE IT.

         The first two goes at this were both wrong in the same way. The label
         was centred on the thing it names, so it landed on top of whatever
         was drawn there, and when the pivot needle of the balance came up
         through the middle of two lines of text I answered it by DIMMING the
         needle behind the words. That is still something crossing text. The
         owner was right to send it back.

         There is no amount of dimming that is not overlapping. The only
         answer is that the words are not there.

         So a callout is now two objects that are not in the same place:

           THE LABEL   lives in a reserved band of the frame that the figure
                       does not reach, above it or below it. Nothing is ever
                       drawn there, so nothing can ever cross it. It carries
                       the words and nothing else.

           THE LEADER  is a separate thin line in the world running from the
                       label to the point on the figure being named. It may
                       cross whatever it likes on the way, because a line
                       crossing a line is not text being crossed.

         The pointing is done by the leader, which is what a leader is for.
         The words are simply somewhere clear. ================================ */
      a.ay = up ? CH - 6 : 6;             /* where the leader leaves the label */
      a.ax = CW * 0.5;

      /* ===================================================================
         THE LABEL WRAPS, AND THAT IS THE WHOLE REASON IT CAN TEACH.

         The cap on a callout was twenty six characters. Not because anybody
         wanted a twenty six character sentence, but because the label was
         one line of 54 pixel type on a 900 pixel canvas and a twenty
         seventh character ran off the end. Everything downstream followed
         from that accident: at twenty six characters a callout cannot make
         a sentence, so it makes a note, and "Cairo, 1020s" is true and
         teaches nobody anything. Cryptic was the owner's word and it was
         the right one.

         So the label wraps, and it wraps on MEASURED width in the real font
         rather than on a character count, because "Illuminated" and
         "millimetre" are the same eleven characters and not the same width.
         Two lines of headline and two of the line under it. If a single
         word is still too wide for the column, the type steps down until it
         fits rather than running off the side.

         The column is 972 of 1080 pixels, which is 90% of the frame, and
         the label is centred in it and never moves. It does not track the
         mark horizontally: the leader does the pointing, and a label that
         slides left and right from beat to beat reads as loose. Holding it
         still also buys back the width that the sliding needed as margin,
         which is most of the room this wrap runs in. ==================== */
      var INSET = SHORTA ? 54 : 40;
      var MAXW = CW - INSET * 2;

      function wrapTo(text, maxLines) {
        var words = String(text).split(/\s+/);
        if (words.length < 2) return [text];
        var lines = [], cur = "";
        for (var i = 0; i < words.length; i++) {
          var t = cur ? cur + " " + words[i] : words[i];
          if (cur && cx.measureText(t).width > MAXW) { lines.push(cur); cur = words[i]; }
          else cur = t;
        }
        if (cur) lines.push(cur);
        /* AND THE TWO LINE CASE IS BALANCED RATHER THAN GREEDY. Greedy
           wrapping fills the first line and leaves whatever is left on the
           second, which on a centred label gives a long line over a single
           short word. Splitting at the point that minimises the WIDER of
           the two gives two lines of roughly equal measure, which is what a
           title looks like when somebody has set it. */
        if (lines.length !== 2) return lines;
        var best = null;
        for (var k = 1; k < words.length; k++) {
          var A = words.slice(0, k).join(" "), B = words.slice(k).join(" ");
          var wa = cx.measureText(A).width, wb = cx.measureText(B).width;
          var w = Math.max(wa, wb);
          if (wa <= MAXW && wb <= MAXW && (!best || w < best.w))
            best = { w: w, l: [A, B] };
        }
        return best ? best.l : lines;
      }

      function fitLines(text, weight, px, family, maxLines) {
        text = String(text || "").trim();
        if (!text) return { lines: [], px: px, font: "" };
        var size = px, lines = wrapTo(text, maxLines);
        for (var pass = 0; pass < 7; pass++) {
          cx.font = weight + " " + size + "px " + family;
          lines = wrapTo(text, maxLines);
          var widest = 0;
          for (var j = 0; j < lines.length; j++)
            widest = Math.max(widest, cx.measureText(lines[j]).width);
          if (lines.length <= maxLines && widest <= MAXW) break;
          size = Math.max(24, Math.round(size * 0.93));
        }
        return { lines: lines, px: size,
                 font: weight + " " + size + "px " + family };
      }

      var FAMA = "NoorCard, system-ui, sans-serif";
      var FAMB = "NoorMono, ui-monospace, monospace";
      var MAIN = fitLines(c.text, "500", SHORTA ? 54 : 54, FAMA, SHORTA ? 2 : 1);
      var SUBL = fitLines(c.sub,  "400", SHORTA ? 34 : 33, FAMB, SHORTA ? 2 : 1);
      var FMAIN = MAIN.font || ("500 54px " + FAMA);
      var FSUB  = SUBL.font || ("400 33px " + FAMB);
      var MLH = Math.round(MAIN.px * 1.20);
      var SLH = Math.round(SUBL.px * 1.34);
      var RUNG = 22;                       /* headline to the line under it */
      var STAND = SHORTA ? 60 : 44;        /* words to where the leader starts */
      var blockH = MAIN.lines.length * MLH
                 + (SUBL.lines.length ? RUNG + SUBL.lines.length * SLH : 0);
      var top = up ? (CH - STAND - blockH) : STAND;

      /* one list, drawn twice: once into the scrim that darkens whatever is
         behind the glyphs, once in light. Building it first is what keeps
         the two passes in register when the wrap changes the line count. */
      var LINES = [], ly2 = top, li;
      for (li = 0; li < MAIN.lines.length; li++) {
        LINES.push({ t: MAIN.lines[li], y: ly2, font: FMAIN,
                     col: PALE, alpha: 0.94, spread: 46 });
        ly2 += MLH;
      }
      if (SUBL.lines.length) {
        ly2 += RUNG;
        for (li = 0; li < SUBL.lines.length; li++) {
          LINES.push({ t: SUBL.lines[li], y: ly2, font: FSUB,
                       col: GHI, alpha: 0.66, spread: 34 });
          ly2 += SLH;
        }
      }
      var tex = CW * 0.5;
      for (li = 0; li < LINES.length; li++)
        scrimText(a, LINES[li].t, tex, LINES[li].y, LINES[li].font,
                  "center", "top", LINES[li].spread);
      cx.textAlign = "center"; cx.textBaseline = "top";
      for (li = 0; li < LINES.length; li++) {
        cx.font = LINES[li].font;
        cx.fillStyle = annoRGBA(LINES[li].col, LINES[li].alpha);
        cx.fillText(LINES[li].t, tex, LINES[li].y);
      }
      a.tex.needsUpdate = true;
      a.stex.needsUpdate = true;
      /* THE LEADER, as its own thin object in the world rather than as pixels
         inside the label. It runs from the label to the mark and it is free
         to cross whatever lies between them, because a hairline crossing a
         figure is not text being crossed. Brightest at the label end and
         fading out as it reaches the mark, so it reads as light reaching
         across to touch the thing rather than as an arrow drawn on top. */
      var lcv = document.createElement("canvas");
      lcv.width = 8; lcv.height = 128;
      var lcx = lcv.getContext("2d");
      var lgr = lcx.createLinearGradient(0, 0, 0, 128);
      /* AND IT HAS TO ARRIVE. The first ramp faded to three per cent at the
         mark end, on the reasoning that a leader should read as light
         reaching across rather than as an arrow drawn on top. Measured on a
         contact sheet, the visible part of the line stopped about a third of
         the way short of what it was pointing at, so on every sheet it read
         as a short diagonal scratch floating in the air near the figure.
         A line that does not touch the thing is not pointing at it. It
         still fades, because a hard-ended rule would be a different
         language, but it fades to a fifth rather than to nothing. */
      lgr.addColorStop(0.00, annoRGBA(GHI, 0.60));
      lgr.addColorStop(0.55, annoRGBA(GHI, 0.52));
      lgr.addColorStop(1.00, annoRGBA(GHI, 0.44));
      /* MEASURED TWICE. At 0.03 at the mark end the visible part of the line
         stopped a third short; at 0.20 it still stopped a quarter short,
         because the plane is additive at 0.92 opacity over a vignetted dark
         ground and a fifth of a dim gold is nothing there. A leader is a
         hairline either way, so it is close to even now: it reads as one
         line that arrives, rather than as a scratch that trails off. */
      lcx.fillStyle = lgr; lcx.fillRect(0, 0, 8, 128);
      var ltx = new T.CanvasTexture(lcv);
      ltx.minFilter = T.LinearFilter; ltx.magFilter = T.LinearFilter;
      ltx.generateMipmaps = false;
      a.lead = new T.Mesh(new T.PlaneGeometry(1, 1),
        new T.MeshBasicMaterial({ map: ltx, transparent: true, depthWrite: false,
                                  depthTest: false, blending: T.AdditiveBlending }));
      a.lead.renderOrder = 3;
      a.lead.visible = false;
      g.add(a.lead);
      g.add(a.smesh); g.add(a.mesh);
      calls.push(a);
    });

    /* place a plane so that one nominated pixel of it sits exactly on a
       point in the world, with the plane square to the lens */
    /* THE RESERVED BANDS. Everything the figures draw lives inside roughly
       a unit and a half of their own origin; these two lines are outside
       that, one above and one below, and nothing but words is ever put in
       them. In a 9:16 frame there is a great deal of room up there and none
       at all beside the figure, which is why the bands are horizontal.
       Measured against the closing frame: at the tightest point of the push
       the frame reaches 0.344 of the standing distance above centre, which is
       2.6 units on the nearest figure in the set, so a band at 1.92 is inside
       it with room to spare on every one of them. */
    var BAND_UP = 1.92, BAND_DOWN = -1.26;

    function place(a, org, ax3, ay3, az3, opacity) {
      var pw = a.w3, ph = pw * a.h / a.w;
      faceLens(a.mesh);
      if (a.smesh) faceLens(a.smesh);
      _AR.set(1, 0, 0).applyQuaternion(cam.quaternion);
      _AU.set(0, 1, 0).applyQuaternion(cam.quaternion);
      var dx = pw * (0.5 - a.ax / a.w);
      var dy = ph * (a.ay / a.h - 0.5);
      a.mesh.scale.set(pw, ph, 1);
      a.mesh.position.set(org[0] + ax3 + _AR.x * dx + _AU.x * dy,
                          org[1] + ay3 + _AR.y * dx + _AU.y * dy,
                          org[2] + az3 + _AR.z * dx + _AU.z * dy);
      a.mesh.material.opacity = opacity;
      a.mesh.visible = opacity > 0.004;
      if (a.smesh) {
        /* THE SCRIM SITS EXACTLY WHERE THE LABEL SITS, one hair behind it,
           and fades with it. A multiply plane cannot be faded with opacity
           the way an additive one can, because a half transparent multiply
           still multiplies: the way it fades is by being mixed back towards
           WHITE, which is the identity for multiply. So the material colour
           is walked from white at zero to full strength at one, and at zero
           the plane is simply switched off. */
        a.smesh.scale.copy(a.mesh.scale);
        a.smesh.position.copy(a.mesh.position);
        a.smesh.position.addScaledVector(_AF.set(0, 0, 1)
          .applyQuaternion(cam.quaternion), -0.012);
        var k = clamp01(opacity);
        /* 0.94 rather than 0.86: at 0.86 a bright line crossing the
           words came through at about a seventh of its value, which is
           dimmed but still legible as a line THROUGH the text. Nothing
           may cross text, so it goes to a sixteenth, which reads as the
           object passing behind rather than being faintly visible. */
        a.smesh.material.color.setScalar(1.0 - 0.94 * k);
        a.smesh.visible = k > 0.004;
      }
    }

    /* ---- THE LEADER, BUILT WHERE IT IS SEEN ----------------------------
       This ran from a world point to a world point, and the quad that drew
       it was billboarded to the lens and then turned by the angle between
       the two ends as measured in the camera's own axes. Every piece of that
       is defensible and the result was wrong on every frame.

       Measured, on one callout of the twin short, in pixels of the delivered
       1080 by 1920 frame:

           the label's bottom edge      548, 523
           the leader, as drawn         548, 659   to   182, 759
           the mark it was pointing at  218, 922

       So it began 136 pixels below the label, in mid air, and stopped 163
       pixels short of the thing it was naming, at the wrong angle. On a
       contact sheet that is not a leader, it is a scratch, and the owner has
       twice sent back frames with strange short lines in them.

       Two faults, and the second is the interesting one.

       The first is arithmetic: the label is placed by its own anchor pixel,
       which is six pixels above the bottom of its canvas, so the anchor
       point IS the bottom edge. Subtracting half a plane height from it, on
       the reasoning that a plane is placed by its centre, pushed the start
       down by half a label.

       The second is that a length and an angle in world units do not survive
       projection. The label is billboarded and sits at its own depth; the
       mark is on the figure at another; the camera is off axis and looking
       down. A quad built from a world distance and a world angle therefore
       arrives on screen at neither.

       So the line is built in the plane the camera is actually looking at.
       Both ends are projected, both are put back on one plane at the label's
       distance, and the quad is laid between those. Then a world length is a
       screen length, a world angle is a screen angle, and the line starts
       where the words end and finishes on the mark. */
    var _LA = new T.Vector3(), _LB = new T.Vector3(), _LM = new T.Vector3();
    var _NA = new T.Vector3(), _NB = new T.Vector3(), _QA = new T.Vector3(),
        _QB = new T.Vector3(), _CD = new T.Vector3();

    /* the point on the plane at distance d from the lens that projects to
       this normalised device coordinate */
    function onPlane(out, ndcx, ndcy, d) {
      out.set(ndcx, ndcy, 0.5).unproject(cam);
      out.sub(cam.position);
      var f = _CD.set(0, 0, -1).applyQuaternion(cam.quaternion).dot(out);
      out.multiplyScalar(f > 1e-6 ? d / f : 1).add(cam.position);
      return out;
    }

    function leader(a, aim, org, lx, ly, up, c, opacity) {
      if (!a.lead) return;
      /* THE ANCHOR POINT IS THE EDGE. See above: place() puts the label's
         anchor pixel on this point, and that pixel is the bottom of the
         canvas, sixty pixels clear of the last line of type. */
      _LA.set(aim[0] + lx, aim[1] + ly, aim[2] + (SHORTA ? FRONT : 0.30));
      _LB.set(org[0] + (c.to[0] || 0), org[1] + (c.to[1] || 0),
              org[2] + (c.to[2] === undefined ? 0.22 : c.to[2]));
      if (opacity <= 0.004) { a.lead.visible = false; return; }

      _NA.copy(_LA).project(cam);
      _NB.copy(_LB).project(cam);
      /* A LEADER THAT RUNS STRAIGHT DOWN FROM ITS OWN LABEL IS NOT A LEADER.
         When the label sits directly over the mark the eye has already
         joined them and the line adds nothing; worse, on a figure with a
         vertical member it draws a second line beside the first. Judged in
         screen width now rather than in world units, because a world unit is
         a different number of pixels on every one of these figures. */
      if (Math.abs(_NA.x - _NB.x) * 0.5 * 1080 < 74) {
        a.lead.visible = false; return;
      }
      var d = cam.position.distanceTo(_LA);
      onPlane(_QA, _NA.x, _NA.y, d);
      onPlane(_QB, _NB.x, _NB.y, d);
      var len = _QA.distanceTo(_QB);
      if (!(len > 0.02)) { a.lead.visible = false; return; }

      _LM.copy(_QA).add(_QB).multiplyScalar(0.5);
      a.lead.position.copy(_LM);
      faceLens(a.lead);
      _AR.set(1, 0, 0).applyQuaternion(cam.quaternion);
      _AU.set(0, 1, 0).applyQuaternion(cam.quaternion);
      _LM.copy(_QB).sub(_QA);
      /* the quad is built along its own y, so it is turned within the
         camera's plane by the angle from the label to the mark as the lens
         sees it, which keeps it a straight line at any camera roll */
      a.lead.rotateZ(Math.atan2(_LM.dot(_AR), -_LM.dot(_AU)));
      a.lead.scale.set(0.016 * S, len, 1);
      a.lead.material.opacity = opacity * 0.92;
      a.lead.visible = true;
      /* what it was asked to join, for the tools that check it */
      a.lead.userData.ends = { ax: _LA.x, ay: _LA.y, az: _LA.z,
                               bx: _LB.x, by: _LB.y, bz: _LB.z, len: len };
    }

    return {
      root: g,
      /* LABELS ARE TIMED IN MILLISECONDS OF THE FILM, NOT IN THE FIGURE'S
         CLOCK. The first cut timed them as fractions of the figure's own
         clock, reasoning that "at 0.42" means "when the sort is nearly done"
         at any length. It is a trap. The short warp REMAPS that clock, so on
         a forty second short the figure only ever runs from 0.16 to 0.70,
         and four of the seven labels written against it sat outside the
         range the figure would ever reach. They never appeared, and nothing
         said so, because a label that is never scheduled is not an error.

         Seconds are what an author already has: they come straight off the
         beat list, they need no knowledge of the warp, and a console can
         draw them on a timeline. */
      at: function (ms, f, org, aim) {
        aim = aim || org;
        if (key) {
          /* the key arrives once the picture exists and then STAYS. It is a
             legend, not a caption, and a legend you cannot check back
             against at the end is not doing its job. */
          var kin = clamp01((ms - (spec.keyAtMs === undefined ? 3000 : spec.keyAtMs)) / 700);
          var kh = spec.keyHoldMs === undefined ? 9000 : spec.keyHoldMs;
          var kout = kh > 0
            ? 1 - clamp01((ms - ((spec.keyAtMs || 3000) + kh)) / 900) : 1;
          place(key, aim, key.at3[0], key.at3[1], key.at3[2],
                clamp01(kin * kout) * f * 0.96);
        }
        for (var i = 0; i < calls.length; i++) {
          var a = calls[i], c = a.spec;
          /* in fast, out slow. A label that snaps away reads as a glitch;
             one that fades reads as attention moving on. */
          var inn = clamp01((ms - c.atMs) / 320);
          var out = 1 - clamp01((ms - (c.atMs + (c.holdMs === undefined ? 3000 : c.holdMs))) / 620);
          var op = clamp01(inn * out) * f;
          /* THE WORDS GO IN THE BAND. Only their x follows the mark, and even
             that is pulled towards the middle so a label never leans off the
             side of a tall frame. The y is the band and nothing else, which
             is the whole point: it does not matter where on the figure the
             mark is, the words are always somewhere the figure is not. */
          /* AND ON A SHORT IT DOES NOT TRACK THE MARK SIDEWAYS EITHER.
             The x used to follow the point being named, pulled a third of
             the way back towards the middle so the label would not lean off
             the edge. Two things were wrong with that. It cost the label a
             third of the frame in margin, which is width the wrap now needs
             to make a sentence; and a block of type that shifts left and
             right from one beat to the next reads as unset. The leader does
             the pointing. The words hold still. */
          var up = SHORTA ? true : (c.side !== "down");
          var lx = SHORTA ? 0 : (c.to[0] || 0) * 0.34;
          var ly = SHORTA ? BAND_S : (up ? BAND_UP : BAND_DOWN);
          place(a, aim, lx, ly, SHORTA ? FRONT : 0.30, op);
          leader(a, aim, org, lx, ly, up, c, op);
        }
      }
    };
  }

  /* ---- mounting a chapter ---------------------------------------------- */
  function mount(list) {
    if (!renderer) size();
    if (!renderer) return;
    /* everything from the last chapter goes, geometry and all: a film is
       rendered chapter by chapter and a leaked buffer is a slow render */
    while (scene.children.length) {
      var c = scene.children.pop();
      c.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) { [].concat(o.material).forEach(function (m) {
          if (m.map) m.map.dispose(); m.dispose(); }); }
      });
    }
    cues = [];
    dust = makeDust();
    if (dust) scene.add(dust);
    (list || []).forEach(function (c) {
      var make = FIG[c.kind];
      if (!make) return;
      var f = make(c);
      f.root.visible = false;
      scene.add(f.root);
      cues.push({ f: f, at: c.at, dur: c.dur, shot: c.shot || "push",
                  warp: c.warp || null,
                  fade: c.fade === undefined ? 520 : c.fade,
                  dim: c.place === "over" ? 0.55 : 1,
                  back: c.place === "over" ? 1 : 0 });
    });
    scene.traverse(fixAdditive);
  }

  /* ---- one frame -------------------------------------------------------- */
  function draw(ms) {
    if (!renderer) size();
    if (!renderer) return;
    var t = ms / 1000;

    /* THE BOARD DRAWS EVERYTHING, ALL THE TIME.
       On the board there is no such thing as a figure that is off. Each one
       runs its own clock from the moment the camera starts toward it, holds
       its finished state afterwards, and is seen or not seen according to
       where the camera is, which is the only honest reason for a thing in a
       room to be invisible. */
    if (BOARD) {
      /* THE CAMERA GOES FIRST, AND IT IS NOT A STYLE POINT.
         Every plate in this film is a billboard: it takes its orientation
         from the lens, once, in its own at(). Placing the camera AFTER that
         loop meant each of them squared up to where the lens was on the
         PREVIOUS frame -- which on a still is whatever was rendered last and
         on a moving shot is one frame of lag, and one frame of lag on a
         billboard is a diagram that leans. */
      boardCamera(ms, t);
      cam.updateMatrixWorld(true);
      for (var bi = 0; bi < cues.length; bi++) {
        var bc = cues[bi];
        var bu = clamp01((ms - bc.at) / Math.max(1, bc.dur));
        /* THE SHORT WARP. Two straight pieces, set by stage.js on a silent
           short and absent everywhere else: the film's first slice covers the
           figure's fade-in so nothing opens on an empty frame, and the rest
           covers the figure's motion so the settle lands near the end.
           Continuous at the join, monotonic, still a pure function of time.
           See THE SHORT WARP in stage.js for where the three numbers came
           from. This is the board path, which is the one every film uses;
           mount() carries the same warp for the single-figure path. */
        if (bc.warp) {
          bu = shortWarp(bu, bc.warp);
        }
        bc.f.root.visible = true;
        /* EACH FIGURE KEEPS ITS OWN COMPOSITION, AND THE BOARD MOVES IT.
           These figures were written for a world with one thing in it, and
           several of them place themselves inside the frame: the orb sits low
           so a title can ride its glow, the chain lifts clear of the caption.
           Zeroing them and then adding the station's position keeps that
           composition and puts it where the station is, rather than throwing
           it away. */
        bc.f.root.position.set(0, 0, 0);
        bc.f.at(bu, t, bc.dim);
        bc.f.root.position.x += bc.home[0];
        bc.f.root.position.y += bc.home[1];
        bc.f.root.position.z += bc.home[2];
        /* the labels take the figure's FINAL position, composition offset
           and all, so a callout stays on the mark it names even when the
           figure has placed itself off its own origin */
        /* THE LABELS HANG OFF WHERE THE CAMERA IS LOOKING, NOT OFF THE
           FIGURE. Two different points, and using the wrong one cut the top
           label off the frame. A figure places itself inside its own station:
           nutsort lifts by 0.80, others by more, so root.position is the
           station plus that lift. The camera, though, is aimed at the STATION.
           Hanging a band 1.92 above the lifted figure therefore put it 1.92
           plus the lift above the middle of the frame, and on a figure that
           lifts by more than half a unit that is outside the top of it.
           The bands take the station. Only the leader's far end takes the
           figure, because that end is pointing at a mark. */
        if (bc.anno) bc.anno.at(ms - bc.at, bc.dim,
                                [bc.f.root.position.x, bc.f.root.position.y,
                                 bc.f.root.position.z],
                                [bc.home[0], bc.home[1] + (bc.lift || 0), bc.home[2]]);
      }
      lanternDraw(ms, t);
      if (dust) { dust.rotation.y = t * 0.0075; dust.rotation.x = Math.sin(t * 0.021) * 0.04; }
    } else {

    var live = null, u = 0;
    for (var i = 0; i < cues.length; i++) {
      var c = cues[i];
      var on = ms >= c.at - c.fade && ms <= c.at + c.dur + c.fade;
      c.f.root.visible = on;
      if (!on) continue;
      var uu = clamp01((ms - c.at) / Math.max(1, c.dur));
      /* THE SHORT WARP. Two straight pieces, set by stage.js on a silent
         short and absent everywhere else: the film's first slice covers the
         figure's fade-in so nothing opens on an empty frame, and the rest
         covers the figure's motion so the arrival lands on the last beat.
         Continuous at the join, monotonic, still a pure function of time. */
      if (c.warp) {
        uu = shortWarp(uu, c.warp);
      }
      /* THE BEAT'S FADE IS AN ARGUMENT, NOT A PASS OVER THE SCENE.
         The first cut walked the objects after at() and multiplied every glow
         by the fade. Two things were wrong with that. A figure that sets its
         own glow each frame had the fade applied on top of a value that was
         already correct, and a figure that sets it once had the fade applied
         to the result of the last frame's fade -- which compounds, so the
         lattice quietly went black over four seconds. A pure function of time
         cannot read its own last answer. The fade goes in as a number and
         each figure applies it where it knows how. */
      var a = clamp01((ms - (c.at - c.fade)) / c.fade) *
              clamp01(((c.at + c.dur + c.fade) - ms) / c.fade);
      c.f.at(uu, t, a * c.dim);
      c.f.root.position.z = -1.45 * c.back;
      if (!live) { live = c; u = uu; }
    }

    /* the dust turns a great deal slower than anything in front of it, so
       what the eye reads is the camera moving through it rather than it
       moving past the camera */
    if (dust) { dust.rotation.y = t * 0.0075; dust.rotation.x = Math.sin(t * 0.021) * 0.04; }

    /* the camera answers the BEAT's shot, whatever figure happens to be up */
    var sh = null, su = 0;
    for (var q = 0; q < shots.length; q++) {
      var S0 = shots[q];
      if (ms >= S0.at && ms < S0.at + S0.dur) {
        sh = S0; su = clamp01((ms - S0.at) / Math.max(1, S0.dur)); break;
      }
      if (ms >= S0.at) { sh = S0; su = 1; }
    }
    if (sh) shotAt(sh.shot, su, t);
    else shotAt((live && live.shot) || "hold", u, t);
    }

    /* base pass */
    renderer.setRenderTarget(rtScene);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, true);
    renderer.render(scene, cam);

    var quad = quadScene.children[0];

    /* THE APERTURE, FIRST, BECAUSE IT IS PART OF THE PICTURE AND NOT AN
       EFFECT ON TOP OF ONE. The lens defocuses what the sensor then records;
       doing it after the bloom would be putting the glass behind the film. */
    quad.material = dofMat;
    dofMat.uniforms.tex.value = rtScene.texture;
    dofMat.uniforms.dep.value = rtScene.depthTexture || null;
    dofMat.uniforms.near.value = cam.near;
    dofMat.uniforms.far.value = cam.far;
    /* the focus rides the thing the shot is looking at, not a fixed number:
       a rack focus is the camera changing its mind, and it should follow the
       same curve the move does */
    dofMat.uniforms.focus.value = LENS.focus;
    dofMat.uniforms.aperture.value = LENS.aperture;
    dofMat.uniforms.maxR.value = LENS.maxR;
    dofMat.uniforms.tiltY.value = LENS.tiltY;
    dofMat.uniforms.tiltBand.value = LENS.tiltBand;
    dofMat.uniforms.tiltSoft.value = LENS.tiltSoft;
    dofMat.uniforms.tiltAmt.value = LENS.tiltAmt;
    renderer.setRenderTarget(rtDof); renderer.clear(true, false, false);
    renderer.render(quadScene, quadCam);

    /* bright pass, then two separable blurs, all at a quarter of the frame */
    quad.material = cutMat;
    cutMat.uniforms.tex.value = rtScene.texture;
    renderer.setRenderTarget(rtA); renderer.clear(true, false, false);
    renderer.render(quadScene, quadCam);

    /* TWO PASSES, THE SECOND ONE WIDER.
       One thirteen-tap blur at a quarter of the frame is a halo about twelve
       pixels across, which on a 1920 frame is not a halo, it is a soft edge.
       Looking at the bloom buffer on its own -- NOORLUME.debug("bloom") --
       showed exactly that: twenty small smudges on black. Light in air does
       not fall off in twelve pixels. So the blur runs twice, the second time
       with the taps two and a half times further apart, which costs one more
       pass at an eighth of the frame and buys a halo that reads as light
       rather than as a rendering artefact. */
    quad.material = blurMat;
    blurMat.uniforms.res.value.set(rtA.width, rtA.height);
    var pass = [[1.0, rtA, rtB], [1.0, rtB, rtC], [3.2, rtC, rtB], [3.2, rtB, rtA]];
    for (var pi = 0; pi < pass.length; pi++) {
      blurMat.uniforms.spread.value = pass[pi][0];
      blurMat.uniforms.tex.value = pass[pi][1].texture;
      blurMat.uniforms.dir.value.set(pi % 2 === 0 ? 1 : 0, pi % 2 === 0 ? 0 : 1);
      renderer.setRenderTarget(pass[pi][2]); renderer.clear(true, false, false);
      renderer.render(quadScene, quadCam);
    }
    /* rtC now holds the tight halo and rtA the wide one */

    /* resolve: supersampled base + bloom, tone mapped, to the canvas */
    if (DEBUG === "bloom") {
      quad.material = showMat; showMat.uniforms.tex.value = rtA.texture;
      renderer.setRenderTarget(null); renderer.clear(true, true, true);
      renderer.render(quadScene, quadCam); quad.material = blurMat; return;
    }
    quad.material = comboMat;
    comboMat.uniforms.base.value = rtScene.texture;
    comboMat.uniforms.bloom.value = rtC.texture;
    comboMat.uniforms.bloom2.value = rtA.texture;
    comboMat.uniforms.dof.value = rtDof.texture;
    comboMat.uniforms.res.value.set(canvas.width, canvas.height);
    comboMat.uniforms.gtime.value = ms / 1000.0;
    /* the room layer still exists as an element and still takes the shot at
       PARALLAX of the figures' rate; it just is not painted any more. Its
       matrix is read here and handed to the shader, so the depth survives
       the move onto the GPU. */
    var GEL = document.getElementById("ground"), gs = 1, gtx = 0, gty = 0;
    if (GEL && window.DOMMatrix) {
      var mtx = new DOMMatrix(getComputedStyle(GEL).transform);
      if (mtx.a) { gs = mtx.a; gtx = mtx.e; gty = mtx.f; }
    }
    comboMat.uniforms.gxf.value.set(gs, gtx, gty);
    renderer.setRenderTarget(null);
    renderer.clear(true, true, true);
    renderer.render(quadScene, quadCam);
    quad.material = blurMat;
  }

  /* =======================================================================
     THE BOARD, AND ONE CAMERA THAT NEVER CUTS
     =======================================================================
     Up to here the film was a reel: one figure at a time in the middle of an
     empty world, cross faded to the next. Cross fades are not transitions,
     they are cuts with the edges sanded off, and a figure that has no place
     cannot be approached, left, or looked at from a new side.

     So every figure in the film now stands somewhere in ONE space at the same
     time, laid out as a constellation, and there is a single camera that
     travels between them and never stops moving. What was a cut is now a
     move: the eye is carried from one object to the next, the near thing
     slides past the far thing on its own, and the parallax is not an effect
     applied to a picture, it is what happens when a camera with a real focal
     length moves through a real arrangement of objects.

     A beat is a VIEWPOINT, not a slide. Several beats on one figure means the
     camera circles it, comes closer, or drops under it while the words change.
     A beat on a new figure means the camera travels.

     HOW THE MOTION STAYS SMOOTH. The viewpoints are knots on two Catmull-Rom
     curves, one for where the camera is and one for what it is pointed at, and
     the whole film is one pass along them. A curve through the knots rather
     than a lerp between them is the difference between a camera that eases to
     a stop at every station and one that flows: there is no corner at a knot,
     because a Catmull-Rom has none. The film's clock is then reparameterised
     so the camera dwells where there is something to read and travels between,
     which is the same curve walked at different speeds rather than a different
     curve.                                                                 */
  var BOARD = null;

  function vec(a) { return new T.Vector3(a[0], a[1], a[2]); }

  function makeBoard(list) {
    /* every viewpoint in order: where the camera stands, what it looks at,
       the focal length, and the roll */
    var P = [], L = [], F = [], R = [], T0 = [], T1 = [];
    /* A VIEW MAY END SOMEWHERE OF ITS OWN, NOT JUST TOWARD THE NEXT ONE
       (round six). Every other beat travels knot to knot, which is the
       right shape for a camera that is going somewhere new -- but the
       last beat has no next knot to travel toward (findEnd is null for
       it and it holds the whole scene through, which was the last scene
       reading as almost still to the audit that opened this round).
       end.eye / end.look, when a view carries them, are this beat's OWN
       private destination: EE / EL hold them, null where a view has
       none, and boardCamera below reads them instead of the shared knot
       curve for exactly that beat, in the same eye-glides / aim-holds-
       then-turns shape every other beat already uses. */
    var EE = [], EL = [];
    for (var i = 0; i < list.length; i++) {
      var v = list[i];
      P.push(vec(v.eye));
      L.push(vec(v.look));
      F.push(v.fov);
      R.push(v.roll || 0);
      T0.push(v.at);
      T1.push(v.at + v.dur);
      EE.push(v.end ? vec(v.end.eye) : null);
      EL.push(v.end ? vec(v.end.look) : null);
    }
    if (P.length < 2) { P.push(P[0].clone().add(new T.Vector3(0, 0, -0.6))); L.push(L[0].clone());
                        F.push(F[0]); R.push(R[0]); T0.push(T0[0] + 1); T1.push(T1[0] + 1);
                        EE.push(EE[0]); EL.push(EL[0]); }
    /* HOW FAR A VIEWPOINT IS ALLOWED TO DRIFT WHILE IT IS BEING READ.
       The dwell is not a freeze: the camera keeps pushing a little, which is
       what keeps a held shot alive. But "a little" is measured along the
       curve, and the curve's next knot may be the same object seen from
       another side or it may be the next object twenty units down the
       corridor. Ten per cent of the first is a slow push. Ten per cent of the
       second is the subject sliding out of frame while you are still reading
       it, which is what put the root plate a quarter of a frame left of
       centre. So the allowance is set per knot from how far the LOOK moves:
       the same subject buys a push, a different one buys almost nothing and
       the whole move happens in the travel where it belongs. */
    var DW = [];
    for (var d = 0; d < L.length; d++) {
      var nx = L[Math.min(L.length - 1, d + 1)];
      var far = L[d].distanceTo(nx);
      DW.push(far < 2.2 ? 0.10 : far < 6.0 ? 0.055 : 0.022);
    }
    /* HOW LONG THE AIM HOLDS ON ITS OWN LOOK, IN SECONDS, BEFORE IT TURNS
       TOWARD THE NEXT ONE (finding 4, round four). Only a scene's own
       views carry this field; a corridor view built by viewFor() has none,
       and a corridor never sets glide pace, so the fallback here (the
       whole viewpoint, in seconds -- "never turns") is read only by code
       that never runs for one. */
    var HOLD = [];
    for (var hI = 0; hI < L.length; hI++) {
      var hv = list[hI] ? list[hI].hold : undefined;
      HOLD.push(hv === undefined ? (T1[hI] - T0[hI]) / 1000 : Number(hv));
    }
    return {
      n: P.length, P: P, L: L, F: F, R: R, t0: T0, t1: T1, DW: DW, HOLD: HOLD,
      EE: EE, EL: EL,
      /* centripetal: a uniform Catmull-Rom loops on itself where two knots sit
         close together, which on a camera path is a lurch */
      cp: new T.CatmullRomCurve3(P, false, "centripetal", 0.5),
      cl: new T.CatmullRomCurve3(L, false, "centripetal", 0.5)
    };
  }

  /* where on the curve we are at ms, and how far through the current
     viewpoint. The film dwells for the first part of each beat and travels
     for the last, so the picture is still while it is being read and moving
     while the argument moves on. */
  var PACE = "dwell";
  /* how much the handheld breath moves the camera, as a fraction of the
     corridor's own 0.104. A scene figure stands in a six unit room rather
     than a twenty unit corridor, and the corridor's breath read as a small
     earthquake in it; scene.breath in the compiled chapter scales this down
     (see NOORLUME.breath below and the darkroom figure's o.breath). */
  var BREATHK = 1;

  function boardAt(ms) {
    var b = BOARD, n = b.n, i = 0;
    for (i = 0; i < n; i++) if (ms < b.t1[i] || i === n - 1) break;
    var dur = Math.max(1, b.t1[i] - b.t0[i]);
    var u = clamp01((ms - b.t0[i]) / dur);
    /* DWELL, THEN TRAVEL. The first 62% of a beat holds near its knot with a
       slow float; the last 38% carries to the next. Eased at both ends, so the
       camera is never seen to start or to stop. */
    /* DWELL IS FOR A FILM THAT TRAVELS. Over a ten second beat, holding
       near the knot for six seconds and then carrying for four is a camera
       that arrives, settles and leaves. Over a four second beat it is a
       camera that stops and starts eight times in thirty seconds, which on a
       phone reads as stutter. In "even" pacing the dwell fraction equals
       HOLD, so the first 62% of every beat is exactly linear and the move
       never appears to pause. */
    /* GLIDE IS FOR A ROOM, NOT A CORRIDOR.
       A scene's knots can sit six units apart, not twenty, and the corridor's
       dwell/travel split still spends 62% of the beat parked near the last
       one and only 38% carrying to the next -- which in a small room is a
       camera that holds still and then lurches the rest of the way in a
       third of the time. Glide removes the dwell entirely and eases the
       WHOLE beat with one inOutSine, so a six second beat between two views
       three units apart is one continuous move, never a park and a dash. */
    if (PACE === "glide") {
      /* THE EYE GLIDES THE WHOLE BEAT; THE AIM HOLDS, THEN TURNS (finding
         4, round four). Round three's fix here was a gamma bias that
         delayed the ease itself so a knot with a far away next look kept
         more of the beat before the aim started swinging toward it -- a
         proxy, built out of the only thing boardAt had to read, the
         knot-to-knot look distance in b.DW. The spec now says the true
         thing directly: camera.hold, in seconds, copied by the compiler
         into views[].hold and carried here as b.HOLD, so the proxy is
         gone. The EYE no longer needs any bias at all: position is one
         inOutSine over the WHOLE beat, full stop. The AIM keeps its own,
         separate clock: it stays on this view's own look point for hold
         seconds, then eases toward the next one with inOutSine over
         whatever is left. A hold equal to the beat's own length (the
         default, for a view that carries none) never turns during it,
         which is exactly the spec's own convention for the field. */
      var gu = 0.5 - 0.5 * Math.cos(Math.PI * u);
      var s2 = (i + gu) / Math.max(1, n - 1);
      var holdMs = (b.HOLD ? b.HOLD[i] : dur / 1000) * 1000;
      var elapsedMs = ms - b.t0[i];
      var aimU = 0;
      if (holdMs < dur - 0.5) {
        var travelMs = Math.max(1, dur - holdMs);
        aimU = 0.5 - 0.5 * Math.cos(Math.PI * clamp01((elapsedMs - holdMs) / travelMs));
      }
      /* gu carried out alongside s2 (round six): a view with its own end
         glides eye and aim across ITS OWN pair, not the shared knot curve,
         and needs the very same whole-beat ease s2 was built from rather
         than a second copy of it. */
      return { i: i, u: u, s: clamp01(s2), local: clamp01(aimU), gu: gu };
    }
    var HOLD = 0.62, dw = PACE === "even" ? HOLD : (b.DW ? b.DW[i] : 0.10);
    var local = u <= HOLD ? (u / HOLD) * dw
                          : dw + ease("inOutQuad", (u - HOLD) / (1 - HOLD)) * (1 - dw);
    var s = (i + local) / Math.max(1, n - 1);
    return { i: i, u: u, s: clamp01(s), local: clamp01(local), gu: local };
  }

  var _BP = new T.Vector3(), _BL = new T.Vector3();

  function boardCamera(ms, tsec) {
    var b = BOARD, w = boardAt(ms);
    /* A VIEW WITH end IS A BEAT OF ITS OWN, NOT A KNOT ON THE SHARED
       CURVE (round six). Every other beat rides b.cp / lerps toward the
       next knot because it is going somewhere else next; the last scene
       has nowhere else to go, so it used to sit on the tail of the curve
       and barely move -- exactly what the audit's own numbers said. Eye
       and aim here glide and hold-then-turn the same as always, just
       between this view's own eye/look and its own end instead of the
       next view's, so the shape of the motion (round four, finding 4) is
       unchanged; only where it goes is. */
    var endEye = b.EE ? b.EE[w.i] : null, endLook = b.EL ? b.EL[w.i] : null;
    if (endEye) {
      _BP.copy(b.P[w.i]).lerp(endEye, w.gu);
    } else {
      b.cp.getPoint(w.s, _BP);
    }
    /* THE AIM IS NOT ON A CURVE, AND THAT IS NOT A SHORTCUT.
       Four beats in a row may look at the same figure from four sides, which
       puts four identical knots in the aim curve -- and a Catmull-Rom through
       coincident knots does not sit still between them, it bulges, because
       the tangents are set by the neighbours on either side. That bulge was
       the root plate sliding a seventh of a frame off centre while it was
       being read, with nothing in the shot to explain why. The POSITION still
       rides the curve, so the camera never stops moving; the aim walks
       straight from one subject to the next, so a held subject is held. */
    var jj = Math.min(b.n - 1, w.i + 1);
    if (endLook) {
      _BL.copy(b.L[w.i]).lerp(endLook, w.local);
    } else {
      _BL.copy(b.L[w.i]).lerp(b.L[jj], w.local);
    }
    /* THE BREATH, AND IT HAS TO BE BIG ENOUGH TO SEE.
       The idea was right and the number was not. At a standing distance of
       7.7 units on a 35 degree lens the half frame is about 2.5 world units
       across, so the old 0.036 was one and a half per cent of it: real, and
       invisible. During the dwell the camera also only creeps a tenth of the
       way to the next knot, so for most of every beat the picture was to the
       eye a locked off shot, which is exactly what it looked like.
       BREATH is now four per cent of the half frame. That is small enough
       that nobody would call it a move and large enough that the shot reads
       as held rather than parked, and because the aim follows only a fifth of
       it the near planes swim against the far ones while it happens, which is
       what actually sells floating. Turn it down here, in one place. */
    var BREATH = 0.104 * BREATHK, AIMFOLLOW = 0.2;
    var bx = wander(tsec, 71) * BREATH;
    var by = wander(tsec, 83) * BREATH * 0.86;
    var bz = wander(tsec, 97) * BREATH * 0.78;
    cam.position.set(_BP.x + bx, _BP.y + by, _BP.z + bz);
    cam.lookAt(_BL.x + bx * AIMFOLLOW, _BL.y + by * AIMFOLLOW, _BL.z);
    var j = Math.min(b.n - 1, w.i + 1), k = w.u;
    cam.rotateZ(lerp(b.R[w.i], b.R[j], ease("inOutQuad", k)) +
                /* and the roll breathes with it: 0.0024 rad is a seventh
                   of a degree, which is nothing. 0.0062 is a third of a
                   degree, still far below anything you would read as a
                   dutch angle. */
                wander(tsec, 103) * 0.0062);
    var f = lerp(b.F[w.i], b.F[j], ease("inOutQuad", k));
    if (Math.abs(cam.fov - f) > 0.001) { cam.fov = f; cam.updateProjectionMatrix(); }
  }

  function mountBoard(list, views) {
    if (!renderer) size();
    if (!renderer) return;
    while (scene.children.length) {
      var c = scene.children.pop();
      c.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) { [].concat(o.material).forEach(function (m) {
          if (m.map) m.map.dispose(); m.dispose(); }); }
      });
    }
    cues = [];
    dust = makeDust();
    if (dust) scene.add(dust);

    /* the one light, built once, added once, never rebuilt */
    LANTERN = makeLantern();
    scene.add(LANTERN.root);
    scene.add(LANTERN.wake);
    scene.add(LANTERN.pane);
    LCUES = []; LCURVE = null;
    (list || []).forEach(function (c) {
      var make = FIG[c.kind];
      if (!make) return;
      var f = make(c);
      f.root.visible = true;
      /* THE FIGURE HAS A PLACE, AND IT KEEPS IT.
         Nothing is hidden and nothing is faded out. A figure the camera has
         left is simply behind it, and a figure it has not reached yet is a
         small light in the distance, which is the whole point: the shape of
         the argument is visible before it is explained. */
      f.root.position.set(c.pos[0], c.pos[1], c.pos[2]);
      if (c.turn) f.root.rotation.y = c.turn;
      scene.add(f.root);
      /* THE KEY AND THE CALLOUTS BELONG TO THE FIGURE, NOT TO THE BEAT.
         They run on the figure's own clock, so "at 0.42" means "when the
         sort is nearly done" and stays true whether that is a 30 second
         short or a two minute stretch of a long film. */
      var anno = null;
      if ((c.key && c.key.length) || (c.calls && c.calls.length)) {
        var AP = ART_OF || {};
        anno = makeAnno(c, {
          base: new T.Color(AP.base === undefined ? 0xEFB229 : AP.base),
          rise: new T.Color(AP.rise === undefined ? 0x0E97A9 : AP.rise),
          mark: new T.Color(AP.mark === undefined ? 0xFBF4DA : AP.mark),
          line: new T.Color(AP.line === undefined ? 0xFBF4DA : AP.line)
        });
        scene.add(anno.root);
      }
      cues.push({ f: f, at: c.at, dur: c.dur, home: c.pos.slice(),
                  warp: c.warp || null, anno: anno, lift: c.lift || 0,
                  fade: 0, dim: c.dim === undefined ? 1 : c.dim, back: 0, board: true });
    });
    BOARD = makeBoard(views || []);
    scene.traverse(fixAdditive);
  }


  /* =======================================================================
     THE LANTERN

     THERE IS ONE LIGHT IN THIS FILM AND IT NEVER GOES OUT.

     Every earlier cut built a new ball of light for every beat that wanted
     one, lit it, and threw it away at the next beat. Eleven times. Which
     means eleven identical births of the same animation, and a viewer who has
     seen the second one has seen all of them.

     The Lantern is the site's own name for the thing a reader asks a question
     to. So it is not a new character invented for a film: it is the one that
     is already there, given a body. It exists from the first frame to the
     last, it stands at a place in the corridor while a thing is explained,
     and it carries to the next place before the camera does, so that what the
     camera is doing is FOLLOWING A LIGHT rather than sliding along rails.

     It has three postures and no others.

       speak  it is the subject. It stands at its station at full size and a
              pane of lit glass opens beside it carrying the one phrase the
              beat turns on.
       aside  a diagram has the frame. The Lantern shrinks to the corner of
              the board and dims, and what is left of it is the light the
              board appears to be lit by.
       lead   between two things there is nothing to look at but the guide,
              so the guide is what you look at.

     It reaches a posture by travelling to it, never by cutting to it. The
     postures are knots on a curve of their own, walked at ms + LEAD, which is
     the whole of how it leads: the same clock, read slightly into the future.
     ======================================================================= */

  var LANTERN = null, LCUES = [], LCURVE = null;
  var LEAD = 430;

  FIG.station = function () {
    /* a place in the corridor that the Lantern will stand in. It has to exist
       so that the spacing of the other figures does not close up around it. */
    return { root: new T.Group(), at: function () {} };
  };

  function makeLantern() {
    var g = new T.Group();
    var hot = C.pale, warm = C.gold;
    var deep = warm.clone().multiplyScalar(0.72).lerp(new T.Color(0xE0A02A), 0.16);

    var core = new T.Mesh(new T.SphereGeometry(0.52, 64, 48),
      lumeMat(hot, warm.clone().multiplyScalar(0.16),
              { rim: 2.4, glow: 0.90, bodyk: 3.4, body: 1.0, sheen: 0.0,
                alpha: 1.0, add: true, depthWrite: false, damt: 0.12 }));
    g.add(core);

    var AIR = [
      { s: 4.10, k1: 1.25, k2: 7.0,  gain: 0.232, hot: 0.98, col: hot,  in: hot },
      { s: 8.40, k1: 1.50, k2: 9.0,  gain: 0.345, hot: 0.62, col: warm, in: hot },
      { s: 16.0, k1: 1.70, k2: 12.0, gain: 0.245, hot: 0.26, col: deep, in: warm }
    ];
    var air = [];
    for (var i = 0; i < AIR.length; i++) {
      var A = AIR[i];
      var m = glowPlane(A.s, A.in, A.col,
        { k1: A.k1, k2: A.k2, gain: A.gain, hot: A.hot, damt: 0.30 });
      g.add(m); air.push({ m: m, gain: A.gain });
    }
    var streak = glowPlane(19.0, hot, warm,
      { k1: 1.15, k2: 6.0, gain: 0.215, hot: 0.42, squash: 15.0, damt: 0.25 });
    g.add(streak);

    /* the motes are the only way the eye can tell that a light has volume and
       that the camera is moving through it rather than past a decal.
       A ROOM IS SMALLER THAN A CORRIDOR, AND THE LENS SITS CLOSER TO IT
       (round three finding 3). Three hundred sparks at full brightness were
       built to be seen from a corridor's own travelling distance; inside a
       few unit room, with the camera parked much nearer the Lantern for
       whole beats at a time (s8 to s10), the same sparks read as a
       fireworks cloud rather than a light's own glow. Scene mode (glide
       pace) gets half the count and half the brightness; every corridor
       film keeps exactly what it had. */
    var sceneSparks = PACE === "glide";
    var n = sceneSparks ? 150 : 300, mpos = new Float32Array(n * 3), mbase = [];
    for (var q = 0; q < n; q++) {
      var a0 = hash(q, 3) * Math.PI * 2;
      var r0 = 1.15 + Math.pow(hash(q, 5), 0.7) * 2.1;
      var y0 = (hash(q, 7) - 0.5) * 1.7;
      mbase.push([a0, r0, y0, 0.2 + hash(q, 11) * 0.55]);
      mpos[q * 3] = Math.cos(a0) * r0; mpos[q * 3 + 1] = y0; mpos[q * 3 + 2] = Math.sin(a0) * r0;
    }
    var mg = new T.BufferGeometry();
    mg.setAttribute("position", new T.BufferAttribute(mpos, 3));
    var moteK = sceneSparks ? 0.5 : 1;
    var motes = new T.Points(mg, new T.PointsMaterial({
      color: C.pale.clone(), size: 0.150, map: dotTex(), transparent: true, opacity: 0.30,
      blending: T.AdditiveBlending, depthWrite: false, sizeAttenuation: true
    }));
    g.add(motes);

    /* THE WAKE.
       A light that moves and leaves nothing behind is a cursor. These are
       sampled off the Lantern's own curve a little way back, so they are
       exactly where it has been, and they are only bright while it is
       actually going somewhere. Nothing else in the film does this, because
       nothing else in the film travels. */
    var wn = 120, wpos = new Float32Array(wn * 3);
    var wg = new T.BufferGeometry();
    wg.setAttribute("position", new T.BufferAttribute(wpos, 3));
    var wake = new T.Points(wg, new T.PointsMaterial({
      color: C.goldhi.clone(), size: 0.085, map: dotTex(), transparent: true, opacity: 0,
      blending: T.AdditiveBlending, depthWrite: false, sizeAttenuation: true
    }));

    /* ---- the pane -----------------------------------------------------
       NOT A SPEECH BALLOON. Everything in this world is drawn by adding light
       to black, so a bubble with a filled body and dark type is not available
       and would be wrong anyway. What is available is a pane of glass with a
       lit rim and the words burning inside it, hung in the room at the
       Lantern's own depth, so the camera drifts against it while it is being
       read and goes past it when the beat ends. */
    var bw = PORTRAIT ? 1120 : 1480, bh = PORTRAIT ? 840 : 620;
    var bcv = document.createElement("canvas");
    bcv.width = bw; bcv.height = bh;
    var bcx = bcv.getContext("2d");
    var btex = new T.CanvasTexture(bcv);
    btex.minFilter = T.LinearFilter; btex.magFilter = T.LinearFilter;
    btex.generateMipmaps = false;
    if (T.SRGBColorSpace) btex.colorSpace = T.SRGBColorSpace;
    var pane = new T.Mesh(new T.PlaneGeometry(1, 1),
      new T.MeshBasicMaterial({ map: btex, transparent: true, depthWrite: false,
                                blending: T.AdditiveBlending }));
    pane.renderOrder = 2;
    pane.visible = false;

    function rgba(c, a) {
      return "rgba(" + Math.round(c[0]) + "," + Math.round(c[1]) + "," +
             Math.round(c[2]) + "," + a.toFixed(3) + ")";
    }
    var GOLD = [201, 162, 39], GHI = [233, 200, 106], PALE = [251, 243, 220];

    function tracked(cx, text, x, y, sp) {
      var w = 0, i;
      for (i = 0; i < text.length; i++) w += cx.measureText(text[i]).width + sp;
      var px = x - w / 2;
      for (i = 0; i < text.length; i++) {
        cx.fillText(text[i], px, y);
        px += cx.measureText(text[i]).width + sp;
      }
    }

    /* the pane's own geometry, in canvas pixels, worked out once */
    var PAD = Math.round(bw * 0.050);
    var RAD = Math.round(bw * 0.022);

    function paint(cue, u) {
      bcx.clearRect(0, 0, bw, bh);
      /* ARRIVING IS ON A CLOCK. LEAVING IS ON THE BEAT.
         Every arrival here used to be a fraction of the beat: the rim at u/0.11,
         the unfold at u/0.20, the text at (u-0.13)/0.09. On the four second
         title that is a pane in half a second and words at 0.64s, which is the
         rhythm this was designed around. On the fourteen second chapter title
         the same fractions become a pane at 1.5s and words at 1.8s, so the
         Lantern held an empty box for nearly two seconds and then spoke slowly.
         One light was speaking at whatever speed the camera happened to dwell.
         The numbers below are that four second beat's own timings, in seconds,
         so she speaks the same way on every beat.
         Leaving stays a fraction, because when she stops has to be tied to when
         the picture moves on, not to a clock. */
      var D = (cue.dur || 4263) / 1000, t = u * D;
      var A = clamp01(t / 0.469) * clamp01((0.84 - u) / 0.17);
      if (A <= 0.002) return 0;
      var op = ease("open", clamp01(t / 0.853));
      var x0 = PAD, y0 = PAD, x1 = bw - PAD, y1 = bh - PAD;

      bcx.save();
      /* it unfolds from the corner nearest the Lantern, because that is the
         corner the light is coming from */
      bcx.translate(x0, y1);
      bcx.scale(0.18 + 0.82 * op, 0.34 + 0.66 * op);
      bcx.translate(-x0, -y1);

      bcx.beginPath();
      bcx.moveTo(x0 + RAD, y0);
      bcx.lineTo(x1 - RAD, y0);
      bcx.quadraticCurveTo(x1, y0, x1, y0 + RAD);
      bcx.lineTo(x1, y1 - RAD);
      bcx.quadraticCurveTo(x1, y1, x1 - RAD, y1);
      bcx.lineTo(x0 + RAD, y1);
      bcx.quadraticCurveTo(x0, y1, x0, y1 - RAD);
      bcx.lineTo(x0, y0 + RAD);
      bcx.quadraticCurveTo(x0, y0, x0 + RAD, y0);
      bcx.closePath();

      /* THE GLASS IS LIT FROM THE LANTERN AND FROM NOWHERE ELSE.
         The first cut of this stroked the whole outline at one brightness,
         which is a rectangle drawn by a computer: four hard edges of equal
         weight, and nothing in the picture to explain why they are lit. A rim
         that is bright at the corner the lamp is at and gone by the far one is
         a pane of glass with a light beside it, and it is the same two lines
         of gradient. */
      var gi = bcx.createRadialGradient(x0, y1, 0, x0, y1, (x1 - x0) * 1.15);
      gi.addColorStop(0, rgba(GHI, 0.058 * A));
      gi.addColorStop(0.45, rgba(GOLD, 0.022 * A));
      gi.addColorStop(1, rgba(GOLD, 0.006 * A));
      bcx.fillStyle = gi; bcx.fill();

      var gs = bcx.createLinearGradient(x0, y1, x1, y0);
      gs.addColorStop(0, rgba(GHI, 0.58 * A));
      gs.addColorStop(0.32, rgba(GHI, 0.30 * A));
      gs.addColorStop(0.72, rgba(GOLD, 0.175 * A));
      gs.addColorStop(1, rgba(GOLD, 0.115 * A));
      bcx.shadowColor = rgba(GHI, 0.42 * A);
      bcx.shadowBlur = bw * 0.011;
      bcx.strokeStyle = gs;
      bcx.lineWidth = Math.max(1.4, bw * 0.0013);
      bcx.stroke();
      bcx.shadowBlur = 0;

      /* the wisp. Something has to join the pane to the light or the pane is
         a caption; a ruled leader line would make it a diagram. This is the
         last of the glow, drawn off the near corner and gone before it
         arrives, which is what a light leak looks like. */
      bcx.beginPath();
      bcx.moveTo(x0 + RAD * 0.5, y1 - RAD * 0.2);
      bcx.quadraticCurveTo(x0 * 0.40, y1 + PAD * 0.62, -PAD * 0.5, bh + PAD * 0.5);
      var gw = bcx.createLinearGradient(x0, y1, 0, bh);
      gw.addColorStop(0, rgba(GHI, 0.52 * A));
      gw.addColorStop(1, rgba(GHI, 0.0));
      bcx.strokeStyle = gw;
      bcx.lineWidth = Math.max(1.2, bw * 0.0024);
      bcx.stroke();
      bcx.restore();

      /* the words. They arrive one at a time, they are never on screen before
         the pane that holds them, and there is never a second line of them
         anywhere else in the frame at the same time.

         THEY ARE NOT DRAWN BRIGHT. Everything on this plane is added to the
         picture and then run through a bright pass that cuts at 0.57, so type
         laid down at full white with a canvas shadow under it comes out of the
         bloom as a lozenge with a ghost of letters in it -- which is exactly
         what the first cut did. Set a little over the cut and with no shadow
         at all, the bloom gives it the halo instead, and the letters survive. */
      var tA = clamp01((t - 0.554) / 0.384) * clamp01((0.84 - u) / 0.14);
      if (tA <= 0.002) return A;

      var inx = x0 + bw * 0.058, inw = (x1 - x0) - bw * 0.116;
      var cy = (y0 + y1) / 2 + (cue.eyebrow ? bh * 0.055 : 0);

      if (cue.eyebrow) {
        bcx.font = "400 " + Math.round(bw * 0.0195) + "px NoorMono, ui-monospace, monospace";
        bcx.textAlign = "left"; bcx.textBaseline = "alphabetic";
        bcx.fillStyle = rgba(GHI, 0.72 * tA);
        tracked(bcx, cue.eyebrow.toUpperCase(), inx + inw / 2, y0 + bh * 0.155, bw * 0.0070);
      }

      var big = cue.size === "big" || !cue.eyebrow;
      var fs = Math.round(bw * (big ? 0.0495 : 0.0455));
      bcx.font = "500 " + fs + "px NoorCard, system-ui, sans-serif";
      bcx.textAlign = "center"; bcx.textBaseline = "middle";

      /* wrap, then fit: a phrase that will not go in three lines is set
         smaller rather than clipped, because a clipped word is a bug */
      var lines = [], guard = 0;
      while (guard++ < 6) {
        lines = [];
        var ws = String(cue.text || "").split(/\s+/), cur = "";
        for (var i = 0; i < ws.length; i++) {
          var test = cur ? cur + " " + ws[i] : ws[i];
          if (bcx.measureText(test).width > inw && cur) { lines.push(cur); cur = ws[i]; }
          else cur = test;
        }
        if (cur) lines.push(cur);
        if (lines.length <= 3) break;
        fs = Math.round(fs * 0.90);
        bcx.font = "500 " + fs + "px NoorCard, system-ui, sans-serif";
      }

      var lh = fs * 1.32;
      var top = cy - (lines.length - 1) * lh / 2;
      var wi = 0;
      for (var L = 0; L < lines.length; L++) {
        var parts = lines[L].split(" ");
        var widths = [], tot = 0, sp = bcx.measureText(" ").width;
        for (var q = 0; q < parts.length; q++) {
          widths.push(bcx.measureText(parts[q]).width);
          tot += widths[q] + (q ? sp : 0);
        }
        var px = inx + inw / 2 - tot / 2;
        for (var q2 = 0; q2 < parts.length; q2++) {
          /* The words arrive on a clock, not on a fraction of the beat.
             This used to be (u - 0.15 - wi*0.020) / 0.085, which is a share of
             however long the beat happens to be. On the four second title that
             is a word every 85ms starting at 0.64s, which is the rhythm the
             pane was designed around. On the fourteen second chapter title the
             same fractions become a word every 280ms starting at 2.1s, so the
             Lantern held an empty pane for two seconds and then spoke slowly:
             one light with two speaking speeds, set by how long the picture
             happens to dwell. The numbers below are the four second beat's own
             timings, in seconds, applied everywhere. */
          var wa = clamp01((t - 0.639 - wi * 0.0853) / 0.3624);
          wi++;
          if (wa > 0.002) {
            var dy = (1 - ease("settle", wa)) * fs * 0.26;
            bcx.globalAlpha = tA * wa;
            bcx.fillStyle = rgba(PALE, 0.58);
            bcx.fillText(parts[q2], px + widths[q2] / 2, top + L * lh + dy);
            bcx.globalAlpha = 1;
          }
          px += widths[q2] + sp;
        }
      }
      return A;
    }

    var _WV = new T.Vector3();

    return {
      root: g, wake: wake, pane: pane,
      /* atten is the near lens attenuation scene mode passes in (finding 5):
         1 means untouched, and every corridor call omits it and gets 1.
         It scales only the air and the streak, never the core sphere or
         the motes, per the finding's own words: the core sphere may stay
         bright, the air must fall. */
      set: function (sc, br, tsec, s, atten) {
        atten = atten === undefined ? 1 : atten;
        g.scale.setScalar(sc);
        core.rotation.y = tsec * 0.12;
        motes.rotation.y = tsec * 0.06;
        core.material.uniforms.glow.value = 0.90 * br;
        for (var i = 0; i < air.length; i++) {
          var brz = 1 + Math.sin(tsec * (0.31 + i * 0.07) + i * 1.7) * 0.045;
          air[i].m.material.uniforms.gain.value = air[i].gain * br * brz * atten;
          faceLens(air[i].m);
        }
        streak.material.uniforms.gain.value =
          0.215 * br * (1 + Math.sin(tsec * 0.43) * 0.10) * atten;
        faceLens(streak);
        motes.material.opacity = 0.55 * br * moteK;
        var p = mg.attributes.position.array;
        for (var q = 0; q < mbase.length; q++) {
          var b = mbase[q], aa = b[0] + tsec * b[3] * 0.22;
          p[q * 3] = Math.cos(aa) * b[1]; p[q * 3 + 1] = b[2]; p[q * 3 + 2] = Math.sin(aa) * b[1];
        }
        mg.attributes.position.needsUpdate = true;
        return sc;
      },
      trail: function (s, speed, sc, br) {
        var wp = wg.attributes.position.array;
        for (var i = 0; i < wn; i++) {
          var back = (i / wn) * 0.0075 * (0.35 + speed);
          LCURVE.getPoint(clamp01(s - back), _WV);
          var j = i * 3, sp = (hash(i, 13) - 0.5) * 0.62 * sc;
          wp[j]     = _WV.x + sp;
          wp[j + 1] = _WV.y + (hash(i, 19) - 0.5) * 0.52 * sc;
          wp[j + 2] = _WV.z + (hash(i, 29) - 0.5) * 0.52 * sc;
        }
        wg.attributes.position.needsUpdate = true;
        wake.material.opacity = clamp01(speed * 1.55) * 0.42 * br;
        wake.material.size = 0.085 * Math.max(0.45, sc);
      },
      bubble: function (cue, u) {
        if (!cue || !cue.text || !cue.bp) { pane.visible = false; return; }
        var A = paint(cue, u);
        if (A <= 0.002) { pane.visible = false; return; }
        pane.visible = true;
        btex.needsUpdate = true;
        pane.material.opacity = 1;
        pane.position.set(cue.bp[0], cue.bp[1], cue.bp[2]);
        pane.scale.set(cue.bw, cue.bw * bh / bw, 1);
        faceLens(pane);
      }
    };
  }

  var _LV = new T.Vector3(), _LV2 = new T.Vector3();

  function setLantern(list) {
    LCUES = (list || []).slice();
    if (!LCUES.length) { LCURVE = null; return; }
    var P = [];
    for (var i = 0; i < LCUES.length; i++) P.push(vec(LCUES[i].pos));
    if (P.length < 2) P.push(P[0].clone().add(new T.Vector3(0, 0, -0.6)));
    LCURVE = new T.CatmullRomCurve3(P, false, "centripetal", 0.5);
  }

  /* the Lantern reads the film's clock a little ahead of the camera, which is
     the entire mechanism by which it arrives first */
  /* Her breath, as bytes.

     NOORFILM hands the page the chapter, and the chapter now carries a 50Hz
     envelope of the finished narration (scratchpad/voice/envelope.py). The
     light reads it rather than a clock: a clock says the same thing whether
     she is speaking or not, which is what made the first Lantern read as a
     screensaver sitting next to a voice.

     Sampled with a lerp between the two nearest values, so a 50Hz envelope
     does not step at 25fps. */
  var VOICE = null, VHZ = 50;
  function setVoice(o) {
    if (!o || !o.b64) { VOICE = null; return; }
    var s = atob(o.b64), a = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
    VOICE = a; VHZ = o.hz || 50;
  }
  function voiceAt(ms) {
    if (!VOICE || !VOICE.length) return 0;
    var x = ms / 1000 * VHZ, i = Math.floor(x);
    if (i < 0) return VOICE[0] / 255;
    if (i >= VOICE.length - 1) return VOICE[VOICE.length - 1] / 255;
    var f = x - i;
    return (VOICE[i] * (1 - f) + VOICE[i + 1] * f) / 255;
  }

  function lanternDraw(ms, tsec) {
    if (!LANTERN || !LCURVE || !BOARD) return;
    var w = boardAt(ms + LEAD);
    var n = Math.max(1, BOARD.n - 1);
    var a = LCUES[Math.min(LCUES.length - 1, w.i)];
    var b = LCUES[Math.min(LCUES.length - 1, w.i + 1)];

    /* SCENE MODE READS ITS CUES ON A HOLD, NOT A SPLINE (finding 4).
       The corridor Lantern travels a smooth Catmull-Rom curve through
       every cue in the film, which is right for a hallway of evenly spaced
       stations. A scene's cues are not evenly spaced in time or in what
       they mean: s2's own cue is hidden (scale 0.0001) for the whole beat,
       but glide pace eases smoothly across the WHOLE beat regardless, so
       reading 430ms ahead (LEAD) during s2 already had the interpolation
       partway into s3's cue before s3 had started, showing the orb at the
       hole before its time. Cues now carry hold: the light stays at its
       own cue's pos, scale and bright for hold seconds after the beat
       starts, then travels to the next cue's values over what is left of
       the beat, eased with inOutSine. A hold equal to the beat's own
       length means it never moves during that beat at all. This only
       applies under glide pace, which only a scene figure ever sets; every
       corridor film keeps the spline above untouched. */
    var sc, br, k;
    if (PACE === "glide") {
      var durSec = a.dur || 1;
      var hold = a.hold === undefined ? durSec : a.hold;
      var elapsed = w.u * durSec;
      var travel = Math.max(0.0001, durSec - hold);
      var tp = clamp01((elapsed - hold) / travel);
      k = ease("inOutSine", tp);
      _LV.set(lerp(a.pos[0], b.pos[0], k), lerp(a.pos[1], b.pos[1], k), lerp(a.pos[2], b.pos[2], k));
      sc = lerp(a.scale, b.scale, k);
      br = lerp(a.bright, b.bright, k);
    } else {
      var sf = clamp01(w.s * n - w.i);
      k = ease("inOutQuad", sf);
      LCURVE.getPoint(w.s, _LV);
      sc = lerp(a.scale, b.scale, k);
      br = lerp(a.bright, b.bright, k);
    }
    LCURVE.getPoint(clamp01(w.s + 0.0014), _LV2);
    var speed = (PACE === "glide")
      ? (k > 0.001 && k < 0.999 ? Math.sqrt(
          Math.pow(b.pos[0] - a.pos[0], 2) + Math.pow(b.pos[1] - a.pos[1], 2) +
          Math.pow(b.pos[2] - a.pos[2], 2)) / Math.max(0.0001, a.dur || 1) / 9.0 : 0)
      : _LV2.distanceTo(_LV) / 0.0014 / Math.max(1, n) / 9.0;

    /*  THE LANTERN IS A LIGHT IN A DARK ROOM. IN FLAT VECTOR IT IS A SHAPE.
        Carried over unchanged into the flat language it arrives as a blown
        out sun that eats the frame and washes out the words underneath it,
        because it was built to be the brightest object in a scene made
        entirely of emitted light and this scene is made of solid colour.
        Two thirds the size and a third the strength puts it back where it
        belongs: the thing that is speaking, not the thing being looked at. */
    if (LAYOUT_OF === "nut") { sc *= 0.62; br *= 0.34; }
    /* the breath. Brightness carries most of it because a light that changes
       size reads as a balloon; a light that changes brightness reads as one
       that is speaking. The scale term is deliberately small, just enough
       that the swell is felt at the edges rather than only in the core. */
    var vv = voiceAt(ms);
    br *= 1 + 0.24 * vv;
    sc *= 1 + 0.040 * vv;
    LANTERN.root.position.set(
      _LV.x + wander(tsec, 131) * 0.058 * sc,
      _LV.y + wander(tsec, 149) * 0.052 * sc,
      _LV.z + wander(tsec, 167) * 0.045 * sc);
    /* NEAR THE LENS, THE AIR MUST FALL (finding 5).
       glowMat's own dnear/dfar falloff only dims what is FAR from the
       camera; it has nothing for a light that comes close, which is
       exactly what s9 and s10 do on their own path toward the lens. A
       smoothstep on the actual distance from this frame's camera to
       where the Lantern is standing right now scales the air and the
       streak down as it arrives, while the core sphere is left alone so
       the light itself never disappears, only the bloom it was throwing
       into the whole frame. Corridor films never pass this and are
       unaffected. */
    var atten = 1;
    if (PACE === "glide") {
      var camDist = cam.position.distanceTo(LANTERN.root.position);
      var st = clamp01((camDist - 0.5) / (2.2 - 0.5));
      atten = st * st * (3 - 2 * st);
    }
    LANTERN.set(sc, br, tsec, w.s, atten);
    LANTERN.trail(w.s, speed, sc, br);

    /* the pane belongs to the beat the CAMERA is in, not the one the Lantern
       has already gone ahead to */
    var wc = boardAt(ms);
    LANTERN.bubble(LCUES[Math.min(LCUES.length - 1, wc.i)], wc.u);
  }

  function setShots(list) { shots = (list || []).slice(); }

  window.NOORLUME = {
    theme: setTheme,
    /* even pacing for a silent short: no per beat dwell, one move. glide is
       even pacing carried further, for a scene figure whose knots sit close
       enough that dwell/travel reads as a lurch; see GLIDE IS FOR A ROOM in
       boardAt(). */
    pace: function (m) { PACE = (m === "even") ? "even" : (m === "glide") ? "glide" : "dwell"; },
    /* how far the handheld breath moves the camera, scaled from the
       corridor's own 0.104. A scene names its own room size, and a room six
       units deep needs a smaller breath than a corridor twenty units long;
       stage.js reads scene.breath and calls this once before the board is
       mounted. Default 1 keeps every corridor film exactly as it was. */
    breath: function (k) { BREATHK = (k === undefined || k === null) ? 1 : k; },
    themes: Object.keys(THEMES),
    shots: setShots,
    board: mountBoard,
    lantern: setLantern,
    voice: setVoice,
    size: size, mount: mount, draw: draw,
    /* how many samples a pixel of the finished frame is boxed down from.
       2 means the scene is drawn at four times the area. */
    frame: function (name) { PORTRAIT = (name === "tall"); },
    supersample: function (v) { SS = Math.max(1, v); size(); },
    debug: function (m) { DEBUG = m || ""; },
    scale: function (v) { SCALE = v; size(); },
    kinds: Object.keys(FIG),
    _cam: function () { return cam; },
    /* MEASURE THE FIGURE INSTEAD OF GUESSING AT IT.
       Every standing distance in stage.js was a number somebody chose by
       looking, and choosing by looking is how the balance ended up with its
       pans off the frame and the chain ended up a thumbnail in the middle of
       an empty one. A figure has an actual size, in world units, and three.js
       will hand it over. This walks the live board and reports the extent of
       what each figure is really drawing at this instant, so the distance can
       be computed from the picture rather than negotiated with it. */
    _extent: function () {
      var out = [];
      for (var i = 0; i < cues.length; i++) {
        var c = cues[i];
        if (!c.board || !c.f || !c.f.root) continue;
        /* MAIN only. The root carries the room as well, and the room is
           the same size for every figure, which is how the first run of this
           came back with an identical answer fifteen times. */
        var sub = c.f.root.getObjectByName("MAIN") || c.f.root;
        /* WHAT IS VISIBLE, NOT WHAT EXISTS.
           Box3 over the whole group counts every mesh in it, including the
           ones that have faded to nothing. On the sieve that is decisive:
           the rejected reports fall three and a half units below the frame
           while fading out, so the box came back 7.4 units tall, the solve
           stood the camera off at 25.6, and the thing the short is actually
           about, seven reports kept out of six hundred, arrived on screen as
           a row of specks a few pixels across. The camera should frame the
           picture, and a mark at two per cent opacity is not in the picture. */
        sub.updateMatrixWorld(true);
        var b = new T.Box3(), any = false, tmp = new T.Box3();
        sub.traverse(function (m) {
          if (!m.isMesh || !m.geometry) return;
          if (m.material && m.material.opacity !== undefined
              && m.material.opacity < 0.08) return;
          tmp.setFromObject(m);
          if (!isFinite(tmp.min.x) || tmp.min.x > tmp.max.x) return;
          if (any) b.union(tmp); else { b.copy(tmp); any = true; }
        });
        if (!any || !isFinite(b.min.x) || !isFinite(b.max.x)) continue;
        out.push({ i: i,
                   hw: (b.max.x - b.min.x) / 2,
                   hh: (b.max.y - b.min.y) / 2,
                   cx: (b.max.x + b.min.x) / 2 - c.home[0],
                   cy: (b.max.y + b.min.y) / 2 - c.home[1] });
      }
      return out;
    },
    /* AND WHERE EVERY MARK OF IT IS, one by one, in the units a callout
       points in. _extent gives the box the whole figure fills, which is what
       the camera needs. A leader needs the opposite: the position of one
       particular thing, the top lamp or the third column, so the line lands
       on it rather than near it.

       Those two are not the same question and guessing at the second from
       the first is how a short ends up with four labels pointing into empty
       air. A figure places its own root and then scales its contents: the
       lamps figure writes its top lamp at y 0.62 in its own source and draws
       it at 1.41 in the world. Only the scene knows that. So it is asked.

       Reported against the figure's home, which is the origin a callout's
       "to" is measured from, and with the material colour, which is how a
       reader of the dump tells a lamp from the wall it is thrown on. */
    /* the whole scene, for tools that need to look at objects the figures
       do not own: the label planes, the leaders, the key panel */
    _scene: function () { return scene; },
    _marks: function () { return marksNow(); },
    /* AND THE SAME THING AT AN ARBITRARY POINT OF THE FIGURE'S OWN CLOCK,
       which is what settle.py needs: it is asking when the figure stops
       changing, and it cannot ask that through the film, because the short
       warp only ever shows it the slice of the clock it is trying to check. */
    _sample: function (u) {
      for (var i = 0; i < cues.length; i++) {
        var c = cues[i];
        if (!c.board || !c.f || !c.f.at) continue;
        c.f.at(clamp01(u), u * 10, 1);
      }
      return marksNow();
    },
    _three: T
  };

  /* ---- THE SHORT WARP, IN THREE PIECES ----------------------------------
     A silent short remaps the figure's own clock onto the film's, and until
     now it did that with two straight pieces: a fast opening slice so the
     picture is on screen inside two seconds, and one long ramp for the rest.

     Two pieces cannot express what is actually wanted, and the contact sheet
     said so plainly. Measured against the lamps short: the three patches of
     light did not land on the wall until 85% of the film had gone and the
     lamp was not covered until 95%, which is where the closing cards are.
     Every callout describing those events was therefore written over a wall
     with nothing on it, twenty seconds early. Stretching the film does not
     help, because the whole map is proportional: lengthening the film moves
     the words and the picture by the same amount.

     What is wanted is three pieces, and each one is a different job:

         0 .. IN        the fade-in. The picture exists almost at once.
         IN .. MID      the ARGUMENT. Everything the figure has to say
                        happens here, and it is over by MID, which is 80% of
                        the film. The callouts live in this stretch and each
                        one can be written against a picture that is doing
                        the thing it names.
         MID .. 1       the tail. The last fifth of the figure's clock,
                        spread over the last fifth of the film, under the
                        closing cards: a finished picture, still breathing.

     Continuous at both joins, monotonic, and still a pure function of time,
     which is the only property the renderer actually requires. */
  var WARP_MID = 0.80;
  function shortWarp(u, w) {
    var IN = w[0], u0 = w[1], u1 = w[2];
    var MID = w[3] === undefined ? WARP_MID : w[3];
    if (u <= IN) return u0 * (u / IN);
    if (u <= MID) return u0 + (u1 - u0) * (u - IN) / (MID - IN);
    return u1 + (1 - u1) * (u - MID) / (1 - MID);
  }

  function marksNow() {
      var out = [];
      for (var i = 0; i < cues.length; i++) {
        var c = cues[i];
        if (!c.board || !c.f || !c.f.root) continue;
        var sub = c.f.root.getObjectByName("MAIN");
        if (!sub) continue;
        /* FROM THE ROOT, NOT FROM MAIN. updateMatrixWorld on a node
           recomputes that node and everything under it, using its PARENT's
           world matrix as it stands. MAIN's parent is the figure's inner
           group, and the inner group is exactly what these figures animate:
           nutbar zooms it from 0.80 to 2.35 while panning to the sliver,
           and every one of them opens with a small widening. Updating from
           MAIN therefore measured the marks against whatever the inner
           group's matrix was at the last actual render, which is why
           settle.py reported nutbar finished at 0.66 when its closing move
           runs to 0.92: the move was invisible to the measurement. */
        c.f.root.updateMatrixWorld(true);
        /* ALL THE WAY DOWN, NOT ONE LEVEL. This walked MAIN's direct
           children, and several of these figures put their marks inside a
           group so the group can be moved as a unit: the balance hangs each
           of its pans, its tray, its wire and its seven counters off one
           Group per side. Reading one level deep saw a beam and a post and
           reported that the balance had two marks in it, and settle.py,
           which is fed by the same walk, then measured when a picture
           finished by watching the two parts of it that never move. */
        var k = 0;
        sub.traverse(function (m) {
          if (!m.isMesh || !m.geometry) return;
          var b = new T.Box3().setFromObject(m);
          if (!isFinite(b.min.x) || b.min.x > b.max.x) return;
          var col = (m.material && m.material.color)
                  ? "#" + m.material.color.getHexString() : "";
          /* ---- AND MEASURED FROM THE FIGURE, NOT FROM ITS STATION ------
             This subtracted c.home, the station the figure stands on. The
             leader adds back the figure's ROOT, which is the station plus
             whatever the figure lifts itself by to compose inside the frame,
             and for the twin construction that is 0.90 of a unit. So every
             anchor in the set was solved against one origin and drawn
             against another, and every leader in every short was too high by
             exactly the figure's own lift. Measured on the twin short: the
             mark sat at 929 pixels down the frame and the line stopped at
             759, which reads as a line pointing at nothing.

             The figure's own root is the right origin for both. A "to" is
             then a coordinate ON THE FIGURE, which is what an author means
             by it, and it survives the figure being moved. */
          var R = c.f.root.position;
          out.push({ k: k++,
                     x: (b.max.x + b.min.x) / 2 - R.x,
                     y: (b.max.y + b.min.y) / 2 - R.y,
                     z: (b.max.z + b.min.z) / 2 - R.z,
                     w: b.max.x - b.min.x,
                     h: b.max.y - b.min.y,
                     op: m.material ? m.material.opacity : 1,
                     col: col });
        });
      }
      return out;
  }

  /* ---- darkroom · Ibn al-Haytham's dark room, built as a room ----------
     EVERY OTHER FIGURE IN THIS FILE IS AN OBJECT IN AN EMPTY THEME. THIS
     ONE IS THE SPACE THE CAMERA STANDS INSIDE.
     Six planes, a punched aperture, three lamps outside it and the three
     separate patches their light throws on the far wall: the argument of
     al-bayt al-muzlim (the dark house) is the room itself, so a diagram of
     a room is not the same claim as a room to stand inside. This is a
     "scene" figure: stage.js hands it explicit camera views instead of
     working one out from figHome/viewFor, because a room with a fixed
     aperture has to be looked at from particular places, not wherever the
     corridor's sine waves put the camera.

     WHAT BROKE BEFORE THIS EXISTED, so it is not tried again.
     The first pass billboarded the image patches to the lens, the way every
     other glow in this file faces the camera; that is right for a light and
     wrong for a mark PRINTED on a wall, because as the camera moved the
     patch kept swivelling to face it and visibly left the plane of the wall
     it was supposed to be lying on. glowMat is double sided, so a patch
     left at its plain, unrotated orientation reads correctly from every
     angle in this room without ever billboarding. And the back wall's hole
     was first cut by hand-building a fan of triangles around a circle; a
     single ShapeGeometry with a circular hole path is the same real gap
     (a camera looking through it sees the actual lamps behind, unlit and
     far off, because there is nothing else back there) in a fraction of
     the code. */
  FIG.darkroom = function (o) {
    var g = new T.Group();
    var ROOM = o.room || { w: 6.0, h: 3.6, d: 8.0 };
    var HX = ROOM.w / 2, RH = ROOM.h, HZ = ROOM.d / 2;
    var AP = o.aperture || { y: 1.7, r: 0.06 };
    var APOS = new T.Vector3(0, AP.y, -HZ);
    var LAMPS = o.lamps || [];
    /* events are read many times a frame, once per lamp and once for the
       shared verbs; sorted once here so ramp() can trust "at" only grows */
    var EV = (o.events || []).slice().sort(function (a, b) { return a.at - b.at; });

    /* ---- a ramp that REPLAYS every matching event up to tsec ------------
       WHY REPLAY RATHER THAN "READ THE NEAREST PAST EVENT".
       outrays fires twice: in at s7, back out at s8. Reading only the
       nearest event past tsec and lerping from ITS OWN start to ITS OWN
       target skips the fade in entirely the instant tsec passes the second
       event's start, so the fan of rays would jump from full brightness
       straight into fading out with no arrival in between. Replaying keeps
       the value each earlier event actually left behind and lerps forward
       from there, which is what a pure function of a whole events list has
       to do to stay pure. */
    function ramp(verb, id, tsec, start) {
      var val = start === undefined ? 0 : start, base = val;
      for (var i = 0; i < EV.length; i++) {
        var e = EV[i];
        if (e.do !== verb) continue;
        if (id !== undefined && e.id !== id) continue;
        if (tsec < e.at) break;
        var to = e.to === undefined ? 1 : e.to;
        var p = clamp01((tsec - e.at) / Math.max(0.0001, e.dur || 0.001));
        val = lerp(base, to, ease("outCubic", p));
        if (p >= 1) base = to;
      }
      return val;
    }
    /* lift is a displacement in world units, not a 0..1 state, so it keeps
       its own copy of the same replay rather than overloading "to" */
    function liftDy(id, tsec) {
      var val = 0, base = 0;
      for (var i = 0; i < EV.length; i++) {
        var e = EV[i];
        if (e.do !== "lift" || e.id !== id) continue;
        if (tsec < e.at) break;
        var p = clamp01((tsec - e.at) / Math.max(0.0001, e.dur || 0.001));
        val = lerp(base, e.dy || 0, ease("outCubic", p));
        if (p >= 1) base = e.dy || 0;
      }
      return val;
    }

    /* ---- the room: six planes and a punched aperture ---------------------
       A DARK ROOM IS NOT SIX BLACK RECTANGLES.
       Flat planes with no lighting model at all read as a hole cut in the
       scene, not a room, because nothing tells the eye where one wall ends
       and the next begins. Every wall's visible face is turned to point
       INTO the room; three.js does not shade a plane from its back, and a
       wall lit from the wrong side is a wall that is not there. */
    /* FIRST DRAFT READ AS EMPTY SPACE, NOT A ROOM.
       0x070B18 at body 0.5 and glow 0.2-0.3 renders close enough to the
       page's own night background that nothing distinguished a wall from
       the void behind it: six planes built, all effectively invisible. */
    /* SECOND DRAFT READ AS A GOLD TENT, NOT A DARK ROOM.
       Fresnel brightens a surface that turns away from the lens, and a
       floor or ceiling seen from roughly the middle of a room turns away
       from the lens across almost all of its visible area, so full
       strength C.gold as the edge colour painted the entire floor and
       ceiling gold. Dimming the edge colour to 30 percent of full gold
       helped but did not finish the job, per the Director's own look at
       the first two contact sheets: a wall viewed at a grazing angle still
       carried enough gold to read as a warm cast over the whole room, and
       a wall viewed nearly face on (five of the ten beats now, on a wider
       lens standing further back) got almost no rim at all and read as one
       flat blue field with no corner anywhere in it. A fresnel rim cannot
       carry both jobs, warmth and corners, because it only fires at one
       kind of angle and this room is seen at every kind in turn. */
    /* THIRD DRAFT, ROUND TWO. The rim is now a whisper of PALE, never gold,
       so a grazing wall reads as a lighter shade of the same dark blue
       rather than a change of colour; warmth comes only from the things
       that are actually lit (the halo at the hole, the images, a spill
       along each ray). And the corners are no longer the rim's job at all:
       twelve thin static seams are laid where two surfaces actually meet,
       lit at a low constant brightness that owes nothing to the camera's
       angle, so a corner is legible because there is a corner there, not
       because of what angle the lens happens to catch it at. bodyk is
       lowered on the three surfaces a camera inside this room is most
       likely to see edge on (floor, ceiling, the sides), so their own body
       colour stays present across a grazing view instead of thinning to
       black the way a steep bodyk would. */
    var WCORE = new T.Color(0x101A34);
    var WFLOOR = new T.Color(0x0B1226);
    var WEDGE = C.pale.clone().multiplyScalar(0.18);
    /* ---- a level and a gradient per face, not one flat tint on all six
       (round four). A ROOM READS BY TONE DIFFERENCE, NOT BY LINES: the
       twelve seams below say a corner is there, but nothing said a
       CEILING reads darker than a FLOOR, or that a wall is lit toward
       wherever the room's one real light actually reaches it -- so six
       faces at the same level, fresnel and seams notwithstanding, still
       read as one grey shell with wires drawn on it. This is lumeMat's
       own shared shader (LUME_FRAG, shared by every figure in every
       theme) plus exactly one thing, kept out of that shared file so
       nothing else in the project gains it: a soft mix between two
       levels, centred on a reference height and easing away from it.
       For the back wall that reference is the hole itself, so the wall
       is lightest exactly where the light comes from; the floor and the
       ceiling have no height of their own to vary over, so the same
       gradient runs along the only axis either of them has any extent
       in, object-space Y, which for a plane rotated flat is depth
       toward that same hole rather than height. */
    var ROOM_FRAG = [
      "varying vec3 vN; varying vec3 vV; varying float vY; varying float vZ; varying vec2 vU;",
      "uniform vec3 core; uniform vec3 edge; uniform float rim;",
      "uniform float glow; uniform float alphaU; uniform float body;",
      "uniform float band; uniform float sheen;",
      "uniform float dnear; uniform float dfar; uniform float damt; uniform float bodyk;",
      "uniform float yRef; uniform float ySpread; uniform float lvlHi; uniform float lvlLo;",
      "const vec3 KEY = normalize(vec3(-0.42, 0.68, 0.60));",
      "void main(){",
      "  vec3 N = normalize(vN), V = normalize(vV);",
      "  float ndv = abs(dot(N, V));",
      "  float f = pow(1.0 - ndv, rim);",
      "  float d = pow(ndv, bodyk);",
      "  vec3 H = normalize(KEY + V);",
      "  float sp = pow(max(dot(N, H), 0.0), 42.0) * sheen;",
      "  float b = 1.0 + band * 0.055 * sin(vY * 9.0);",
      "  float t = clamp(1.0 - abs(vY - yRef) / ySpread, 0.0, 1.0);",
      "  float lvl = mix(lvlLo, lvlHi, smoothstep(0.0, 1.0, t));",
      "  vec3 c = (core * d * body * b * lvl + edge * f + vec3(1.0, 0.97, 0.90) * sp) * glow;",
      "  c *= 1.0 - smoothstep(dnear, dfar, vZ) * damt;",
      "  gl_FragColor = vec4(c, alphaU);",
      "}"
    ].join("\n");
    function roomMat(core, rim, bk, sheenV, yRef, ySpread, lvlHi, lvlLo) {
      return new T.ShaderMaterial({
        uniforms: {
          core: { value: core.clone() }, edge: { value: WEDGE.clone() },
          rim: { value: rim }, glow: { value: 1.0 }, alphaU: { value: 1.0 },
          body: { value: 1.0 }, band: { value: 1.0 }, sheen: { value: sheenV },
          dnear: { value: 6.0 }, dfar: { value: 13.0 }, damt: { value: 0.30 },
          bodyk: { value: bk },
          yRef: { value: yRef }, ySpread: { value: Math.max(0.001, ySpread) },
          lvlHi: { value: lvlHi }, lvlLo: { value: lvlLo }
        },
        vertexShader: LUME_VERT, fragmentShader: ROOM_FRAG,
        transparent: false, depthWrite: true, blending: T.NormalBlending,
        side: T.FrontSide
      });
    }
    /* THE FIRST TRY READ AS A LIT WINDOW IN A DARK WALL, NOT A GRADIENT.
       A peak level far above its own low end (1.30 against 0.80) on the
       one face the lens looks at nearly head on, next to three faces
       whose grazing view at these cameras is carried almost entirely by
       the constant pale rim rather than by this level at all (d collapses
       toward zero at a grazing angle whatever lvl says), painted a bright
       rectangle exactly where the back wall's own geometry ends and the
       floor, ceiling and sides begin -- a hard edge, not the soft one
       asked for. Every level below is now a quiet ratio of its own low
       end (about 1.15 to 1.2, not 1.6), the spread is wide enough that
       the curve is still rising or falling everywhere a camera actually
       stands rather than flattening into a plateau in the middle, and the
       peaks are kept under about 1.08 on a core whose own blue channel
       already sits near the 22 percent ceiling, so no face can cross it
       on its own account. */
    /* floor and ceiling: PlaneGeometry(w, d) rotated flat, so object-space
       Y is the room's DEPTH (HZ at the back wall, -HZ at the front); the
       floor's rotation (-90 about X) lands +Y on the back/hole side, the
       ceiling's (+90) the opposite, which is why their yRef signs differ. */
    var floorM = roomMat(WFLOOR, 1.6, 0.55, 0.06,  HZ, 2 * HZ, 0.70, 0.58);
    var ceilM  = roomMat(WCORE,  1.8, 0.55, 0.06, -HZ, 2 * HZ, 0.58, 0.48);
    /* side walls: PlaneGeometry(d, RH) is not rotated about X, so object
       space Y is true room height; yRef targets the aperture's own
       height, the one place light actually enters at. */
    var sideM  = roomMat(WCORE,  2.0, 0.55, 0.06, AP.y - RH / 2, RH * 1.1, 0.86, 0.76);
    /* back wall: the ShapeGeometry the hole is cut from is built directly
       in 0..RH, no rotation, so yRef = AP.y is the hole's own height. Kept
       close to the side walls' own range (still the quiet ratio, not the
       first try's 1.6) so the seam where the two meet stays a corner, not
       a second, harder-edged rectangle drawn on top of the one the twelve
       seams already mark. */
    var backM  = roomMat(WCORE,  1.6, 0.90, 0.06, AP.y, RH * 1.4, 0.92, 0.82);
    /* the front wall is where the images fall, so it has to read a shade
       lighter even before anything lands on it: "the first frame has
       something to look at" fails here first, on a wall no different from
       the dark behind it. Lighter in the core colour, and now lightest
       around the height the aperture throws its images at (round four). */
    var frontM = roomMat(WCORE.clone().lerp(C.pale, 0.06), 1.6, 0.90, 0.08,
                          AP.y - RH / 2, RH * 1.1, 0.90, 0.76);

    var floor = new T.Mesh(new T.PlaneGeometry(ROOM.w, ROOM.d), floorM);
    floor.rotation.x = -Math.PI / 2; g.add(floor);            /* normal +y */
    var ceil = new T.Mesh(new T.PlaneGeometry(ROOM.w, ROOM.d), ceilM);
    ceil.rotation.x = Math.PI / 2; ceil.position.set(0, RH, 0); g.add(ceil); /* -y */
    var lwall = new T.Mesh(new T.PlaneGeometry(ROOM.d, RH), sideM);
    lwall.rotation.y = Math.PI / 2; lwall.position.set(-HX, RH / 2, 0); g.add(lwall); /* +x */
    var rwall = new T.Mesh(new T.PlaneGeometry(ROOM.d, RH), sideM);
    rwall.rotation.y = -Math.PI / 2; rwall.position.set(HX, RH / 2, 0); g.add(rwall); /* -x */
    var front = new T.Mesh(new T.PlaneGeometry(ROOM.w, RH), frontM);
    front.rotation.y = Math.PI; front.position.set(0, RH / 2, HZ); g.add(front); /* -z */

    /* THE HOLE IS GEOMETRY, NOT A TEXTURE. A shape wound counter clockwise
       in three.js faces +z, which here is straight into the room from the
       back wall, so no rotation is needed at all. */
    var backShape = new T.Shape();
    backShape.moveTo(-HX, 0); backShape.lineTo(HX, 0);
    backShape.lineTo(HX, RH); backShape.lineTo(-HX, RH); backShape.lineTo(-HX, 0);
    var holePath = new T.Path();
    holePath.absarc(0, AP.y, Math.max(0.02, AP.r), 0, Math.PI * 2, false);
    backShape.holes.push(holePath);
    var back = new T.Mesh(new T.ShapeGeometry(backShape, 24), backM);
    back.position.set(0, 0, -HZ); g.add(back);

    /* ---- a straight rod between two points: the film's only kind of ray --
       ONE SCALED CYLINDER, NOT A CURVE.
       Every ray here is a straight line -- that is the whole of the
       argument, in the spec's own words -- so a TubeGeometry built to bend
       would be spending cycles proving something the figure already
       assumes. r is a radius, not fixed any more: the seams that mark a
       corner and the dust lit pencil along a ray both need to be a
       different thickness from the gold rays themselves. */
    var YAX = new T.Vector3(0, 1, 0);
    function makeRod(mat, r) {
      r = r === undefined ? 0.010 : r;
      var m = new T.Mesh(new T.CylinderGeometry(r, r, 1, 8, 1, true), mat);
      m.visible = false;
      g.add(m);
      return m;
    }
    var _RD = new T.Vector3();
    function placeRod(m, p0, p1) {
      var dx = p1.x - p0.x, dy = p1.y - p0.y, dz = p1.z - p0.z;
      var len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (len < 0.0008) { m.visible = false; return; }
      m.visible = true;
      m.position.set((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, (p0.z + p1.z) / 2);
      m.scale.set(1, len, 1);
      _RD.set(dx, dy, dz).normalize();
      m.quaternion.setFromUnitVectors(YAX, _RD);
    }

    /* ---- twelve seams, lit at a low constant brightness the camera's
       angle cannot change (finding 2). A room reads as a room only where a
       corner actually shows; the fresnel rim above shows one only where the
       lens happens to be looking along it, which round one's checklist
       found was nowhere on five of the ten beats. This is a corner because
       there is a corner there, drawn once at build time and never touched
       again. */
    var EDGE_COL = C.pale.clone().multiplyScalar(0.55);
    /* a third as bright as before (round four finding 2): the seams still
       say where a corner is, they no longer compete with the tone the
       faces themselves now carry for saying it. */
    function edgeMat() {
      return lumeMat(EDGE_COL, EDGE_COL,
        { rim: 0, glow: 0.16 / 3, body: 1.0, sheen: 0, add: true,
          depthWrite: false, damt: 0.5 });
    }
    var FLO = [[-HX, 0, -HZ], [HX, 0, -HZ], [HX, 0, HZ], [-HX, 0, HZ]];
    var CEI = [[-HX, RH, -HZ], [HX, RH, -HZ], [HX, RH, HZ], [-HX, RH, HZ]];
    var EDGES = [];
    for (var ei = 0; ei < 4; ei++) EDGES.push([FLO[ei], FLO[(ei + 1) % 4]]);
    for (ei = 0; ei < 4; ei++) EDGES.push([CEI[ei], CEI[(ei + 1) % 4]]);
    for (ei = 0; ei < 4; ei++) EDGES.push([FLO[ei], CEI[ei]]);
    EDGES.forEach(function (pair) {
      placeRod(makeRod(edgeMat(), 0.008),
        new T.Vector3(pair[0][0], pair[0][1], pair[0][2]),
        new T.Vector3(pair[1][0], pair[1][1], pair[1][2]));
    });

    /* ---- the hole itself (finding 1, retuned round three). The back wall
       showed nothing at the aperture at all: no disc, no halo, no pencil of
       light. apDot sits BEHIND the wall, on the lamps' own side, and depth
       tests normally -- the wall is opaque everywhere except the one
       circular hole actually cut into its geometry, so apDot shows only
       through that hole, cropped to it by the wall's own geometry rather
       than by its own falloff, exactly the way a real pinhole would. Cold
       and small before any lamp is lit, hot gold once one is.

       Round three: the two together read as one glowing ball floating in
       the dark rather than a hole in a wall.

       apDot's own plane went smaller at first, on the reasoning that a
       smaller source is a smaller disc; it is the opposite -- AT THAT
       SIZE. The physical hole crops apDot to the aperture's own radius no
       matter how big apDot's plane is underneath; what the plane's SIZE
       controls is WHERE IN ITS OWN FALLOFF that tiny crop lands, and a
       plane merely BARELY bigger than the hole (round three's own first
       try) crops right at the falloff's outer edge, where the curve is
       already dropping toward zero -- an invisible pinprick, not a bright
       one. Sized much larger instead, the crop landed on the flat,
       near-peak middle of the curve: the whole tiny disc read at close to
       the falloff's maximum, evenly, which is even -- a fat, soft ball,
       not the hard point a pinhole actually throws (round four finding
       3). What a pinhole needs is neither extreme: a plane a few times
       the hole's own radius, not fifty, so the physical crop lands partway
       down the SAME falloff curve rather than at either of its ends --
       bright at the hole's own centre, genuinely dim toward its own edge,
       which is a hard point where round three's plane gave one flat disc.

       apGlow used to be a small, fairly bright halo tight around the hole;
       a small bright thing next to a small bright thing is one ball. It is
       a broad, DIM, warm gradient roughly 1.4 units in radius -- low k1 so
       it falls off gently the whole way out rather than dropping steeply
       near the disc, and no hot core of its own (that hot core belongs at
       the disc, not spread across the wall) -- so the plaster receives
       light visibly but keeps its own dark tone right up to the disc, and
       the disc stays the one point the eye lands on. Untouched this round:
       it is already the broad dim wash finding 3 asks to keep. */
    var apDot = glowPlane(1.4, C.cool, C.cool,
      { k1: 4.0, k2: 13.0, gain: 0.34, hot: 1.4, dnear: 6, dfar: 13, damt: 0.3 });
    apDot.position.set(0, AP.y, -HZ - 0.04);
    g.add(apDot);
    var apGlow = glowPlane(2.8, C.pale, C.gold,
      { k1: 1.5, k2: 6.0, gain: 0.05, hot: 0.0, dnear: 6, dfar: 13, damt: 0.4 });
    apGlow.position.set(0, AP.y, -HZ + 0.02);
    g.add(apGlow);

    /* ---- the lamps: a flame and a halo, dark until their own cue -------- */
    function makeLamp() {
      var flame = new T.Mesh(new T.SphereGeometry(0.09, 14, 10),
        lumeMat(C.pale, C.goldhi, { rim: 1.8, glow: 1.2, bodyk: 2.4, body: 1.0,
          sheen: 0.4, add: true, depthWrite: false, damt: 0.2 }));
      var halo = glowPlane(0.42, C.pale, C.gold,
        { k1: 2.4, k2: 7.0, gain: 0.30, hot: 0.85, dnear: 6, dfar: 13, damt: 0.3 });
      flame.scale.setScalar(0.0001); halo.scale.setScalar(0.0001);
      g.add(flame); g.add(halo);
      return { flame: flame, halo: halo };
    }
    var lampRig = LAMPS.map(function (L) {
      var pos = L.pos || [0, 0, 0];
      var lamp = makeLamp();
      /* ONE MATERIAL PER LAMP, NOT ONE FOR ALL OF THEM.
         A single rayMat built outside this map and handed to every lamp's
         two legs meant all three lamps' rods pointed at the very same
         uniforms object, so whichever lamp the frame loop below visited
         LAST decided the glow every ray on screen actually rendered with.
         At s3 lampA's ray was fully drawn and lit while lampB and lampC
         sat dark, but lampB and lampC ran through the loop after lampA
         and each wrote their own (zero) glow into that shared uniform, so
         lampA's ray vanished the instant the loop reached the next lamp,
         even though lampA's own numbers were correct the whole time. */
      var rayMat = lumeMat(C.pale, C.gold,
        { rim: 1.4, glow: 1.1, body: 0.8, sheen: 0.3, add: true,
          depthWrite: false, damt: 0.4 });
      var leg1 = makeRod(rayMat), leg2 = makeRod(rayMat);
      /* the dust the ray passes through, not the ray itself (finding 1): a
         fatter, dimmer, paler rod riding the same aperture to front wall
         path as leg2, the segment the camera can actually see. Its own
         material for the same reason rayMat above is no longer shared. */
      var beamMat = lumeMat(C.pale, C.pale,
        { rim: 1.0, glow: 0.5, body: 0.5, sheen: 0, add: true,
          depthWrite: false, damt: 0.5 });
      var beam = makeRod(beamMat, 0.05);
      var bead = new T.Mesh(new T.SphereGeometry(0.024, 12, 8),
        lumeMat(C.pale, C.goldhi, { rim: 1.8, glow: 1.3, bodyk: 2.6, body: 1.0,
          sheen: 0.4, add: true, depthWrite: false, damt: 0.2 }));
      bead.visible = false; g.add(bead);
      /* the picture the hole throws on the front wall (finding 2, retuned
         round three): too small and too dim to read as three separate
         patches at s8's own viewing distance. Rebuilt to the Director's own
         numbers -- a soft halo reaching out to about 0.45 (base size 0.9,
         matched by the per-frame scale below going to 1 rather than 0.7 at
         full bloom) and, inside that, a tight hot core (steep k2, no
         matching steepness on k1) landing at roughly 0.10, so each image
         reads as a warm patch with a bright heart rather than one soft
         smear or an invisible one. */
      var image = glowPlane(0.9, C.pale, C.gold,
        { k1: 1.8, k2: 14.0, gain: 0.55, hot: 1.3, dnear: 6, dfar: 13, damt: 0.3 });
      image.scale.setScalar(0.0001); g.add(image);
      return { id: L.id, base: new T.Vector3(pos[0], pos[1], pos[2]),
               lamp: lamp, leg1: leg1, leg2: leg2, beam: beam, bead: bead, image: image };
    });

    /* ---- the old idea, brushed away: a fan out of the viewer's own eye --
       Thinner than the gold rays (radius 0.006, not 0.010) and split into a
       near half and a far half so each one fades with distance from its
       own origin instead of reading as one even, blown beam (finding 6). */
    var OUT_N = 7, outrayNear = [], outrayFar = [];
    for (var oi = 0; oi < OUT_N; oi++) {
      outrayNear.push(makeRod(
        lumeMat(C.cool, C.cool, { rim: 1.2, glow: 0.7, body: 0.5, sheen: 0.1,
          add: true, depthWrite: false, damt: 0.4 }), 0.006));
      outrayFar.push(makeRod(
        lumeMat(C.cool, C.cool, { rim: 1.2, glow: 0.7, body: 0.5, sheen: 0.1,
          add: true, depthWrite: false, damt: 0.4 }), 0.006));
    }
    var OUT_EYE = new T.Vector3(0, 1.6, 2.2);

    var _A = new T.Vector3(), _B = new T.Vector3(), _IMG = new T.Vector3(),
        _MID = new T.Vector3();

    return {
      root: g,
      at: function (u, tsec, f) {
        f = f === undefined ? 1 : f;

        /* the constant walls still owe the film's own fade in and out
           (they were not scaled by f before, which is fine while f is 1
           for the whole span but would show a full bright room on a frame
           that is meant to be fading, so it is cheap insurance to include
           it here) */
        floorM.uniforms.glow.value = 1.0 * f;
        ceilM.uniforms.glow.value = 1.0 * f;
        sideM.uniforms.glow.value = 1.0 * f;

        /* the wall the film opens on, and the "images" event's late boost */
        var wg = ramp("wallglow", undefined, tsec, 0);
        frontM.uniforms.glow.value = (1.0 + wg * 3.0) * f;
        var imgBoost = ramp("images", undefined, tsec, 1);

        var anyLit = 0;
        for (var i = 0; i < lampRig.length; i++) {
          var R = lampRig[i], id = R.id;
          var dy = liftDy(id, tsec);
          _A.copy(R.base); _A.y += dy;                    /* the lamp, lifted */
          var lit = ramp("lamp", id, tsec, 0);
          anyLit = Math.max(anyLit, lit);
          /* CANDLES FLICKER (round six). wander() is already a smooth,
             seeded, exact function of time -- built for a camera's slow
             breath, one cycle every several seconds. Fed a scaled-up tsec
             it is the same organic, non-repeating curve at candle speed
             instead, a few hertz rather than a few tenths: still pure in
             tsec, never Math.random, so frame N is frame N on any machine.
             Seeded 60 apart per lamp (wander spends 37 per octave across
             its own three) so three candles never breathe in lockstep.
             Plus or minus six percent, applied everywhere this lamp's own
             light shows -- the flame, its ray, its image on the wall --
             so all three move together as one burning thing rather than a
             steady ray off a flickering flame. */
          var flicker = 1 + 0.06 * wander(tsec * 40, 211 + i * 60);
          R.lamp.flame.position.copy(_A);
          R.lamp.halo.position.copy(_A);
          var flameS = Math.max(0.0001, 0.09 * lit), haloS = Math.max(0.0001, 0.7 * lit);
          R.lamp.flame.scale.setScalar(flameS);
          R.lamp.halo.scale.setScalar(haloS);
          R.lamp.flame.material.uniforms.glow.value = 0.55 * lit * flicker * f;
          R.lamp.halo.material.uniforms.gain.value = 0.20 * lit * flicker * f;

          /* the image point, recomputed every frame from where the lamp
             actually is: a lift moves it live and nothing here has to know
             that happened. Same formula as the spec's own note, generalised
             from the room's own back and front wall positions rather than
             the fixed -4/4 the spec was written against. */
          var k = (2 * HZ) / (-HZ - _A.z);
          _IMG.set(APOS.x + (APOS.x - _A.x) * k,
                   APOS.y + (APOS.y - _A.y) * k,
                   HZ);

          /* THE FIRST LEG IS BEHIND AN OPAQUE WALL, SO ITS TRAVEL TIME IS
             WASTED ON A LEG THE VIEWER CANNOT SEE.
             Splitting the event's progress by the two legs' REAL lengths
             (lamp to aperture is 7 to 8 units, aperture to the front wall a
             little more) spent the first third to half of "ray" drawing
             the segment that sits outside the room, entirely hidden by the
             back wall except for the width of the hole -- so for the first
             one to one and a half seconds of s3 the screen showed nothing
             at all, then the visible leg snapped through its whole length
             in the time that was left. A ray is a diagram, not a physics
             sim: the light is given to the hole almost at once (15% of the
             event) and the rest of the event draws the leg the camera can
             actually see, across the whole room, at a pace that matches
             the beat it is drawn in. */
          var drawn = ramp("ray", id, tsec, 0);
          var d1 = clamp01(drawn / 0.15);
          var d2 = clamp01((drawn - 0.15) / 0.85);
          _B.copy(_A).lerp(APOS, d1);
          placeRod(R.leg1, _A, _B);
          var e1 = _B.clone();
          _B.copy(APOS).lerp(_IMG, d2);
          placeRod(R.leg2, APOS, _B);
          placeRod(R.beam, APOS, _B);
          if (lit <= 0.02) { R.leg1.visible = false; R.leg2.visible = false; R.beam.visible = false; }
          R.leg1.material.uniforms.glow.value = 0.30 * lit * flicker * f;
          R.leg2.material.uniforms.glow.value = 0.30 * lit * flicker * f;
          /* the dust the ray passes through, not the ray itself (finding 1):
             fat, faint, pale, and only present where the ray has actually
             drawn (d2), so it never shows ahead of the light */
          R.beam.material.uniforms.glow.value = 0.07 * lit * d2 * f;
          var tip = d2 > 0.001 ? _B : (d1 > 0.001 ? e1 : null);
          if (tip && drawn < 0.999 && lit > 0.02) {
            R.bead.visible = true;
            R.bead.position.copy(tip);
            R.bead.scale.setScalar(0.024);
            R.bead.material.uniforms.glow.value = 0.45 * lit * f;
          } else {
            R.bead.visible = false;
          }

          var bloom = ramp("image", id, tsec, 0);
          R.image.position.set(_IMG.x, _IMG.y, _IMG.z - 0.02);
          R.image.scale.setScalar(Math.max(0.0001, bloom));
          R.image.material.uniforms.gain.value = 0.55 * bloom * imgBoost * flicker * f;
        }

        /* the hole (finding 1): a faint cold point before any lamp is lit,
           hot gold once one is, cropped to the physical opening by the
           back wall's own geometry; the halo it throws on the room side of
           that same wall; and a faint warm falloff across the wall itself,
           not only the halo plane sitting in front of it (finding 2, 8) */
        apDot.material.uniforms.inner.value.copy(C.cool).lerp(C.goldhi, anyLit);
        apDot.material.uniforms.outer.value.copy(C.cool).lerp(C.gold, anyLit);
        /* round four finding 3. Halving alone (0.40 to 0.20, 0.85 to
           0.425) still bloomed the whole physical opening: the bloom pass
           thresholds on LUMINANCE (cut 0.57) before it ever blurs
           anything, and the lit disc's hot core cleared that threshold
           almost everywhere inside the aperture at either gain, because
           the fall off is steep in RADIUS but the aperture is tiny in
           radius to begin with. Measured against that threshold directly
           (Lantern film math, not guesswork): 0.21 on top of the same
           0.20 rest is what puts the crossing at roughly a quarter of the
           hole's own radius, an eight pixel core on the tall frame at
           five units, with the rest of the opening left dim enough that
           the bright pass never touches it -- the broad dim wash finding
           3 asks to keep.

           Round five finding 1: at s1, before any lamp, the rest term
           alone (0.20) rendered on the actual still as a two or three
           pixel smudge close enough to the room's own dark tone that it
           did not read at all -- true on the crop, not only by eye. C.cool
           at hot 1.4 puts the disc's own peak luminance at gain times
           about 1.33; the bright pass only fires past 0.57, so 0.20 (0.27)
           sat safely under the cut but too close to the floor to see. 0.34
           (0.45) stays under that same cut with real margin -- no bloom,
           so it still reads as a point rather than a lit halo -- while
           landing well over twice the old floor, and the lit state's own
           total (0.20 plus 0.21, well past the cut once the disc goes
           gold) stays far above it. */
        apDot.material.uniforms.gain.value = (0.34 + 0.21 * anyLit) * f;
        apGlow.material.uniforms.gain.value = (0.010 + 0.05 * anyLit) * f;
        backM.uniforms.glow.value = (1.0 + 0.5 * anyLit) * f;

        /* the old idea, and its own retraction: a fan from the viewer's eye
           toward the back wall, cool where every other light in the room is
           warm, thin, and split near from far so it fades with distance
           from its own origin instead of reading as one blown beam
           (finding 6); the near half never goes brighter than the gold
           rays' own 0.30 glow */
        var outAmt = ramp("outrays", undefined, tsec, 0);
        for (var oj = 0; oj < OUT_N; oj++) {
          var az = (oj / (OUT_N - 1) - 0.5) * 0.85;
          var el = (oj / (OUT_N - 1) - 0.5) * 0.62;
          var tx = Math.sin(az) * 1.3, ty = 1.6 + el, tz = -HZ + 0.25;
          var p = clamp01(outAmt * 1.06);
          _B.set(OUT_EYE.x + (tx - OUT_EYE.x) * p,
                 OUT_EYE.y + (ty - OUT_EYE.y) * p,
                 OUT_EYE.z + (tz - OUT_EYE.z) * p);
          _MID.copy(OUT_EYE).lerp(_B, 0.45);
          placeRod(outrayNear[oj], OUT_EYE, _MID);
          placeRod(outrayFar[oj], _MID, _B);
          if (outAmt <= 0.01) { outrayNear[oj].visible = false; outrayFar[oj].visible = false; }
          outrayNear[oj].material.uniforms.glow.value = 0.20 * outAmt * f;
          outrayFar[oj].material.uniforms.glow.value = 0.09 * outAmt * f;
        }
      }
    };
  };
})();
