'use strict';
/* Zero-dependency full-stack server: static site + JSON API + image uploads + owner login. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// tiny .env loader (no packages needed)
try {
  fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n').forEach((l) => {
    const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
} catch (e) { /* no .env file */ }

const PORT = process.env.PORT || 3000;
const PASS = process.env.ADMIN_PASSWORD || '';
const SITE_URL = (process.env.SITE_URL || '').replace(/\/$/, '');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UP_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PUBLIC = path.join(__dirname, 'public');
fs.mkdirSync(UP_DIR, { recursive: true });

const SEED = {
  profile: {
    name: 'Keith Daven G. Bandiola',
    role: 'Computer Engineering student',
    tagline: 'I build full-stack web and desktop apps, and the hardware they run on.',
    location: 'San Jose, Antique, Philippines',
    education: "BS Computer Engineering, St. Anthony's College",
    about: '', skills: ['Python', 'Tkinter', 'Flask', 'Node.js', 'Raspberry Pi', 'MicroPython'],
    email: '', phone: '', links: [], photo: ''
  },
  projects: [], photos: [], posts: []
};
const COLLECTIONS = ['projects', 'photos', 'posts'];
const FILE_FIELDS = ['photo', 'cover', 'asset'];

let db;
try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) { db = JSON.parse(JSON.stringify(SEED)); save(); }
db.profile = Object.assign({}, SEED.profile, db.profile);
COLLECTIONS.forEach((c) => { if (!Array.isArray(db[c])) db[c] = []; });

function save() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}
function dropFile(url) {
  if (typeof url !== 'string' || !url.startsWith('/uploads/')) return;
  const f = path.join(UP_DIR, path.basename(url));
  fs.unlink(f, () => {});
}
const uid = () => Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
const str = (v, max) => String(v == null ? '' : v).slice(0, max);

/* ---------- sessions ---------- */
const sessions = new Map();
const fails = new Map();
function cookies(req) {
  const o = {};
  (req.headers.cookie || '').split(';').forEach((p) => { const i = p.indexOf('='); if (i > 0) o[p.slice(0, i).trim()] = p.slice(i + 1).trim(); });
  return o;
}
function isAdmin(req) {
  const s = cookies(req).sid;
  const exp = s && sessions.get(s);
  if (!exp) return false;
  if (exp < Date.now()) { sessions.delete(s); return false; }
  return true;
}
function safeEq(a, b) {
  const x = crypto.createHash('sha256').update(a).digest();
  const y = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(x, y);
}

