/* ==========================================================================
   Giannis Dimitriadis — RPG Portfolio
   Three.js ember field + GSAP scroll choreography
   ========================================================================== */

(function () {
  "use strict";

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isTouch = window.matchMedia("(hover: none)").matches;
  var hasGsap = typeof window.gsap !== "undefined";
  var hasThree = typeof window.THREE !== "undefined";

  if (prefersReducedMotion || !hasGsap) {
    document.documentElement.classList.add("motion-off");
  }

  /* ------------------------------------------------------------------
     Three.js — drifting ember / spark field behind everything
  ------------------------------------------------------------------ */
  if (hasThree && !prefersReducedMotion) {
    try {
      var canvas = document.getElementById("bg-canvas");
      var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(window.innerWidth, window.innerHeight);

      var scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x0b0c14, 0.045);

      var camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
      camera.position.z = 14;

      var COUNT = isTouch ? 260 : 650;
      var SPREAD_X = 46, SPREAD_Y = 30, SPREAD_Z = 26;

      var positions = new Float32Array(COUNT * 3);
      var colors = new Float32Array(COUNT * 3);
      var speeds = new Float32Array(COUNT);
      var phases = new Float32Array(COUNT);

      var palette = [
        new THREE.Color(0xe8c15a), // gold
        new THREE.Color(0xff8a3d), // ember
        new THREE.Color(0x9fb4ff), // faint arcane blue
        new THREE.Color(0xfff2c9)  // bright spark
      ];

      for (var i = 0; i < COUNT; i++) {
        positions[i * 3] = (Math.random() - 0.5) * SPREAD_X;
        positions[i * 3 + 1] = (Math.random() - 0.5) * SPREAD_Y;
        positions[i * 3 + 2] = (Math.random() - 0.5) * SPREAD_Z;
        var c = palette[Math.floor(Math.random() * palette.length)];
        colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
        speeds[i] = 0.004 + Math.random() * 0.012;
        phases[i] = Math.random() * Math.PI * 2;
      }

      var geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

      // Soft round sprite via canvas texture
      var spriteCanvas = document.createElement("canvas");
      spriteCanvas.width = spriteCanvas.height = 64;
      var ctx = spriteCanvas.getContext("2d");
      var grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.35, "rgba(255,255,255,0.6)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
      var sprite = new THREE.CanvasTexture(spriteCanvas);

      var material = new THREE.PointsMaterial({
        size: 0.32,
        map: sprite,
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true
      });

      var points = new THREE.Points(geometry, material);
      scene.add(points);

      var mouseX = 0, mouseY = 0, targetX = 0, targetY = 0;
      var scrollDepth = 0;

      if (!isTouch) {
        window.addEventListener("pointermove", function (e) {
          mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
          mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
        }, { passive: true });
      }

      window.addEventListener("scroll", function () {
        var max = Math.max(document.body.scrollHeight - window.innerHeight, 1);
        scrollDepth = window.scrollY / max;
      }, { passive: true });

      window.addEventListener("resize", function () {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      });

      var clock = new THREE.Clock();
      var pos = geometry.attributes.position;

      function animate() {
        requestAnimationFrame(animate);
        var t = clock.getElapsedTime();

        for (var i = 0; i < COUNT; i++) {
          var y = pos.array[i * 3 + 1] + speeds[i];               // slow upward drift
          if (y > SPREAD_Y / 2) y = -SPREAD_Y / 2;
          pos.array[i * 3 + 1] = y;
          pos.array[i * 3] += Math.sin(t * 0.6 + phases[i]) * 0.0035; // lateral sway
        }
        pos.needsUpdate = true;

        points.rotation.y = t * 0.02 + scrollDepth * 0.6;

        targetX += (mouseX - targetX) * 0.04;
        targetY += (mouseY - targetY) * 0.04;
        camera.position.x = targetX * 1.4;
        camera.position.y = -targetY * 1.0 - scrollDepth * 2.5;
        camera.lookAt(scene.position);

        renderer.render(scene, camera);
      }
      animate();
    } catch (err) {
      console.warn("Background scene disabled:", err);
    }
  }

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
