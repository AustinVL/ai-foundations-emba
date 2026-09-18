/* AI Foundations · Executive MBA · session site.
   Three small jobs: "Copy" buttons on the code blocks, worksheets and checklists
   kept in this browser, and (parked, unlinked) the Relay button from
   assets/config.js. Nothing here sends anything anywhere: there is no fetch,
   no XHR, no beacon in this file.

   Each page's head puts `js` on <html>. This file takes it away again if
   anything here throws, and the last line of each page takes it away if this
   file never set window.__EMBA_OK (blocked, 404, cut off). Either way the page
   falls back to its plain, fully readable state. */
(function () {
  "use strict";

  var root = document.documentElement;

  function flash(btn, msg) {
    var was = btn.getAttribute("data-was") || btn.textContent;
    btn.setAttribute("data-was", was);
    btn.textContent = msg;
    window.setTimeout(function () { btn.textContent = was; }, 2200);
  }

  /* Put text on the clipboard: the async API first, the old command as the
     fallback. Calls done(ok). */
  function toClipboard(text, done) {
    function legacy() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed"; ta.style.top = "0"; ta.style.left = "0"; ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      done(ok);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, legacy);
    } else { legacy(); }
  }

  /* ------------------------------------------------------ copy a code block */
  function copyBlocks() {
    var btns = document.querySelectorAll("[data-copy-block]");
    Array.prototype.forEach.call(btns, function (btn) {
      var pre = document.getElementById(btn.getAttribute("data-copy-block"));
      if (!pre) return;
      btn.addEventListener("click", function () {
        var text = pre.textContent.replace(/\s+$/, "") + "\n";
        toClipboard(text, function (ok) {
          if (ok) { flash(btn, "Copied"); return; }
          flash(btn, "Select and copy");
          var range = document.createRange();
          range.selectNodeContents(pre);
          var sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        });
      });
    });
  }

  /* ------------------------------------------------------------ Relay link */
  function relay() {
    var a = document.querySelector("[data-relay-link]");
    if (!a) return;
    var url = (window.EMBA && typeof window.EMBA.relayUrl === "string") ? window.EMBA.relayUrl.trim() : "";
    if (!/^https:\/\//i.test(url)) return;          /* empty or unusable: leave the page as built */
    a.setAttribute("href", url);
    a.removeAttribute("aria-disabled");
    a.classList.remove("is-off");
    var note = document.querySelector("[data-relay-note]");
    if (note) note.hidden = true;
  }

  /* ------------------------------------------------------------- worksheet */
  /* Every form with data-worksheet="storage-key" is kept in localStorage under
     that key. Fields carry data-f="name"; radios share a name; a checkbox is
     stored as its value when ticked and "" when not. */
  function worksheet(form) {
    var KEY = form.getAttribute("data-worksheet") || "emba-2026-worksheet";
    var fields = Array.prototype.slice.call(form.querySelectorAll("[data-f]"));
    var status = form.parentNode.querySelector("[data-ws-status]") || document.querySelector("[data-ws-status]");
    if (status && status.closest("form") && status.closest("form") !== form) status = null;
    var storageOk = true;
    var timer = null;
    var quiet = form.hasAttribute("data-quiet");           /* a checklist: no status chatter */

    function say(msg) { if (status && !quiet) status.textContent = msg; }

    function clock() {
      var d = new Date(), h = d.getHours(), m = d.getMinutes();
      var ap = h >= 12 ? "p.m." : "a.m.";
      h = h % 12; if (h === 0) h = 12;
      return h + ":" + (m < 10 ? "0" : "") + m + " " + ap;
    }

    function valueOf(el) {
      if (el.type === "radio") {
        var on = form.querySelector('input[name="' + el.name + '"]:checked');
        return on ? on.value : "";
      }
      if (el.type === "checkbox") return el.checked ? (el.value || "on") : "";
      return el.value;
    }

    /* one entry per field name (radios share a name) */
    function names() {
      var seen = {}, out = [];
      fields.forEach(function (el) {
        var n = el.getAttribute("data-f");
        if (!seen[n]) { seen[n] = true; out.push(n); }
      });
      return out;
    }
    function first(name) { return form.querySelector('[data-f="' + name + '"]'); }

    function read() {
      var data = {};
      names().forEach(function (n) { data[n] = valueOf(first(n)); });
      return data;
    }

    function grow(el) {
      if (el.tagName !== "TEXTAREA") return;
      el.style.height = "auto";
      el.style.height = Math.max(96, el.scrollHeight + 2) + "px";
    }

    /* the print mirror: text that grows to fit, or ruled space when empty.
       Checkboxes print as they are, so they get no mirror. */
    function mirror(name) {
      var el = first(name);
      if (el.type === "checkbox") return;
      var m = form.querySelector('[data-mirror="' + name + '"]');
      if (!m) {
        m = document.createElement("div");
        m.className = "mirror" + (el.tagName === "TEXTAREA" ? "" : " mirror--line");
        m.setAttribute("data-mirror", name);
        m.setAttribute("aria-hidden", "true");
        var host = el.type === "radio" ? el.closest(".choices") : el;
        host.parentNode.insertBefore(m, host.nextSibling);
      }
      var v = valueOf(el);
      if (el.tagName === "SELECT" && v) v = el.options[el.selectedIndex].text;
      m.textContent = v;
      m.classList.toggle("is-empty", !v);
      if (!v) {                                  /* ruled lines to write on, in print only */
        var lines = el.tagName === "TEXTAREA" ? 3 : 1;
        for (var i = 0; i < lines; i++) {
          var r = document.createElement("span");
          r.className = "rule";
          m.appendChild(r);
        }
      }
    }

    function save() {
      timer = null;
      try {
        window.localStorage.setItem(KEY, JSON.stringify(read()));
        storageOk = true;
        say("Saved in this browser, " + clock());
      } catch (e) {
        storageOk = false;
        say("This browser is not saving what you type. Copy or print before you close the tab.");
      }
    }

    function load() {
      var raw = null;
      try { raw = window.localStorage.getItem(KEY); }
      catch (e) { storageOk = false; }
      if (!raw) return false;
      var data;
      try { data = JSON.parse(raw); } catch (e) { return false; }
      if (!data || typeof data !== "object") return false;
      names().forEach(function (n) {
        if (typeof data[n] !== "string") return;
        var el = first(n);
        if (el.type === "radio") {
          Array.prototype.forEach.call(form.querySelectorAll('input[name="' + el.name + '"]'), function (r) {
            r.checked = (r.value === data[n]);
          });
        } else if (el.type === "checkbox") {
          el.checked = data[n] !== "";
        } else {
          el.value = data[n];
        }
      });
      return true;
    }

    function refresh() {
      fields.forEach(grow);
      names().forEach(mirror);
    }

    form.addEventListener("input", function (ev) {
      var el = ev.target;
      if (!el || !el.getAttribute || !el.getAttribute("data-f")) return;
      grow(el);
      mirror(el.getAttribute("data-f"));
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(save, 250);
    });
    form.addEventListener("change", function (ev) {
      var el = ev.target;
      if (!el || !el.getAttribute || !el.getAttribute("data-f")) return;
      mirror(el.getAttribute("data-f"));
      if (timer) window.clearTimeout(timer);
      save();
    });
    form.addEventListener("submit", function (ev) { ev.preventDefault(); });
    function flush() { if (timer) { window.clearTimeout(timer); save(); } }
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", function () { if (document.hidden) flush(); });
    window.addEventListener("beforeprint", refresh);
    window.addEventListener("resize", function () { fields.forEach(grow); });

    /* ------------------------------------------------------ copy as text */
    function label(name) {
      var el = first(name);
      return el.getAttribute("data-label") || name;
    }

    function asText() {
      var out = [];
      var rule = "------------------------------------------------------------";
      out.push("AI Foundations · Executive MBA · MIT Sloan");
      out.push((form.getAttribute("data-ws-title") || "Worksheet") + " · September 19, 2026");
      out.push("");
      var blocks = form.querySelectorAll("[data-block]");
      Array.prototype.forEach.call(blocks, function (b) {
        var kind = b.getAttribute("data-block");
        var t = b.getAttribute("data-title");
        if (kind === "section") {
          out.push(rule); out.push(t.toUpperCase()); out.push(rule); out.push("");
        } else if (kind === "group") {
          out.push(t); out.push("");
        }
        var mine = b.querySelectorAll("[data-f]");
        var seen = {};
        Array.prototype.forEach.call(mine, function (el) {
          if (el.closest("[data-block]") !== b) return;      /* belongs to a nested group */
          var n = el.getAttribute("data-f");
          if (seen[n]) return; seen[n] = true;
          var v = valueOf(el);
          if (el.tagName === "SELECT" && v) v = el.options[el.selectedIndex].text;
          if (el.type === "checkbox") { out.push("[" + (v ? "x" : " ") + "] " + label(n)); out.push(""); return; }
          v = (v || "").replace(/\s+$/, "");
          out.push(label(n) + ":");
          out.push(v ? v : "(blank)");
          out.push("");
        });
      });
      return out.join("\n").replace(/\n{3,}/g, "\n\n").replace(/\s+$/, "") + "\n";
    }
    window.__worksheetText = asText;       /* read by the render tests; harmless */

    function showFallback(text) {
      var box = document.querySelector("[data-copy-fallback]");
      if (!box) return;
      box.hidden = false;
      var ta = box.querySelector("textarea");
      ta.value = text;
      ta.style.height = "240px";
      ta.focus();
      ta.select();
    }

    var copyBtn = document.querySelector("[data-copy]");
    if (copyBtn && !quiet) copyBtn.addEventListener("click", function () {
      var text = asText();
      toClipboard(text, function (ok) {
        if (ok) { flash(copyBtn, "Copied"); say("Copied. Paste it into an email or a note to keep it."); }
        else { showFallback(text); say("Select the text below and copy it."); }
      });
    });

    var printBtn = document.querySelector("[data-print]");
    if (printBtn && !quiet) printBtn.addEventListener("click", function () { refresh(); window.print(); });

    var clearBtn = form.querySelector("[data-clear]") || (quiet ? null : document.querySelector("[data-clear]"));
    if (clearBtn) clearBtn.addEventListener("click", function () {
      if (!quiet && !window.confirm("Clear everything you typed on this worksheet? This cannot be undone.")) return;
      try { window.localStorage.removeItem(KEY); } catch (e) { /* nothing to remove */ }
      form.reset();
      refresh();
      say("Cleared.");
    });

    var had = load();
    refresh();
    if (!storageOk) say("This browser is not saving what you type. Copy or print before you close the tab.");
    else if (had) say("Your earlier answers were restored from this browser.");
    else say("Saved in this browser as you type.");
  }

  try {
    copyBlocks();
    relay();
    Array.prototype.forEach.call(document.querySelectorAll("form[data-worksheet]"), worksheet);
    window.__EMBA_OK = true;
  } catch (e) {
    root.className = root.className.replace(/(^|\s)js(\s|$)/g, " ");
    if (window.console && console.error) console.error(e);
  }
})();
