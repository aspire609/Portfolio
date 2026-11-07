(function () {
"use strict";
var $ = function (s, r) { return (r || document).querySelector(s); };
var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

var S = { profile: {}, projects: [], photos: [], posts: [], admin: false };

/* ---------- API ---------- */
function api(method, url, body, headers) {
  var h = Object.assign({ "X-Requested-With": "portfolio" }, headers || {});
  var opt = { method: method, headers: h, credentials: "same-origin" };
  if (body !== undefined && !(body instanceof Blob)) { h["Content-Type"] = "application/json"; opt.body = JSON.stringify(body); }
  else if (body instanceof Blob) opt.body = body;
  return fetch(url, opt).then(function (r) {
    return r.json().catch(function () { return {}; }).then(function (j) {
      if (!r.ok) throw new Error(j.error || "Request failed (" + r.status + ").");
      return j;
    });
  });
}
function load() {
  return api("GET", "/api/site").then(function (d) {
    S.profile = d.profile || {};
    S.projects = (d.projects || []).slice().sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
    S.photos = (d.photos || []).slice().sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
    S.posts = (d.posts || []).slice().sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
  });
}
function refresh() { return load().then(render); }

/* ---------- helpers ---------- */
function initials(n) { return (n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join("").toUpperCase(); }
function fmtDate(ts) { try { return new Date(ts).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }); } catch (e) { return ""; } }
function splitList(s) { return String(s || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean); }
function parseLinks(s) {
  return String(s || "").split("\n").map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
    var i = l.indexOf("|"), label = i > -1 ? l.slice(0, i).trim() : "", url = (i > -1 ? l.slice(i + 1) : l).trim();
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    return { label: label || url.replace(/^https?:\/\//i, "").replace(/\/.*$/, ""), url: url };
  });
}
function linksToText(ls) { return (ls || []).map(function (l) { return l.label + " | " + l.url; }).join("\n"); }
function safeUrl(u) { return /^https?:\/\//i.test(u) ? u : "#"; }
function copyText(text, btn) {
  var ok = function () { var o = btn.textContent; btn.textContent = "Copied"; setTimeout(function () { btn.textContent = o; }, 1400); };
  try { navigator.clipboard.writeText(text).then(ok, function () { btn.textContent = "Select and copy"; }); } catch (e) { btn.textContent = "Select and copy"; }
}

/* ---------- render ---------- */
function coverHtml(p) {
  var ph = '<span class="ph">' + esc(initials(p.title)) + "</span>";
  return p.cover ? '<img src="' + esc(p.cover) + '" alt="' + esc(p.title) + ' cover" loading="lazy">' : ph;
}
function renderProjects() {
  if (!S.projects.length) return '<div class="empty"><strong>No projects yet</strong>' + (S.admin ? "Use + Add project to publish your Automatic Voting Machine." : "Projects will appear here soon.") + "</div>";
  return '<div class="grid">' + S.projects.map(function (p) {
    return '<div class="card-wrap"><button class="card tilt" data-act="open-project" data-id="' + esc(p.id) + '">' +
      '<div class="cover">' + coverHtml(p) + '</div><div class="body"><div class="card-meta"><span class="chip">Case study</span><span class="mono">' + esc(p.year || "") + "</span></div>" +
      "<h3>" + esc(p.title) + "</h3><p>" + esc(p.summary) + '</p><div class="tags">' + (p.tags || []).slice(0, 5).map(function (t) { return "<span>" + esc(t) + "</span>"; }).join("") + "</div></div></button>" +
      '<div class="edit-row"><button class="btn sm ghost" data-act="edit-project" data-id="' + esc(p.id) + '">Edit</button></div></div>';
  }).join("") + "</div>";
}
function renderGallery() {
  var p = S.profile;
  var av = p.photo ? '<img src="' + esc(p.photo) + '" alt="">' : esc(initials(p.name));
  var handle = (p.name || "").toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_.]/g, "");
  var head = '<div class="ig-head"><div class="ig-av"><div>' + av + "</div></div><div><b>" + esc(handle) + "</b><span>" + S.photos.length + " post" + (S.photos.length === 1 ? "" : "s") + " &middot; " + esc(p.role || "") + "</span></div></div>";
  if (!S.photos.length) return '<div class="ig">' + head + '<div class="empty"><strong>No photos yet</strong>' + (S.admin ? "Use + Add photos to fill the grid." : "Photos will appear here soon.") + "</div></div>";
  return '<div class="ig">' + head + '<div class="photos">' + S.photos.map(function (ph, i) {
    return '<button class="photo tilt" data-act="open-photo" data-i="' + i + '" aria-label="' + esc(ph.caption || "Photo " + (i + 1)) + '"><img src="' + esc(ph.asset) + '" alt="' + esc(ph.caption || "") + '" loading="lazy">' + (ph.caption ? '<span class="cap">' + esc(ph.caption) + "</span>" : "") + "</button>";
  }).join("") + "</div></div>";
}
function renderPosts() {
  if (!S.posts.length) return '<div class="empty"><strong>No posts yet</strong>' + (S.admin ? "Use + New post to write your first one." : "Posts will appear here soon.") + "</div>";
  return '<div class="posts">' + S.posts.map(function (b) {
    return '<button class="post" data-act="open-post" data-id="' + esc(b.id) + '"><time>' + esc(fmtDate(b.ts)) + "</time><div><h3>" + esc(b.title) + "</h3><p>" + esc(b.body) + "</p></div></button>";
  }).join("") + "</div>";
}
function renderContact() {
  var p = S.profile, rows = [];
  if (p.email) rows.push(["Email", p.email, "mailto:" + p.email]);
  if (p.phone) rows.push(["Phone", p.phone, ""]);
  if (p.location) rows.push(["Location", p.location, ""]);
  (p.links || []).forEach(function (l) { rows.push([l.label, l.url.replace(/^https?:\/\//, ""), l.url]); });
  if (!rows.length) return '<div class="empty"><strong>No contact details yet</strong>' + (S.admin ? "Open Edit profile to add your email, phone and links." : "") + "</div>";
  return '<div class="contact-list">' + rows.map(function (r) {
    var open = r[2] ? '<a class="btn sm ghost" href="' + esc(safeUrl(r[2]).replace(/^#$/, r[2])) + '" target="_blank" rel="noopener">Open</a>' : "";
    return '<div class="crow"><span class="label">' + esc(r[0]) + '</span><span class="v">' + esc(r[1]) + '</span><span style="display:flex;gap:6px"><button class="btn sm ghost" data-act="copy" data-v="' + esc(r[1]) + '">Copy</button>' + open + "</span></div>";
  }).join("") + "</div>";
}
function cube(skills) {
  var s = (skills && skills.length ? skills : ["Code"]);
  var out = ""; for (var i = 0; i < 6; i++) out += "<div>" + esc(s[i % s.length]) + "</div>";
  return '<div class="cube-wrap" aria-hidden="true"><div class="cube">' + out + "</div></div>";
}
function seo() {
  var p = S.profile; if (!p.name) return;
  document.title = p.name.replace(/ G\. /, " ") + " | " + (p.role || "Portfolio");
  var d = p.tagline ? p.name + ". " + p.role + " in " + p.location + ". " + p.tagline : "";
  var md = $('meta[name="description"]'); if (md && d) md.content = d.slice(0, 300);
  var og = $('meta[property="og:description"]'); if (og && p.tagline) og.content = p.tagline;
  var ld = $("#ld");
  if (ld) ld.textContent = JSON.stringify({ "@context": "https://schema.org", "@type": "Person", name: p.name, jobTitle: p.role, alumniOf: p.education, email: p.email || undefined, sameAs: (p.links || []).map(function (l) { return l.url; }), address: { "@type": "PostalAddress", addressLocality: p.location } });
}
function render() {
  var p = S.profile, A = $("#app");
  document.body.classList.toggle("admin", S.admin);
  var specs = [["Role", p.role], ["Studying", p.education], ["Based in", p.location]].filter(function (r) { return r[1]; });
  A.innerHTML =
    '<header class="top"><div class="wrap"><a class="mark" href="#top">KDGB<span>.</span></a><nav class="nav" aria-label="Sections"><a href="#work">Work</a><a href="#gallery">Gallery</a><a href="#writing">Writing</a><a href="#about">About</a><a href="#contact">Contact</a></nav></div></header>' +
    '<div class="editbar"><div class="wrap"><span>Owner mode. Changes save instantly and are visible to everyone.</span><span style="display:flex;gap:8px"><button class="btn sm" data-act="edit-profile">Edit profile and contacts</button><button class="btn sm" data-act="logout">Log out</button></span></div></div>' +
    '<main class="wrap" id="top"><div class="hero"><div><span class="label">Portfolio &middot; ' + new Date().getFullYear() + '</span><h1 class="grad-text">' + esc(p.name) + '</h1><p class="tag">' + esc(p.tagline) + "</p>" +
    '<div class="cta"><a class="btn primary" href="#work">See my work</a><a class="btn" href="#contact">Get in touch</a></div><dl class="specs">' +
    specs.map(function (r) { return "<dt>" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd>"; }).join("") + "</dl></div>" +
    '<div class="stage"><figure class="portrait tilt"><div class="frame">' + (p.photo ? '<img src="' + esc(p.photo) + '" alt="Portrait of ' + esc(p.name) + '">' : '<span class="init grad-text">' + esc(initials(p.name)) + "</span>") + '</div><span class="chipf c1">' + esc((p.skills || [])[0] || "Engineer") + '</span><span class="chipf c2">' + esc((p.skills || [])[1] || "Builder") + "</span></figure>" + cube(p.skills) + "</div></div>" +
    '<section class="block reveal" id="work"><div class="sec-head"><h2>Work</h2><span class="label">' + S.projects.length + ' project' + (S.projects.length === 1 ? "" : "s") + '</span><button class="btn sm only-admin" data-act="new-project">+ Add project</button></div>' + renderProjects() + "</section>" +
    '<section class="block reveal" id="gallery"><div class="sec-head"><h2>Gallery</h2><span class="label">' + S.photos.length + ' photo' + (S.photos.length === 1 ? "" : "s") + '</span><button class="btn sm only-admin" data-act="new-photos">+ Add photos</button></div>' + renderGallery() + "</section>" +
    '<section class="block reveal" id="writing"><div class="sec-head"><h2>Writing</h2><span class="label">' + S.posts.length + ' post' + (S.posts.length === 1 ? "" : "s") + '</span><button class="btn sm only-admin" data-act="new-post">+ New post</button></div>' + renderPosts() + "</section>" +
    '<section class="block reveal" id="about"><div class="sec-head"><h2>About</h2><span class="label">Profile</span></div><div class="about"><div>' + (p.about ? "<p>" + esc(p.about) + "</p>" : '<p style="color:var(--muted)">' + (S.admin ? "Add a short bio from Edit profile." : "") + "</p>") +
    '</div><div><div class="label" style="margin-bottom:12px">Skills and tools</div><ul class="skills">' + (p.skills || []).map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ul></div></div></section>" +
    '<section class="block reveal" id="contact"><div class="sec-head"><h2>Contact</h2><span class="label">Say hello</span></div>' + renderContact() + "</section>" +
    '<footer class="mono"><span>&copy; ' + new Date().getFullYear() + " " + esc(p.name) + "</span>" + (S.admin ? "<span></span>" : '<button data-act="login">Owner login</button>') + "</footer></main>";
  seo(); observe();
}

/* ---------- 3D: tilt + reveal ---------- */
var io = ("IntersectionObserver" in window) ? new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }); }, { threshold: .08 }) : null;
function observe() { document.querySelectorAll(".reveal").forEach(function (el) { if (io) io.observe(el); else el.classList.add("in"); }); }
document.addEventListener("pointermove", function (e) {
  if (reduce || e.pointerType === "touch") return;
  var t = e.target.closest && e.target.closest(".tilt");
  document.querySelectorAll(".tilt.on").forEach(function (el) { if (el !== t) { el.classList.remove("on"); el.style.transform = ""; } });
  if (!t) return;
  var r = t.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
  var max = t.classList.contains("portrait") ? 14 : 10;
  t.classList.add("on");
  t.style.transform = "rotateX(" + ((.5 - y) * max).toFixed(2) + "deg) rotateY(" + ((x - .5) * max).toFixed(2) + "deg) translateZ(8px)";
  t.style.setProperty("--mx", (x * 100) + "%"); t.style.setProperty("--my", (y * 100) + "%");
});
document.addEventListener("pointerleave", function () { document.querySelectorAll(".tilt.on").forEach(function (el) { el.classList.remove("on"); el.style.transform = ""; }); });

/* ---------- 3D background scene (canvas, no libraries) ---------- */
(function scene() {
  var c = $("#bg"); if (!c || !c.getContext) return;
  var g = c.getContext("2d"), W, H, DPR, pts = [], N, mx = 0, my = 0, tx = 0, ty = 0, ay = 0, scroll = 0;
  function size() {
    DPR = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight;
    c.width = W * DPR; c.height = H * DPR; g.setTransform(DPR, 0, 0, DPR, 0, 0);
    N = Math.round(Math.min(110, Math.max(40, W * H / 14000)));
    pts = []; for (var i = 0; i < N; i++) pts.push({ x: (Math.random() - .5) * 2200, y: (Math.random() - .5) * 1600, z: (Math.random() - .5) * 2000, h: Math.random() });
  }
  size(); addEventListener("resize", size);
  addEventListener("pointermove", function (e) { tx = (e.clientX / W - .5); ty = (e.clientY / H - .5); });
  addEventListener("scroll", function () { scroll = scrollY; }, { passive: true });
  function frame() {
    mx += (tx - mx) * .05; my += (ty - my) * .05; ay += reduce ? 0 : .0016;
    g.clearRect(0, 0, W, H);
    var ry = ay + mx * .6, rx = my * .4 + scroll * .0003, cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx), f = 700, out = [];
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i], x = p.x * cy - p.z * sy, z = p.x * sy + p.z * cy, y = p.y * cx - z * sx; z = p.y * sx + z * cx + 1100;
      if (z < 50) { out.push(null); continue; }
      var k = f / z; out.push({ x: W / 2 + x * k, y: H / 2 + y * k, k: k, h: p.h });
    }
    g.lineWidth = 1;
    for (var a = 0; a < out.length; a++) {
      var A = out[a]; if (!A) continue;
      for (var b = a + 1; b < out.length; b++) {
        var B = out[b]; if (!B) continue;
        var dx = A.x - B.x, dy = A.y - B.y, d = dx * dx + dy * dy;
        if (d < 14000) { g.strokeStyle = "rgba(" + (A.h > .5 ? "124,92,255" : "34,211,238") + "," + ((1 - d / 14000) * .28 * Math.min(1, A.k * 1.6)).toFixed(3) + ")"; g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); g.stroke(); }
      }
    }
    for (var j = 0; j < out.length; j++) {
      var P = out[j]; if (!P) continue;
      g.fillStyle = P.h > .75 ? "rgba(244,114,182," + Math.min(.9, P.k * 1.2) + ")" : P.h > .4 ? "rgba(167,139,250," + Math.min(.9, P.k * 1.2) + ")" : "rgba(34,211,238," + Math.min(.9, P.k * 1.2) + ")";
      g.beginPath(); g.arc(P.x, P.y, Math.max(.6, P.k * 3.2), 0, 6.283); g.fill();
    }
    if (!reduce) requestAnimationFrame(frame);
  }
  frame();
})();

/* ---------- modal ---------- */
var scrim = $("#scrim"), sheet = $("#sheet"), lbIndex = 0;
function openModal(html) { sheet.innerHTML = html; scrim.hidden = false; scrim.scrollTop = 0; document.documentElement.style.overflow = "hidden"; var f = sheet.querySelector("[autofocus],input[type=text],input[type=password],textarea"); if (f) try { f.focus({ preventScroll: true }); } catch (e) {} }
function closeModal() { if (scrim.hidden) return; scrim.hidden = true; sheet.innerHTML = ""; document.documentElement.style.overflow = ""; }
scrim.addEventListener("mousedown", function (e) { if (e.target === scrim) closeModal(); });
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") closeModal();
  if (!scrim.hidden && sheet.querySelector(".lb")) { if (e.key === "ArrowRight") lbStep(1); if (e.key === "ArrowLeft") lbStep(-1); }
});
function head(title, extra) { return '<div class="sheet-head"><h3>' + esc(title) + "</h3>" + (extra || "") + '<button class="iconbtn" data-act="close" aria-label="Close">&times;</button></div>'; }

