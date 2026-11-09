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
