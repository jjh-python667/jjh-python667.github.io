(function () {
  /* ---------- nav (R6: inert + focus trap when open) ---------- */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");
  var lastNavFocus = null;
  function navFocusables() {
    if (!nav) return [];
    return Array.prototype.slice.call(
      nav.querySelectorAll('a, button, [tabindex]:not([tabindex="-1"])')
    ).filter(function (el) {
      return !el.hasAttribute("disabled") && el.offsetParent !== null;
    });
  }
  function setNavOpen(open) {
    if (!toggle || !nav) return;
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "关闭导航" : "打开导航");
    if (open) {
      lastNavFocus = document.activeElement;
      if ("inert" in HTMLElement.prototype) {
        /* only mark siblings inert if supported — keep header tools usable */
      }
      nav.removeAttribute("inert");
      var items = navFocusables();
      if (items[0]) items[0].focus();
    } else {
      if (window.matchMedia("(max-width: 859px)").matches) {
        nav.setAttribute("inert", "");
      } else {
        nav.removeAttribute("inert");
      }
      /* R10 P0-2: never leave body/main inert or cmdk veil after nav close */
      if (document.body.hasAttribute("inert")) {
        document.body.removeAttribute("inert");
      }
      var mainEl = document.querySelector("main");
      if (mainEl && mainEl.hasAttribute("inert")) {
        mainEl.removeAttribute("inert");
      }
      document.body.classList.remove("cmdk-open");
      if (lastNavFocus && typeof lastNavFocus.focus === "function") {
        lastNavFocus.focus();
      } else {
        toggle.focus();
      }
    }
  }
  if (toggle && nav) {
    if (window.matchMedia("(max-width: 859px)").matches) {
      nav.setAttribute("inert", "");
    }
    toggle.addEventListener("click", function () {
      setNavOpen(!nav.classList.contains("is-open"));
    });
    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        if (window.matchMedia("(max-width: 859px)").matches) {
          setNavOpen(false);
          var target = document.getElementById((link.hash || "").slice(1));
          if (target) {
            target.setAttribute("tabindex", "-1");
            target.focus({ preventScroll: true });
          }
        }
      });
    });
    document.addEventListener("keydown", function (e) {
      if (!nav.classList.contains("is-open")) return;
      if (e.key === "Escape") {
        e.preventDefault();
        setNavOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      var items = navFocusables();
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
    window.matchMedia("(max-width: 859px)").addEventListener("change", function (mq) {
      if (!mq.matches) {
        nav.classList.remove("is-open");
        nav.removeAttribute("inert");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "打开导航");
      } else if (!nav.classList.contains("is-open")) {
        nav.setAttribute("inert", "");
      }
    });
  }

  document.querySelectorAll("img[data-fallback]").forEach(function (img) {
    img.addEventListener("error", function () {
      var fallback = img.getAttribute("data-fallback") || "?";
      var wrap = img.parentElement;
      if (!wrap) return;
      var el = document.createElement("div");
      el.className = "cover-fallback";
      el.setAttribute("aria-hidden", "true");
      el.textContent = fallback;
      wrap.replaceChild(el, img);
    });
  });

  /* ---------- View Transitions (deepen; no API → direct nav, never throw) ---------- */
  document.querySelectorAll('a[href*="projects/"], a[href$="index.html"], a[href^="index.html"], a.card-title-link, a.card-detail-link').forEach(function (a) {
    var href = a.getAttribute("href") || "";
    if (href.indexOf("http") === 0) return;
    a.addEventListener("click", function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (a.target === "_blank") return;
      if (typeof document.startViewTransition !== "function") return;
      /* MPA: let the browser handle; named elements aid Chromium cross-doc VT when enabled */
      try {
        var card = a.closest("[data-project]");
        if (card) {
          var pid = card.getAttribute("data-project") || "";
          card.style.setProperty("--vt-title", "vt-title-" + pid);
          card.style.setProperty("--vt-cover", "vt-cover-" + pid);
        }
      } catch (err) {
        /* never block navigation */
      }
    });
  });

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function loadFlowData() {
    var el = document.getElementById("flow-demo-data");
    if (el && el.textContent) {
      try {
        return JSON.parse(el.textContent);
      } catch (err) {
        console.warn("flow-demo-data parse failed", err);
      }
    }
    return null;
  }

  var FLOW = loadFlowData();
  if (!FLOW) {
    /* fallback fetch for pages that only have the file */
    /* keep demo inert until loaded — index always embeds JSON */
  }

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  try { reduceMotion = reduceMotion || localStorage.getItem("jjh-motion") === "off"; } catch (error) {}
  document.addEventListener("jjh:motionchange", function (event) { reduceMotion = event.detail.reduced; });

  document.querySelectorAll("[data-flow-demo]").forEach(function (root) {
    if (!FLOW) return;
    var steps = Array.prototype.slice.call(root.querySelectorAll("[data-flow-step]"));
    var panel = root.querySelector("[data-flow-panel]");
    var actions = root.querySelector("[data-flow-actions]");
    var live = root.querySelector("[data-flow-live]");
    if (!steps.length || !panel) return;

    var detailHref =
      root.getAttribute("data-detail-href") || "projects/personal-learning-agent.html";
    var picked = null;
    var answeredCorrect = false;
    var currentKey = "explain";
    var renderTimer = null;
    var enterTimer = null;
    var params = new URLSearchParams(window.location.search);
    var demoMode = params.get("demo");
    var STEP_ORDER = (FLOW.steps || []).map(function (s) {
      return s.id;
    });
    if (!STEP_ORDER.length) STEP_ORDER = ["explain", "quiz", "answer", "continue"];

    function stepByKey(key) {
      return root.querySelector('[data-flow-step="' + key + '"]');
    }

    function stepIndex(key) {
      var i = STEP_ORDER.indexOf(key);
      return i < 0 ? 0 : i;
    }

    function announce(msg) {
      if (!live) return;
      live.textContent = "";
      /* force re-announce */
      void live.offsetWidth;
      live.textContent = msg;
    }

    function setStep(btn) {
      var key = btn.getAttribute("data-flow-step");
      currentKey = key;
      var idx = stepIndex(key);
      steps.forEach(function (s, i) {
        var on = s === btn;
        s.classList.toggle("is-active", on);
        s.classList.toggle("is-done", stepIndex(s.getAttribute("data-flow-step")) < idx);
        s.setAttribute("aria-selected", on ? "true" : "false");
        s.setAttribute("tabindex", on ? "0" : "-1");
      });
      root.querySelectorAll("[data-flow-arrow]").forEach(function (arrow) {
        var ai = parseInt(arrow.getAttribute("data-flow-arrow"), 10);
        arrow.classList.toggle("is-lit", ai < idx);
      });
    }

    function setActions(html) {
      if (!actions) return;
      actions.innerHTML = html || "";
      actions.classList.toggle("is-empty", !html);
      actions.classList.toggle("has-dual", actions.querySelectorAll(".btn").length >= 2);
    }

    function goTo(key) {
      var btn = stepByKey(key);
      if (btn) activate(btn, true);
    }

    function crossfade(renderFn) {
      window.clearTimeout(renderTimer);
      window.clearTimeout(enterTimer);
      panel.classList.remove("is-exit", "is-enter");
      if (reduceMotion) {
        renderFn();
        return;
      }
      panel.classList.add("is-exit");
      renderTimer = window.setTimeout(function () {
        renderFn();
        panel.classList.remove("is-exit");
        panel.classList.add("is-enter");
        enterTimer = window.setTimeout(function () {
          panel.classList.remove("is-enter");
        }, 180);
      }, 90);
    }

    function renderAnswer() {
      var A = FLOW.answer;
      var html =
        '<p class="flow-panel-kicker">' +
        escapeHtml(A.kicker) +
        '</p><p class="flow-q">' +
        (A.prompt_html || "") +
        '</p><div class="flow-choices" role="group" aria-label="选项">';
      A.choices.forEach(function (c) {
        var cls = "flow-choice";
        var disabled = "";
        var pressed = ' aria-pressed="false"';
        if (answeredCorrect) {
          disabled = " disabled";
          if (c.correct) cls += " is-correct";
          if (picked === c.id && !c.correct) cls += " is-wrong";
        } else if (picked === c.id && !c.correct) {
          cls += " is-wrong";
          pressed = ' aria-pressed="true"';
        }
        html +=
          '<button type="button" class="' +
          cls +
          '" data-choice="' +
          c.id +
          '"' +
          disabled +
          pressed +
          ">" +
          escapeHtml(c.label) +
          "</button>";
      });
      html += '</div><div class="flow-feedback-slot">';
      if (picked) {
        var choice = A.choices.filter(function (c) {
          return c.id === picked;
        })[0];
        var ok = choice && choice.correct;
        var msg = ok ? A.ok : (choice && choice.hint) || A.bad_fallback;
        html +=
          '<p class="flow-feedback ' +
          (ok ? "ok" : "bad") +
          '" role="status">' +
          escapeHtml(msg) +
          (ok ? "" : " 可以再选一次。") +
          "</p>";
      } else {
        html +=
          '<p class="flow-feedback muted" role="status">点一个选项作答；答错可重试。</p>';
      }
      html += "</div>";
      panel.innerHTML = html;

      if (answeredCorrect) {
        setActions(
          '<button type="button" class="btn btn-primary flow-next" data-flow-next="continue">继续</button>'
        );
        announce("第" + (stepIndex("answer") + 1) + "步·答题·正确。" + A.ok);
      } else if (picked && !answeredCorrect) {
        setActions(
          '<button type="button" class="btn btn-ghost flow-retry" data-flow-retry>再试一次</button>'
        );
        var badChoice = A.choices.filter(function (c) {
          return c.id === picked;
        })[0];
        announce(
          "第" +
            (stepIndex("answer") + 1) +
            "步·答题·错误。" +
            ((badChoice && badChoice.hint) || A.bad_fallback)
        );
      } else {
        setActions("");
        announce("第" + (stepIndex("answer") + 1) + "步·答题");
      }

      panel.querySelectorAll("[data-choice]").forEach(function (b) {
        b.addEventListener("click", function () {
          if (answeredCorrect) return;
          picked = b.getAttribute("data-choice");
          var choice = A.choices.filter(function (c) {
            return c.id === picked;
          })[0];
          answeredCorrect = !!(choice && choice.correct);
          renderAnswer();
          if (answeredCorrect) {
            var cont = actions && actions.querySelector("[data-flow-next]");
            if (cont) cont.focus();
          } else {
            var selected = panel.querySelector('[data-choice="' + picked + '"]');
            if (selected) selected.focus({ preventScroll: true });
          }
        });
      });

      if (actions) {
        var retry = actions.querySelector("[data-flow-retry]");
        if (retry) {
          retry.addEventListener("click", function () {
            picked = null;
            answeredCorrect = false;
            renderAnswer();
            var first = panel.querySelector("[data-choice]");
            if (first) first.focus();
          });
        }
        var nextBtn = actions.querySelector('[data-flow-next="continue"]');
        if (nextBtn) {
          nextBtn.addEventListener("click", function () {
            goTo("continue");
          });
        }
      }
    }

    function renderContinue() {
      var C = FLOW.continue;
      panel.innerHTML =
        '<p class="flow-panel-kicker">' +
        escapeHtml(C.kicker) +
        "</p>" +
        '<p class="flow-panel-body">' +
        (C.body_html || "") +
        "</p>" +
        '<p class="flow-panel-body muted">' +
        (C.note_html || "") +
        "</p>";
      setActions(
        '<button type="button" class="btn btn-ghost" data-flow-restart>' +
          escapeHtml(FLOW.restart_label || "重新体验") +
          "</button>" +
          '<a class="btn btn-primary" href="' +
          escapeHtml(detailHref) +
          '">' +
          escapeHtml(FLOW.detail_label || "查看项目详情") +
          "</a>"
      );
      announce("第" + (stepIndex("continue") + 1) + "步·继续");
      if (actions) {
        var restart = actions.querySelector("[data-flow-restart]");
        if (restart) {
          restart.addEventListener("click", function () {
            picked = null;
            answeredCorrect = false;
            activate(stepByKey("explain"));
            var first = stepByKey("explain");
            if (first) first.focus();
          });
        }
      }
    }

    function renderExplainOrQuiz(key) {
      var data = FLOW[key];
      if (!data) return;
      var html =
        '<p class="flow-panel-kicker">' + escapeHtml(data.kicker) + "</p>";
      if (data.code) {
        html +=
          '<pre class="flow-code"><code>' +
          escapeHtml(data.code) +
          "</code></pre>";
      }
      if (data.body_html) {
        html += '<p class="flow-panel-body">' + data.body_html + "</p>";
      }
      if (data.question_html) {
        html += '<p class="flow-q">' + data.question_html + "</p>";
      }
      panel.innerHTML = html;
      if (data.next) {
        setActions(
          '<button type="button" class="btn btn-primary flow-next" data-flow-next="' +
            escapeHtml(data.next.step) +
            '">' +
            escapeHtml(data.next.label) +
            "</button>"
        );
        var nb = actions && actions.querySelector("[data-flow-next]");
        if (nb) {
          nb.addEventListener("click", function () {
            goTo(data.next.step);
          });
        }
      } else {
        setActions("");
      }
      announce("第" + (stepIndex(key) + 1) + "步·" + (data.kicker || key));
    }

    function activate(btn, focusContent) {
      var key = btn.getAttribute("data-flow-step");
      setStep(btn);
      crossfade(function () {
        if (key === "answer") {
          renderAnswer();
        } else if (key === "continue") {
          renderContinue();
        } else {
          renderExplainOrQuiz(key);
        }
        if (focusContent) {
          var target = panel.querySelector("[data-choice]:not(:disabled)") ||
            (actions && actions.querySelector("button, a")) || panel;
          target.focus({ preventScroll: true });
        }
      });
    }

    steps.forEach(function (btn, index) {
      btn.addEventListener("click", function () {
        activate(btn);
      });
      btn.addEventListener("keydown", function (e) {
        var next = null;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          next = steps[(index + 1) % steps.length];
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          next = steps[(index - 1 + steps.length) % steps.length];
        } else if (e.key === "Home") {
          next = steps[0];
        } else if (e.key === "End") {
          next = steps[steps.length - 1];
        } else if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate(btn);
          return;
        }
        if (next) {
          e.preventDefault();
          /* roving tabindex only — do NOT activate */
          steps.forEach(function (s) {
            s.setAttribute("tabindex", "-1");
          });
          next.setAttribute("tabindex", "0");
          next.focus();
        }
      });
    });

    var initial = steps[0];
    if (demoMode === "answered") {
      picked = "b";
      answeredCorrect = true;
      initial = stepByKey("answer") || steps[2];
    } else if (demoMode === "wrong") {
      picked = "a";
      answeredCorrect = false;
      initial = stepByKey("answer") || steps[2];
    } else if (demoMode === "answer") {
      initial = stepByKey("answer") || steps[2];
    } else if (demoMode === "continue") {
      picked = "b";
      answeredCorrect = true;
      initial = stepByKey("continue") || steps[3];
    }
    /* first paint without waiting on exit animation */
    var prevReduce = reduceMotion;
    reduceMotion = true;
    activate(initial);
    reduceMotion = prevReduce;
  });
})();