function openProject(id) {
  var p = S.projects.filter(function (x) { return x.id === id; })[0]; if (!p) return;
  var meta = [p.year, p.role].filter(Boolean).map(function (m) { return "<span>" + esc(m) + "</span>"; }).join("");
  var links = (p.links || []).map(function (l) { return '<a class="btn sm" href="' + esc(safeUrl(l.url)) + '" target="_blank" rel="noopener">' + esc(l.label) + " &#8599;</a>"; }).join("");
  openModal(head(p.title, S.admin ? '<button class="btn sm ghost" data-act="edit-project" data-id="' + esc(p.id) + '">Edit</button>' : "") + '<div class="sheet-body"><div class="meta"><span class="chip">Case study</span>' + meta + "</div>" +
    (p.cover ? '<img class="cover-big" src="' + esc(p.cover) + '" alt="' + esc(p.title) + '">' : "") +
    (p.summary ? '<p class="prose" style="font-size:18px">' + esc(p.summary) + "</p>" : "") + (p.body ? '<p class="prose">' + esc(p.body) + "</p>" : "") +
    (links ? '<div class="links">' + links + "</div>" : "") + ((p.tags || []).length ? '<div class="tags">' + p.tags.map(function (t) { return "<span>" + esc(t) + "</span>"; }).join("") + "</div>" : "") + "</div>");
}
function openPhoto(i) {
  lbIndex = i; var ph = S.photos[i]; if (!ph) return;
  var nav = S.photos.length > 1 ? '<button class="lb-nav prev" data-act="lb" data-d="-1" aria-label="Previous photo">&#8249;</button><button class="lb-nav next" data-act="lb" data-d="1" aria-label="Next photo">&#8250;</button>' : "";
  openModal(head("Photo " + (i + 1) + " of " + S.photos.length, S.admin ? '<button class="btn sm ghost" data-act="edit-photo" data-id="' + esc(ph.id) + '">Edit caption</button>' : "") +
    '<div class="lb">' + nav + '<img src="' + esc(ph.asset) + '" alt="' + esc(ph.caption || "") + '"><div class="cap"><div>' + esc(ph.caption || "") + '</div><span class="mono" style="color:var(--muted)">' + esc(fmtDate(ph.ts)) + "</span></div></div>");
}
function lbStep(d) { var n = S.photos.length; if (n > 1) openPhoto((lbIndex + d + n) % n); }
function openPost(id) {
  var b = S.posts.filter(function (x) { return x.id === id; })[0]; if (!b) return;
  openModal(head(b.title, S.admin ? '<button class="btn sm ghost" data-act="edit-post" data-id="' + esc(b.id) + '">Edit</button>' : "") +
    '<div class="sheet-body"><div class="meta mono"><span>' + esc(fmtDate(b.ts)) + "</span>" + (b.tag ? "<span>#" + esc(b.tag) + "</span>" : "") + '</div><p class="prose" style="font-size:17px">' + esc(b.body) + "</p></div>");
}

