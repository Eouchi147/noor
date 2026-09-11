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
    var c = document.createElement("canvas"); c.width = c.height = 64;
    var x = c.getContext("2d");
    var g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(255,255,255,.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
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
    "  float hot = exp(-pow((vU.x - headU) * 20.0, 2.0)) * headOn;",
    /* the band at the wavefront was at full strength and, being the
       brightest thing in the frame, it was what the bloom found -- so the
       head of the stream came out as a white smear a tenth of the frame
       across, wide enough in 9:16 to sit on top of the caption. It marks
       where the light has got to; it is not a headlamp. */
    "  c += edge * hot * 0.26;",
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

  function lumeMat(core, edge, opt) {
    opt = opt || {};
    return new T.ShaderMaterial({
      uniforms: {
        core:  { value: core.clone() },
        edge:  { value: edge.clone() },
        rim:   { value: opt.rim === undefined ? 2.2 : opt.rim },
        glow:  { value: opt.glow === undefined ? 1.0 : opt.glow },
        alphaU:{ value: opt.alpha === undefined ? 1.0 : opt.alpha },
        body:  { value: opt.body === undefined ? 1.0 : opt.body },
        band:  { value: opt.band === undefined ? 0.0 : opt.band },
        sheen: { value: opt.sheen === undefined ? 0.55 : opt.sheen },
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
      vertexShader: LUME_VERT, fragmentShader: LUME_FRAG,
      transparent: opt.alpha !== undefined && opt.alpha < 1,
      depthWrite: opt.depthWrite === undefined ? true : opt.depthWrite,
      blending: opt.add ? T.AdditiveBlending : T.NormalBlending,
      side: opt.side || T.FrontSide
    });
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

    /* motes, so the eye has something to measure the volume against */
    var n = o.motes === undefined ? 300 : o.motes;
    var pos = new Float32Array(n * 3), base = [];
    for (var q = 0; q < n; q++) {
      var a = hash(q, 3) * Math.PI * 2;
      var r = 1.15 + Math.pow(hash(q, 5), 0.7) * 2.1;
      var y = (hash(q, 7) - 0.5) * 1.7;
      base.push([a, r, y, 0.2 + hash(q, 11) * 0.55]);
      pos[q * 3] = Math.cos(a) * r; pos[q * 3 + 1] = y; pos[q * 3 + 2] = Math.sin(a) * r;
    }
    var pg = new T.BufferGeometry();
    pg.setAttribute("position", new T.BufferAttribute(pos, 3));
    var pts = new T.Points(pg, new T.PointsMaterial({
      color: C.pale.clone(), size: 0.055, map: dotTex(), transparent: true, opacity: 0.55,
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

        pts.material.opacity = 0.55 * k * f;
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
        for (var i = 0; i < nodes.length; i++) {
          var n = nodes[i];
          var k = clamp01(front - n.gen);
          var e = ease("snap", k * 1.6);
          var pulse = 0.85 + 0.35 * Math.sin(tsec * 1.6 + i);
          S.setScalar(e * pulse);
          M.compose(n.p, ZQ, S);
          inst.setMatrixAt(i, M);
          /* the halo arrives a shade after the bead and is brightest just as
             the light is handed on, so the chain reads as a wave of lighting
             rather than a set of lamps switched on together */
          /* every hand is not lit to the same degree: a little spread,
             fixed per node, keeps a crowded generation from pooling into
             one blob when their halos land on top of each other */
          var hk = e * (0.66 + 0.34 * hash(i, 53)) *
                   (0.84 + 0.16 * Math.sin(tsec * 1.6 + i));
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

    /* THE SPECKS RIDE THE WAVEFRONT, THEY DO NOT FILL THE PIPE.
       Scattered evenly along the whole path they were invisible: a few dozen
       dim points spread over four units, none of them bright enough to reach
       the bloom's bright pass. They are gathered behind the head now, where
       there is something to see, and they thin out with the distance they
       have travelled -- which is what carrying something looks like. */
    var n = o.motes || 300;
    var pos = new Float32Array(n * 3), lag = [];
    for (var i = 0; i < n; i++) lag.push(Math.pow(hash(i, 13), 1.7) * 0.34 + hash(i, 29) * 0.02);
    var pg = new T.BufferGeometry();
    pg.setAttribute("position", new T.BufferAttribute(pos, 3));
    var pts = new T.Points(pg, new T.PointsMaterial({
      color: C.pale.clone(), size: 0.098, map: dotTex(), transparent: true, opacity: 0.72,
      blending: T.AdditiveBlending, depthWrite: false, sizeAttenuation: true
    }));
    g.add(pts);

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

        var head = clamp01(ease("outQuint", u / 0.8));
        tubeM.uniforms.headU.value = head;
        tubeM.uniforms.glow.value = 1.25 * f;

        var p = pg.attributes.position.array;
        for (var i = 0; i < lag.length; i++) {
          var s = head - lag[i] - Math.sin(tsec * 2.1 + i) * 0.006;
          if (s <= 0.0005) { p[i * 3 + 1] = 9999; continue; }
          curve.getPointAt(Math.min(0.9999, s), V3);
          /* a little scatter across the pipe, steady in time so nothing crawls */
          p[i * 3]     = V3.x + (hash(i, 41) - 0.5) * 0.085;
          p[i * 3 + 1] = V3.y + (hash(i, 43) - 0.5) * 0.085;
          p[i * 3 + 2] = V3.z + (hash(i, 47) - 0.5) * 0.085;
        }
        pg.attributes.position.needsUpdate = true;
        pts.material.opacity = 0.72 * f;

        curve.getPointAt(Math.min(0.9999, Math.max(0.0001, head)), V3);
        bead.position.copy(V3);
        beadGlow.position.copy(V3);
        faceLens(beadGlow);
        var hv = f * (head < 0.999 ? 1 : 0.62);
        bead.material.uniforms.glow.value = 1.30 * hv;
        beadGlow.material.uniforms.gain.value = 0.26 * hv;
        bead.visible = beadGlow.visible = head > 0.004;
      }
    };
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
  var rtScene, rtA, rtB, rtC, blurMat, cutMat, quadScene, quadCam, comboMat, showMat, DEBUG = "";
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

  function makeTargets() {
    var sw = Math.max(4, Math.round(W * SS)), sh = Math.max(4, Math.round(H * SS));
    var bw = Math.max(4, Math.round(W / BLOOM_DIV)), bh = Math.max(4, Math.round(H / BLOOM_DIV));
    [rtScene, rtA, rtB, rtC].forEach(function (r) { if (r) r.dispose(); });
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
    "uniform float amt; uniform float wide; uniform float exposure; uniform vec2 texel;",
    "vec3 filmic(vec3 x){",
    "  const float a=2.51, b=0.03, c=2.43, d=0.59, e=0.14;",
    "  return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);",
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
    "  float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);",
    "  c += (n - 0.5) / 255.0;",
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
    "  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));",
    "  gl_FragColor = vec4(c, clamp(lum * 2.4 + dot(g, vec3(0.35)), 0.0, 1.0));",
    "}"
  ].join("\n");

  var QUAD_VERT = "varying vec2 v; void main(){ v = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";

  function size() {
    if (!canvas) {
      canvas = document.getElementById("lume");
      if (!canvas) return;
      renderer = new T.WebGLRenderer({ canvas: canvas, antialias: false, alpha: true, powerPreference: "low-power" });
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
      cutMat = new T.ShaderMaterial({
        uniforms: { tex: { value: null }, cut: { value: 0.57 }, knee: { value: 0.20 } },
        vertexShader: QUAD_VERT, fragmentShader: CUT_FRAG, depthTest: false, depthWrite: false
      });
      comboMat = new T.ShaderMaterial({
        uniforms: { base: { value: null }, bloom: { value: null }, bloom2: { value: null },
                    amt: { value: 5.8 }, wide: { value: 1.05 },
                    exposure: { value: 0.98 }, texel: { value: new T.Vector2(1, 1) } },
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
    var bx = Math.sin(tsec * 0.37) * 0.030 + Math.sin(tsec * 0.11 + 1.7) * 0.022;
    var by = Math.cos(tsec * 0.29) * 0.026 + Math.sin(tsec * 0.13 + 0.6) * 0.017;
    var bz = Math.sin(tsec * 0.19 + 2.2) * 0.030;
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
    cam.rotateZ(lerp(s.roll[0], s.roll[1], k) + Math.sin(tsec * 0.23) * 0.0025);
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
  function makeDust() {
    var n = 1100, pos = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) {
      pos[i * 3]     = (hash(i, 101) - 0.5) * 30;
      pos[i * 3 + 1] = (hash(i, 103) - 0.5) * 19;
      pos[i * 3 + 2] = (hash(i, 107) - 0.5) * 24 - 5;
    }
    var dg = new T.BufferGeometry();
    dg.setAttribute("position", new T.BufferAttribute(pos, 3));
    return new T.Points(dg, new T.PointsMaterial({
      color: C.pale.clone(), size: 0.046, map: dotTex(), transparent: true,
      opacity: 0.44, blending: T.AdditiveBlending, depthWrite: false,
      sizeAttenuation: true
    }));
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
    scene.add(dust);
    (list || []).forEach(function (c) {
      var make = FIG[c.kind];
      if (!make) return;
      var f = make(c);
      f.root.visible = false;
      scene.add(f.root);
      cues.push({ f: f, at: c.at, dur: c.dur, shot: c.shot || "push",
                  fade: c.fade === undefined ? 520 : c.fade,
                  dim: c.place === "over" ? 0.55 : 1,
                  back: c.place === "over" ? 1 : 0 });
    });
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

    /* bright pass, then two separable blurs, all at a quarter of the frame */
    var quad = quadScene.children[0];
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
    for (var i = 0; i < list.length; i++) {
      var v = list[i];
      P.push(vec(v.eye));
      L.push(vec(v.look));
      F.push(v.fov);
      R.push(v.roll || 0);
      T0.push(v.at);
      T1.push(v.at + v.dur);
    }
    if (P.length < 2) { P.push(P[0].clone().add(new T.Vector3(0, 0, -0.6))); L.push(L[0].clone());
                        F.push(F[0]); R.push(R[0]); T0.push(T0[0] + 1); T1.push(T1[0] + 1); }
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
    return {
      n: P.length, P: P, L: L, F: F, R: R, t0: T0, t1: T1, DW: DW,
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
  function boardAt(ms) {
    var b = BOARD, n = b.n, i = 0;
    for (i = 0; i < n; i++) if (ms < b.t1[i] || i === n - 1) break;
    var dur = Math.max(1, b.t1[i] - b.t0[i]);
    var u = clamp01((ms - b.t0[i]) / dur);
    /* DWELL, THEN TRAVEL. The first 62% of a beat holds near its knot with a
       slow float; the last 38% carries to the next. Eased at both ends, so the
       camera is never seen to start or to stop. */
    var HOLD = 0.62, dw = b.DW ? b.DW[i] : 0.10;
    var local = u <= HOLD ? (u / HOLD) * dw
                          : dw + ease("inOutQuad", (u - HOLD) / (1 - HOLD)) * (1 - dw);
    var s = (i + local) / Math.max(1, n - 1);
    return { i: i, u: u, s: clamp01(s), local: clamp01(local) };
  }

  var _BP = new T.Vector3(), _BL = new T.Vector3();

  function boardCamera(ms, tsec) {
    var b = BOARD, w = boardAt(ms);
    b.cp.getPoint(w.s, _BP);
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
    _BL.copy(b.L[w.i]).lerp(b.L[jj], w.local);
    /* the breath: a camera held by a person is never perfectly still, and a
       perfectly still camera is the loudest thing in an animated film */
    var bx = Math.sin(tsec * 0.31) * 0.034 + Math.sin(tsec * 0.11 + 1.7) * 0.021;
    var by = Math.cos(tsec * 0.26) * 0.029 + Math.sin(tsec * 0.13 + 0.6) * 0.016;
    var bz = Math.sin(tsec * 0.17 + 2.2) * 0.026;
    cam.position.set(_BP.x + bx, _BP.y + by, _BP.z + bz);
    cam.lookAt(_BL.x + bx * 0.3, _BL.y + by * 0.3, _BL.z);
    var j = Math.min(b.n - 1, w.i + 1), k = w.u;
    cam.rotateZ(lerp(b.R[w.i], b.R[j], ease("inOutQuad", k)) +
                Math.sin(tsec * 0.21) * 0.0022);
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
    scene.add(dust);

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
      cues.push({ f: f, at: c.at, dur: c.dur, home: c.pos.slice(),
                  fade: 0, dim: c.dim === undefined ? 1 : c.dim, back: 0, board: true });
    });
    BOARD = makeBoard(views || []);
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
       that the camera is moving through it rather than past a decal */
    var n = 300, mpos = new Float32Array(n * 3), mbase = [];
    for (var q = 0; q < n; q++) {
      var a0 = hash(q, 3) * Math.PI * 2;
      var r0 = 1.15 + Math.pow(hash(q, 5), 0.7) * 2.1;
      var y0 = (hash(q, 7) - 0.5) * 1.7;
      mbase.push([a0, r0, y0, 0.2 + hash(q, 11) * 0.55]);
      mpos[q * 3] = Math.cos(a0) * r0; mpos[q * 3 + 1] = y0; mpos[q * 3 + 2] = Math.sin(a0) * r0;
    }
    var mg = new T.BufferGeometry();
    mg.setAttribute("position", new T.BufferAttribute(mpos, 3));
    var motes = new T.Points(mg, new T.PointsMaterial({
      color: C.pale.clone(), size: 0.055, map: dotTex(), transparent: true, opacity: 0.55,
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
      var A = clamp01(u / 0.11) * clamp01((0.84 - u) / 0.17);
      if (A <= 0.002) return 0;
      var op = ease("open", clamp01(u / 0.20));
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
      var tA = clamp01((u - 0.13) / 0.09) * clamp01((0.84 - u) / 0.14);
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
          var wa = clamp01((u - 0.15 - wi * 0.020) / 0.085);
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
      set: function (sc, br, tsec, s) {
        g.scale.setScalar(sc);
        core.rotation.y = tsec * 0.12;
        motes.rotation.y = tsec * 0.06;
        core.material.uniforms.glow.value = 0.90 * br;
        for (var i = 0; i < air.length; i++) {
          var brz = 1 + Math.sin(tsec * (0.31 + i * 0.07) + i * 1.7) * 0.045;
          air[i].m.material.uniforms.gain.value = air[i].gain * br * brz;
          faceLens(air[i].m);
        }
        streak.material.uniforms.gain.value =
          0.215 * br * (1 + Math.sin(tsec * 0.43) * 0.10);
        faceLens(streak);
        motes.material.opacity = 0.55 * br;
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
  function lanternDraw(ms, tsec) {
    if (!LANTERN || !LCURVE || !BOARD) return;
    var w = boardAt(ms + LEAD);
    var n = Math.max(1, BOARD.n - 1);
    var sf = clamp01(w.s * n - w.i);
    var k = ease("inOutQuad", sf);
    var a = LCUES[Math.min(LCUES.length - 1, w.i)];
    var b = LCUES[Math.min(LCUES.length - 1, w.i + 1)];

    LCURVE.getPoint(w.s, _LV);
    LCURVE.getPoint(clamp01(w.s + 0.0014), _LV2);
    var speed = _LV2.distanceTo(_LV) / 0.0014 / Math.max(1, n) / 9.0;

    var sc = lerp(a.scale, b.scale, k);
    var br = lerp(a.bright, b.bright, k);
    LANTERN.root.position.set(
      _LV.x + Math.sin(tsec * 0.37) * 0.055 * sc,
      _LV.y + Math.cos(tsec * 0.29) * 0.050 * sc,
      _LV.z + Math.sin(tsec * 0.23 + 0.7) * 0.042 * sc);
    LANTERN.set(sc, br, tsec, w.s);
    LANTERN.trail(w.s, speed, sc, br);

    /* the pane belongs to the beat the CAMERA is in, not the one the Lantern
       has already gone ahead to */
    var wc = boardAt(ms);
    LANTERN.bubble(LCUES[Math.min(LCUES.length - 1, wc.i)], wc.u);
  }

  function setShots(list) { shots = (list || []).slice(); }

  window.NOORLUME = {
    shots: setShots,
    board: mountBoard,
    lantern: setLantern,
    size: size, mount: mount, draw: draw,
    /* how many samples a pixel of the finished frame is boxed down from.
       2 means the scene is drawn at four times the area. */
    frame: function (name) { PORTRAIT = (name === "tall"); },
    supersample: function (v) { SS = Math.max(1, v); size(); },
    debug: function (m) { DEBUG = m || ""; },
    scale: function (v) { SCALE = v; size(); },
    kinds: Object.keys(FIG),
    _three: T
  };
})();