/* ===== R6 P0 modules ===== */
(function () {
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  try { reduceMotion = reduceMotion || localStorage.getItem("jjh-motion") === "off"; } catch (error) {}
  document.addEventListener("jjh:motionchange", function (event) { reduceMotion = event.detail.reduced; });
  var THEME_KEY = "jjh-theme";

  function currentTheme() {
    var t = document.documentElement.getAttribute("data-theme");
    if (t === "light" || t === "dark") return t;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  /* R10 P0-2: clear stuck cmdk/backdrop veil without touching intentional aurora */
  function clearOverlayResidue() {
    var bd = document.querySelector("[data-cmdk-backdrop]");
    var dlg = document.getElementById("cmdk");
    var shouldOpen = !!(bd && bd.classList.contains("is-open") && !bd.hidden);
    if (!shouldOpen) {
      document.body.classList.remove("cmdk-open");
      if (bd) {
        bd.classList.remove("is-open");
        bd.hidden = true;
        bd.setAttribute("hidden", "");
      }
    }
    /* never inert document.body; nav inert stays on #site-nav only */
    if (document.body.hasAttribute("inert")) {
      document.body.removeAttribute("inert");
    }
    var main = document.querySelector("main");
    if (main && main.hasAttribute("inert")) {
      main.removeAttribute("inert");
    }
  }

  function applyTheme(theme, persist) {
    if (theme !== "light" && theme !== "dark") return;
    if (!reduceMotion) {
      document.documentElement.classList.add("theme-animating");
      window.setTimeout(function () {
        document.documentElement.classList.remove("theme-animating");
        clearOverlayResidue();
      }, 200);
    }
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
    if (persist) {
      try {
        localStorage.setItem(THEME_KEY, theme);
      } catch (e) {}
    }
    document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
      btn.setAttribute(
        "aria-label",
        theme === "dark" ? "切换到浅色主题" : "切换到深色主题"
      );
    });
    clearOverlayResidue();
  }

  /* Ensure attribute present even if boot script missed */
  applyTheme(currentTheme(), false);

  document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      applyTheme(currentTheme() === "dark" ? "light" : "dark", true);
    });
  });

  /* Follow system only when user has no manual override */
  try {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", function (e) {
      var stored = null;
      try {
        stored = localStorage.getItem(THEME_KEY);
      } catch (err) {}
      if (stored === "light" || stored === "dark") return;
      applyTheme(e.matches ? "dark" : "light", false);
    });
  } catch (e) {}

  /* ---------- scroll progress + section aria-current ---------- */
  var progress = document.querySelector("[data-scroll-progress]");
  var sectionIds = ["works", "updates", "growth"];
  var siteHeader = document.querySelector(".site-header");
  function updateHeader() { if (siteHeader) siteHeader.classList.toggle("is-scrolled", window.scrollY > 24); }
  function updateProgress() {
    if (!progress) return;
    var el = document.documentElement;
    var max = Math.max(0, el.scrollHeight - el.clientHeight);
    var top = el.scrollTop || document.body.scrollTop || 0;
    var pct = max > 0 ? (top / max) * 100 : 0;
    pct = Math.min(100, Math.max(0, pct));
    progress.style.width = pct + "%";
    progress.setAttribute("data-progress", String(Math.round(pct)));
  }
  function updateSectionNav() {
    var links = document.querySelectorAll(".site-nav a[data-nav-section]");
    if (!links.length) return;
    var header = document.querySelector(".site-header");
    var offset = header ? header.getBoundingClientRect().bottom + 8 : 72;
    var active = null;
    sectionIds.forEach(function (id) {
      var sec = document.getElementById(id);
      if (!sec) return;
      var top = sec.getBoundingClientRect().top;
      if (top <= offset) active = id;
    });
    links.forEach(function (a) {
      var key = a.getAttribute("data-nav-section");
      if (active && key === active) {
        a.setAttribute("aria-current", "true");
      } else if (a.getAttribute("aria-current") === "page") {
        /* keep page-level current on detail pages */
      } else {
        a.removeAttribute("aria-current");
      }
    });
  }
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      updateHeader();
      updateProgress();
      updateSectionNav();
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("hashchange", function () {
    updateSectionNav();
  });
  updateProgress();
  updateSectionNav();
  updateHeader();

  /* ---------- tag filter (R10 P0-1: mobile collapse) ---------- */
  var filterRoot = document.querySelector("[data-works-filter]");
  var grid = document.querySelector("[data-featured-grid]");
  var emptyEl = document.querySelector("[data-works-empty]");
  if (filterRoot && grid) {
    var filterToggle = filterRoot.querySelector("[data-filter-toggle]");
    var filterChips = filterRoot.querySelector("[data-filter-chips]");
    var filterCurrent = filterRoot.querySelector("[data-filter-current]");
    var searchInput = document.querySelector("[data-project-search]");
    var clearSearch = document.querySelector("[data-clear-search]");
    var projectCount = document.querySelector("[data-project-count]");
    var activeFilterTag = "*";
    var activeFilterLabel = "";
    var filterBreakpoint = window.matchMedia("(min-width: 641px)");

    function filterIsDesktop() {
      return filterBreakpoint.matches;
    }
    function setFilterCollapsed(collapsed) {
      if (!filterToggle || !filterChips) return;
      filterRoot.setAttribute("data-collapsed", collapsed ? "true" : "false");
      filterToggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
      filterToggle.textContent = collapsed ? "按技术筛选" : "收起筛选";
      if (collapsed) {
        if (filterChips.contains(document.activeElement)) {
          filterToggle.focus();
        }
        filterChips.hidden = true;
        filterChips.setAttribute("hidden", "");
      } else {
        filterChips.hidden = false;
        filterChips.removeAttribute("hidden");
      }
    }
    function updateFilterCurrent(tag, label) {
      if (!filterCurrent) return;
      if (tag === "*") {
        filterCurrent.hidden = true;
        filterCurrent.setAttribute("hidden", "");
        filterCurrent.textContent = "";
        return;
      }
      filterCurrent.hidden = false;
      filterCurrent.removeAttribute("hidden");
      filterCurrent.textContent = "当前：" + (label || tag);
    }


    var filterAnimations = new WeakMap();
    document.addEventListener("jjh:motionchange", function (event) {
      if (!event.detail.reduced) return;
      grid.querySelectorAll(".card[data-tags]").forEach(function (card) {
        var animation = filterAnimations.get(card);
        if (animation) animation.cancel();
      });
    });
    function applyProjectFilters() {
      var previous = new Map();
      grid.querySelectorAll(".card[data-tags]").forEach(function (card) {
        var animation = filterAnimations.get(card);
        if (animation) animation.cancel();
        if (!card.classList.contains("is-filtered-out")) previous.set(card, card.getBoundingClientRect());
      });
      var query = searchInput ? searchInput.value.trim().toLocaleLowerCase() : "";
      var visible = 0;
      grid.querySelectorAll(".card[data-tags]").forEach(function (card) {
        var tags = (card.getAttribute("data-tags") || "").split(",");
        var matchesTag = activeFilterTag === "*" || tags.indexOf(activeFilterTag) >= 0;
        var matchesText = !query || card.textContent.toLocaleLowerCase().includes(query);
        var show = matchesTag && matchesText;
        card.classList.toggle("is-filtered-out", !show);
        if (show) visible += 1;
      });
      if (emptyEl) {
        emptyEl.hidden = visible !== 0;
        emptyEl.classList.toggle("is-visible", visible === 0);
      }
      if (projectCount) projectCount.textContent = visible + " 个作品";
      if (clearSearch) clearSearch.disabled = !query;
      if (!reduceMotion && Element.prototype.animate) {
        grid.querySelectorAll(".card[data-tags]:not(.is-filtered-out)").forEach(function (card) {
          var before = previous.get(card), after = card.getBoundingClientRect();
          if (after.bottom < 0 || after.top > innerHeight) return;
          var dx = before ? before.left - after.left : 0, dy = before ? before.top - after.top : 12;
          if (before && Math.abs(dx) + Math.abs(dy) < 1) return;
          // Keep the visual transition local when a filter removes a tall project.
          dy = Math.max(-60, Math.min(60, dy));
          dx = Math.max(-60, Math.min(60, dx));
          filterAnimations.set(card, card.animate([
            { opacity: before ? 1 : 0, transform: "translate(" + dx + "px," + dy + "px)" },
            { opacity: 1, transform: "translate(0,0)" }
          ], { duration: 260, easing: "cubic-bezier(.2,.7,.2,1)" }));
        });
      }
    }
    if (searchInput) searchInput.addEventListener("input", applyProjectFilters);
    if (clearSearch) clearSearch.addEventListener("click", function () {
      searchInput.value = "";
      applyProjectFilters();
      searchInput.focus();
    });
    applyProjectFilters();
    setFilterCollapsed(true);
    if (filterToggle) {
      filterToggle.addEventListener("click", function () {
        var collapsed = filterRoot.getAttribute("data-collapsed") !== "false";
        setFilterCollapsed(!collapsed);
      });
    }
    filterBreakpoint.addEventListener("change", function () {
      setFilterCollapsed(true);
      updateFilterCurrent(activeFilterTag, activeFilterLabel);
    });

    filterRoot.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-filter-tag]");
      if (!btn) return;
      var tag = btn.getAttribute("data-filter-tag") || "*";
      var label = (btn.textContent || "").trim();
      activeFilterTag = tag;
      activeFilterLabel = label;
      filterRoot.querySelectorAll("[data-filter-tag]").forEach(function (b) {
        b.setAttribute("aria-pressed", b === btn ? "true" : "false");
      });
      applyProjectFilters();
      updateFilterCurrent(tag, label);
      /* After picking a tag on mobile, collapse and keep current condition visible */
      if (!filterIsDesktop()) {
        setFilterCollapsed(true);
      }
    });
  }

  /* ---------- command palette ---------- */
  var backdrop = document.querySelector("[data-cmdk-backdrop]");
  var dialog = document.getElementById("cmdk");
  var cmdkTrigger = document.querySelector("[data-cmdk-open]");
  var cmdkReturnFocus = null;
  var cmdkIndex = 0;

  function cmdkItems() {
    if (!dialog) return [];
    return Array.prototype.slice.call(dialog.querySelectorAll(".cmdk-item"));
  }
  function setCmdkSelected(i) {
    var items = cmdkItems();
    if (!items.length) return;
    cmdkIndex = (i + items.length) % items.length;
    items.forEach(function (el, idx) {
      el.setAttribute("aria-selected", idx === cmdkIndex ? "true" : "false");
    });
    items[cmdkIndex].focus();
  }
  function openCmdk() {
    if (!backdrop || !dialog) return;
    var navToggle = document.querySelector(".nav-toggle");
    if (navToggle && navToggle.getAttribute("aria-expanded") === "true") {
      navToggle.click();
    }
    cmdkReturnFocus = document.activeElement;
    backdrop.hidden = false;
    backdrop.classList.add("is-open");
    backdrop.removeAttribute("hidden");
    document.body.classList.add("cmdk-open");
    setCmdkSelected(0);
  }
  function closeCmdk() {
    if (backdrop) {
      backdrop.classList.remove("is-open");
      backdrop.hidden = true;
      backdrop.setAttribute("hidden", "");
    }
    document.body.classList.remove("cmdk-open");
    clearOverlayResidue();
    if (cmdkReturnFocus && typeof cmdkReturnFocus.focus === "function") {
      cmdkReturnFocus.focus();
    } else if (cmdkTrigger) {
      cmdkTrigger.focus();
    }
  }
  function runCmdk(btn) {
    if (!btn) return;
    var action = btn.getAttribute("data-cmdk-action");
    if (action === "theme") {
      applyTheme(currentTheme() === "dark" ? "light" : "dark", true);
      closeCmdk();
      return;
    }
    var href = btn.getAttribute("data-href");
    var external = btn.getAttribute("data-external") === "1";
    closeCmdk();
    if (!href) return;
    if (external) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    /* same-page hash */
    try {
      var url = new URL(href, window.location.href);
      var samePage = url.pathname === location.pathname ||
        (location.pathname === "/" && url.pathname === "/index.html") ||
        (location.pathname === "/index.html" && url.pathname === "/");
      var target = url.hash && document.getElementById(url.hash.slice(1));
      if (samePage && target) {
        location.hash = url.hash;
        target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
        target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
        return;
      }
      location.href = href;
    } catch (err) {
      location.href = href;
    }
  }

  if (cmdkTrigger) {
    cmdkTrigger.addEventListener("click", function () {
      openCmdk();
    });
  }
  if (backdrop) {
    backdrop.addEventListener("click", function (e) {
      if (e.target === backdrop) closeCmdk();
    });
  }
  cmdkItems().forEach(function (btn) {
    btn.addEventListener("click", function () {
      runCmdk(btn);
    });
  });

  document.addEventListener("keydown", function (e) {
    var metaK = (e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey);
    if (metaK) {
      e.preventDefault();
      if (backdrop && backdrop.classList.contains("is-open")) closeCmdk();
      else openCmdk();
      return;
    }
    if (!backdrop || !backdrop.classList.contains("is-open")) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closeCmdk();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCmdkSelected(cmdkIndex + 1);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setCmdkSelected(cmdkIndex - 1);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      runCmdk(cmdkItems()[cmdkIndex]);
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      setCmdkSelected(e.shiftKey ? cmdkIndex - 1 : cmdkIndex + 1);
    }
  });

  /* ---------- magnetic CTA (fine pointer, ≤6px) ---------- */
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (fine && !reduceMotion) {
    document.querySelectorAll(".btn-cta-strong").forEach(function (btn) {
      btn.classList.add("is-magnetic");
      btn.addEventListener("pointermove", function (e) {
        var r = btn.getBoundingClientRect();
        var x = e.clientX - (r.left + r.width / 2);
        var y = e.clientY - (r.top + r.height / 2);
        var max = 6;
        var mx = Math.max(-max, Math.min(max, x * 0.15));
        var my = Math.max(-max, Math.min(max, y * 0.15));
        btn.style.setProperty("--mx", mx.toFixed(2) + "px");
        btn.style.setProperty("--my", my.toFixed(2) + "px");
      });
      btn.addEventListener("pointerleave", function () {
        btn.style.setProperty("--mx", "0px");
        btn.style.setProperty("--my", "0px");
      });
    });
  }
})();

