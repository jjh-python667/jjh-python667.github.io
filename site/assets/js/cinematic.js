(function () {
  "use strict";
  var root = document.documentElement;
  var main = document.querySelector("main");
  if (!main) return;
  var gsap = window.gsap;
  var fine = matchMedia("(hover: hover) and (pointer: fine)");
  var mobile = matchMedia("(max-width: 640px)");
  var opening = null, openingPlayed = false, entryObserver = null;
  var entriesInMotion = new Map(), visited = new Set(), registry = [];
  var previousScroll = window.scrollY, previousScrollAt = performance.now(), fastUntil = 0;
  var hoverFrame = 0, glowTarget = null, glowX = 50, glowY = 0;
  var entranceEase = "cubic-bezier(.22, 1, .36, 1)";
  var maxEntrances = 3;
  function enabled() { return root.dataset.motion === "running"; }
  function mark(node, state) { node.dataset.moduleState = state; }
  function clear(node) {
    if (gsap && node) gsap.set(node, { clearProps: "transform,opacity,visibility,clipPath,willChange" });
  }
  // Register leaf modules; a card's controls never receive separate arrival transforms.
  var selectors = [
    ".hero-copy", ".creative-stage", ".workbench-desktop", ".workbench-mobile", ".preview-project",
    ".section-head", ".project-search-row", "[data-works-filter]", ".card[data-project]",
    ".update-item", ".sync-bar", ".growth-grid > .panel:first-child", ".growth-grid > .panel:last-child > h3", ".timeline-item",
    ".about > .section-display", ".about > p", ".detail-hero", ".agent-launch-card", ".agent-feature-list",
    ".agent-demo-grid > .cover-flow", ".demo-companion", ".agent-progress-card", ".detail-shot",
    ".detail-lead-card", ".detail-lead > figure", ".detail-sections > article"
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
  var diagnostic = { version: gsap && gsap.version, personality: "premium", openingDuration: 0,
    modules: registry.length, sectionTitles: document.querySelectorAll(".section-display").length,
    entryStrategy: "intersection-once", maxConcurrentEntries: maxEntrances };
  Object.defineProperty(window, "jjhMotionDiagnostics", { value: diagnostic, configurable: true });

  function finishOpening() {
    if (opening) opening.progress(1);
  }

  document.addEventListener("focusin", function (event) {
    finishOpening();
    registry.forEach(function (node) {
      if (!node.contains(event.target)) return;
      visited.add(node);
      if (entryObserver) entryObserver.unobserve(node);
      var animation = entriesInMotion.get(node);
      if (animation) animation.cancel();
    });
  });

  function playEntry(entry) {
    var node = entry.target;
    if (!entry.isIntersecting || visited.has(node)) return;
    entryObserver.unobserve(node);
    visited.add(node);
    if (!enabled() || document.hidden || opening || performance.now() < fastUntil ||
        entriesInMotion.size >= maxEntrances || node.offsetParent === null) return;

    // Start just ahead of the viewport. Scrolling back to existing content stays still.
    if (entry.boundingClientRect.top < innerHeight - 18) return;
    var target = node.querySelector(".section-display > .display-inner, :scope > .card-body") || node;
    var distance = mobile.matches ? 10 : 16;
    var animation = target.animate([
      { translate: "0 " + distance + "px", opacity: .9 },
      { translate: "0 0", opacity: 1 }
    ], { duration: mobile.matches ? 320 : 420, easing: entranceEase });
    entriesInMotion.set(node, animation);
    mark(node, "playing");
    animation.onfinish = animation.oncancel = function () {
      entriesInMotion.delete(node);
      mark(node, "entered");
    };
  }
  function createOpening() {
    var shell = document.querySelector(".opening-scene");
    if (!gsap || !shell || openingPlayed || location.hash || scrollY > 40) return;
    openingPlayed = true;
    root.dataset.opening = "running";
    var heroModules = registry.filter(function (node) { return node.matches(".hero-copy, .creative-stage, .hero-showcase .workbench-desktop, .preview-project"); });
    heroModules.forEach(function (node) { visited.add(node); });
    // CSS provides the initial concealed states. Initialize each tween at its
    // own cue rather than measuring every supporting element during startup.
    opening = gsap.timeline({ defaults: { ease: "power3.out", immediateRender: false }, onComplete: function () {
      root.dataset.opening = "complete";
      heroModules.forEach(clear);
      gsap.set(".hero-line-inner, .hero-kicker, .hero-intro, .hero-copy .lead, .hero-actions, .hero-footnote, .opening-shutter, .opening-signature, .stage-ticket, .stage-caption", { clearProps: "transform,opacity,visibility,clipPath,willChange" });
      gsap.set(".stage-core", { clearProps: "opacity,clipPath" });
      clear(document.querySelector(".stage-core strong"));
      opening = null;
    } });
    opening.fromTo(".opening-signature", { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: .24 }, 0)
      .fromTo(".opening-shutter", { clipPath: "inset(0% 0% 0% 0%)" },
        { clipPath: "inset(0% 0% 100% 0%)", duration: .62, ease: "power3.inOut" }, .12)
      .fromTo(".hero-line-inner", { yPercent: 100, scaleX: .95 },
        { yPercent: 0, scaleX: 1, opacity: 1, duration: .7, stagger: .09 }, .22)
      .fromTo(".hero-kicker, .hero-intro", { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: .32, stagger: .04 }, .46)
      .fromTo(".hero-copy .lead, .hero-actions, .hero-footnote", { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: .34, stagger: .07 }, .56)
      .fromTo(".creative-stage", { y: 20, scale: .99, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: .52 }, .52)
      .fromTo(".stage-core", { opacity: 0 }, { opacity: 1, duration: .38 }, .66)
      .fromTo(".stage-ticket", { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: .38, stagger: .06 }, .75)
      .fromTo(".stage-caption, .hero-showcase .workbench-desktop", { y: 8, opacity: 0 },
        { y: 0, opacity: 1, duration: .34, stagger: .05 }, .95)
      .fromTo(".preview-project", { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: .32, stagger: .05 }, 1.05);
    if (mobile.matches) opening.timeScale(1.25);
    diagnostic.openingDuration = opening.duration() / opening.timeScale();
  }

  function teardown() {
    if (entryObserver) { entryObserver.disconnect(); entryObserver = null; }
    finishOpening();
    entriesInMotion.forEach(function (animation, node) {
      animation.cancel();
      mark(node, "entered");
    });
    entriesInMotion.clear();
    root.dataset.opening = "complete";
  }
  function build() {
    teardown();
    if (!enabled() || document.hidden) return;
    createOpening();
    if ("IntersectionObserver" in window && Element.prototype.animate) {
      entryObserver = new IntersectionObserver(function (entries, observer) {
        if (entryObserver === observer) entries.forEach(playEntry);
      }, { rootMargin: "40px 0px 64px 0px" });
      registry.forEach(function (node) {
        if (!visited.has(node)) entryObserver.observe(node);
      });
    }
  }
  window.addEventListener("scroll", function () {
    var now = performance.now(), top = window.scrollY;
    var distance = Math.abs(top - previousScroll), elapsed = now - previousScrollAt;
    if (distance >= 120 || (distance >= 28 && elapsed < 80 && distance / Math.max(elapsed, 8) > 2)) {
      fastUntil = now + 150;
    }
    previousScroll = top;
    previousScrollAt = now;
    if (opening && top > 96) finishOpening();
  }, { passive: true });
  document.addEventListener("jjh:motionchange", build);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) teardown();
    else build();
  });
  window.addEventListener("pagehide", teardown);
  window.addEventListener("pageshow", function (event) { if (event.persisted) build(); });
  build();
})();