/* ---------- forms ---------- */
function F(id, label, control, hint) { return '<div class="field"><label for="' + id + '">' + label + "</label>" + control + (hint ? "<small>" + hint + "</small>" : "") + "</div>"; }
function T(id, v, ph, type) { return '<input type="' + (type || "text") + '" id="' + id + '" value="' + esc(v || "") + '" placeholder="' + esc(ph || "") + '" autocomplete="off">'; }
function TA(id, v, ph, rows) { return '<textarea id="' + id + '" placeholder="' + esc(ph || "") + '"' + (rows ? ' style="min-height:' + rows * 24 + 'px"' : "") + ">" + esc(v || "") + "</textarea>"; }
function val(id) { var e = $("#" + id); return e ? e.value.trim() : ""; }
function setMsg(t, cls) { var m = $("#f-msg"); if (m) { m.textContent = t || ""; m.className = "msg " + (cls || ""); } }
function busy(on) { sheet.querySelectorAll("button[data-act^='save'],button[data-act='do-delete'],button[data-act='do-login']").forEach(function (b) { b.disabled = on; }); }
function errText(e) { return e && e.message ? e.message : "Something went wrong. Try again."; }
function fail(e) { setMsg(errText(e), "err"); busy(false); if (/log in/i.test(errText(e))) { S.admin = false; } }
function compress(file, max, q) {
  return new Promise(function (res, rej) {
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function () {
      var s = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.width * s)); c.height = Math.max(1, Math.round(img.height * s));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      c.toBlob(function (b) { b ? res(b) : rej(new Error("Could not process that image.")); }, "image/jpeg", q);
    };
    img.onerror = function () { URL.revokeObjectURL(url); rej(new Error("Could not read that image. Use JPG, PNG or WebP.")); };
    img.src = url;
  });
}
function uploadImage(file, max) { return compress(file, max, .86).then(function (b) { return api("POST", "/api/upload", b, { "Content-Type": "image/jpeg" }); }).then(function (r) { return r.url; }); }
function deleteBlock(kind, id, label) {
  return '<div class="actions" id="del-row"><button class="btn danger sm grow" data-act="ask-delete">Delete ' + label + '</button></div><div class="actions" id="del-ask" hidden><span class="msg err grow">Delete this ' + label + ' for good?</span><button class="btn sm ghost" data-act="cancel-delete">Keep it</button><button class="btn danger sm" data-act="do-delete" data-kind="' + kind + '" data-id="' + esc(id) + '">Yes, delete</button></div>';
}
var PATH = { project: "projects", photo: "photos", post: "posts" };

