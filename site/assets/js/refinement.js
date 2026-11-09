(function () {
  "use strict";
  var root = document.documentElement;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)");
  var header = document.querySelector(".site-header");
  var stage = document.querySelector("[data-stage]");
  var controls = document.querySelectorAll("[data-motion-toggle]");
  var preference = "on";
  try { preference = localStorage.getItem("jjh-motion") === "off" ? "off" : "on"; } catch (error) {}
  var active = new Set();
  var stageVisible = false;
  var pending = false;
  var frame = 0, x = 0, y = 0;
  function enabled() { return !reduced.matches && preference !== "off"; }
  function resetStage() {
    if (!stage) return;
    cancelAnimationFrame(frame); frame = 0;
    stage.style.setProperty("--stage-x", "0deg");
    stage.style.setProperty("--stage-y", "0deg");
  }
  function syncStageVisibility() {
    root.dataset.pageVisible = String(!document.hidden);
    if (stage) stage.classList.toggle("is-stage-visible", stageVisible && !document.hidden);
  }
  function syncMotion() {
    var running = enabled();
    root.dataset.motion = running ? "running" : "paused";
    if (!running) {
      resetStage();
      active.forEach(function (animation) { animation.cancel(); });
      active.clear();
    }
    controls.forEach(function (control) {
      control.hidden = false;
      control.disabled = reduced.matches;
      control.textContent = reduced.matches ? "静态显示" : running ? "暂停动效" : "播放动效";
      control.setAttribute("aria-pressed", String(running));
      control.setAttribute("aria-label", reduced.matches ? "系统已开启减少动态，当前为静态显示" : running ? "暂停页面装饰动效" : "播放页面装饰动效");
    });
    syncStageVisibility();
    document.dispatchEvent(new CustomEvent("jjh:motionchange", { detail: { reduced: !running } }));
  }
  controls.forEach(function (control) { control.addEventListener("click", function () {
    preference = enabled() ? "off" : "on";
    try { localStorage.setItem("jjh-motion", preference); } catch (error) {}
    syncMotion();
  }); });
  reduced.addEventListener("change", syncMotion);
  window.addEventListener("storage", function (event) {
    if (event.key !== "jjh-motion") return;
    preference = event.newValue === "off" ? "off" : "on";
    syncMotion();
  });
  document.addEventListener("visibilitychange", syncStageVisibility);
  syncMotion();
  function animate(element, frames, options) {
    if (!element || !enabled() || !element.animate) return;
    var animation = element.animate(frames, options);
    active.add(animation);
    animation.onfinish = animation.oncancel = function () { active.delete(animation); };
  }
  if (stage && "IntersectionObserver" in window) {
    var stageObserver = new IntersectionObserver(function (entries) {
      stageVisible = entries[0].isIntersecting;
      syncStageVisibility();
    }, { threshold: 0.03 });
    stageObserver.observe(stage);
  } else if (stage) { stageVisible = true; syncStageVisibility(); }
  if (stage) {
    stage.addEventListener("pointermove", function (event) {
      if (!enabled() || !fine.matches || event.pointerType === "touch") return;
      var rect = stage.getBoundingClientRect();
      x = Math.max(-3, Math.min(3, ((event.clientY - rect.top) / rect.height - .5) * -6));
      y = Math.max(-4, Math.min(4, ((event.clientX - rect.left) / rect.width - .5) * 8));
      if (!frame) frame = requestAnimationFrame(function () {
        stage.style.setProperty("--stage-x", x.toFixed(2) + "deg");
        stage.style.setProperty("--stage-y", y.toFixed(2) + "deg");
        frame = 0;
      });
    });
    stage.addEventListener("pointerleave", resetStage);
  }
})();
