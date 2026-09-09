/* NOOR reel · the picture, v2: night, and one light that breathes.
   ===========================================================================
   The old picture was a heads up display: a grid, a radar circle, ticks,
   counters, rays. It is gone. What is left is the least a beautiful frame
   needs and nothing else:

     the night      the site's own night, a slow vertical gradient, nearly
                    black, so parchment type sits on it without a scrim
     the light      one soft gold radial glow behind the words. It breathes
                    on its own (a slow sine, a whole cycle every fifteen
                    seconds), swells on the beats the type layer reports,
                    and, in One verse, follows the reciter's voice frame by
                    frame, because the renderer measures the recording and
                    hands the envelope in.
     the star       one Islamic star polygon {n/k}, drawn as a hairline,
                    larger than the frame so only its arcs cross the corners,
                    turning about one degree a second. Faint enough to be
                    felt rather than read.
     the dust       a very few slow stars, and grain, and a vignette.

   Three colours, all the site's: night (#04060F to #0A1024), gold (#C9A227,
   #E9C86A) and parchment (#FFFEF7), which only the type uses. Nothing is
   sampled, nothing is figurative, nothing is licensed: it is arithmetic.

   The type layer sets these for every frame (see NOORREEL.seek):
     t       seconds
     cue     0..1  how far into the idea on screen we are
     bloom   0..1  gold in the air: rises on a beat, falls over a bar
     hit     0..1  the accent itself, decaying fast
     pulse   0..1  the reciter's loudness (One verse only)
     recede  0..1  how much the words own the frame
     focus   the y (0..1, top to bottom) the light stands on
   =========================================================================== */