function loginForm() {
  openModal(head("Owner login") + '<div class="sheet-body"><div class="form">' + F("l-pass", "Password", T("l-pass", "", "Owner password", "password"), "Only the site owner can edit. Visitors can browse without logging in.") +
    '<div class="actions"><span class="msg grow" id="f-msg"></span><button class="btn ghost" data-act="close">Cancel</button><button class="btn primary" data-act="do-login">Log in</button></div></div></div>');
  var i = $("#l-pass"); if (i) i.addEventListener("keydown", function (e) { if (e.key === "Enter") doLogin(); });
}
function doLogin() {
  busy(true); setMsg("Checking...", "");
  api("POST", "/api/login", { password: $("#l-pass").value }).then(function () { S.admin = true; closeModal(); render(); }).catch(function (e) { setMsg(errText(e), "err"); busy(false); });
}

function editProfile() {
  var p = S.profile;
  openModal(head("Edit profile and contacts") + '<div class="sheet-body"><div class="form">' +
    '<div class="field"><span class="label">Your photo</span>' + (p.photo ? '<img class="thumb" src="' + esc(p.photo) + '" alt="">' : "") + '<input type="file" id="p-photo" accept="image/*"><small>Shown in the hero and as your gallery avatar. Large photos are resized automatically.</small></div>' +
    '<div class="row2">' + F("p-name", "Full name", T("p-name", p.name)) + F("p-role", "Headline", T("p-role", p.role)) + "</div>" + F("p-tag", "One-line intro", T("p-tag", p.tagline)) +
    '<div class="row2">' + F("p-loc", "Location", T("p-loc", p.location)) + F("p-edu", "Education", T("p-edu", p.education)) + "</div>" +
    F("p-about", "About you", TA("p-about", p.about, "A short bio for interviewers.", 6)) + F("p-skills", "Skills and tools", T("p-skills", (p.skills || []).join(", ")), "Separate with commas. The first six also appear on the rotating cube.") +
    '<div class="row2">' + F("p-email", "Email", T("p-email", p.email, "name@example.com")) + F("p-phone", "Phone", T("p-phone", p.phone, "+63 ...")) + "</div>" +
    F("p-links", "Links", TA("p-links", linksToText(p.links), "GitHub | github.com/yourname\nFacebook | facebook.com/yourname", 4), "One per line as: Label | address") +
    '<div class="actions"><span class="msg grow" id="f-msg"></span><button class="btn ghost" data-act="close">Cancel</button><button class="btn primary" data-act="save-profile">Save profile</button></div></div></div>');
}
function saveProfile() {
  busy(true); setMsg("Saving...", "");
  var file = $("#p-photo").files[0];
  Promise.resolve(file ? (setMsg("Uploading photo...", ""), uploadImage(file, 900)) : null).then(function (url) {
    var body = { name: val("p-name"), role: val("p-role"), tagline: val("p-tag"), location: val("p-loc"), education: val("p-edu"), about: val("p-about"), skills: splitList(val("p-skills")), email: val("p-email"), phone: val("p-phone"), links: parseLinks(val("p-links")) };
    if (url) body.photo = url;
    return api("PUT", "/api/profile", body);
  }).then(function () { closeModal(); return refresh(); }).catch(fail);
}

