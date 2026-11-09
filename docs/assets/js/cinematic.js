(function () {
  "use strict";
  var root = document.documentElement;
  var main = document.querySelector("main");
  if (!main) return;
  var gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
  var fine = matchMedia("(hover: hover) and (pointer: fine)");
  var mobile = matchMedia("(max-width: 640px)");
  var context = null, opening = null, openingPlayed = false, entryObserver = null;
  var timelines = new Map(), visited = new Set(), registry = [];
  var hoverFrame = 0, glowTarget = null, glowX = 50, glowY = 0;
  function enabled() { return root.dataset.motion === "running"; }
  function mark(node, state) { node.dataset.moduleState = state; }
  function clear(node) {
    if (gsap) gsap.set(node, { clearProps: "transform,opacity,visibility,clipPath,willChange" });
  }
  // Register leaf modules; a card's controls never receive separate arrival transforms.
  var selectors = [
    ".hero-copy", ".creative-stage", ".workbench-desktop", ".workbench-mobile", ".preview-project",
    ".section-head", ".project-search-row", "[data-works-filter]", ".card[data-project]",
    ".update-item", ".sync-bar", ".growth-grid > .panel:first-child", ".growth-grid > .panel:last-child > h3", ".timeline-item",
    ".about > .section-display", ".about > p", ".detail-hero", ".agent-launch-card", ".agent-feature-list",
    ".agent-demo-grid > .cover-flow", ".demo-companion", ".agent-progress-card", ".detail-shot",
    ".detail-lead-card", ".detail-lead > figure", ".detail-sections > article", ".site-footer"
  ];
  if (!main.classList.contains("detail-page") && !document.body.classList.contains("portfolio-home")) selectors.push("main.wrap.section");
  document.querySelectorAll(selectors.join(",")).forEach(function (node, index) {
    if (registry.some(function (parent) { return parent.contains(node); })) return;
    node.dataset.cinematicModule = "module-" + index;
    mark(node, "entered");
    registry.push(node);
  });
  // Glow surfaces are independent, non-interactive border masks.
  document.querySelectorAll(".card[data-project], .creative-stage, .workshop-card, .preview-project, .updates, .panel, .agent-launch-card, .agent-feature-list, .demo-companion, .agent-progress-card, .detail-shot, .detail-lead-card, .detail-sections > article, .agent-demo-grid > .cover-flow").forEach(function (node) {
    node.classList.add("glow-surface");
    var glow = document.createElement("span");
    glow.className = "surface-glow";
    glow.setAttribute("aria-hidden", "true");
    node.appendChild(glow);
    node.addEventListener("pointermove", function (event) {
      if (!enabled() || !fine.matches || event.pointerType === "touch") return;
      var rect = node.getBoundingClientRect();
      glowTarget = node;
      glowX = Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100));
      glowY = Math.max(0, Math.min(100, (event.clientY - rect.top) / rect.height * 100));
      if (!hoverFrame) hoverFrame = requestAnimationFrame(function () {
        glowTarget.style.setProperty("--glow-x", glowX.toFixed(2) + "%");
        glowTarget.style.setProperty("--glow-y", glowY.toFixed(2) + "%");
        hoverFrame = 0;
      });
    });
    node.addEventListener("pointerleave", function () {
      if (hoverFrame && glowTarget === node) { cancelAnimationFrame(hoverFrame); hoverFrame = 0; }
      node.style.setProperty("--glow-x", "50%");
      node.style.setProperty("--glow-y", "0%");
    });
  });
  var imageTargets = Array.from(document.querySelectorAll(".cover-shot img, .detail-shot img, .preview-project > img"));
  imageTargets.forEach(function (image) { image.parentElement.classList.add("reveal-clip"); });
  function settle() {
    root.dataset.opening = "complete";
    registry.forEach(function (node) { mark(node, "entered"); });
  }
  if (!gsap || !ScrollTrigger) { settle(); return; }
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  var diagnostic = { version: gsap.version, openingDuration: 0, modules: registry.length, sectionTitles: document.querySelectorAll(".section-display").length };
  Object.defineProperty(window, "jjhMotionDiagnostics", { value: diagnostic, configurable: true });
  function complete(node) { mark(node, "entered"); visited.add(node); clear(node); }
  function finishInside(node) {
    registry.forEach(function (module) {
      if (module === node || module.contains(node)) {
        var timeline = timelines.get(module);
        if (timeline) timeline.progress(1);
        complete(module);
      }
    });
  }
  document.addEventListener("focusin", function (event) {
    if (opening && opening.isActive()) { opening.progress(1); }
    finishInside(event.target);
  });
  function moduleTimeline(node, index) {
    if (visited.has(node) || node.offsetParent === null) return;
    if (node.matches(".hero-copy, .creative-stage, .hero-showcase .workbench-desktop, .preview-project") && root.dataset.opening === "running") return;
    var inner = node.matches(".section-display") ? node.querySelector(".display-inner") : node.querySelector(".section-display > .display-inner");
    var isHeader = node.matches(".section-head, .detail-hero, .section-display");
    var siblings = Array.from(node.parentElement.children).filter(function (item) { return registry.includes(item); });
    var staggerIndex = Math.max(0, siblings.indexOf(node));
    var tl = gsap.timeline({ paused: true, defaults: { ease: "power3.out" }, onStart: function () { mark(node, "playing"); }, onComplete: function () {
      complete(node);
      if (inner) clear(inner);
      Array.from(node.children).forEach(function (child) { if (!child.classList.contains("surface-glow")) clear(child); });
    } });
    timelines.set(node, tl);
    if (inner) {
      tl.fromTo(inner, { yPercent: 110, xPercent: mobile.matches ? -8 : -15, scaleX: .8, rotation: -3, transformOrigin: "left bottom" },
        { yPercent: 0, xPercent: 0, scaleX: 1, rotation: 0, duration: mobile.matches ? 1.15 : 1.5, immediateRender: true }, 0);
      var rest = Array.from(node.children).filter(function (child) { return !child.matches(".section-display, .surface-glow"); });
      if (rest.length) tl.fromTo(rest, { y: mobile.matches ? 30 : 54, clipPath: "inset(0 0 100% 0)" },
        { y: 0, clipPath: "inset(0 0 0% 0)", stagger: .1, duration: 1.1, immediateRender: true }, .45);
    } else {
      tl.fromTo(node, { y: mobile.matches ? 42 : 78, scale: .965, rotationX: mobile.matches ? 0 : 5, clipPath: "inset(0 0 100% 0 round 24px)", transformOrigin: "center bottom" },
        { y: 0, scale: 1, rotationX: 0, clipPath: "inset(0 0 0% 0 round 24px)", duration: mobile.matches ? .95 : 1.25, immediateRender: false }, Math.min(staggerIndex, 3) * .13);
    }
    mark(node, "pending");
    function playEntry() {
      if (visited.has(node)) return;
      var section = node.closest("section");
      var lead = section && section.querySelector(":scope > .section-head");
      if (!lead && !node.matches(".detail-hero")) lead = document.querySelector(".detail-hero");
      if (lead && lead !== node && lead.dataset.moduleState === "playing") tl.delay(.42);
      tl.play(0);
    }
    mark(node, "playing");
    playEntry();
  }
  function createOpening() {
    var shell = document.querySelector(".opening-scene");
    if (!shell || openingPlayed || location.hash || scrollY > 40) { root.dataset.opening = "complete"; return; }
    openingPlayed = true;
    root.dataset.opening = "running";
    var heroModules = registry.filter(function (node) { return node.matches(".hero-copy, .creative-stage, .hero-showcase .workbench-desktop, .preview-project"); });
    heroModules.forEach(function (node) { mark(node, "playing"); });
    opening = gsap.timeline({ defaults: { ease: "power4.inOut" }, onComplete: function () {
      root.dataset.opening = "complete";
      heroModules.forEach(complete);
      gsap.set(".hero-line-inner, .hero-intro, .hero-copy .lead, .hero-actions, .hero-footnote, .opening-signature", { clearProps: "transform,opacity,visibility,clipPath,willChange" });
    } });
    opening.fromTo(".opening-signature", { y: 34, scaleX: .7, opacity: 0 }, { y: 0, scaleX: 1, opacity: 1, duration: .6, ease: "power3.out" }, 0)
      .fromTo(".opening-shutter", { clipPath: "inset(0 0 0% 0 round 0px)" }, { clipPath: "inset(0 0 100% 0 round 0px)", duration: 1.2 }, .32)
      .fromTo(".hero-line-inner", { yPercent: 118, scaleX: .74, scaleY: 1.17, rotation: -3, transformOrigin: "left bottom" }, { yPercent: 0, scaleX: 1, scaleY: 1, rotation: 0, duration: 1.65, stagger: .18, ease: "expo.out" }, .6)
      .fromTo(".hero-intro, .hero-copy .lead, .hero-actions, .hero-footnote", { y: 34, clipPath: "inset(0 0 100% 0)" }, { y: 0, clipPath: "inset(0 0 0% 0)", duration: 1.1, stagger: .12, ease: "power3.out" }, .92)
      .fromTo(".creative-stage", { y: 80, scale: .88, rotation: 4, clipPath: "inset(0 0 100% 0 round 32px)" }, { y: 0, scale: 1, rotation: 0, clipPath: "inset(0 0 0% 0 round 32px)", duration: 1.4, ease: "power3.out" }, .98)
      .fromTo(".hero-showcase .workbench-desktop, .preview-project", { y: 55, clipPath: "inset(0 0 100% 0 round 20px)" }, { y: 0, clipPath: "inset(0 0 0% 0 round 20px)", duration: 1.05, stagger: .1, ease: "power3.out" }, 1.5);
    if (mobile.matches) opening.timeScale(1.35);
    diagnostic.openingDuration = opening.duration() / opening.timeScale();
    heroModules.forEach(function (node) { timelines.set(node, opening); });
  }
  function setupParallax() {
    if (!fine.matches || mobile.matches) return;
    // Long product screenshots must remain complete; only cropped covers can move.
    document.querySelectorAll(".cover-shot img").forEach(function (image) {
      gsap.fromTo(image, { yPercent: -3, scale: 1.08 }, { yPercent: 3, scale: 1.08, ease: "none",
        scrollTrigger: { trigger: image.parentElement, start: "top bottom", end: "bottom top", scrub: .8 } });
    });
  }
  function teardown() {
    if (entryObserver) { entryObserver.disconnect(); entryObserver = null; }
    if (opening) { opening.kill(); opening = null; }
    if (context) { context.revert(); context = null; }
    timelines.clear();
    settle();
  }
  function build() {
    teardown();
    if (!enabled()) return;
    context = gsap.context(function () {
      createOpening();
      setupParallax();
    }, document.body);
    context.add("enterModule", moduleTimeline);
    diagnostic.entryStrategy = "intersection-on-demand";
    if ("IntersectionObserver" in window) {
      entryObserver = new IntersectionObserver(function (entries) {
        entries.filter(function (entry) { return entry.isIntersecting; })
          .sort(function (a, b) { return registry.indexOf(a.target) - registry.indexOf(b.target); })
          .forEach(function (entry) {
            entryObserver.unobserve(entry.target);
            if (context && enabled()) context.enterModule(entry.target, registry.indexOf(entry.target));
          });
      }, { rootMargin: "0px 0px -8% 0px", threshold: .01 });
      registry.forEach(function (node) {
        if (visited.has(node) || node.dataset.moduleState === "playing") return;
        mark(node, "pending");
        entryObserver.observe(node);
      });
    } else {
      registry.forEach(function (node, index) { context.enterModule(node, index); });
    }
    requestAnimationFrame(function () { ScrollTrigger.refresh(); });
  }
  document.addEventListener("jjh:motionchange", build);
  document.addEventListener("visibilitychange", function () {
    timelines.forEach(function (timeline, node) {
      if (document.hidden && timeline.isActive()) { node.dataset.wasAnimating = "true"; timeline.pause(); }
      else if (!document.hidden && node.dataset.wasAnimating === "true" && enabled()) { delete node.dataset.wasAnimating; timeline.resume(); }
    });
  });
  window.addEventListener("pagehide", teardown);
  window.addEventListener("pageshow", function (event) { if (event.persisted) build(); });
  window.addEventListener("load", function () { if (enabled()) ScrollTrigger.refresh(); }, { once: true });
  mobile.addEventListener("change", build);
  build();
})();