(function () {
  "use strict";
  /* one look for every kind: the difference between them is choreography and
     sound, not colour. `pal` is kept so old plans still load. */
  var LOOK = {
    skyA: [0.016, 0.024, 0.059],   /* #04060F */
    skyB: [0.039, 0.063, 0.141],   /* #0A1024 */
    gold: [0.788, 0.635, 0.153],   /* #C9A227 */
    goldHi: [0.914, 0.784, 0.416]  /* #E9C86A */
  };

  var VS = "#version 300 es\nin vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }";

  var FS = [
"#version 300 es",
"precision highp float;",
"out vec4 O;",
"uniform vec2 R; uniform float t, seed, cue, bloom, pulse, hit, recede, focus, scrim, progress;",
"uniform float n, k;",
"uniform vec3 skyA, skyB, gold, goldHi;",
"",
"/* an integer hash: the same on every machine and every build, which sin() is not */",
"float hash(vec2 p){ uvec2 q = uvec2(ivec2(floor(p*64.0))) * uvec2(1597334677u, 3812015801u); uint h = (q.x ^ q.y ^ uint(seed*1000.0)) * 1597334677u; h ^= h >> 15u; h *= 2246822519u; h ^= h >> 13u; return float(h) * (1.0/4294967296.0); }",
"float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);",
"  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }",
"float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 3; i++){ v += a*noise(p); p = p*2.03 + 7.1; a *= 0.5; } return v; }",
"",
"/* distance to the outline of the star polygon {n/k}, radius r, turned by ph */",
"float starD(vec2 p, float r, float nn, float kk, float ph){",
"  float a = atan(p.y, p.x) + ph; float L = length(p);",
"  float inner = r * cos(3.14159265*kk/nn) / cos(3.14159265*(kk-1.0)/nn);",
"  float seg = 6.2831853/nn; float m = mod(a, seg);",
"  vec2 A = vec2(r, 0.0); vec2 B = vec2(inner*cos(seg*0.5), inner*sin(seg*0.5)); vec2 C = vec2(r*cos(seg), r*sin(seg));",
"  vec2 q = vec2(L*cos(m), L*sin(m));",
"  vec2 e1 = B-A, e2 = C-B;",
"  float d1 = length(q - A - e1*clamp(dot(q-A,e1)/dot(e1,e1), 0.0, 1.0));",
"  float d2 = length(q - B - e2*clamp(dot(q-B,e2)/dot(e2,e2), 0.0, 1.0));",
"  return min(d1, d2);",
"}",
"float hair(float d, float w){ return exp(-d*d/(w*w)); }",
"",
"void main(){",
"  vec2 fc = gl_FragCoord.xy; vec2 uv = (fc - 0.5*R) / R.y;      /* y up, centre 0 */",
"  vec2 centre = vec2(0.0, 0.5 - focus);",
"  uv *= 1.0 - 0.035 * clamp(t/22.0, 0.0, 1.0);                   /* the slowest push */",
"",
"  /* the night */",
"  float v = clamp(uv.y + 0.55, 0.0, 1.0);",
"  vec3 col = mix(skyB, skyA, v*0.82 + 0.10);",
"",
"  /* the light that breathes. One slow sine under it, the beats over it, and",
"     the reciter's voice over that: three sources, one glow. */",
"  float breath = 0.62 + 0.16*sin(t*0.42) + 0.10*sin(t*0.17 + 1.3);",
"  float amt = breath * (0.74 + 0.55*bloom + 0.30*hit + 0.95*pulse) * (1.0 - 0.18*recede);",
"  vec2 g = (uv - centre) * vec2(1.0, 0.86);",
"  float L = length(g);",
"  col += goldHi * exp(-L*L*6.0) * 0.195 * amt;                   /* the core */",
"  col += gold   * exp(-L*2.8)   * 0.065 * amt;                   /* the reach */",
"  /* the air it stands in, moving very slowly */",
"  float hz = fbm(uv*1.7 + vec2(t*0.013, -t*0.008));",
"  col += gold * hz * 0.020 * (0.5 + 0.5*amt) * (1.0 - smoothstep(0.25, 0.85, L));",
"",
"  /* the star: one hairline polygon, larger than the frame, turning about a",
"     degree a second. Faint enough to be felt and not read. */",
"  float rot = -1.5708 + t*0.017;",
"  float d1 = starD(uv - centre*0.55, 0.88, n, k, rot);",
"  float ln = hair(d1, 0.0019);",
"  col += gold * ln * (0.060 + 0.045*bloom + 0.05*pulse) * (1.0 - 0.35*recede);",
"",
"  /* the dust: a few slow stars, and nothing else in the sky */",
"  for (int i = 0; i < 2; i++){",
"    float sc = 15.0 + float(i)*11.0; vec2 p = uv*sc + vec2(t*0.004*(1.0+float(i)), t*0.006);",
"    vec2 cell = floor(p), f = fract(p) - 0.5; float h = hash(cell + float(i)*31.7);",
"    if (h > 0.972){ vec2 o = vec2(hash(cell+1.3), hash(cell+2.7)) - 0.5;",
"      float tw = 0.55 + 0.45*sin(t*(0.5+1.4*hash(cell+5.1)) + h*40.0);",
"      col += 0.24 * tw * exp(-dot(f-o*0.6, f-o*0.6)*300.0) * vec3(1.0, 0.985, 0.94); } }",
"",
"  col = 1.0 - exp(-col*1.25);                                    /* a soft shoulder */",
"  /* the ground the words stand on: the faintest darkening where they are */",
"  float dy = (uv.y - centre.y)/0.42; col *= 1.0 - scrim*0.30*exp(-dy*dy);",
"  col = pow(max(col, 0.0), vec3(0.96));",
"  col *= 1.0 - 0.62 * pow(length(uv*vec2(0.80, 0.58)), 2.1);     /* vignette */",
"  col += (hash(fc + floor(t*30.0)*0.37) - 0.5) * 0.022;          /* grain */",
"  O = vec4(clamp(col, 0.0, 1.0), 1.0);",
"}"
  ].join("\n");

  var gl = null, prog = null, U = {}, canvas = null, W2 = 405, H2 = 720;

  function compile(type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error("shader: " + gl.getShaderInfoLog(s));
    return s;
  }

  function init() {
    canvas = document.getElementById("gl");
    canvas.width = W2; canvas.height = H2;
    gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true, antialias: false, alpha: false });
    if (!gl) throw new Error("no webgl2");
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("link: " + gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    ["R", "t", "seed", "cue", "bloom", "pulse", "hit", "recede", "focus", "scrim", "progress",
     "n", "k", "skyA", "skyB", "gold", "goldHi"]
      .forEach(function (nm) { U[nm] = gl.getUniformLocation(prog, nm); });
    gl.viewport(0, 0, W2, H2);
    gl.uniform2f(U.R, W2, H2);
    gl.uniform3fv(U.skyA, LOOK.skyA); gl.uniform3fv(U.skyB, LOOK.skyB);
    gl.uniform3fv(U.gold, LOOK.gold); gl.uniform3fv(U.goldHi, LOOK.goldHi);
  }

  window.NOORSCENE = {
    init: function () { if (!gl) init(); },
    info: function () { return { ok: !!gl && !gl.isContextLost(), renderer: gl ? gl.getParameter(gl.RENDERER) : "", size: [W2, H2] }; },
    /* what the card is: once per build. Only the star's {n/k} and the seed of
       the grain differ from card to card; the colours never do. */
    card: function (c) {
      if (!gl) init();
      gl.uniform1f(U.seed, Number(c.seed || 7));
      gl.uniform1f(U.n, Number(c.n || 8));
      gl.uniform1f(U.k, Number(c.k || 3));
    },
    /* the frame: what this instant is */
    frame: function (f) {
      if (gl.isContextLost()) throw new Error("webgl context lost");
      gl.uniform1f(U.t, f.t || 0); gl.uniform1f(U.cue, f.cue || 0); gl.uniform1f(U.bloom, f.bloom || 0);
      gl.uniform1f(U.pulse, f.pulse || 0); gl.uniform1f(U.hit, f.hit || 0); gl.uniform1f(U.recede, f.recede || 0);
      gl.uniform1f(U.focus, f.focus == null ? 0.46 : f.focus);
      gl.uniform1f(U.scrim, f.scrim == null ? 0.5 : f.scrim);
      gl.uniform1f(U.progress, f.progress || 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3); gl.finish();
      var err = gl.getError(); if (err) throw new Error("webgl error " + err);
      return true;
    }
  };
})();