function editProject(id) {
  var p = id ? S.projects.filter(function (x) { return x.id === id; })[0] : null, d = p || { tags: [], links: [] };
  openModal(head(p ? "Edit project" : "Add project") + '<div class="sheet-body"><div class="form">' +
    '<div class="row2">' + F("f-title", "Title", T("f-title", d.title, "Automatic Voting Machine")) + F("f-year", "Year", T("f-year", d.year, "2026")) + "</div>" +
    F("f-role", "Your role", T("f-role", d.role, "Proponent, hardware and software")) + F("f-summary", "Short summary", TA("f-summary", d.summary, "One or two sentences shown on the card.", 3)) +
    F("f-body", "Full write-up", TA("f-body", d.body, "Problem, approach, components, results, what you learned.", 9)) +
    '<div class="field"><span class="label">Cover image</span>' + (d.cover ? '<img class="thumb" src="' + esc(d.cover) + '" alt="">' : "") + '<input type="file" id="f-cover" accept="image/*"><small>A screenshot or photo of the project. Optional.</small></div>' +
    F("f-tags", "Tags", T("f-tags", (d.tags || []).join(", "), "Raspberry Pi, Python, Tkinter"), "Separate with commas.") +
    F("f-links", "Links", TA("f-links", linksToText(d.links), "GitHub | github.com/you/project\nLive demo | yourapp.example.com", 3), "One per line as: Label | address") +
    '<div class="actions"><span class="msg grow" id="f-msg"></span><button class="btn ghost" data-act="close">Cancel</button><button class="btn primary" data-act="save-project" data-id="' + esc(id || "") + '">' + (p ? "Save changes" : "Add project") + "</button></div>" + (p ? deleteBlock("project", p.id, "project") : "") + "</div></div>");
}
function saveProject(id) {
  var title = val("f-title"); if (!title) { setMsg("Add a title first.", "err"); return; }
  busy(true); setMsg("Saving...", "");
  var file = $("#f-cover").files[0];
  Promise.resolve(file ? (setMsg("Uploading cover...", ""), uploadImage(file, 1400)) : null).then(function (url) {
    var body = { title: title, year: val("f-year"), role: val("f-role"), summary: val("f-summary"), body: val("f-body"), tags: splitList(val("f-tags")), links: parseLinks(val("f-links")) };
    if (url) body.cover = url;
    return id ? api("PUT", "/api/projects/" + id, body) : api("POST", "/api/projects", body);
  }).then(function () { closeModal(); return refresh(); }).catch(fail);
}

