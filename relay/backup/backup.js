/* Exercise One backup page.
   The case content arrives encrypted (data1.json, data2.json: salt, iv, ciphertext). The student types a code,
   the browser derives the key (PBKDF2-SHA256) and decrypts (AES-GCM) with WebCrypto. Decrypted content is held
   in memory only. What is stored in this browser: the role number, when the briefing clock started, that it
   ended, the three notes, the two self-audit answers (localStorage), and the typed codes for this tab only
   (sessionStorage, so a reload does not ask again). Nothing is sent anywhere. */
(function () {
  "use strict";

  var root = document.documentElement;
  var KEY = "emba-2026-relay-backup-v1";
  var CODES = "emba-2026-relay-backup-codes";
  var LIMIT = 180000;                     /* the 3:00 clock, in milliseconds */
  var NOTE_MAX = 120;

  var $ = function (id) { return document.getElementById(id); };
  var data1 = null, data2 = null, ticker = null;

  /* ----------------------------------------------------------------- state */
  var state = { role: 0, startedAt: 0, done: false, notes: ["", "", ""], answers: ["", ""], step: 1 };
  function loadState() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) return;
      var s = JSON.parse(raw);
      if (s && typeof s === "object") {
        state.role = [1, 2, 3, 4].indexOf(s.role) >= 0 ? s.role : 0;
        state.startedAt = typeof s.startedAt === "number" ? s.startedAt : 0;
        state.done = !!s.done;
        if (Array.isArray(s.notes)) state.notes = [0, 1, 2].map(function (i) { return String(s.notes[i] || "").slice(0, NOTE_MAX); });
        if (Array.isArray(s.answers)) state.answers = [0, 1].map(function (i) { return String(s.answers[i] || ""); });
        state.step = [1, 2, 3, 4, 5].indexOf(s.step) >= 0 ? s.step : 1;
      }
    } catch (e) { /* private mode or bad data: start fresh */ }
  }
  function saveState() { try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* keeps working in memory */ } }
  function codes() { try { return JSON.parse(window.sessionStorage.getItem(CODES) || "{}") || {}; } catch (e) { return {}; } }
  function keepCode(which, code) { try { var c = codes(); c[which] = code; window.sessionStorage.setItem(CODES, JSON.stringify(c)); } catch (e) { /* asks again after a reload */ } }

  /* ---------------------------------------------------------------- crypto */
  function normalize(code) { return String(code || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
  function bytes(b64) { var bin = window.atob(b64), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }

  function unlock(file, code) {
    if (!window.crypto || !window.crypto.subtle) return Promise.reject(new Error("nocrypto"));
    return window.fetch(file, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error("nodata");
      return r.json();
    }, function () { throw new Error("nodata"); }).then(function (d) {
      var subtle = window.crypto.subtle;
      return subtle.importKey("raw", new TextEncoder().encode(normalize(code)), "PBKDF2", false, ["deriveKey"]).then(function (km) {
        return subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: bytes(d.salt), iterations: d.iter }, km, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
      }).then(function (key) {
        return subtle.decrypt({ name: "AES-GCM", iv: bytes(d.iv) }, key, bytes(d.ct));
      }).then(function (plain) {
        return JSON.parse(new TextDecoder().decode(plain));
      }, function (e) { throw (e && e.message === "nodata") ? e : new Error("wrongcode"); });
    });
  }

  function explain(err) {
    if (err && err.message === "nodata") return "The backup data did not load. Check your connection and reload the page.";
    if (err && err.message === "nocrypto") return "This browser cannot open the backup. Use a current version of Chrome, Safari, Edge, or Firefox.";
    return "That code did not work. Check the spelling and try again.";
  }

  function wireGate(form, file, which, onOpen) {
    var input = form.querySelector("input"), msg = form.querySelector("[data-msg]"), btn = form.querySelector("button");
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var code = input.value;
      if (!normalize(code)) { msg.className = "gate__msg"; msg.textContent = "Type the code first."; return; }
      btn.disabled = true;
      msg.className = "gate__msg is-quiet";
      msg.textContent = "Checking the code. This takes a second or two.";
      unlock(file, code).then(function (data) {
        keepCode(which, normalize(code));
        msg.textContent = "";
        btn.disabled = false;
        onOpen(data);
      }, function (err) {
        btn.disabled = false;
        msg.className = "gate__msg";
        msg.textContent = explain(err);
        input.focus();
        input.select();
      });
    });
  }

  /* --------------------------------------------------------------- helpers */
  function el(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
  function text(tag, cls, str) { var n = document.createElement(tag); if (cls) n.className = cls; n.textContent = str; return n; }
  function button(label, cls, fn) { var b = text("button", cls, label); b.type = "button"; b.addEventListener("click", fn); return b; }
  function role() { return data1 && state.role ? data1.roles[state.role - 1] : null; }
  function remaining() { return state.startedAt ? LIMIT - (Date.now() - state.startedAt) : LIMIT; }
  function mmss(ms) { var s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ":" + (s % 60 < 10 ? "0" : "") + (s % 60); }

  function keptNotes() {
    var ol = el("ol", "kept");
    state.notes.forEach(function (n) {
      var li = text("li", n ? "" : "is-empty", n || "(no note)");
      ol.appendChild(li);
    });
    return ol;
  }

  function stepNav(host, back, next) {
    var nav = el("div", "stepnav");
    if (next) nav.appendChild(button(next[0], "btn", function () { go(next[1]); }));
    if (back) nav.appendChild(button(back[0], "btn btn--ghost", function () { go(back[1]); }));
    host.appendChild(nav);
  }

  /* ---------------------------------------------------------------- step 1 */
  function renderRole() {
    var host = $("step1"); host.innerHTML = "";
    var j = data1.stage.join, locked = !!state.startedAt;
    host.appendChild(text("h2", "", "Pick your role"));
    host.appendChild(el("div", "", j.introHtml));
    var grid = el("div", "roles");
    data1.roles.forEach(function (r) {
      var b = el("button", "role" + (state.role === r.n ? " is-mine" : ""));
      b.type = "button";
      b.appendChild(text("b", "", String(r.n)));
      b.appendChild(text("span", "", r.title));
      b.setAttribute("aria-pressed", state.role === r.n ? "true" : "false");
      b.disabled = locked;
      b.addEventListener("click", function () { state.role = r.n; saveState(); renderRole(); });
      grid.appendChild(b);
    });
    host.appendChild(grid);
    if (locked) host.appendChild(text("p", "", "Your role is set for this exercise."));
    host.appendChild(el("div", "framing", data1.framingHtml));
    host.appendChild(el("div", "", j.afterHtml));
    var nav = el("div", "stepnav");
    var next = button("Go to my briefing", "btn", function () { if (state.role) go(2); });
    if (!state.role) { next.className = "btn is-off"; next.setAttribute("aria-disabled", "true"); }
    nav.appendChild(next);
    if (!state.role) nav.appendChild(text("p", "launch__note", "Tap your number first."));
    host.appendChild(nav);
  }

  /* ---------------------------------------------------------------- step 2 */
  function endBriefing() {
    if (ticker) { window.clearInterval(ticker); ticker = null; }
    state.done = true; saveState();
    var b = document.querySelector("[data-briefing]");
    if (b && b.parentNode) b.parentNode.removeChild(b);             /* out of the DOM */
    if (data1) data1.roles.forEach(function (r) { r.bodyHtml = null; });  /* and out of memory */
    if (state.step === 2) { renderBriefing(); focusHeading(); }
    if (state.step === 3) renderReport();
  }

  function noteFields(host) {
    var wrap = el("div", "notes");
    wrap.appendChild(text("h2", "sec", "Your three notes"));
    [0, 1, 2].forEach(function (i) {
      var f = el("div", "field");
      var lab = el("label", ""); lab.setAttribute("for", "note" + i);
      lab.appendChild(document.createTextNode("Note " + (i + 1)));
      var count = text("span", "count", state.notes[i].length + " / " + NOTE_MAX);
      lab.appendChild(count);
      var inp = el("input", ""); inp.type = "text"; inp.id = "note" + i; inp.maxLength = NOTE_MAX; inp.value = state.notes[i];
      inp.setAttribute("autocomplete", "off");
      inp.addEventListener("input", function () {
        state.notes[i] = inp.value.slice(0, NOTE_MAX);
        count.textContent = state.notes[i].length + " / " + NOTE_MAX;
        saveState();
      });
      f.appendChild(lab); f.appendChild(inp); wrap.appendChild(f);
    });
    host.appendChild(wrap);
  }

  function renderBriefing() {
    var host = $("step2"); host.innerHTML = "";
    var r = role(), c = data1.stage.card;
    if (!r) { host.appendChild(text("p", "", "Pick your role first.")); stepNav(host, ["Back to roles", 1], null); return; }
    if (state.startedAt && !state.done && remaining() <= 0) { state.done = true; saveState(); data1.roles.forEach(function (x) { x.bodyHtml = null; }); }

    host.appendChild(text("h2", "", state.done ? "Your briefing has ended" : c.title));
    var you = el("p", "you"); you.appendChild(text("small", "", "You are")); you.appendChild(document.createTextNode(r.n + " · " + r.title));
    host.appendChild(you);

    if (state.done) {
      host.appendChild(text("p", "", "These are the notes you carry into the meeting."));
      host.appendChild(keptNotes());
      stepNav(host, ["Back to roles", 1], ["Go to the team report", 3]);
      return;
    }

    if (!state.startedAt) {
      host.appendChild(el("div", "", r.yourPartHtml));
      host.appendChild(el("div", "", c.html));
      var start = el("div", "launch");
      start.appendChild(button("Start the 3:00 clock", "btn btn--big", function () {
        state.startedAt = Date.now(); saveState(); renderBriefing();
      }));
      host.appendChild(start);
      host.appendChild(text("p", "launch__note", "Start when your instructor says go."));
      stepNav(host, ["Back to roles", 1], null);
      return;
    }

    /* the clock is running */
    var clock = el("div", "clock");
    clock.appendChild(text("span", "label", "Time left"));
    var t = text("span", "clock__t", mmss(remaining())); t.setAttribute("aria-label", "Time left");
    clock.appendChild(t);
    host.appendChild(clock);
    var body = el("div", "briefing", r.bodyHtml); body.setAttribute("data-briefing", "");
    host.appendChild(body);
    noteFields(host);
    var away = el("div", "stepnav");
    away.appendChild(button("Put the briefing away", "btn btn--ghost", function () {
      if (window.confirm("Put the briefing away now? It cannot be reopened.")) endBriefing();
    }));
    host.appendChild(away);

    if (ticker) window.clearInterval(ticker);
    ticker = window.setInterval(function () {
      var left = remaining();
      t.textContent = mmss(left);
      if (left <= 30000) clock.className = "clock is-late";
      if (left <= 0) endBriefing();
    }, 250);
  }

  /* ---------------------------------------------------------------- step 3 */
  function renderReport() {
    var host = $("step3"); host.innerHTML = "";
    var n = data1.stage.notes, b = data1.stage.brief;
    host.appendChild(text("h2", "", n.title));
    host.appendChild(el("div", "", n.html));
    host.appendChild(text("h2", "sec", "Your notes"));
    if (state.done || !state.startedAt) host.appendChild(keptNotes());
    else host.appendChild(text("p", "", "Your briefing clock is still running. Go back to step 2."));
    var d = el("details", "framing");
    d.appendChild(text("summary", "", data1.framingLabel + " (the shared framing)"));
    d.appendChild(el("div", "", data1.framingHtml));
    host.appendChild(d);
    var h = text("h2", "", b.title); h.style.marginTop = "48px";
    host.appendChild(h);
    host.appendChild(el("div", "", b.html));
    host.appendChild(text("p", "note note--red", "Keep your team's output open in Claude; your instructor will tell you what to do with it."));
    stepNav(host, ["Back to my briefing", 2], ["The complete case", 4]);
  }

  /* ---------------------------------------------------------- steps 4 and 5 */
  function gate2(host, then) {
    host.appendChild(text("h2", "", "The complete case"));
    var form = el("form", "gate");
    form.setAttribute("autocomplete", "off");
    form.innerHTML = '<p class="lede">This part opens with a second code. Your instructor will give it when it is time.</p>' +
      '<div class="field"><label for="code2">Second code</label>' +
      '<input type="text" id="code2" name="code2" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="off"></div>' +
      '<div class="launch"><button type="submit" class="btn btn--big">Open</button></div><p class="gate__msg" data-msg role="alert"></p>';
    host.appendChild(form);
    wireGate(form, "data2.json", "c2", function (d) { data2 = d; then(); });
    stepNav(host, ["Back to the team report", 3], null);
  }

  function answerField(host, i, labelText, hint) {
    var f = el("div", "field");
    var lab = text("label", "", labelText); lab.setAttribute("for", "answer" + i);
    var ta = el("textarea", ""); ta.id = "answer" + i; ta.rows = 3; ta.value = state.answers[i];
    ta.addEventListener("input", function () { state.answers[i] = ta.value; saveState(); });
    f.appendChild(lab); f.appendChild(text("span", "hint", hint)); f.appendChild(ta);
    host.appendChild(f);
  }

  function renderCase() {
    var host = $("step4"); host.innerHTML = "";
    if (!data2) { gate2(host, function () { render(); }); return; }
    var c = data2.stage["case"];
    host.appendChild(text("h2", "", c.title));
    host.appendChild(el("div", "", c.html));
    host.appendChild(el("div", "case", data2.caseHtml));
    host.appendChild(text("h2", "sec", "Your team's answers"));
    answerField(host, 0, "The single highest-consequence omission or distortion in your pitch", "One sentence is enough.");
    answerField(host, 1, "One change you would make to your prompt", "Say what you would add, cut, or reword.");
    stepNav(host, ["Back to the team report", 3], ["Judge the pair", 5]);
  }

  function renderJudge() {
    var host = $("step5"); host.innerHTML = "";
    if (!data2) { state.step = 4; saveState(); render(); return; }
    host.appendChild(text("h2", "", "Judge the pair"));
    host.appendChild(text("p", "", "Two pitches for the same board meeting. Each has its decision and ask under it. The complete case is one step back. Answer one question:"));
    host.appendChild(text("p", "question", data2.question));
    host.appendChild(text("p", "", "Pick one. No ties. Vote by show of hands when asked."));
    var pair = el("div", "pair");
    data2.pair.forEach(function (p) {
      var card = el("article", "pitch");
      card.appendChild(text("h3", "pitch__k", "Pitch " + p.label));
      card.appendChild(el("div", "", p.pitchHtml));
      var ask = el("div", "pitch__ask", '<span class="label">Decision and ask</span>' + p.askHtml);
      card.appendChild(ask);
      pair.appendChild(card);
    });
    host.appendChild(pair);
    stepNav(host, ["Back to the complete case", 4], null);
  }

  /* ---------------------------------------------------------------- render */
  function focusHeading() {
    var h = $("step" + state.step).querySelector("h2");
    if (!h) return;
    h.setAttribute("tabindex", "-1");
    try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); }
  }

  function go(n) {
    if (n === 2 && !state.role) n = 1;
    if (n === 5 && !data2) n = 4;
    state.step = n; saveState(); render();
    window.scrollTo(0, 0);
    focusHeading();
  }

  function render() {
    $("gate1").hidden = true;
    $("steps").hidden = false;
    $("page").className = "page" + (state.step === 5 && data2 ? " page--wide" : "");
    [1, 2, 3, 4, 5].forEach(function (n) { $("step" + n).hidden = (n !== state.step); });
    Array.prototype.forEach.call($("steps").querySelectorAll("button"), function (b) {
      var n = Number(b.getAttribute("data-go"));
      b.className = (n === state.step ? "is-now" : "") + ((n >= 4 && !data2) ? " is-locked" : "");
      if (n === state.step) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
    });
    if (state.step === 1) renderRole();
    if (state.step === 2) renderBriefing();
    if (state.step === 3) renderReport();
    if (state.step === 4) renderCase();
    if (state.step === 5) renderJudge();
  }

  function opened(d) {
    data1 = d;
    /* a clock that ran out while the page was closed still counts */
    if (state.startedAt && !state.done && remaining() <= 0) { state.done = true; saveState(); }
    if (state.done) data1.roles.forEach(function (r) { r.bodyHtml = null; });
    var c2 = codes().c2;
    if (c2 && state.step >= 4) {
      unlock("data2.json", c2).then(function (d2) { data2 = d2; render(); }, function () { render(); });
    } else {
      render();
    }
    /* if the student is on another step when the clock runs out, the briefing still ends */
    if (state.startedAt && !state.done && !ticker) {
      ticker = window.setInterval(function () { if (remaining() <= 0) endBriefing(); }, 500);
    }
  }

  function start() {
    if (/[?&]reset=1\b/.test(window.location.search)) {
      try { window.localStorage.removeItem(KEY); window.sessionStorage.removeItem(CODES); } catch (e) { /* nothing stored */ }
      if (window.history && window.history.replaceState) window.history.replaceState(null, "", window.location.pathname);
    }
    loadState();
    Array.prototype.forEach.call($("steps").querySelectorAll("button"), function (b) {
      b.addEventListener("click", function () { go(Number(b.getAttribute("data-go"))); });
    });
    wireGate($("gate1"), "data1.json", "c1", opened);
    var c1 = codes().c1;
    if (c1) {
      unlock("data1.json", c1).then(opened, function () { $("gate1").hidden = false; });
    } else {
      $("gate1").hidden = false;
    }
  }

  try {
    start();
    window.__EMBA_BACKUP_OK = true;
  } catch (e) {
    root.className = root.className.replace(/(^|\s)js(\s|$)/g, " ");
    if (window.console && console.error) console.error(e);
  }
})();
