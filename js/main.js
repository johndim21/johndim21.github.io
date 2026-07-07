/* ==========================================================================
   Giannis Dimitriadis — RPG Portfolio
   Pixel-art night panorama + GSAP scroll choreography
   ========================================================================== */

(function () {
  "use strict";

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isTouch = window.matchMedia("(hover: none)").matches;
  var hasGsap = typeof window.gsap !== "undefined";

  if (prefersReducedMotion || !hasGsap) {
    document.documentElement.classList.add("motion-off");
  }

  /* ------------------------------------------------------------------
     Pixel panorama — a night journey painted behind the scroll:
     starry sky and moon at the title, mountain ridges by the character
     sheet, a castle in the forest through the quests, and a campfire
     waiting at the end of the road.
  ------------------------------------------------------------------ */
  (function () {
    var canvas = document.getElementById("bg-canvas");
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext("2d");

    var PAL = {
      skyTop: "#06070d",
      skyMid: "#0b0c14",
      horizonA: [21, 19, 48],   // deep purple at the start of the journey
      horizonB: [46, 27, 29],   // warm ember tint near the campfire
      ridgeFar: "#10121f",
      ridgeNear: "#0c0e19",
      treeline: "#0a0d18",
      castle: "#191c30",
      pines: "#090c15",
      ground: "#07080e",
      moon: "#d8c383",
      moonMid: "#c9af74",
      moonDark: "#b09a5e",
      moonLight: "#ecdca4",
      log: "#2c1e10",
      star: "#e9e4d6",
      gold: "#e8c15a",
      ember: "#ff8a3d"
    };

    // Deterministic PRNG so terrain survives resize without reshuffling
    function mulberry32(seed) {
      return function () {
        seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
        var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    function clamp01(v) { return Math.min(1, Math.max(0, v)); }

    var W, H, TRAVEL;
    var layers = [];
    var stars = [], fireflies = [];
    var moonSprite = null;
    var groundFire = null;
    var targetS = 0, curS = 0;
    var rafId = null;
    var shoot = { active: false, next: 6 };

    function readScroll() {
      var max = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      targetS = clamp01(window.scrollY / max);
    }

    // Scroll progress at which a section settles into view — measured, so
    // the scenery keeps lining up with the chapters if content changes
    function anchorFor(id, fallback) {
      var el = document.getElementById(id);
      if (!el) return fallback;
      var max = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      var top = el.getBoundingClientRect().top + window.scrollY;
      return clamp01((top - window.innerHeight * 0.35) / max);
    }

    // Jagged skyline heights: two octaves of interpolated value noise
    function skyline(rand, amp, step) {
      function octave(sp, a) {
        var n = Math.ceil(W / sp) + 2, knots = [], i;
        for (i = 0; i < n; i++) knots.push(rand() * a);
        return function (x) {
          var f = x / sp, k = Math.floor(f), t = f - k;
          return knots[k] + (knots[k + 1] - knots[k]) * t;
        };
      }
      var coarse = octave(step, amp * 0.8);
      var fine = octave(Math.max(3, Math.round(step / 4)), amp * 0.2);
      var h = new Array(W);
      for (var x = 0; x < W; x++) h[x] = Math.round(coarse(x) + fine(x));
      return h;
    }

    // Pre-render one terrain band: skyline silhouette filled to the bottom.
    // `top` is the headroom above the baseline (amplitude + decoration room).
    function terrainCanvas(heights, top, color, decorate) {
      var c = document.createElement("canvas");
      c.width = W;
      c.height = H + top;
      var g = c.getContext("2d");
      g.fillStyle = color;
      for (var x = 0; x < W; x++) g.fillRect(x, top - heights[x], 1, H + heights[x]);
      if (decorate) decorate(g);
      return c;
    }

    function pine(g, x, baseY, ht) {
      var half = Math.max(1, Math.round(ht * 0.35));
      for (var row = 0; row < ht; row++) {
        var w = Math.max(1, Math.round(half * 2 * (row / ht)));
        g.fillRect(x - (w >> 1), baseY - ht + row, w, 1);
      }
      g.fillRect(x, baseY, 1, 2);
    }

    function castle(g, cx, baseY, windows) {
      g.fillStyle = PAL.castle;
      g.fillRect(cx - 16, baseY - 3, 32, 5);            // knoll
      g.fillRect(cx - 6, baseY - 14, 12, 14);           // keep
      for (var m = -6; m < 6; m += 3) g.fillRect(cx + m, baseY - 16, 2, 2);
      g.fillRect(cx - 12, baseY - 20, 5, 20);           // towers
      g.fillRect(cx + 7, baseY - 20, 5, 20);
      for (m = 0; m < 2; m++) {
        g.fillRect(cx - 12 + m * 3, baseY - 22, 2, 2);
        g.fillRect(cx + 7 + m * 3, baseY - 22, 2, 2);
      }
      windows.push(
        { x: cx - 10, y: baseY - 16 }, { x: cx + 9, y: baseY - 16 },
        { x: cx - 10, y: baseY - 10 }, { x: cx + 9, y: baseY - 10 },
        { x: cx - 1, y: baseY - 9 }
      );
    }

    function makeMoon(r) {
      var c = document.createElement("canvas");
      c.width = c.height = r * 2 + 2;
      var g = c.getContext("2d"), cx = r + 1, cy = r + 1, dy, w;

      // Shaded disc first; the lit disc offset up-left leaves a crescent
      // of shadow along the lower-right limb
      g.fillStyle = PAL.moonMid;
      for (dy = -r; dy <= r; dy++) {
        w = Math.floor(Math.sqrt(r * r - dy * dy));
        g.fillRect(cx - w, cy + dy, w * 2 + 1, 1);
      }
      var r2 = r - 1;
      g.fillStyle = PAL.moon;
      for (dy = -r2; dy <= r2; dy++) {
        w = Math.floor(Math.sqrt(r2 * r2 - dy * dy));
        g.fillRect(cx - 1 - w, cy - 1 + dy, w * 2 + 1, 1);
      }

      // Maria — broad mid-tone patches under the craters
      g.fillStyle = PAL.moonMid;
      g.fillRect(cx + 2, cy - 4, 4, 2);
      g.fillRect(cx + 3, cy - 2, 2, 1);
      g.fillRect(cx - 8, cy - 1, 2, 2);

      // Craters
      g.fillStyle = PAL.moonDark;
      g.fillRect(cx - 4, cy - 2, 3, 2);
      g.fillRect(cx + 1, cy + 3, 2, 2);
      g.fillRect(cx - 1, cy - 6, 2, 1);
      g.fillRect(cx + 4, cy - 4, 2, 2);
      g.fillRect(cx - 7, cy + 2, 2, 2);
      g.fillRect(cx - 3, cy + 5, 3, 2);
      g.fillRect(cx + 6, cy - 1, 1, 1);
      g.fillRect(cx - 6, cy - 5, 1, 1);
      g.fillRect(cx + 3, cy - 8, 1, 1);

      // Sunlit lower rims on the two largest craters
      g.fillStyle = PAL.moonLight;
      g.fillRect(cx - 3, cy, 2, 1);
      g.fillRect(cx - 2, cy + 7, 2, 1);
      return c;
    }

    function build() {
      W = isTouch ? 200 : 320;
      H = Math.round(W * window.innerHeight / Math.max(window.innerWidth, 1));
      H = Math.max(140, Math.min(H, 520));
      canvas.width = W;
      canvas.height = H;
      ctx.imageSmoothingEnabled = false;
      TRAVEL = H * 2;

      var aCharacter = anchorFor("character", 0.1);
      var aQuests = anchorFor("quests", 0.35);
      var aChronicle = anchorFor("chronicle", 0.65);

      var rand = mulberry32(20260707);
      var i, amp, hts;
      layers = [];

      amp = Math.max(10, Math.round(H * 0.10));
      layers.push({
        p: 0.30, anchor: aCharacter, designY: 0.66, minY: 0.10,
        top: amp, color: PAL.ridgeFar,
        canvas: terrainCanvas(skyline(rand, amp, 46), amp, PAL.ridgeFar)
      });

      amp = Math.max(12, Math.round(H * 0.14));
      layers.push({
        p: 0.42, anchor: aCharacter, designY: 0.78, minY: 0.16,
        top: amp, color: PAL.ridgeNear,
        canvas: terrainCanvas(skyline(rand, amp, 30), amp, PAL.ridgeNear)
      });

      amp = Math.max(6, Math.round(H * 0.05));
      var windows = [];
      hts = skyline(rand, amp, 12);
      var castleX = Math.round(W * 0.62);
      var treeTop = amp + 24;
      layers.push({
        p: 0.55, anchor: aQuests, designY: 0.84, minY: 0.30,
        top: treeTop, color: PAL.treeline, windows: windows,
        canvas: terrainCanvas(hts, treeTop, PAL.treeline, function (g) {
          castle(g, castleX, treeTop - hts[castleX] + 2, windows);
        })
      });

      amp = Math.max(5, Math.round(H * 0.04));
      hts = skyline(rand, amp, 10);
      var pineTop = amp + 22;
      var pineCount = isTouch ? 16 : 30;
      layers.push({
        p: 0.78, anchor: aChronicle, designY: 0.92, minY: 0.50,
        top: pineTop, color: PAL.pines, hasFireflies: true,
        canvas: terrainCanvas(hts, pineTop, PAL.pines, function (g) {
          for (var k = 0; k < pineCount; k++) {
            var tx = 4 + Math.round(rand() * (W - 8));
            pine(g, tx, pineTop - hts[tx] + 1, 8 + Math.round(rand() * 12));
          }
        })
      });

      amp = 3;
      hts = skyline(rand, amp, 16);
      var fireX = Math.round(W * 0.68);
      var groundTop = amp + 2;
      layers.push({
        p: 1.0, anchor: 1, designY: 0.84, minY: 0.84,
        top: groundTop, color: PAL.ground, fire: true,
        canvas: terrainCanvas(hts, groundTop, PAL.ground)
      });
      groundFire = { x: fireX, relY: groundTop - hts[fireX] };

      stars = [];
      var starCount = isTouch ? 50 : 90;
      for (i = 0; i < starCount; i++) {
        stars.push({
          x: Math.round(rand() * (W - 1)),
          y: Math.round(rand() * H * 1.05),
          bright: rand() > 0.91,
          gold: rand() > 0.82,
          base: 0.18 + rand() * 0.3,
          speed: 0.4 + rand() * 1.2,
          phase: rand() * Math.PI * 2
        });
      }

      fireflies = [];
      for (i = 0; i < 8; i++) {
        fireflies.push({
          bx: 8 + rand() * (W - 16),
          relY: pineTop - rand() * (amp + 26),
          ax: 5 + rand() * 7,
          sx: 0.25 + rand() * 0.4,
          sy: 0.3 + rand() * 0.5,
          blink: 0.6 + rand() * 1.1,
          ph1: rand() * 6.28, ph2: rand() * 6.28, ph3: rand() * 6.28
        });
      }

      moonSprite = makeMoon(11);
    }

    function layerBaseY(l) {
      var y = H * l.designY + (l.anchor - curS) * TRAVEL * l.p;
      return Math.max(y, H * l.minY);
    }

    function drawFire(t, yTop, live) {
      var fx = groundFire.x, fy = yTop + groundFire.relY;
      if (fy > H + 12) return;

      var pulse = live ? 1 + 0.08 * Math.sin(t * 3.1) : 1;
      var gr = 34 * pulse;
      var glow = ctx.createRadialGradient(fx, fy - 2, 2, fx, fy - 2, gr);
      glow.addColorStop(0, "rgba(255,138,61,0.20)");
      glow.addColorStop(1, "rgba(255,138,61,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(fx - gr, fy - 2 - gr, gr * 2, gr * 2);

      ctx.fillStyle = PAL.log;
      ctx.fillRect(fx - 5, fy - 1, 10, 2);
      ctx.fillRect(fx - 3, fy - 2, 6, 1);

      // Flame jitter is time-quantized so it strobes like sprite-sheet fire
      var q = live ? Math.floor(t * 11) : 7;
      var j1 = (q * 2654435761) % 5;
      var j2 = (q * 40503) % 3;
      var h1 = 4 + j1, h2 = 3 + j2, h3 = 2 + ((j1 + j2) % 3);
      ctx.fillStyle = "#b78f2e";
      ctx.fillRect(fx - 2, fy - 2 - h1, 5, h1);
      ctx.fillStyle = PAL.gold;
      ctx.fillRect(fx - 1, fy - 1 - h1 - h2, 3, h2);
      ctx.fillStyle = PAL.ember;
      ctx.fillRect(fx, fy - h1 - h2 - h3, 1, h3);

      if (live) {
        ctx.fillStyle = PAL.ember;
        for (var s = 0; s < 5; s++) {
          var cyc = (t * (0.25 + s * 0.07) + s * 0.7) % 1;
          var sy = Math.round(fy - 4 - cyc * 26);
          var sx = fx + Math.round(Math.sin(t * 1.3 + s * 2.1) * (2 + s));
          ctx.globalAlpha = (1 - cyc) * 0.7;
          ctx.fillRect(sx, sy, 1, 1);
        }
        ctx.globalAlpha = 1;
      }
    }

    function shootingStar(t) {
      if (!shoot.active) {
        if (curS < 0.7 && t > shoot.next) {
          shoot.active = true;
          shoot.x = W * (0.1 + Math.random() * 0.6);
          shoot.y = H * (0.05 + Math.random() * 0.22);
          shoot.vx = 55 + Math.random() * 45;
          shoot.vy = 20 + Math.random() * 16;
          shoot.t0 = t;
        }
        return;
      }
      var age = t - shoot.t0;
      if (age > 0.7) {
        shoot.active = false;
        shoot.next = t + 7 + Math.random() * 8;
        return;
      }
      var x = shoot.x + shoot.vx * age, y = shoot.y + shoot.vy * age;
      for (var k = 0; k < 4; k++) {
        ctx.globalAlpha = (1 - age / 0.7) * (1 - k * 0.22) * 0.8;
        ctx.fillStyle = k === 0 ? "#fff2c9" : PAL.star;
        ctx.fillRect(Math.round(x - k * 2), Math.round(y - k * 0.8), 1, 1);
      }
      ctx.globalAlpha = 1;
    }

    function draw(t, live) {
      var i, l;

      // Sky — horizon warms from arcane purple toward embers on the way down
      var hz = [0, 1, 2].map(function (c) {
        return Math.round(PAL.horizonA[c] + (PAL.horizonB[c] - PAL.horizonA[c]) * curS);
      });
      var sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, PAL.skyTop);
      sky.addColorStop(0.55, PAL.skyMid);
      sky.addColorStop(1, "rgb(" + hz[0] + "," + hz[1] + "," + hz[2] + ")");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      // Stars
      var starShift = -curS * TRAVEL * 0.12;
      for (i = 0; i < stars.length; i++) {
        var st = stars[i];
        var sy = Math.round(st.y + starShift);
        if (sy < -1 || sy > H) continue;
        var a = live ? st.base + 0.25 * Math.sin(t * st.speed + st.phase) : st.base + 0.15;
        if (a <= 0.03) continue;
        ctx.globalAlpha = Math.min(a, 0.75);
        ctx.fillStyle = st.gold ? PAL.gold : PAL.star;
        ctx.fillRect(st.x, sy, 1, 1);
        if (st.bright) {
          ctx.fillRect(st.x - 1, sy, 1, 1);
          ctx.fillRect(st.x + 1, sy, 1, 1);
          ctx.fillRect(st.x, sy - 1, 1, 1);
          ctx.fillRect(st.x, sy + 1, 1, 1);
        }
      }
      ctx.globalAlpha = 1;

      // Moon — drifts up and away as the descent begins
      var mx = Math.round(W * 0.78);
      var my = Math.round(H * 0.2 - curS * TRAVEL * 0.25);
      if (my > -30) {
        var halo = ctx.createRadialGradient(mx, my, 2, mx, my, 26);
        halo.addColorStop(0, "rgba(232,193,90,0.10)");
        halo.addColorStop(1, "rgba(232,193,90,0)");
        ctx.fillStyle = halo;
        ctx.fillRect(mx - 26, my - 26, 52, 52);
        ctx.drawImage(moonSprite, mx - (moonSprite.width >> 1), my - (moonSprite.height >> 1));
      }

      if (live && !isTouch) shootingStar(t);

      // Terrain bands, back to front
      for (i = 0; i < layers.length; i++) {
        l = layers[i];
        var yTop = Math.round(layerBaseY(l) - l.top);
        if (yTop >= H) continue;
        ctx.drawImage(l.canvas, 0, yTop);
        var bottom = yTop + l.canvas.height;
        if (bottom < H) {
          ctx.fillStyle = l.color;
          ctx.fillRect(0, bottom, W, H - bottom);
        }

        if (l.windows) {
          for (var wi = 0; wi < l.windows.length; wi++) {
            var win = l.windows[wi];
            var wy = yTop + win.y;
            if (wy < -2 || wy > H) continue;
            ctx.globalAlpha = live
              ? 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(t * 0.8 + wi * 1.7))
              : 0.6;
            ctx.fillStyle = PAL.ember;
            ctx.fillRect(win.x, wy, 1, 2);
          }
          ctx.globalAlpha = 1;
        }

        if (l.hasFireflies && live && !isTouch) {
          ctx.fillStyle = PAL.gold;
          for (var f = 0; f < fireflies.length; f++) {
            var ff = fireflies[f];
            var fa = 0.2 + 0.4 * Math.max(0, Math.sin(t * ff.blink + ff.ph3));
            var ffx = Math.round(ff.bx + Math.sin(t * ff.sx + ff.ph1) * ff.ax);
            var ffy = Math.round(yTop + ff.relY + Math.sin(t * ff.sy + ff.ph2) * 6);
            if (ffy < 0 || ffy >= H || ffx < 0 || ffx >= W) continue;
            ctx.globalAlpha = fa;
            ctx.fillRect(ffx, ffy, 1, 1);
          }
          ctx.globalAlpha = 1;
        }

        if (l.fire) drawFire(t, yTop, live);
      }
    }

    function frame(now) {
      rafId = requestAnimationFrame(frame);
      var diff = targetS - curS;
      curS = Math.abs(diff) < 0.0005 ? targetS : curS + diff * 0.1;
      draw(now / 1000, true);
    }

    var redrawQueued = false;
    function staticRedraw() {
      if (redrawQueued) return;
      redrawQueued = true;
      requestAnimationFrame(function () {
        redrawQueued = false;
        curS = targetS;
        draw(0, false);
      });
    }

    window.addEventListener("scroll", function () {
      readScroll();
      if (prefersReducedMotion) staticRedraw();
    }, { passive: true });

    var resizeTimer = null;
    var lastW = window.innerWidth, lastH = window.innerHeight;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        // Ignore mobile URL-bar height churn; rebuild on real size changes
        if (window.innerWidth === lastW && Math.abs(window.innerHeight - lastH) <= 120) return;
        lastW = window.innerWidth;
        lastH = window.innerHeight;
        build();
        readScroll();
        if (prefersReducedMotion) staticRedraw();
      }, 150);
    });

    // Section positions settle once images/fonts land
    window.addEventListener("load", function () {
      build();
      readScroll();
      if (prefersReducedMotion) staticRedraw();
    });

    document.addEventListener("visibilitychange", function () {
      if (prefersReducedMotion) return;
      if (document.hidden) {
        cancelAnimationFrame(rafId);
        rafId = null;
      } else if (rafId === null) {
        rafId = requestAnimationFrame(frame);
      }
    });

    build();
    readScroll();
    curS = targetS;
    if (prefersReducedMotion) {
      draw(0, false);
    } else {
      rafId = requestAnimationFrame(frame);
    }
  })();

  /* ------------------------------------------------------------------
     Typewriter — narrator dialogue on the title screen
  ------------------------------------------------------------------ */
  var LINES = [
    "Ah, a visitor! You stand before the chronicle of a designer-developer of serious games…",
    "Six years of quests: MetaHumans taught to speak, museums brought to life, students turned into time-travellers.",
    "Scroll onward, traveller — the character sheet awaits."
  ];

  (function typewriter() {
    var el = document.getElementById("typewriter");
    if (!el) return;

    if (prefersReducedMotion) { el.textContent = LINES[0]; return; }

    var line = 0, ch = 0, deleting = false;

    function tick() {
      var text = LINES[line];
      if (!deleting) {
        ch++;
        el.textContent = text.slice(0, ch);
        if (ch === text.length) { deleting = true; setTimeout(tick, 2600); return; }
        setTimeout(tick, 26 + Math.random() * 30);
      } else {
        ch = 0;
        deleting = false;
        el.textContent = "";
        line = (line + 1) % LINES.length;
        setTimeout(tick, 350);
      }
    }
    setTimeout(tick, 900);
  })();

  /* ------------------------------------------------------------------
     GSAP — entrance + scroll choreography
  ------------------------------------------------------------------ */
  if (hasGsap && !prefersReducedMotion) {
    gsap.registerPlugin(ScrollTrigger);

    // Title screen entrance
    gsap.timeline({ defaults: { ease: "power3.out" } })
      .to(".hero-anim", { opacity: 1, y: 0, duration: 0.9, stagger: 0.13, startAt: { y: 26 } })
      .add(function () { document.getElementById("hud").classList.add("is-visible"); }, "-=0.4");

    // Generic reveals
    gsap.utils.toArray(".reveal").forEach(function (el) {
      gsap.fromTo(el,
        { opacity: 0, y: 40 },
        {
          opacity: 1, y: 0, duration: 0.85, ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 86%", toggleActions: "play none none none" }
        });
    });

    // Stat bars: fill + count up when scrolled into view
    gsap.utils.toArray(".stat").forEach(function (stat) {
      var value = parseInt(stat.getAttribute("data-value"), 10) || 0;
      var fill = stat.querySelector(".stat__fill");
      var num = stat.querySelector(".stat__num");
      var counter = { v: 0 };

      gsap.timeline({
        scrollTrigger: { trigger: stat, start: "top 88%", toggleActions: "play none none none" }
      })
        .to(fill, { width: value + "%", duration: 1.3, ease: "power2.out" })
        .to(counter, {
          v: value, duration: 1.3, ease: "power2.out",
          onUpdate: function () { num.textContent = Math.round(counter.v); }
        }, "<");
    });

    // Timeline spine draws itself as you scroll the chronicle
    var spineFill = document.querySelector(".timeline__spine-fill");
    if (spineFill) {
      gsap.to(spineFill, {
        scaleY: 1, ease: "none",
        scrollTrigger: {
          trigger: ".timeline",
          start: "top 75%",
          end: "bottom 55%",
          scrub: 0.6
        }
      });
    }

    // Section title parallax shimmer
    gsap.utils.toArray(".section__head").forEach(function (head) {
      gsap.fromTo(head, { y: 30 }, {
        y: -10, ease: "none",
        scrollTrigger: { trigger: head, start: "top bottom", end: "bottom top", scrub: 0.8 }
      });
    });

    // Active nav link tracking
    gsap.utils.toArray("main section[id]").forEach(function (sec) {
      ScrollTrigger.create({
        trigger: sec,
        start: "top 45%",
        end: "bottom 45%",
        onToggle: function (self) {
          if (!self.isActive) return;
          document.querySelectorAll(".hud__link").forEach(function (l) {
            l.classList.toggle("is-active", l.getAttribute("href") === "#" + sec.id);
          });
        }
      });
    });
  } else {
    // No GSAP or reduced motion: show everything, fill bars statically
    document.getElementById("hud").classList.add("is-visible");
    document.querySelectorAll(".stat").forEach(function (stat) {
      var value = parseInt(stat.getAttribute("data-value"), 10) || 0;
      stat.querySelector(".stat__fill").style.width = value + "%";
      stat.querySelector(".stat__num").textContent = value;
    });
  }

  /* ------------------------------------------------------------------
     Quest-card tilt (desktop pointers only)
  ------------------------------------------------------------------ */
  if (hasGsap && !isTouch && !prefersReducedMotion) {
    document.querySelectorAll(".quest").forEach(function (card) {
      var rX = gsap.quickTo(card, "rotationX", { duration: 0.5, ease: "power3.out" });
      var rY = gsap.quickTo(card, "rotationY", { duration: 0.5, ease: "power3.out" });

      card.addEventListener("pointermove", function (e) {
        var rect = card.getBoundingClientRect();
        var px = (e.clientX - rect.left) / rect.width - 0.5;
        var py = (e.clientY - rect.top) / rect.height - 0.5;
        rX(-py * 6);
        rY(px * 6);
      });

      card.addEventListener("pointerleave", function () { rX(0); rY(0); });
    });
  }

  /* ------------------------------------------------------------------
     Mobile nav
  ------------------------------------------------------------------ */
  var burger = document.getElementById("hud-burger");
  if (burger) {
    burger.addEventListener("click", function () {
      var open = document.body.classList.toggle("nav-open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.querySelectorAll(".hud__link").forEach(function (link) {
      link.addEventListener("click", function () {
        document.body.classList.remove("nav-open");
        burger.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ------------------------------------------------------------------
     Konami code → LEVEL UP easter egg
  ------------------------------------------------------------------ */
  var KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
  var kIndex = 0;
  var overlay = document.getElementById("levelup");

  window.addEventListener("keydown", function (e) {
    var key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    kIndex = key === KONAMI[kIndex] ? kIndex + 1 : (key === KONAMI[0] ? 1 : 0);
    if (kIndex !== KONAMI.length) return;
    kIndex = 0;
    levelUp();
  });

  // Tapping the LVL number 5 times works on touch devices
  var lvlTaps = 0, lvlTapTimer = null;
  var lvlEl = document.getElementById("level-number");
  if (lvlEl) {
    lvlEl.addEventListener("click", function () {
      lvlTaps++;
      clearTimeout(lvlTapTimer);
      lvlTapTimer = setTimeout(function () { lvlTaps = 0; }, 900);
      if (lvlTaps >= 5) { lvlTaps = 0; levelUp(); }
    });
  }

  function levelUp() {
    if (!overlay || overlay.classList.contains("is-open")) return;
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");

    var lvl = document.getElementById("level-number");
    if (lvl) lvl.textContent = String(parseInt(lvl.textContent, 10) + 1);

    if (hasGsap && !prefersReducedMotion) {
      gsap.fromTo(".levelup__box",
        { scale: 0.6, opacity: 0, rotation: -4 },
        { scale: 1, opacity: 1, rotation: 0, duration: 0.55, ease: "back.out(2)" });
      gsap.fromTo(".levelup__burst",
        { scale: 0, rotation: -180 },
        { scale: 1, rotation: 0, duration: 0.7, ease: "back.out(3)", delay: 0.1 });
    }

    setTimeout(closeLevelUp, 3200);
    overlay.addEventListener("click", closeLevelUp);
  }

  function closeLevelUp() {
    if (!overlay) return;
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
  }
})();