function newPhotos() {
  openModal(head("Add photos") + '<div class="sheet-body"><div class="form"><div class="field"><label for="ph-files">Choose photos</label><input type="file" id="ph-files" accept="image/*" multiple><small>Pick several at once. Each is resized for fast loading.</small></div>' +
    F("ph-cap", "Caption (optional)", T("ph-cap", "", "Applies to every photo in this batch"), "You can edit each caption later.") +
    '<div class="actions"><span class="msg grow" id="f-msg"></span><button class="btn ghost" data-act="close">Cancel</button><button class="btn primary" data-act="save-photos">Upload</button></div></div></div>');
}
function savePhotos() {
  var files = Array.prototype.slice.call($("#ph-files").files);
  if (!files.length) { setMsg("Choose at least one photo.", "err"); return; }
  busy(true); var cap = val("ph-cap"), i = 0;
  (function next() {
    if (i >= files.length) { closeModal(); return refresh(); }
    setMsg("Uploading " + (i + 1) + " of " + files.length + "...", "");
    return uploadImage(files[i], 1600).then(function (url) { return api("POST", "/api/photos", { asset: url, caption: cap }); }).then(function () { i++; return next(); });
  })().catch(function (e) { setMsg((i ? i + " uploaded. " : "") + errText(e), "err"); busy(false); if (i) refresh(); });
}
function editPhoto(id) {
  var ph = S.photos.filter(function (x) { return x.id === id; })[0]; if (!ph) return;
  openModal(head("Edit photo") + '<div class="sheet-body"><div class="form"><img class="thumb" src="' + esc(ph.asset) + '" alt="">' + F("ph-cap", "Caption", TA("ph-cap", ph.caption, "", 3)) +
    '<div class="actions"><span class="msg grow" id="f-msg"></span><button class="btn ghost" data-act="close">Cancel</button><button class="btn primary" data-act="save-photo" data-id="' + esc(id) + '">Save caption</button></div>' + deleteBlock("photo", id, "photo") + "</div></div>");
}
function savePhoto(id) { busy(true); api("PUT", "/api/photos/" + id, { caption: val("ph-cap") }).then(function () { closeModal(); return refresh(); }).catch(fail); }

