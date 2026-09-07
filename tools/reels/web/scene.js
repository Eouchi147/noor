/* NOOR reel · the picture, drawn as light.
   ===========================================================================
   One fragment shader draws the whole picture behind the words: sky, haze,
   the house geometry, the subject of the format, the light around it, the
   grain and the grade. It runs in the same headless browser that animates
   the type, at half resolution under a full-resolution DOM, so one
   screenshot per frame is the finished picture.

   Nothing is sampled, nothing is licensed, nothing is figurative. Everything
   on screen is arithmetic: star polygons, circles, noise, and light.

   The type layer sets the uniforms for each frame (see NOORREEL.seek):
     t        seconds
     cue      0..1  the subject's moment (the word lands, the verse opens)
     bloom    0..1  gold in the air: rises on a hit and fades over a bar
     pulse    0..1  the reciter's loudness, for One verse
     hit      0..1  the accent of the last downbeat, decaying
     recede   0..1  how much the words own the frame
     focus    the y (0..1, top to bottom) the subject stands on
     scrim    how dark the ground under the words should be
   plus, from the card: kind, seed, n/k, palette, month, progress.
   =========================================================================== */
(function () {
  "use strict";
  var KINDS = { light: 0, know: 0, word: 1, verse: 2, day: 3, codex: 4 };
  var PAL = {
    night: { a: [0.030, 0.043, 0.125], b: [0.150, 0.243, 0.549], lamp: [0.47, 0.376, 0.157], line: [0.914, 0.784, 0.416] },
    dusk:  { a: [0.102, 0.055, 0.133], b: [0.659, 0.361, 0.275], lamp: [0.588, 0.314, 0.180], line: [1.0, 0.839, 0.588] },
    green: { a: [0.024, 0.086, 0.102], b: [0.086, 0.408, 0.369], lamp: [0.235, 0.471, 0.353], line: [0.839, 0.886, 0.667] },
    sand:  { a: [0.110, 0.078, 0.047], b: [0.588, 0.455, 0.251], lamp: [0.549, 0.408, 0.204], line: [0.980, 0.910, 0.745] },
    codex: { a: [0.020, 0.028, 0.060], b: [0.050, 0.080, 0.170], lamp: [0.25, 0.32, 0.55], line: [0.914, 0.784, 0.416] }
  };

  var VS = "#version 300 es\nin vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }";

  var FS = [
"#version 300 es",
"precision highp float;",
"out vec4 O;",
"uniform vec2 R; uniform float t, seed, cue, bloom, pulse, hit, recede, focus, scrim, month, progress, beat;",
"uniform int kind; uniform float n, k;",
"uniform vec3 skyA, skyB, lamp, line;",
"",
"/* an integer hash: the same on every machine and every build, which sin() is not */",
"float hash(vec2 p){ uvec2 q = uvec2(ivec2(floor(p*64.0))) * uvec2(1597334677u, 3812015801u); uint h = (q.x ^ q.y ^ uint(seed*1000.0)) * 1597334677u; h ^= h >> 15u; h *= 2246822519u; h ^= h >> 13u; return float(h) * (1.0/4294967296.0); }",
"float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);",
"  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }",
"float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a*noise(p); p = p*2.03 + 7.1; a *= 0.5; } return v; }",
"",
"/* distance to the outline of the star polygon {n/k}, radius r, turned by ph */",
"float starD(vec2 p, float r, float nn, float kk, float ph){",
"  float a = atan(p.y, p.x) + ph; float L = length(p);",
"  float inner = r * cos(3.14159265*kk/nn) / cos(3.14159265*(kk-1.0)/nn);",
"  float seg = 6.2831853/nn; float m = mod(a, seg); float u = m/seg;",
"  /* the boundary alternates between the outer point and the inner one */",
"  vec2 A = vec2(r, 0.0); vec2 B = vec2(inner*cos(seg*0.5), inner*sin(seg*0.5)); vec2 C = vec2(r*cos(seg), r*sin(seg));",
"  vec2 q = vec2(L*cos(m), L*sin(m));",
"  vec2 e1 = B-A, e2 = C-B;",
"  float d1 = length(q - A - e1*clamp(dot(q-A,e1)/dot(e1,e1), 0.0, 1.0));",
"  float d2 = length(q - B - e2*clamp(dot(q-B,e2)/dot(e2,e2), 0.0, 1.0));",
"  return min(d1, d2);",
"}",
"float glowLine(float d, float w, float s){ return exp(-d*d/(w*w)) + s*exp(-d/(w*5.0)); }",
"float ring(vec2 p, float r, float w){ return glowLine(abs(length(p)-r), w, 0.5); }",
"",
"/* the stars: three depths of them, moving at three rates */",
"vec3 stars(vec2 uv, float par){",
"  vec3 c = vec3(0.0);",
"  for (int i = 0; i < 3; i++){",
"    float sc = 18.0 + float(i)*14.0; vec2 p = uv*sc + vec2(t*0.006*(1.0+float(i)), t*0.010*par);",
"    vec2 g = floor(p), f = fract(p) - 0.5; float h = hash(g + float(i)*31.7);",
"    if (h > 0.955){ vec2 o = vec2(hash(g+1.3), hash(g+2.7)) - 0.5; float d = length(f - o*0.6);",
"      float tw = 0.6 + 0.4*sin(t*(1.0+3.0*hash(g+5.1)) + h*40.0);",
"      c += (0.35 + 0.25*float(i)/2.0) * tw * exp(-d*d*260.0) * vec3(1.0, 0.98, 0.92); } }",
"  return c;",
"}",
"",
"/* the drifting motes, drawn toward the subject when the frame blooms */",
"vec3 motes(vec2 uv, vec2 centre){",
"  vec3 c = vec3(0.0);",
"  for (int i = 0; i < 2; i++){",
"    vec2 p = uv*7.0 + vec2(0.0, t*0.05) + float(i)*3.1; vec2 g = floor(p), f = fract(p) - 0.5;",
"    float h = hash(g + 9.3*float(i)); if (h < 0.55) continue;",
"    vec2 o = (vec2(hash(g+4.1), hash(g+8.2)) - 0.5)*0.8; o += sin(t*0.4 + h*20.0)*0.08;",
"    vec2 w = f - o; vec2 toC = (centre - uv); w -= toC*0.25*bloom;",
"    float d = length(w); c += (0.05 + 0.16*bloom) * exp(-d*d*420.0) * vec3(0.89, 0.91, 0.98); }",
"  return c;",
"}",
"",
"vec3 rays(vec2 uv, vec2 c, float amt){",
"  vec2 d = uv - c; float a = atan(d.y, d.x); float L = length(d);",
"  float sp = pow(0.5 + 0.5*cos(a*9.0 + t*0.16), 7.0) * 0.7 + pow(0.5 + 0.5*cos(a*5.0 - t*0.11 + 1.3), 9.0)*0.5;",
"  return lamp * sp * exp(-L*2.6) * amt * 0.55;",
"}",
"",
"void main(){",
"  vec2 fc = gl_FragCoord.xy; vec2 uv = (fc - 0.5*R) / R.y;   /* y up, centre 0 */",
"  float fy = (0.5 - focus) * (R.y/R.y);                        /* the subject's y in uv */",
"  vec2 centre = vec2(0.0, (0.5 - focus) * 1.0);",
"  /* the slow push: the frame is never still */",
"  uv *= 1.0 - 0.05 * clamp(t/20.0, 0.0, 1.0);",
"",
"  /* the sky, deliberately dark: white type has to sit on it */",
"  float v = uv.y + 0.5;",
"  vec3 col = mix(skyB*0.55, skyA, clamp(v + 0.15, 0.0, 1.0));",
"  if (kind == 3){ /* This day: night turning to dawn across the reel */",
"    float dawn = clamp(progress, 0.0, 1.0);",
"    col = mix(col, mix(vec3(0.16, 0.10, 0.20), vec3(0.62, 0.36, 0.22), clamp(0.3 - uv.y, 0.0, 1.0)), dawn*0.45*clamp(0.6 - uv.y, 0.0, 1.0)); }",
"  /* haze */",
"  float hz = fbm(uv*2.2 + vec2(t*0.02, -t*0.012));",
"  col += lamp * hz * 0.16 * (1.0 - length((uv - centre)*vec2(1.0, 0.7)));",
"  /* the lamp behind everything, breathing on the beat, brighter on a hit */",
"  float lampA = 0.75 + 0.10*sin(t*0.55) + 0.25*bloom + 0.18*hit + 0.35*pulse;",
"  col += lamp * exp(-length((uv - centre)*vec2(1.0, 0.75))*3.0) * 0.36 * lampA;",
"  /* the far house geometry, out of focus */",
"  vec2 g2 = uv*1.6 + vec2(0.2 + t*0.004, 0.15 - t*0.003); vec2 cell = floor(g2), fr = fract(g2) - 0.5;",
"  float far = glowLine(starD(fr, 0.36, 8.0, 3.0, -1.5708), 0.06, 0.2) * 0.045;",
"  col += line * far * (0.5 + 0.5*bloom);",
"  col += stars(uv, 1.0) * (kind == 3 ? 1.0 - progress*0.8 : 1.0) * 0.8;",
"",
"  vec2 q = uv - centre;",
"  if (kind == 0){ /* the day's card, Did you know: a rosette in front, a lattice behind */",
"    vec2 bk = uv - vec2(-0.55 + 0.02*sin(t*0.17), -0.35 + 0.03*sin(t*0.11) - t*0.004);",
"    col += line * glowLine(starD(bk, 0.22, n, k, -1.5708 + t*0.02), 0.030, 0.4) * 0.16 * (1.0 - 0.5*recede);",
"    col += rays(uv, vec2(0.0, 0.32), 0.25 + 0.4*bloom);",
"  }",
"  if (kind == 1){ /* The word: a mandala drawing itself, two turns, petals, a heart */",
"    float p = clamp(0.04 + t/3.8, 0.0, 1.0); float wake = 0.35 + 0.65*cue;",
"    float ang = atan(q.y, q.x); float drawn = step(fract((ang + 3.14159)/6.2831853 + 0.0), p);",
"    float r1 = 0.155 + 0.003*sin(t*0.7) + 0.006*pulse;",
"    float d1 = starD(q, r1, n, k, -1.5708 + t*0.030);",
"    float d2 = starD(q, r1*0.62, n, max(2.0, k-2.0), -1.5708 - t*0.048 + 3.14159/n);",
"    float ln = glowLine(d1, 0.0035, 0.4)*0.95 + glowLine(d2, 0.003, 0.4)*0.7;",
"    ln *= drawn * (0.55 + 0.45*wake);",
"    /* the petals: short arcs on a ring outside, arriving with the cue */",
"    float rr = r1 + 0.022; float m = 2.0*n; float ph = mod(ang + t*0.03 + 1.5708, 6.2831853)/6.2831853*m;",
"    float seg = fract(ph); float on = step(seg, 0.62) * step(floor(ph), cue*m*1.15);",
"    ln += glowLine(abs(length(q)-rr), 0.003, 0.3) * on * 0.5 * wake;",
"    ln += glowLine(abs(length(q)-(rr+0.012)), 0.0025, 0.2) * 0.18;",
"    col += line * ln * (1.0 - 0.35*recede);",
"    col += line * exp(-length(q)*length(q)*400.0) * (0.25 + 0.5*cue + 0.4*hit);   /* the heart */",
"    col += lamp * exp(-length(q)*5.0) * (0.18 + 0.30*wake + 0.25*hit);            /* the disc */",
"    col += rays(uv, centre, 0.35 + 0.5*bloom);",
"    col += motes(uv, centre);",
"  }",
"  if (kind == 2){ /* One verse: rings of light in a haze, breathing with the voice */",
"    float open_ = clamp(t/2.2, 0.0, 1.0); float base = 0.10 + 0.05*open_;",
"    float rg = 0.0;",
"    for (int i = 0; i < 5; i++){ float fi = float(i); float rr = (base + fi*0.026) * (1.0 + 0.030*pulse*(1.0+fi*0.4)) + 0.002*sin(t*0.5+fi);",
"      rg += ring(q, rr, 0.0022 + 0.0012*pulse) * (0.9 - fi*0.14) * (0.55 + 0.45*open_) * (0.6 + 0.7*pulse); }",
"    col += vec3(0.914, 0.84, 0.59) * rg * 0.30 * (1.0 - 0.3*recede);",
"    col += line * glowLine(starD(q, base*0.78, n, k, -1.5708 + t*0.02), 0.0025, 0.3) * (0.12 + 0.15*open_ + 0.35*pulse) * (1.0 - 0.3*recede);",
"    float haze = fbm(q*3.0 + t*0.05) * exp(-length(q)*2.0);",
"    col += lamp * haze * (0.25 + 0.6*pulse + 0.3*hit);",
"    col += lamp * exp(-length(q)*4.0) * (0.15 + 0.5*pulse + 0.2*hit);",
"    col += rays(uv, centre, 0.25 + 0.6*pulse + 0.3*bloom);",
"    /* sparks lifting while the voice sounds */",
"    vec2 sp = q*9.0 + vec2(0.0, -t*0.6); vec2 sg = floor(sp), sf = fract(sp)-0.5; float sh = hash(sg+3.3);",
"    if (sh > 0.86) col += vec3(1.0, 0.94, 0.78) * exp(-dot(sf,sf)*420.0) * pulse * 0.7 * step(length(q), base+0.12) * step(base-0.02, length(q));",
"  }",
"  if (kind == 3){ /* This day: a crescent with earthshine, a ring of months */",
"    vec2 mc = uv - vec2(0.22, -0.22); float rc = 0.062;",
"    float ph = 0.10 + 0.10*progress; vec2 shade = mc - vec2(-rc*(1.0 - 0.9*sin(ph*3.14159)) - rc*0.05, rc*0.08);",
"    float disc = 1.0 - smoothstep(-0.004, 0.004, length(mc) - rc);",
"    float dark = 1.0 - smoothstep(-0.004, 0.004, length(shade) - rc*1.02);",
"    float lit = disc * (1.0 - dark);",
"    col += vec3(0.97, 0.95, 0.89) * lit * 0.95 + vec3(0.30, 0.34, 0.50) * disc * dark * 0.05;   /* earthshine */",
"    col += vec3(0.91, 0.84, 0.66) * exp(-length(mc)*9.0) * (0.35 + 0.4*cue + 0.3*hit);",
"    float R2 = 0.16; vec2 cc = uv - vec2(0.22, -0.22);",
"    float a2 = atan(cc.y, cc.x); float mi = floor(mod((a2 + 1.5708)/6.2831853, 1.0)*12.0);",
"    float tick = abs(length(cc) - R2); float ang12 = abs(mod(a2 + 1.5708 + 0.2618, 0.5236) - 0.2618);",
"    float isTick = step(ang12, 0.02) * step(tick, 0.014);",
"    float litM = step(abs(mi - (month-1.0)), 0.5);",
"    float pr = clamp(t/1.6, 0.0, 1.0); float shown = step(mi/12.0, pr);",
"    col += line * isTick * shown * (0.35 + 1.2*litM*(0.6+0.4*cue));",
"    col += line * ring(cc, R2, 0.003) * 0.12 * pr;",
"    col += rays(uv, vec2(0.0, 0.30), 0.22 + 0.4*bloom);",
"  }",
"  if (kind == 4){ /* The Codex: a blueprint drawing itself */",
"    col = mix(skyB*0.6, skyA, clamp(v + 0.1, 0.0, 1.0));",
"    vec2 gp = uv*14.0; vec2 gf = abs(fract(gp) - 0.5);",
"    float grid = smoothstep(0.03, 0.0, min(gf.x, gf.y)) * 0.10 + smoothstep(0.02, 0.0, min(abs(fract(gp/5.0)-0.5).x, abs(fract(gp/5.0)-0.5).y)) * 0.10;",
"    col += vec3(0.49, 0.61, 0.82) * grid * (0.5 + 0.5*progress);",
"    float rr = 0.21; float ang = atan(q.y, q.x);",
"    float drawn = step(fract((ang + 3.14159)/6.2831853), clamp(progress*1.4, 0.0, 1.0));",
"    col += line * glowLine(starD(q, rr, n, k, -1.5708 + t*0.05), 0.0035, 0.5) * drawn * 0.9;",
"    col += vec3(0.49, 0.61, 0.82) * ring(q, rr*1.18, 0.002) * 0.5 * drawn;",
"    col += vec3(0.49, 0.61, 0.82) * ring(q, rr*0.55, 0.002) * 0.4 * drawn;",
"    /* measurement ticks on the outer circle */",
"    float a36 = abs(mod(ang + 0.0873, 0.1745) - 0.0873); float tk = step(a36, 0.006) * step(abs(length(q) - rr*1.18), 0.012);",
"    col += vec3(0.49, 0.61, 0.82) * tk * 0.8 * drawn;",
"    /* a sweep of light around, once a bar */",
"    float sweep = pow(0.5 + 0.5*cos(ang - beat*6.2831853), 24.0) * step(length(q), rr*1.25);",
"    col += line * sweep * 0.35 * (0.3 + hit);",
"    /* scanlines */",
"    col *= 0.92 + 0.08*sin(fc.y*3.14159*0.5);",
"    col += vec3(0.49, 0.61, 0.82) * exp(-length(q)*4.0) * (0.10 + 0.35*hit);",
"  }",
"",
"  col = 1.0 - exp(-col*1.15);                                   /* a soft shoulder, no white blobs */\n  /* the ground the words stand on */",
"  float dy = (uv.y - centre.y)/0.30; float band = (kind == 1 || kind == 2) ? exp(-dy*dy) : 1.0 - smoothstep(-0.6, 0.35, uv.y);",
"  col *= 1.0 - scrim * (0.35 + 0.65*band);",
"  /* grade: lift the shadows toward the sky, keep the gold gold */",
"  col = pow(max(col, 0.0), vec3(0.94));",
"  col = mix(col, col*vec3(1.02, 1.0, 0.96) + skyB*0.02, 0.5);",
"  /* vignette, grain */",
"  col *= 1.0 - 0.55 * pow(length(uv*vec2(0.85, 0.62)), 2.2);",
"  col += (hash(fc + floor(t*30.0)*0.37) - 0.5) * 0.028;",
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
    var loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    ["R", "t", "seed", "cue", "bloom", "pulse", "hit", "recede", "focus", "scrim", "month", "progress", "beat", "kind", "n", "k", "skyA", "skyB", "lamp", "line"]
      .forEach(function (nm) { U[nm] = gl.getUniformLocation(prog, nm); });
    gl.viewport(0, 0, W2, H2);
    gl.uniform2f(U.R, W2, H2);
  }

  var CARD = { kind: 0, seed: 7, n: 8, k: 3, pal: "night", month: 1 };

  window.NOORSCENE = {
    init: function () { if (!gl) init(); },
    info: function () { return { ok: !!gl && !gl.isContextLost(), renderer: gl ? gl.getParameter(gl.RENDERER) : "", size: [W2, H2] }; },
    /* what the card is: once per build */
    card: function (c) {
      if (!gl) init();
      CARD = { kind: KINDS[c.kind || "light"] || 0, seed: Number(c.seed || 7), n: Number(c.n || 8), k: Number(c.k || 3),
               pal: c.pal || "night", month: Number(c.month || 1) };
      var P = PAL[CARD.kind === 4 ? "codex" : CARD.pal] || PAL.night;
      gl.uniform1i(U.kind, CARD.kind); gl.uniform1f(U.seed, CARD.seed);
      gl.uniform1f(U.n, CARD.n); gl.uniform1f(U.k, CARD.k); gl.uniform1f(U.month, CARD.month);
      gl.uniform3fv(U.skyA, P.a); gl.uniform3fv(U.skyB, P.b); gl.uniform3fv(U.lamp, P.lamp); gl.uniform3fv(U.line, P.line);
    },
    /* the frame: what this instant is */
    frame: function (f) {
      if (gl.isContextLost()) throw new Error("webgl context lost");
      gl.uniform1f(U.t, f.t || 0); gl.uniform1f(U.cue, f.cue || 0); gl.uniform1f(U.bloom, f.bloom || 0);
      gl.uniform1f(U.pulse, f.pulse || 0); gl.uniform1f(U.hit, f.hit || 0); gl.uniform1f(U.recede, f.recede || 0);
      gl.uniform1f(U.focus, f.focus == null ? 0.42 : f.focus); gl.uniform1f(U.scrim, f.scrim == null ? 0.6 : f.scrim);
      gl.uniform1f(U.progress, f.progress || 0); gl.uniform1f(U.beat, f.beat || 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3); gl.finish();
      var err = gl.getError(); if (err) throw new Error("webgl error " + err);
      return true;
    }
  };
})();
