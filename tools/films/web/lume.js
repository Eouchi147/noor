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

  /* ---- easing, evaluated not stepped ----------------------------------- *
     anime.js drives the words; this layer cannot use it, because a timeline
     that is seeked backwards must give the same answer as one seeked
     forwards, and the only way to guarantee that is a closed form.          */
  function outExpo(t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); }
  function outQuint(t) { return 1 - Math.pow(1 - t, 5); }
  function linear(t) { return t; }
  /* the analytic step response of a damped spring, normalised to settle at 1.
     The constants are the same ones stage.js names, so a figure rising in
     this layer and a headline arriving in the DOM are the same movement. */
  function spring(stiffness, damping, mass) {
    var w0 = Math.sqrt(stiffness / mass);
    var z = damping / (2 * Math.sqrt(stiffness * mass));
    if (z < 1) {
      var wd = w0 * Math.sqrt(1 - z * z);
      return function (t) {
        if (t <= 0) return 0;
        return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + (z * w0 / wd) * Math.sin(wd * t));
      };
    }
    return function (t) { return t <= 0 ? 0 : 1 - Math.exp(-w0 * t) * (1 + w0 * t); };
  }
  var SP = {
    settle: spring(92, 16, 1),
    lift:   spring(74, 14, 1.1),
    snap:   spring(140, 18, 0.9),
    open:   spring(60, 15, 1.3)
  };
  var EASE = { outExpo: outExpo, outQuint: outQuint, linear: linear,
               settle: SP.settle, lift: SP.lift, snap: SP.snap, open: SP.open };
  function ease(name, t) { return (EASE[name] || outExpo)(Math.max(0, Math.min(1, t))); }
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
    "varying vec3 vN; varying vec3 vV; varying float vY; varying float vZ;",
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
    "varying vec3 vN; varying vec3 vV; varying float vY; varying float vZ;",
    "uniform vec3 core; uniform vec3 edge; uniform float rim;",
    "uniform float glow; uniform float alpha; uniform float body;",
    "uniform float band; uniform float sheen;",
    "uniform float dnear; uniform float dfar; uniform float damt;",
    "const vec3 KEY = normalize(vec3(-0.42, 0.68, 0.60));",
    "void main(){",
    "  vec3 N = normalize(vN), V = normalize(vV);",
    "  float ndv = abs(dot(N, V));",
    "  float f = pow(1.0 - ndv, rim);",
    "  float d = pow(ndv, 1.35);",
    "  vec3 H = normalize(KEY + V);",
    "  float sp = pow(max(dot(N, H), 0.0), 42.0) * sheen;",
    /* a whisper of latitude banding, so a sphere has a surface rather than a
       gradient. It is generated, not a texture, and it is a function of the
       geometry only, so it never crawls between frames. */
    "  float b = 1.0 + band * 0.055 * sin(vY * 9.0);",
    "  vec3 c = (core * d * body * b + edge * f + vec3(1.0, 0.97, 0.90) * sp) * glow;",
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
        alpha: { value: opt.alpha === undefined ? 1.0 : opt.alpha },
        body:  { value: opt.body === undefined ? 1.0 : opt.body },
        band:  { value: opt.band === undefined ? 0.0 : opt.band },
        sheen: { value: opt.sheen === undefined ? 0.55 : opt.sheen },
        dnear: { value: opt.dnear === undefined ? 5.0 : opt.dnear },
        dfar:  { value: opt.dfar === undefined ? 13.0 : opt.dfar },
        damt:  { value: opt.damt === undefined ? 0.72 : opt.damt }
      },
      vertexShader: LUME_VERT, fragmentShader: LUME_FRAG,
      transparent: opt.alpha !== undefined && opt.alpha < 1,
      depthWrite: opt.depthWrite === undefined ? true : opt.depthWrite,
      blending: opt.add ? T.AdditiveBlending : T.NormalBlending,
      side: opt.side || T.FrontSide
    });
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
     A sphere that is dark in the middle and burning at the edge, inside a
     second, larger shell that is nearly transparent. Two surfaces make a
     volume; one surface makes a disc. */
  FIG.orb = function (o) {
    var g = new T.Group();
    var core = new T.Mesh(new T.SphereGeometry(1, 96, 64),
      lumeMat(o.warm || C.gold, o.hot || C.pale,
              { rim: 2.4, glow: 1.0, body: 0.62, band: 1.0 }));
    var shell = new T.Mesh(new T.SphereGeometry(1.46, 72, 48),
      lumeMat(new T.Color(0x000000), (o.hot || C.goldhi),
              { rim: 3.2, glow: 0.85, alpha: 0.55, add: true, depthWrite: false,
                body: 0.0, side: T.BackSide }));
    g.add(core); g.add(shell);

    /* a ring of specks held in orbit, so the eye has something to measure
       the sphere's size against */
    var n = o.motes === undefined ? 260 : o.motes;
    var pos = new Float32Array(n * 3), base = [];
    for (var i = 0; i < n; i++) {
      var a = hash(i, 3) * Math.PI * 2;
      var r = 1.9 + hash(i, 5) * 1.5;
      var y = (hash(i, 7) - 0.5) * 1.1;
      base.push([a, r, y, 0.25 + hash(i, 11) * 0.6]);
      pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = y; pos[i * 3 + 2] = Math.sin(a) * r;
    }
    var pg = new T.BufferGeometry();
    pg.setAttribute("position", new T.BufferAttribute(pos, 3));
    var pts = new T.Points(pg, new T.PointsMaterial({
      color: C.pale.clone(), size: 0.09, map: dotTex(), transparent: true, opacity: 0.75,
      blending: T.AdditiveBlending, depthWrite: false, sizeAttenuation: true
    }));
    g.add(pts);

    return {
      root: g,
      at: function (u, tsec, f) {
        f = f === undefined ? 1 : f;
        var k = ease(o.ease || "lift", u * 3.2);
        g.scale.setScalar(lerp(0.55, 1, k));
        core.material.uniforms.glow.value = lerp(0.15, 1, k) * f;
        shell.material.uniforms.glow.value = lerp(0.0, 0.8, k) * f;
        g.rotation.y = tsec * 0.16;
        pts.material.opacity = 0.75 * k * f;
        var p = pg.attributes.position.array;
        for (var i = 0; i < base.length; i++) {
          var b = base[i], a = b[0] + tsec * b[3] * 0.28;
          p[i * 3] = Math.cos(a) * b[1]; p[i * 3 + 1] = b[2]; p[i * 3 + 2] = Math.sin(a) * b[1];
        }
        pg.attributes.position.needsUpdate = true;
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
      for (var i = 0; i < count; i++) {
        var a = (i / count) * Math.PI * 2 + r * 0.4;
        var v = new T.Vector3(Math.cos(a) * rad, Math.sin(a) * rad * 0.62, z);
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
    var eg = new T.CylinderGeometry(0.0062, 0.0062, 1, 8, 1, true);
    var em = lumeMat(C.goldhi, C.pale, { rim: 1.1, glow: 1.05, body: 0.75, sheen: 0.0, dnear: 4.6, dfar: 11.0, damt: 0.7 });
    var lines = new T.InstancedMesh(eg, em, Math.max(1, edges.length));
    var UP = new T.Vector3(0, 1, 0), DIR = new T.Vector3(), MID = new T.Vector3();
    var EM = new T.Matrix4(), EQ = new T.Quaternion(), ES = new T.Vector3();
    for (var e = 0; e < edges.length; e++) {
      DIR.subVectors(edges[e].b, edges[e].a);
      MID.addVectors(edges[e].a, edges[e].b).multiplyScalar(0.5);
      EQ.setFromUnitVectors(UP, DIR.clone().normalize());
      ES.set(1, DIR.length(), 1);
      EM.compose(MID, EQ, ES);
      lines.setMatrixAt(e, EM);
    }
    lines.instanceMatrix.needsUpdate = true;
    g.add(lines);

    /* the nodes: instanced spheres, so a thousand of them cost one call */
    var sg = new T.SphereGeometry(0.092, 24, 18);
    var sm = lumeMat(C.gold, C.goldhi, { rim: 2.0, glow: 1.15, body: 1.0, sheen: 0.35, dnear: 4.6, dfar: 10.5, damt: 0.82 });
    var inst = new T.InstancedMesh(sg, sm, nodes.length);
    inst.instanceMatrix.setUsage(T.DynamicDrawUsage);
    g.add(inst);
    var M = new T.Matrix4(), Q = new T.Quaternion(), S = new T.Vector3();

    var maxGen = rings.length - 1;

    return {
      root: g,
      at: function (u, tsec, f) {
        f = f === undefined ? 1 : f;
        /* the chain builds generation by generation across the first 70% of
           the beat, then a pulse runs the whole length of it */
        var grow = clamp01(u / 0.7);
        var front = grow * (maxGen + 0.9);
        for (var i = 0; i < nodes.length; i++) {
          var n = nodes[i];
          var k = clamp01(front - n.gen);
          var e = ease("snap", k * 1.6);
          S.setScalar(e * (0.85 + 0.35 * Math.sin(tsec * 1.6 + i)));
          M.compose(n.p, Q, S);
          inst.setMatrixAt(i, M);
        }
        inst.instanceMatrix.needsUpdate = true;
        sm.uniforms.glow.value = 1.15 * f;
        em.uniforms.glow.value = 1.05 * clamp01(front / maxGen) * f;
        /* the whole chain turns slowly: depth you can see rather than infer */
        g.rotation.y = -0.5 + Math.sin(tsec * 0.22) * 0.34;
        g.rotation.x = -0.14 + Math.cos(tsec * 0.17) * 0.06;
        g.scale.setScalar(lerp(0.70, 0.86, ease("open", u * 2.4)));
      }
    };
  };

  /* ---- stream · something carried across time ---------------------------
     Specks running along a curve, brightest at the head. Used where the film
     says "and it travelled": a text out of a city, a practice down a century. */
  FIG.stream = function (o) {
    var g = new T.Group();
    var curve = new T.CatmullRomCurve3((o.path || [
      [-4.2, -1.1, 0], [-1.6, 1.0, 1.2], [1.4, -0.7, -1.0], [4.2, 1.0, 0]
    ]).map(function (p) { return new T.Vector3(p[0], p[1], p[2]); }));

    var tubeM = lumeMat(C.gold, C.goldhi, { rim: 2.0, glow: 0.7, alpha: 0.6, add: true, depthWrite: false, body: 0.45 });
    var tube = new T.Mesh(new T.TubeGeometry(curve, 240, 0.036, 16, false), tubeM);
    g.add(tube);

    var n = o.motes || 420;
    var pos = new Float32Array(n * 3), off = [];
    for (var i = 0; i < n; i++) off.push(hash(i, 13));
    var pg = new T.BufferGeometry();
    pg.setAttribute("position", new T.BufferAttribute(pos, 3));
    var pts = new T.Points(pg, new T.PointsMaterial({
      color: C.pale.clone(), size: 0.14, map: dotTex(), transparent: true, opacity: 0.9,
      blending: T.AdditiveBlending, depthWrite: false
    }));
    g.add(pts);
    var v = new T.Vector3();

    return {
      root: g,
      at: function (u, tsec, f) {
        f = f === undefined ? 1 : f;
        var head = clamp01(ease("linear", u * 1.15));
        var p = pg.attributes.position.array;
        for (var i = 0; i < off.length; i++) {
          var s = (off[i] + tsec * 0.14) % 1;
          var live = s <= head ? 1 : 0;
          curve.getPointAt(Math.min(0.9999, s), v);
          p[i * 3] = v.x * live; p[i * 3 + 1] = live ? v.y : 999; p[i * 3 + 2] = v.z * live;
        }
        pg.attributes.position.needsUpdate = true;
        tubeM.uniforms.glow.value = 0.7 * ease("outExpo", u * 3) * f;
        pts.material.opacity = 0.9 * f;
        g.rotation.y = Math.sin(tsec * 0.2) * 0.22;
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
      var m = new T.Mesh(new T.TorusGeometry(rad, 0.030 + i * 0.006, 24, 320),
        lumeMat(i % 2 ? C.gold : C.goldhi, C.pale, { rim: 1.8, glow: 1.15, body: 0.8, sheen: 0.7, dnear: 5.2, dfar: 12.0, damt: 0.6 }));
      m.rotation.x = 1.1 - i * 0.34;
      m.rotation.y = i * 0.5;
      g.add(m);
      parts.push({ m: m, dir: i % 2 ? -1 : 1, rad: rad });
    }
    /* one mark riding the outermost ring, so the turn is readable */
    var bead = new T.Mesh(new T.SphereGeometry(0.075, 28, 20),
      lumeMat(C.pale, C.parch, { rim: 1.4, glow: 1.4, body: 1.0 }));
    g.add(bead);
    var last = parts[parts.length - 1];
    var BEAD = new T.Vector3();

    return {
      root: g,
      at: function (u, tsec, f) {
        f = f === undefined ? 1 : f;
        var k = ease("open", u * 2.6);
        g.scale.setScalar(lerp(0.62, 0.84, k));
        for (var i = 0; i < parts.length; i++) {
          var p = parts[i];
          p.m.rotation.z = tsec * 0.22 * p.dir * (1 + i * 0.3);
          p.m.material.uniforms.glow.value = clamp01(ease("snap", (u * 2.2) - i * 0.18)) * f;
        }
        /* THE BEAD RIDES THE RING, and the only reliable way to say that is
           to take a point on the ring's own circle and put it through the
           ring's own matrix. Hand-rolling the rotation put it three units off
           to one side, orbiting nothing. */
        var a = tsec * 0.5;
        BEAD.set(Math.cos(a) * last.rad, Math.sin(a) * last.rad, 0);
        last.m.updateMatrix();
        bead.position.copy(BEAD.applyMatrix4(last.m.matrix));
        bead.material.uniforms.glow.value = 1.4 * k * f;
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
    var W = o.w || 2.5, H = o.h || 1.6;
    var items = [];

    for (var i = 0; i < faces.length; i++) {
      var f = faces[i];
      var cv = document.createElement("canvas");
      cv.width = 768; cv.height = Math.round(768 * H / W);
      var cx = cv.getContext("2d");
      var bg = cx.createLinearGradient(0, 0, cv.width * 0.6, cv.height);
      bg.addColorStop(0, "#141B30"); bg.addColorStop(1, "#070B18");
      cx.fillStyle = bg; cx.fillRect(0, 0, cv.width, cv.height);
      if (f.draw && window[f.draw]) { window[f.draw](cx, cv.width, cv.height, f); }
      else {
        cx.strokeStyle = "rgba(233,200,106,.5)"; cx.lineWidth = 3;
        cx.strokeRect(14, 14, cv.width - 28, cv.height - 28);
        if (f.text) {
          cx.fillStyle = "#F4E2AE";
          cx.font = "600 " + Math.round(cv.height * 0.17) + "px system-ui,sans-serif";
          cx.textAlign = "center"; cx.textBaseline = "middle";
          cx.fillText(String(f.text), cv.width / 2, cv.height / 2);
        }
      }
      var tex = new T.CanvasTexture(cv);
      tex.colorSpace = T.SRGBColorSpace || undefined;
      /* THE FACE IS LIT PAPER, NOT A LAMP.
         Drawn at full strength the pale numerals sat above the bloom's bright
         pass, and every card drowned in a halo of its own contents -- a page
         of a mushaf glowing like a bulb. The whole plane is multiplied down
         until its brightest ink falls just under the threshold, so the card
         is read and only its gold edge gives off light. */
      var plane = new T.Mesh(new T.PlaneGeometry(W, H),
        new T.MeshBasicMaterial({ map: tex, color: 0x7C7C7C, transparent: false }));
      /* the lit edge: a slightly larger plane behind, in gold, additive.
         It is what makes a flat rectangle read as an object with a thickness
         rather than a sticker. */
      var edge = new T.Mesh(new T.PlaneGeometry(W + 0.06, H + 0.06),
        new T.MeshBasicMaterial({ color: C.gold.clone(), transparent: true, opacity: 0.55,
                                  blending: T.AdditiveBlending, depthWrite: false }));
      edge.position.z = -0.012;
      var card = new T.Group(); card.add(edge); card.add(plane);
      g.add(card);
      items.push({ card: card, plane: plane, edge: edge, i: i });
    }

    var spread = o.spread === undefined ? 1.18 : o.spread;

    return {
      root: g,
      at: function (u, tsec, f) {
        f = f === undefined ? 1 : f;
        var open = ease("open", u * 2.0);
        for (var i = 0; i < items.length; i++) {
          var it = items[i];
          var mid = (items.length - 1) / 2;
          var slot = (i - mid);
          var k = ease("lift", (u * 2.4) - i * 0.13);
          it.card.position.x = slot * (W * 0.78 * spread) * open;
          it.card.position.y = Math.sin(tsec * 0.5 + i) * 0.045;
          it.card.position.z = -Math.abs(slot) * 0.28 * open;
          it.card.rotation.y = -slot * 0.20 * open + Math.sin(tsec * 0.24) * 0.05;
          it.card.scale.setScalar(lerp(0.82, 1, k));
          it.plane.material.opacity = f;
          it.plane.material.transparent = f < 1;
          it.edge.material.opacity = 0.62 * k * f;
          it.card.visible = k > 0.001;
        }
      }
    };
  };

  /* =======================================================================
     THE RENDERER, THE BLOOM, AND THE CAMERA
     ======================================================================= */

  var canvas, renderer, scene, cam, W = 0, H = 0;
  var rtScene, rtA, rtB, rtC, blurMat, cutMat, quadScene, quadCam, comboMat, showMat, DEBUG = "";
  var current = null, cues = [], BLOOM_DIV = 8, SCALE = 1, SS = 2;

  function makeTargets() {
    var sw = Math.max(4, Math.round(W * SS)), sh = Math.max(4, Math.round(H * SS));
    var bw = Math.max(4, Math.round(W / BLOOM_DIV)), bh = Math.max(4, Math.round(H / BLOOM_DIV));
    [rtScene, rtA, rtB, rtC].forEach(function (r) { if (r) r.dispose(); });
    rtScene = new T.WebGLRenderTarget(sw, sh, { minFilter: T.LinearFilter, magFilter: T.LinearFilter });
    if (comboMat) comboMat.uniforms.texel.value.set(1 / sw, 1 / sh);
    rtA = new T.WebGLRenderTarget(bw, bh, { minFilter: T.LinearFilter, magFilter: T.LinearFilter });
    rtB = new T.WebGLRenderTarget(bw, bh, { minFilter: T.LinearFilter, magFilter: T.LinearFilter });
    rtC = new T.WebGLRenderTarget(bw, bh, { minFilter: T.LinearFilter, magFilter: T.LinearFilter });
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
    "  vec4 b0 = texture2D(base, v + texel * vec2(-0.5,-0.5));",
    "  vec4 b1 = texture2D(base, v + texel * vec2( 0.5,-0.5));",
    "  vec4 b2 = texture2D(base, v + texel * vec2(-0.5, 0.5));",
    "  vec4 b3 = texture2D(base, v + texel * vec2( 0.5, 0.5));",
    "  vec4 b = (b0 + b1 + b2 + b3) * 0.25;",
    /* A BLUR CONSERVES ENERGY, WHICH IS WHY ONE BLUR IS NOT A BLOOM.
       Spreading a bright pixel over a hundred times the area divides its peak
       by a hundred, so a single wide Gaussian comes back as a stain you can
       barely see -- which is exactly what the bloom buffer looked like when I
       finally rendered it on its own. Real glare is not one falloff, it is
       several at once: a tight core around the source and a wide veil in the
       air. Two scales, summed, at a gain that puts the light back. */
    "  vec3 g = (texture2D(bloom, v).rgb + texture2D(bloom2, v).rgb * wide) * amt;",
    "  vec3 c = filmic((b.rgb + g) * exposure);",
    "  float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);",
    "  c += (n - 0.5) / 255.0;",
    "  gl_FragColor = vec4(c, clamp(max(b.a, dot(g, vec3(0.55))), 0.0, 1.0));",
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
        uniforms: { tex: { value: null }, cut: { value: 0.46 }, knee: { value: 0.22 } },
        vertexShader: QUAD_VERT, fragmentShader: CUT_FRAG, depthTest: false, depthWrite: false
      });
      comboMat = new T.ShaderMaterial({
        uniforms: { base: { value: null }, bloom: { value: null }, bloom2: { value: null },
                    amt: { value: 5.4 }, wide: { value: 1.05 },
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
  var SHOT = {
    push:  { z: [7.6, 5.9],  y: [0, 0.16], x: [0, 0],    ease: "linear" },
    pull:  { z: [5.4, 7.4],  y: [0.12, 0], x: [0, 0],    ease: "outQuint" },
    "in":  { z: [9.4, 6.8],  y: [-0.3, 0], x: [0, 0],    ease: "open" },
    drift: { z: [6.9, 6.6],  y: [0, 0],    x: [-0.5, 0.5], ease: "linear" },
    hold:  { z: [7.0, 7.0],  y: [0, 0],    x: [0, 0],    ease: "linear" }
  };

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
    (list || []).forEach(function (c) {
      var make = FIG[c.kind];
      if (!make) return;
      var f = make(c);
      f.root.visible = false;
      scene.add(f.root);
      cues.push({ f: f, at: c.at, dur: c.dur, shot: c.shot || "push",
                  fade: c.fade === undefined ? 520 : c.fade,
                  dim: c.place === "over" ? 0.46 : 1 });
    });
  }

  /* ---- one frame -------------------------------------------------------- */
  function draw(ms) {
    if (!renderer) size();
    if (!renderer) return;
    var t = ms / 1000;

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
      if (!live) { live = c; u = uu; }
    }

    /* the camera answers the beat's own shot */
    var s = SHOT[(live && live.shot) || "hold"] || SHOT.hold;
    var k = ease(s.ease, u);
    cam.position.set(lerp(s.x[0], s.x[1], k), lerp(s.y[0], s.y[1], k), lerp(s.z[0], s.z[1], k));
    cam.lookAt(0, 0, 0);

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

  window.NOORLUME = {
    size: size, mount: mount, draw: draw,
    /* how many samples a pixel of the finished frame is boxed down from.
       2 means the scene is drawn at four times the area. */
    supersample: function (v) { SS = Math.max(1, v); size(); },
    debug: function (m) { DEBUG = m || ""; },
    scale: function (v) { SCALE = v; size(); },
    kinds: Object.keys(FIG),
    _three: T
  };
})();