/* ---------- helpers ---------- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.woff2': 'font/woff2' };
function send(res, code, body, headers) {
  const h = Object.assign({
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-ancestors 'self'"
  }, headers);
  res.writeHead(code, h); res.end(body);
}
const json = (res, code, obj, h) => send(res, code, JSON.stringify(obj), Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, h));
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on('data', (c) => { n += c.length; if (n > limit) { reject(Object.assign(new Error('Too large'), { code: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function readJson(req) {
  const b = await readBody(req, 512 * 1024);
  try { return JSON.parse(b.toString('utf8') || '{}'); } catch (e) { throw Object.assign(new Error('Bad JSON'), { code: 400 }); }
}
function clean(obj, kind) {
  const o = {};
  const text = (k, m) => { if (k in obj) o[k] = str(obj[k], m); };
  const list = (k) => { if (Array.isArray(obj[k])) o[k] = obj[k].slice(0, 30).map((x) => str(x, 60)); };
  const links = () => { if (Array.isArray(obj.links)) o.links = obj.links.slice(0, 12).map((l) => ({ label: str(l && l.label, 60), url: /^https?:\/\//i.test(l && l.url) ? str(l.url, 300) : '' })).filter((l) => l.url); };
  if (kind === 'profile') {
    ['name', 'role', 'tagline', 'location', 'education', 'email', 'phone'].forEach((k) => text(k, 200));
    text('about', 5000); text('photo', 200); list('skills'); links();
  } else if (kind === 'projects') {
    ['title', 'year', 'role'].forEach((k) => text(k, 200)); text('summary', 600); text('body', 8000); text('cover', 200); list('tags'); links();
  } else if (kind === 'photos') { text('caption', 300); text('asset', 200); }
  else if (kind === 'posts') { text('title', 200); text('tag', 60); text('body', 20000); }
  return o;
}
function dropReplaced(oldObj, newObj) {
  FILE_FIELDS.forEach((f) => { if (oldObj && oldObj[f] && newObj[f] !== undefined && newObj[f] !== oldObj[f]) dropFile(oldObj[f]); });
}

/* ---------- API ---------- */
async function api(req, res, url) {
  const p = url.pathname;
  const m = req.method;
  if (p === '/api/site' && m === 'GET') return json(res, 200, db);
  if (p === '/api/me' && m === 'GET') return json(res, 200, { admin: isAdmin(req) });

  if (m !== 'GET' && req.headers['x-requested-with'] !== 'portfolio') return json(res, 403, { error: 'Blocked request.' });

  if (p === '/api/login' && m === 'POST') {
    const ip = req.socket.remoteAddress || 'x';
    const f = fails.get(ip) || { n: 0, t: Date.now() };
    if (Date.now() - f.t > 15 * 60e3) { f.n = 0; f.t = Date.now(); }
    if (f.n >= 8) return json(res, 429, { error: 'Too many attempts. Try again in 15 minutes.' });
    if (!PASS) return json(res, 503, { error: 'ADMIN_PASSWORD is not set on the server.' });
    const body = await readJson(req);
    if (!safeEq(str(body.password, 200), PASS)) { f.n++; fails.set(ip, f); return json(res, 401, { error: 'Wrong password.' }); }
    fails.delete(ip);
    const sid = crypto.randomBytes(24).toString('hex');
    sessions.set(sid, Date.now() + 7 * 864e5);
    const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
    return json(res, 200, { admin: true }, { 'Set-Cookie': `sid=${sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${7 * 86400}${secure}` });
  }
  if (p === '/api/logout' && m === 'POST') {
    sessions.delete(cookies(req).sid);
    return json(res, 200, { admin: false }, { 'Set-Cookie': 'sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
  }

  // everything below needs the owner
  if (!isAdmin(req)) return json(res, 401, { error: 'Please log in as the owner.' });

  if (p === '/api/upload' && m === 'POST') {
    const type = String(req.headers['content-type'] || '').split(';')[0];
    const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' }[type];
    if (!ext) return json(res, 415, { error: 'Only JPG, PNG, WebP or GIF images.' });
    const buf = await readBody(req, 8 * 1024 * 1024);
    const name = uid() + ext;
    fs.writeFileSync(path.join(UP_DIR, name), buf);
    return json(res, 200, { url: '/uploads/' + name });
  }

  if (p === '/api/profile' && m === 'PUT') {
    const next = clean(await readJson(req), 'profile');
    dropReplaced(db.profile, next);
    db.profile = Object.assign({}, db.profile, next); save();
    return json(res, 200, db.profile);
  }

  const mm = p.match(/^\/api\/(projects|photos|posts)(?:\/([a-z0-9]+))?$/);
  if (mm) {
    const col = mm[1], id = mm[2], arr = db[col];
    if (m === 'POST' && !id) {
      const item = Object.assign({ id: uid(), ts: Date.now() }, clean(await readJson(req), col));
      arr.push(item); save(); return json(res, 201, item);
    }
    const i = arr.findIndex((x) => x.id === id);
    if (i < 0) return json(res, 404, { error: 'Not found.' });
    if (m === 'PUT') {
      const next = clean(await readJson(req), col);
      dropReplaced(arr[i], next);
      arr[i] = Object.assign({}, arr[i], next); save(); return json(res, 200, arr[i]);
    }
    if (m === 'DELETE') { FILE_FIELDS.forEach((f) => dropFile(arr[i][f])); arr.splice(i, 1); save(); return json(res, 200, { ok: true }); }
  }
  return json(res, 404, { error: 'Not found.' });
}

/* ---------- static + SEO files ---------- */
function origin(req) { return SITE_URL || ((req.headers['x-forwarded-proto'] || 'http') + '://' + req.headers.host); }
function serveFile(req, res, file, cache) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain' });
    const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff' });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    let p = decodeURIComponent(url.pathname);
    if (p.startsWith('/api/')) return await api(req, res, url);
    if (p === '/robots.txt') return send(res, 200, `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${origin(req)}/sitemap.xml\n`, { 'Content-Type': 'text/plain' });
    if (p === '/sitemap.xml') {
      return send(res, 200, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin(req)}/</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod><priority>1.0</priority></url></urlset>`, { 'Content-Type': 'application/xml' });
    }
    if (p.startsWith('/uploads/')) {
      const f = path.join(UP_DIR, path.basename(p));
      return serveFile(req, res, f, 'public, max-age=31536000, immutable');
    }
    if (p === '/') p = '/index.html';
    const f = path.normalize(path.join(PUBLIC, p));
    if (!f.startsWith(PUBLIC + path.sep)) return send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain' });
    return serveFile(req, res, f, p.endsWith('.html') ? 'no-cache' : 'public, max-age=300');
  } catch (e) {
    json(res, e.code === 413 || e.code === 400 ? e.code : 500, { error: e.code ? e.message : 'Server error.' });
  }
}).listen(PORT, () => {
  console.log('Portfolio running on http://localhost:' + PORT);
  if (!PASS) console.log('WARNING: ADMIN_PASSWORD is not set, so nobody can log in to edit. Set it in .env or your host settings.');
});