function editPost(id) {
  var b = id ? S.posts.filter(function (x) { return x.id === id; })[0] : null, d = b || {};
  openModal(head(b ? "Edit post" : "New post") + '<div class="sheet-body"><div class="form">' + F("b-title", "Title", T("b-title", d.title, "What I learned building my voting machine")) + F("b-tag", "Topic", T("b-tag", d.tag, "hardware")) +
    F("b-body", "Post", TA("b-body", d.body, "Write your post. Blank lines start new paragraphs.", 12)) +
    '<div class="actions"><span class="msg grow" id="f-msg"></span><button class="btn ghost" data-act="close">Cancel</button><button class="btn primary" data-act="save-post" data-id="' + esc(id || "") + '">' + (b ? "Save changes" : "Publish post") + "</button></div>" + (b ? deleteBlock("post", b.id, "post") : "") + "</div></div>");
}
function savePost(id) {
  var title = val("b-title"), body = val("b-body");
  if (!title || !body) { setMsg("A post needs a title and some text.", "err"); return; }
  busy(true);
  var data = { title: title, tag: val("b-tag"), body: body };
  (id ? api("PUT", "/api/posts/" + id, data) : api("POST", "/api/posts", data)).then(function () { closeModal(); return refresh(); }).catch(fail);
}
function doDelete(kind, id) { busy(true); api("DELETE", "/api/" + PATH[kind] + "/" + id).then(function () { closeModal(); return refresh(); }).catch(fail); }

