/* Class pack page.
   pack.bin is the class pack zip, encrypted: a 37-byte header (magic, version, PBKDF2 iterations, salt, iv)
   and AES-256-GCM ciphertext. The student types the class code, the browser derives the key (PBKDF2-SHA256)
   and decrypts with WebCrypto, and the zip is offered as a download from memory. Nothing is stored and
   nothing is sent anywhere: there is no request in this file except the GET for pack.bin. */
(function () {
  "use strict";

  var FILE = "pack.bin";
  var $ = function (id) { return document.getElementById(id); };
  var form = $("gate"), input = $("code"), btn = $("open"), msg = form.querySelector("[data-msg]");
  var packBox = $("pack"), link = $("download"), sizeEl = $("size");
  var cached = null;                       /* the ciphertext, fetched once per page load */
  var objectUrl = null;

  function normalize(code) { return String(code || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
  function say(text, quiet) { msg.className = "gate__msg" + (quiet ? " is-quiet" : ""); msg.textContent = text; }
  function mb(n) { return (n / 1048576).toFixed(1) + " MB"; }

  function fetchPack() {
    if (cached) return Promise.resolve(cached);
    return window.fetch(FILE, { cache: "force-cache" }).then(function (r) {
      if (!r.ok) throw new Error("nodata");
      return r.arrayBuffer();
    }, function () { throw new Error("nodata"); }).then(function (buf) {
      var u = new Uint8Array(buf);
      if (u.length < 64 || u[0] !== 0x45 || u[1] !== 0x4d || u[2] !== 0x42 || u[3] !== 0x50 || u[4] !== 1) throw new Error("nodata");
      cached = u;
      return u;
    });
  }

  function unlock(code) {
    if (!window.crypto || !window.crypto.subtle) return Promise.reject(new Error("nocrypto"));
    var subtle = window.crypto.subtle;
    return fetchPack().then(function (u) {
      var iter = new DataView(u.buffer, u.byteOffset).getUint32(5, false);
      var salt = u.subarray(9, 25), iv = u.subarray(25, 37), ct = u.subarray(37);
      say("Checking the code. This takes a second or two.", true);
      return subtle.importKey("raw", new TextEncoder().encode(normalize(code)), "PBKDF2", false, ["deriveKey"]).then(function (km) {
        return subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: salt, iterations: iter }, km, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
      }).then(function (key) {
        return subtle.decrypt({ name: "AES-GCM", iv: iv }, key, ct);
      }).then(function (plain) {
        var z = new Uint8Array(plain);
        if (z.length < 4 || z[0] !== 0x50 || z[1] !== 0x4b) throw new Error("wrongcode");
        return z;
      }, function (e) { throw (e && e.message === "nodata") ? e : new Error("wrongcode"); });
    });
  }

  function explain(err) {
    if (err && err.message === "nodata") return "The pack did not load. Check your connection and try again.";
    if (err && err.message === "nocrypto") return "This browser cannot open the pack. Use a current version of Chrome, Safari, Edge, or Firefox.";
    return "That code did not work. Check the spelling and try again.";
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var code = input.value;
    if (!normalize(code)) { say("Type the code first."); input.focus(); return; }
    btn.disabled = true;
    say("Downloading the pack (about " + (cached ? mb(cached.length) : "12 MB") + "). This can take a minute on the classroom Wi-Fi.", true);
    unlock(code).then(function (zip) {
      if (objectUrl) { try { URL.revokeObjectURL(objectUrl); } catch (e) {} }
      objectUrl = URL.createObjectURL(new Blob([zip], { type: "application/zip" }));
      link.href = objectUrl;
      link.setAttribute("data-bytes", String(zip.length));
      sizeEl.textContent = "Zip, " + mb(zip.length) + ". Saved to your Downloads folder.";
      packBox.hidden = false;
      form.hidden = true;
      say("");
      link.focus();
    }, function (err) {
      btn.disabled = false;
      say(explain(err));
      input.focus();
      input.select();
    });
  });

  window.__PACK_OK = true;
})();
