/* Step engine for the AI Foundations EMBA guides. Adapted from
   2026/site-alt/assets/alt.js (the vibe-coding workshop site): the same gate,
   rail, dot-matrix numerals and Copy buttons, plus team tabs, saved fields,
   an "any one box" gate, required fields, a score readout and a copy-my-answers
   button. Nothing here sends anything anywhere: no fetch, no XHR, no beacon.

   The page is authored expanded and JS hides what it does not need: the `js`
   class on <html> (set in each page's head, removed again if this file fails to
   load or throws) gates every display:none rule in guide.css. If anything here
   breaks, the guide degrades to one long readable document. */
(function () {
  "use strict";

  var TRACK = window.TRACK || { id: "track" };
  var KEY = "emba26." + TRACK.id;
  var reduce = /[?&]still/.test(location.search) ||
    (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  if (reduce) document.documentElement.className += " still";

  /* ------------------------------------------------------------- storage */
  function load() {
    var v;
    try { v = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    return (v && typeof v === "object" && !Array.isArray(v)) ? v : {};
  }
  var storageOk = true;
  function save(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); storageOk = true; }
    catch (e) { storageOk = false; }
  }
  if (/[?&]fresh/.test(location.search)) {
    try { localStorage.removeItem(KEY); } catch (e) {}
    try {
      var q = location.search.replace(/[?&]fresh(=[^&]*)?/g, "").replace(/^&/, "?");
      history.replaceState(null, "", location.pathname + q + location.hash);
    } catch (e) {}
  }
  var state = load();
  if (!state.checks) state.checks = {};
  if (!state.fields) state.fields = {};
  if (!state.scores) state.scores = {};

  /* ------------------------------------------------------- dot numerals */
  var DOT = {
    "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
    "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
    "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
    "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
    "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
    "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
    "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
    "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
    "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
    ".": ["0", "0", "0", "0", "0", "0", "1"]
  };

  function fillNumeral(el, animate) {
    var chars = String(el.getAttribute("data-num") || "").split("")
      .filter(function (ch) { return DOT[ch]; });
    var widths = chars.map(function (ch) { return DOT[ch][0].length; });
    var cols = widths.reduce(function (a, w) { return a + w; }, 0) + Math.max(0, chars.length - 1);
    el.textContent = "";
    el.style.setProperty("--cols", cols);
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", chars.join(""));
    for (var r = 0; r < 7; r++) {
      var x = 0;
      for (var d = 0; d < chars.length; d++) {
        if (d > 0) { el.appendChild(document.createElement("i")); x++; }
        for (var c = 0; c < widths[d]; c++, x++) {
          var i = document.createElement("i");
          if (DOT[chars[d]][r][c] === "1") {
            i.className = "on";
            if (animate && !reduce) i.style.transitionDelay = (x * 34 + r * 6) + "ms";
          }
          el.appendChild(i);
        }
      }
    }
    if (!animate || reduce) el.classList.add("is-in");
  }
  function paintNumerals() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-num]"), function (el) {
      var anim = el.classList.contains("dots--anim");
      fillNumeral(el, anim);
      if (anim) setTimeout(function () { el.classList.add("is-in"); }, 380);
    });
  }

  /* ---------------------------------------------------------------- hub */
  /* The entry page: a hairline sweep and a staged fade-in. Everything is on
     the page from the first frame; nothing waits for this. */
  function runHub() {
    var sweep = document.querySelector(".hub__sweep");
    if (!sweep) return;
    var step = reduce ? 0 : 1;
    setTimeout(function () { sweep.classList.add("is-in"); }, 60 * step);
    Array.prototype.forEach.call(document.querySelectorAll(".hub__rise"), function (el, i) {
      setTimeout(function () { el.classList.add("is-in"); }, (140 + i * 110) * step);
    });
  }

  /* -------------------------------------------------------------- stepper */
  var steps = [].slice.call(document.querySelectorAll(".step"));
  var doneScreen = document.querySelector(".done");
  var indexWrap = document.querySelector(".rail__index");
  var fillEl = document.querySelector(".meter__fill");
  var meterEl = document.querySelector(".meter");
  var readStep = document.querySelector("[data-read-step]");
  var readPct = document.querySelector("[data-read-pct]");
  var nowEl = document.querySelector(".rail__now");
  var current = 0;

  function stepNum(i) {
    if (!steps[i]) return null;
    var n = steps[i].querySelector(".step__num");
    var v = n && n.getAttribute("data-num");
    return v || null;
  }
  var SECTION = (function () {
    for (var i = 0; i < steps.length; i++) {
      var v = stepNum(i);
      if (v && v.indexOf(".") > 0) return v.split(".")[0];
    }
    return "";
  })();
  function stepLabel(i) { return stepNum(i) || (SECTION ? SECTION + ".0" : "0"); }
  function indexOfNum(n) {
    var k = parseInt(String(n).split(".").pop(), 10);
    if (k === 0) return steps.length ? 0 : -1;
    for (var i = 0; i < steps.length; i++) {
      var v = stepNum(i);
      if (v && parseInt(v.split(".").pop(), 10) === k) return i;
    }
    return -1;
  }

  /* checks are the boxes that gate; scores are boxes that only count */
  function allChecks() { return [].slice.call(document.querySelectorAll("input[data-check]")); }
  function stepChecks(i) { return steps[i] ? [].slice.call(steps[i].querySelectorAll("input[data-check]")) : []; }

  /* required fields: a textarea/input with data-required, or a radio group
     (name) whose one radio carries data-required */
  function stepRequired(i) {
    if (!steps[i]) return [];
    var seen = {}, out = [];
    [].slice.call(steps[i].querySelectorAll("[data-required]")).forEach(function (el) {
      var k = el.type === "radio" ? "radio:" + el.name : "el:" + (el.id || el.getAttribute("data-field"));
      if (seen[k]) return;
      seen[k] = true;
      out.push(el);
    });
    return out;
  }
  function filled(el) {
    if (el.type === "radio") return !!document.querySelector('input[name="' + el.name + '"]:checked');
    return !!(el.value && el.value.trim());
  }
  function fieldHost(el) {
    return el.closest(".field") || el;
  }

  /* The gate. A step is satisfied when every box on it is ticked (or any one,
     for a step marked data-gate="any") and every required field is filled. */
  function stepSatisfied(i) {
    var s = steps[i];
    if (!s) return true;
    var cs = stepChecks(i);
    var any = s.getAttribute("data-gate") === "any";
    var boxesOk = !cs.length ? true
      : any ? cs.some(function (c) { return c.checked; })
      : cs.every(function (c) { return c.checked; });
    var fieldsOk = stepRequired(i).every(filled);
    return boxesOk && fieldsOk;
  }
  function stepComplete(i) {
    return (stepChecks(i).length > 0 || stepRequired(i).length > 0) && stepSatisfied(i);
  }
  function progress() {
    var total = 0, done = 0;
    steps.forEach(function (s, i) {
      var any = s.getAttribute("data-gate") === "any";
      var cs = stepChecks(i);
      if (cs.length) {
        if (any) { total += 1; if (cs.some(function (c) { return c.checked; })) done += 1; }
        else { total += cs.length; done += cs.filter(function (c) { return c.checked; }).length; }
      }
      var rq = stepRequired(i);
      total += rq.length;
      done += rq.filter(filled).length;
    });
    return total ? done / total : 0;
  }
  function isDone() { return !!(doneScreen && doneScreen.classList.contains("is-active")); }
  function furthest() {
    for (var i = 0; i < steps.length; i++) if (!stepSatisfied(i)) return i;
    return steps.length;
  }

  function setHash(h) {
    try { if (history.replaceState) history.replaceState(null, "", h); } catch (e) {}
  }
  function toTop(smooth) {
    try { window.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" }); }
    catch (e) { window.scrollTo(0, 0); }
    if (window.pageYOffset > 0) window.scrollTo(0, 0);
  }

  function buildIndex() {
    if (!indexWrap || !steps.length) return;
    indexWrap.innerHTML = "";
    steps.forEach(function (s, i) {
      var li = document.createElement("li");
      var b = document.createElement("button");
      b.className = "rail__item";
      b.type = "button";
      b.innerHTML = '<span class="rail__n"></span><span class="rail__l"></span>';
      b.querySelector(".rail__n").textContent = stepLabel(i);
      b.querySelector(".rail__l").textContent = s.getAttribute("data-rail") || ("Step " + (i + 1));
      b.addEventListener("click", function () { go(i); });
      li.appendChild(b);
      indexWrap.appendChild(li);
    });
  }

  function paintIndex() {
    if (indexWrap && steps.length) {
      var limit = furthest();
      [].slice.call(indexWrap.querySelectorAll(".rail__item")).forEach(function (b, i) {
        var now = i === current && !isDone();
        var locked = i > limit;
        b.disabled = locked;
        b.title = locked ? "Finish the step before this one first" : "";
        b.classList.toggle("is-done", stepComplete(i));
        b.classList.toggle("is-now", now);
        if (now) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
      });
    }
    var p = isDone() ? 1 : progress();
    var pct = Math.round(p * 100);
    if (fillEl) fillEl.style.width = pct + "%";
    if (meterEl) meterEl.setAttribute("aria-valuenow", String(pct));
    if (readStep) readStep.textContent = isDone() ? "COMPLETE" : "STEP " + stepLabel(current);
    if (readPct) readPct.textContent = pct + "%";
    paintGuides();
    if (nowEl) nowEl.textContent = isDone() ? "Complete" : (steps[current] && steps[current].getAttribute("data-rail")) || "";
  }

  function go(i, opts) {
    opts = opts || {};
    if (doneScreen) doneScreen.classList.remove("is-active");
    var limit = furthest();
    if (i >= steps.length) {
      if (limit >= steps.length) { finish(); return; }
      i = limit;
    }
    current = Math.max(0, Math.min(steps.length - 1, i, limit));
    steps.forEach(function (s, n) { s.classList.toggle("is-active", n === current); });
    state.step = current;
    save(state);
    paintIndex();
    refreshNav();
    if (!opts.silent) {
      setHash("#step-" + stepLabel(current));
      toTop(!reduce);
      focusHead(steps[current].querySelector(".step__title"));
    }
  }

  function advance() {
    var limit = furthest();
    if (limit > current) go(current + 1);
    else nudge(limit);
  }

  /* A locked Next still takes the press, so it can point at what is missing:
     outline every unticked box and every empty required field, focus the first. */
  function nudge(i) {
    if (i !== current) go(i);
    var s = steps[i];
    var any = s && s.getAttribute("data-gate") === "any";
    var cs = stepChecks(i);
    var missing = [];
    if (cs.length && (any ? !cs.some(function (c) { return c.checked; }) : true)) {
      missing = cs.filter(function (c) { return !c.checked; });
    }
    var missingFields = stepRequired(i).filter(function (el) { return !filled(el); });
    missing.forEach(function (c) {
      var row = c.closest(".check");
      if (!row) return;
      row.classList.remove("is-missing");
      void row.offsetWidth;
      row.classList.add("is-missing");
    });
    missingFields.forEach(function (el) {
      var host = fieldHost(el);
      host.classList.remove("is-missing");
      void host.offsetWidth;
      host.classList.add("is-missing");
    });
    var first = missing[0] || missingFields[0];
    if (!first) return;
    try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); }
    var target = first.closest(".check") || fieldHost(first);
    try { target.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" }); }
    catch (e) { target.scrollIntoView(); }
  }

  function focusHead(el) {
    if (!el) return;
    el.setAttribute("tabindex", "-1");
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
  }

  function finish() {
    var limit = furthest();
    if (limit < steps.length) { go(limit); nudge(limit); return; }
    steps.forEach(function (s) { s.classList.remove("is-active"); });
    if (doneScreen) doneScreen.classList.add("is-active");
    state.done = true;
    save(state);
    paintIndex();
    setHash("#done");
    toTop(!reduce);
    if (doneScreen) focusHead(doneScreen.querySelector(".done__t"));
  }

  function refreshNav() {
    var limit = furthest();
    steps.forEach(function (s, i) {
      var any = s.getAttribute("data-gate") === "any";
      var cs = stepChecks(i);
      var left = cs.filter(function (c) { return !c.checked; }).length;
      var rq = stepRequired(i);
      var empty = rq.filter(function (el) { return !filled(el); }).length;
      var open = limit > i;
      var hint = s.querySelector("[data-hint]");
      var next = s.querySelector("[data-next]");
      if (hint && !hint.id) hint.id = "hint-" + i;
      if (next) {
        next.classList.toggle("is-locked", !open);
        next.setAttribute("aria-disabled", open ? "false" : "true");
        if (hint) next.setAttribute("aria-describedby", hint.id);
      }
      if (!hint) return;
      var msg;
      if (!cs.length && !rq.length) msg = "";
      else if (open) msg = "All done here.";
      else if (limit < i) msg = "An earlier step is not finished yet.";
      else if (empty && (any ? !cs.some(function (c) { return c.checked; }) : left)) msg = "Fill the " + (empty === 1 ? "empty field" : empty + " empty fields") + " and tick the boxes to continue.";
      else if (empty) msg = empty === 1 ? "Fill the empty field to continue." : "Fill the " + empty + " empty fields to continue.";
      else if (any) msg = "Tick at least one box to continue.";
      else msg = left === 1 ? "Tick the last box to continue." : "Tick the " + left + " remaining boxes to continue.";
      hint.textContent = msg;
    });
  }

  /* ----------------------------------------------------------------- copy */
  function toClipboard(text, done) {
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed"; ta.style.top = "0"; ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      var copied = false;
      try { copied = document.execCommand("copy"); } catch (e) {}
      document.body.removeChild(ta);
      done(!!copied);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try { navigator.clipboard.writeText(text).then(function () { done(true); }, fallback); }
      catch (e) { fallback(); }
    } else { fallback(); }
  }

  function wireCopy() {
    Array.prototype.forEach.call(document.querySelectorAll(".btn-copy"), function (b) {
      var label = b.textContent;
      var timer = null;
      function flash(text, okState) {
        if (timer) clearTimeout(timer);
        b.textContent = text;
        b.classList.toggle("is-ok", !!okState);
        timer = setTimeout(function () { b.textContent = label; b.classList.remove("is-ok"); }, okState ? 1600 : 4000);
      }
      b.addEventListener("click", function () {
        var card = b.closest(".prompt");
        var body = card && card.querySelector(".prompt__body");
        if (!body) return;
        var text = body.innerText.replace(/ /g, " ").replace(/\s+$/, "");
        toClipboard(text, function (ok) {
          if (ok) { flash("Copied", true); try { b.focus(); } catch (e) {} return; }
          try {
            var r = document.createRange();
            r.selectNodeContents(body);
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(r);
          } catch (e) {}
          flash("Press Ctrl/Cmd-C", false);
        });
      });
    });
  }

  /* ---------------------------------------------------------------- team */
  function paintTeam() {
    var picks = document.querySelectorAll("[data-team-pick]");
    if (!picks.length) return;
    var team = state.team || "";
    Array.prototype.forEach.call(picks, function (b) {
      var on = b.getAttribute("data-team-pick") === team;
      b.classList.toggle("is-selected", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-team-panel]"), function (p) {
      p.classList.toggle("is-active", p.getAttribute("data-team-panel") === team);
    });
    var none = document.querySelector("[data-team-none]");
    if (none) none.hidden = !!team;
  }
  function wireTeam() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-team-pick]"), function (b) {
      b.addEventListener("click", function () {
        state.team = b.getAttribute("data-team-pick");
        save(state);
        paintTeam();
      });
    });
    paintTeam();
  }

  /* -------------------------------------------------------------- fields */
  function allFields() { return [].slice.call(document.querySelectorAll("[data-field]")); }
  function grow(el) {
    if (el.tagName !== "TEXTAREA") return;
    el.style.height = "auto";
    el.style.height = Math.max(88, el.scrollHeight + 2) + "px";
  }
  function wireFields() {
    var timer = null;
    allFields().forEach(function (el) {
      var id = el.getAttribute("data-field");
      var v = state.fields[id];
      if (el.type === "radio") { if (typeof v === "string" && v === el.value) el.checked = true; }
      else if (typeof v === "string") el.value = v;
      grow(el);
      function store() {
        if (el.type === "radio") { if (el.checked) state.fields[id] = el.value; }
        else state.fields[id] = el.value;
        fieldHost(el).classList.remove("is-missing");
        save(state);
        paintIndex();
        refreshNav();
      }
      el.addEventListener("input", function () {
        grow(el);
        if (timer) clearTimeout(timer);
        timer = setTimeout(store, 200);
      });
      el.addEventListener("change", function () { if (timer) clearTimeout(timer); store(); });
    });
    window.addEventListener("resize", function () { allFields().forEach(grow); });
    window.addEventListener("beforeprint", function () { allFields().forEach(grow); });
    window.addEventListener("pagehide", function () { if (timer) { clearTimeout(timer); save(state); } });
  }

  /* --------------------------------------------------------------- score */
  /* The score panel can appear on more than one step (2.5 and 2.7): every box with
     the same data-score id is one tick, and every readout shows the same count. */
  function scoreIds() {
    var seen = {}, out = [];
    Array.prototype.forEach.call(document.querySelectorAll("input[data-score]"), function (c) {
      var id = c.getAttribute("data-score");
      if (!seen[id]) { seen[id] = true; out.push(id); }
    });
    return out;
  }
  function paintScore() {
    var ids = scoreIds();
    var n = ids.filter(function (id) { return !!state.scores[id]; }).length;
    Array.prototype.forEach.call(document.querySelectorAll("[data-score-count]"), function (out) {
      out.innerHTML = "";
      var b = document.createElement("b");
      b.textContent = String(n);
      out.appendChild(b);
      out.appendChild(document.createTextNode(" of " + ids.length));
    });
  }
  function wireScore() {
    Array.prototype.forEach.call(document.querySelectorAll("input[data-score]"), function (c) {
      var id = c.getAttribute("data-score");
      if (state.scores[id]) c.checked = true;
      c.addEventListener("change", function () {
        state.scores[id] = c.checked;
        Array.prototype.forEach.call(document.querySelectorAll('input[data-score="' + id + '"]'), function (o) { o.checked = c.checked; });
        save(state);
        paintScore();
      });
    });
    paintScore();
  }

  /* ------------------------------------------------------ copy answers */
  function answersText() {
    var out = [];
    var rule = "------------------------------------------------------------";
    out.push("AI Foundations · Executive MBA · MIT Sloan");
    out.push((TRACK.title || "Answers") + " · September 19, 2026");
    out.push("");
    var scoresListed = {};
    steps.forEach(function (s, i) {
      var title = s.querySelector(".step__title");
      out.push(rule);
      out.push(("STEP " + stepLabel(i) + " · " + (title ? title.textContent.replace(/\s+/g, " ").trim() : "")).toUpperCase());
      out.push(rule);
      out.push("");
      [].slice.call(s.querySelectorAll("input[data-check], input[data-score]")).forEach(function (c) {
        var sid = c.getAttribute("data-score");
        if (sid) { if (scoresListed[sid]) return; scoresListed[sid] = true; }   /* the shared panel is listed once */
        var row = c.closest(".check");
        var t = row && row.querySelector(".check__t");
        var label = t ? (t.childNodes[0] && t.childNodes[0].textContent || t.textContent).replace(/\s+/g, " ").trim() : c.getAttribute("data-check") || c.getAttribute("data-score");
        out.push("[" + (c.checked ? "x" : " ") + "] " + label);
      });
      var seen = {};
      [].slice.call(s.querySelectorAll("[data-field]")).forEach(function (el) {
        var id = el.getAttribute("data-field");
        var name = el.getAttribute("data-label") || id;
        if (el.type === "radio") {
          if (seen[el.name]) return;
          seen[el.name] = true;
          var on = document.querySelector('input[name="' + el.name + '"]:checked');
          out.push("");
          out.push(name + ": " + (on ? on.value : "(blank)"));
          return;
        }
        var v = (el.value || "").replace(/\s+$/, "");
        out.push("");
        out.push(name + ":");
        out.push(v ? v : "(blank)");
      });
      if (state.team && s.querySelector("[data-team-pick]")) {
        var pick = s.querySelector('[data-team-pick="' + state.team + '"] .team__pick-t');
        out.push("");
        out.push("Team: " + (pick ? pick.textContent.trim() : state.team));
      }
      out.push("");
    });
    return out.join("\n").replace(/\n{3,}/g, "\n\n").replace(/\s+$/, "") + "\n";
  }
  window.__answersText = answersText;   /* read by the render tests; harmless */

  function wireCopyAnswers() {
    var b = document.querySelector("[data-copy-answers]");
    if (!b) return;
    var status = document.querySelector("[data-done-status]");
    var label = b.textContent;
    b.addEventListener("click", function () {
      var text = answersText();
      toClipboard(text, function (ok) {
        if (ok) {
          b.textContent = "Copied";
          setTimeout(function () { b.textContent = label; }, 1800);
          if (status) status.textContent = "Copied. Paste it into an email or a note to keep it.";
          return;
        }
        var box = document.querySelector("[data-done-fallback]");
        if (box) {
          box.hidden = false;
          var ta = box.querySelector("textarea");
          ta.value = text;
          ta.focus(); ta.select();
        }
        if (status) status.textContent = "Select the text below and copy it.";
      });
    });
  }

  /* --------------------------------------------------------------- wiring */
  function wireChecks() {
    allChecks().forEach(function (c) {
      var id = c.getAttribute("data-check");
      if (state.checks[id]) c.checked = true;
      c.addEventListener("change", function () {
        state.checks[id] = c.checked;
        var row = c.closest(".check");
        if (row) row.classList.remove("is-missing");
        save(state);
        paintIndex();
        refreshNav();
      });
    });
  }

  function clearAll() {
    try { localStorage.removeItem(KEY); } catch (e) {}
    state = { checks: {}, fields: {}, scores: {} };
    allChecks().forEach(function (c) { c.checked = false; });
    Array.prototype.forEach.call(document.querySelectorAll("input[data-score]"), function (c) { c.checked = false; });
    allFields().forEach(function (el) {
      if (el.type === "radio") el.checked = false; else { el.value = ""; grow(el); }
    });
    paintTeam();
    paintScore();
    go(0);
    paintIndex();
    refreshNav();
  }

  function wireNav() {
    document.addEventListener("click", function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var n = t.closest("[data-next]");
      if (n) { e.preventDefault(); advance(); return; }
      var p = t.closest("[data-back]");
      if (p) { e.preventDefault(); go(current - 1); return; }
      var pr = t.closest("[data-print]");
      if (pr) { e.preventDefault(); allFields().forEach(grow); window.print(); return; }
      var r = t.closest("[data-restart]");
      if (r) {
        e.preventDefault();
        state.done = false;
        save(state);
        go(0);
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      var t = e.target;
      if (!t || !t.matches || t.matches("input, textarea, summary, button, a, [contenteditable]")) return;
      if (e.key === "ArrowRight" && current < steps.length - 1 && furthest() > current) go(current + 1);
      if (e.key === "ArrowLeft") go(current - 1);
    });

    Array.prototype.forEach.call(document.querySelectorAll(".btn-reset"), function (reset) {
      reset.addEventListener("click", function () {
        if (!confirm("Clear the ticks, answers and progress saved on this page in this browser?")) return;
        clearAll();
      });
    });
  }

  function paintGuides() {
    Array.prototype.forEach.call(document.querySelectorAll(".rail__guide[data-guide]"), function (li) {
      var s;
      try { s = JSON.parse(localStorage.getItem("emba26." + li.getAttribute("data-guide"))); } catch (e) {}
      var done = !!(s && s.done);
      var link = li.querySelector(".rail__g");
      var tick = link && link.querySelector(".rail__tick");
      li.classList.toggle("is-finished", done);
      if (done && link && !tick) {
        tick = document.createElement("span");
        tick.className = "rail__tick";
        tick.innerHTML = '<span class="vh"> (finished)</span>';
        link.appendChild(tick);
      } else if (!done && tick) {
        tick.parentNode.removeChild(tick);
      }
    });
  }

  function paintHubStatus() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-track-status]"), function (el) {
      var id = el.getAttribute("data-track-status"), s;
      try { s = JSON.parse(localStorage.getItem("emba26." + id)) || {}; } catch (e) { s = {}; }
      if (s && s.done) { el.textContent = "Finished"; el.classList.add("is-done"); }
      else if (s && s.checks && Object.keys(s.checks).some(function (k) { return s.checks[k]; })) {
        el.textContent = "In progress";
      }
    });
  }

  /* ------------------------------------------------------------------ boot */
  function boot() {
    paintNumerals();
    buildIndex();
    wireChecks();
    wireFields();
    wireScore();
    wireTeam();
    wireCopy();
    wireCopyAnswers();
    wireNav();
    paintHubStatus();
    runHub();

    if (steps.length) {
      var limit = furthest();
      var want;
      var m = /^#step-(\d+(?:\.\d+)?)$/.exec(location.hash);
      if (m) {
        var i = indexOfNum(m[1]);
        want = i >= 0 ? i : steps.length - 1;
      } else if (location.hash === "#done" || state.done) {
        want = steps.length;
      } else if (typeof state.step === "number") {
        want = state.step;
      } else {
        want = 0;
      }
      if (want >= steps.length && limit >= steps.length) {
        finish();
      } else {
        go(Math.min(want, limit), { silent: true });
        if (location.hash && want !== current) setHash("#step-" + stepLabel(current));
      }
      var note = document.querySelector("[data-storage-note]");
      if (note && !storageOk) note.hidden = false;
    }
    paintIndex();
    refreshNav();
  }

  function degrade() {
    var h = document.documentElement;
    h.className = h.className.replace(/(^|\s)js(\s|$)/, " ").trim();
  }

  document.addEventListener("DOMContentLoaded", function () {
    try { boot(); }
    catch (err) {
      degrade();
      if (window.console) console.error("guide: falling back to the full page", err);
    }
  });

  window.__GUIDE_OK = 1;   /* the page's inline guard checks this after loading us */
})();