;
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

;
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

;
(function () {
  var host = document.querySelector("[data-agent-service]");
  if (!host) return;
  var label = host.querySelector("[data-service-label]");
  var detail = host.querySelector("[data-service-detail]");
  var entry = host.querySelector("[data-workspace-link]");
  var retry = host.querySelector("[data-service-retry]");
  async function checkService() {
    retry.disabled = true;
    label.textContent = "正在检测学习服务…";
    try {
      var response = await fetch("/api/state", { credentials: "same-origin", signal: AbortSignal.timeout(5000), cache: "no-store" });
      if (!response.ok && response.status !== 401) throw new Error("service unavailable");
      host.dataset.connected = "true";
      entry.href = "/learning/";
      entry.textContent = response.status === 401 ? "登录学习工作台" : "打开学习工作台";
      if (response.status === 401) {
        label.textContent = "学习服务已连接";
        detail.textContent = "登录自己的账户，继续课程、资料和对话。";
      } else {
        var state = await response.json();
        label.textContent = state.configured ? "本机已连接 · 真实模型可用" : "本机已连接 · 模型待配置";
        detail.textContent = state.configured ? "可以上传资料、提问和继续学习。当前为本机联调，公网邀请试用仍在准备。" : "课程和资料管理已可使用，配置模型后即可生成真实回复。";
      }
    } catch (error) {
      host.dataset.connected = "false";
      label.textContent = "等待学习服务连接";
      detail.textContent = "可以先体验下方示例，并在开放进度里查看公网试用状态。";
      entry.href = "#trial-status";
      entry.textContent = "查看开放进度";
    } finally { retry.disabled = false; }
  }
  retry.addEventListener("click", checkService);
  document.querySelectorAll("[data-demo-step]").forEach(function (button) {
    button.addEventListener("click", function () {
      var target = document.querySelector('[data-flow-step="' + button.dataset.demoStep + '"]');
      if (target) { target.click(); target.focus({ preventScroll: true }); }
    });
  });
  if (document.querySelector('meta[name="deployment-mode"][content="static-portfolio"]')) {
    host.dataset.connected = "false";
    label.textContent = "GitHub Pages 作品展示";
    detail.textContent = "这里提供项目说明和固定示例；真实学习后台尚未在公网部署，不会在此索取账户或模型 Key。";
    entry.href = "#trial-status";
    entry.textContent = "查看开放进度";
    retry.hidden = true;
  } else checkService();
})();