/* ---------- events ---------- */
document.addEventListener("click", function (e) {
  var t = e.target.closest("[data-act]"); if (!t) return;
  var a = t.dataset.act, id = t.dataset.id;
  switch (a) {
    case "login": loginForm(); break;
    case "do-login": doLogin(); break;
    case "logout": api("POST", "/api/logout").then(function () { S.admin = false; render(); }); break;
    case "edit-profile": editProfile(); break;
    case "new-project": editProject(""); break;
    case "edit-project": editProject(id); break;
    case "open-project": openProject(id); break;
    case "new-photos": newPhotos(); break;
    case "open-photo": openPhoto(+t.dataset.i); break;
    case "edit-photo": editPhoto(id); break;
    case "new-post": editPost(""); break;
    case "open-post": openPost(id); break;
    case "edit-post": editPost(id); break;
    case "close": closeModal(); break;
    case "copy": copyText(t.dataset.v, t); break;
    case "lb": lbStep(+t.dataset.d); break;
    case "save-profile": saveProfile(); break;
    case "save-project": saveProject(id); break;
    case "save-photos": savePhotos(); break;
    case "save-photo": savePhoto(id); break;
    case "save-post": savePost(id); break;
    case "ask-delete": $("#del-row").hidden = true; $("#del-ask").hidden = false; break;
    case "cancel-delete": $("#del-row").hidden = false; $("#del-ask").hidden = true; break;
    case "do-delete": doDelete(t.dataset.kind, id); break;
  }
});

/* ---------- start ---------- */
Promise.all([load(), api("GET", "/api/me").then(function (m) { S.admin = !!m.admin; }).catch(function () {})]).then(render).catch(function () {
  $("#app").insertAdjacentHTML("beforeend", '<p style="text-align:center;color:#a69fcf">Could not load the latest content. Please refresh.</p>');
});
})();
