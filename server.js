// POATUBE: servidor (Express + multer). Dados em JSON, vídeos em disco.
const express = require("express"), multer = require("multer"), crypto = require("crypto"), fs = require("fs"), path = require("path");
const PORT = process.env.PORT || 3000, MAXMB = +process.env.MAX_MB || 500;
const DATA = process.env.DATA_DIR || path.join(__dirname, "data"), UP = path.join(DATA, "uploads");
const ADMIN = (process.env.ADMIN_EMAIL || "").toLowerCase();
const CATS = ["Música", "Jogos", "Tecnologia", "Culinária", "Viagens", "Esportes", "Ciência", "Educação", "Outros"];
fs.mkdirSync(UP, { recursive: true });

// ---- banco JSON ----
const DBF = path.join(DATA, "db.json");
let db = { users: [], videos: [], comments: [], likes: [], subs: [], reports: [] };
try { db = { ...db, ...JSON.parse(fs.readFileSync(DBF, "utf8")) }; } catch {}
let timer;
const flush = () => { clearTimeout(timer); fs.writeFileSync(DBF + ".tmp", JSON.stringify(db)); fs.renameSync(DBF + ".tmp", DBF); };
const save = () => { clearTimeout(timer); timer = setTimeout(flush, 300); };
["SIGINT", "SIGTERM"].forEach(s => process.on(s, () => { flush(); process.exit(0); }));
const uid = () => crypto.randomBytes(6).toString("hex");

// ---- sessão assinada em cookie ----
const SF = path.join(DATA, "secret");
const SECRET = process.env.SECRET || (fs.existsSync(SF) ? fs.readFileSync(SF, "utf8") : (() => { const k = crypto.randomBytes(32).toString("hex"); fs.writeFileSync(SF, k, { mode: 0o600 }); return k; })());
const sign = s => crypto.createHmac("sha256", SECRET).update(s).digest("base64url");
const token = id => { const p = Buffer.from(JSON.stringify({ id, exp: Date.now() + 30 * 864e5 })).toString("base64url"); return p + "." + sign(p); };
const who = q => {
  const m = /(?:^|; )tok=([^;]+)/.exec(q.headers.cookie || ""); if (!m) return null;
  const [p, s] = m[1].split("."); if (!p || !s) return null;
  const a = Buffer.from(sign(p)), b = Buffer.from(s); if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { const o = JSON.parse(Buffer.from(p, "base64url")); return o.exp > Date.now() ? db.users.find(u => u.id === o.id) || null : null; } catch { return null; }
};
const setCookie = (s, id) => s.setHeader("Set-Cookie", `tok=${id ? token(id) : ""}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${id ? 2592000 : 0}`);
const need = (q, s, n) => { q.user = who(q); q.user ? n() : s.status(401).json({ error: "Entre na sua conta para continuar." }); };
const admin = u => !!ADMIN && u.email === ADMIN;
const hashPw = (pw, salt = crypto.randomBytes(16).toString("hex")) => salt + ":" + crypto.scryptSync(pw, salt, 32).toString("hex");
const checkPw = (pw, h) => { const [salt, x] = h.split(":"); const a = Buffer.from(hashPw(pw, salt).split(":")[1]), b = Buffer.from(x); return a.length === b.length && crypto.timingSafeEqual(a, b); };
const me = u => ({ id: u.id, name: u.name, admin: admin(u) });

// ---- helpers ----
const find = id => db.videos.find(v => v.id === id);
const uname = id => (db.users.find(u => u.id === id) || { name: "Canal removido" }).name;
const nf = s => s.status(404).json({ error: "Não encontrado." });
const vid = (v, u) => ({
  id: v.id, title: v.title, desc: v.desc, cat: v.cat, dur: v.dur, views: v.views, created: v.created, uid: v.uid, channel: uname(v.uid),
  thumb: v.thumb ? "/files/" + v.thumb : null, url: "/files/" + v.file,
  likes: db.likes.filter(l => l.v === v.id).length, comments: db.comments.filter(c => c.v === v.id).length,
  liked: !!u && db.likes.some(l => l.v === v.id && l.u === u.id), canDownload: !!v.dl, mine: !!u && (u.id === v.uid || admin(u))
});
const cm = (c, u) => ({ id: c.id, name: uname(c.u), text: c.text, t: c.t, mine: !!u && (u.id === c.u || admin(u)) });

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "50kb" }));
app.use((q, s, n) => { s.setHeader("X-Content-Type-Options", "nosniff"); n(); });
app.use("/files", express.static(UP, { index: false, dotfiles: "deny", maxAge: "7d" }));
app.use(express.static(path.join(__dirname, "public")));

// ---- contas ----
app.post("/api/register", (q, s) => {
  const { name, email, password } = q.body || {}, n = String(name || "").trim().slice(0, 40), e = String(email || "").trim().toLowerCase();
  if (n.length < 2 || !/^\S+@\S+\.\S+$/.test(e) || String(password || "").length < 8) return s.status(400).json({ error: "Informe um nome, um e-mail válido e uma senha com 8 ou mais caracteres." });
  if (db.users.some(u => u.email === e)) return s.status(409).json({ error: "Este e-mail já está cadastrado." });
  const u = { id: uid(), name: n, email: e, pw: hashPw(String(password)) };
  db.users.push(u); save(); setCookie(s, u.id); s.status(201).json(me(u));
});
app.post("/api/login", (q, s) => {
  const u = db.users.find(x => x.email === String(q.body?.email || "").trim().toLowerCase());
  if (!u || !checkPw(String(q.body?.password || ""), u.pw)) return s.status(401).json({ error: "E-mail ou senha incorretos." });
  setCookie(s, u.id); s.json(me(u));
});
app.post("/api/logout", (q, s) => { setCookie(s, null); s.json({ ok: true }); });
app.get("/api/me", (q, s) => { const u = who(q); s.json({ user: u ? me(u) : null, maxMB: MAXMB }); });

// ---- vídeos ----
app.get("/api/videos", (q, s) => {
  const u = who(q), { cat, q: t, sort, channel, subs } = q.query; let r = db.videos;
  if (cat && cat !== "Tudo") r = r.filter(v => v.cat === cat);
  if (t) r = r.filter(v => (v.title + " " + uname(v.uid)).toLowerCase().includes(String(t).toLowerCase()));
  if (channel) r = r.filter(v => v.uid === channel);
  if (subs) { if (!u) return s.status(401).json({ error: "Entre para ver suas inscrições." }); const ids = db.subs.filter(x => x.u === u.id).map(x => x.c); r = r.filter(v => ids.includes(v.uid)); }
  r = [...r].sort(sort === "views" ? (a, b) => b.views - a.views : (a, b) => b.created - a.created);
  s.json(r.slice(0, 60).map(v => vid(v, u)));
});
app.get("/api/videos/:id", (q, s) => {
  const u = who(q), v = find(q.params.id); if (!v) return nf(s);
  v.views++; save();
  const sb = db.subs.filter(x => x.c === v.uid);
  s.json({
    ...vid(v, u), subs: sb.length, subbed: !!u && sb.some(x => x.u === u.id),
    comments: db.comments.filter(c => c.v === v.id).sort((a, b) => b.t - a.t).map(c => cm(c, u)),
    related: db.videos.filter(x => x.id !== v.id).sort((a, b) => (b.cat === v.cat) - (a.cat === v.cat) || b.views - a.views).slice(0, 8).map(x => vid(x, u))
  });
});
const EXT = { "video/mp4": ".mp4", "video/webm": ".webm", "video/ogg": ".ogv", "video/quicktime": ".mov", "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
const up = multer({
  storage: multer.diskStorage({ destination: UP, filename: (q, f, cb) => cb(null, uid() + uid() + EXT[f.mimetype]) }),
  limits: { fileSize: MAXMB * 1024 * 1024, files: 2 },
  fileFilter: (q, f, cb) => cb(null, f.fieldname === "video" ? /^video\/(mp4|webm|ogg|quicktime)$/.test(f.mimetype) : f.fieldname === "thumb" && /^image\/(jpeg|png|webp)$/.test(f.mimetype))
}).fields([{ name: "video", maxCount: 1 }, { name: "thumb", maxCount: 1 }]);
app.post("/api/videos", need, (q, s) => up(q, s, err => {
  const F = q.files || {}, V = F.video?.[0], T = F.thumb?.[0], rm = () => [V, T].forEach(f => f && fs.unlink(f.path, () => {}));
  if (err) { rm(); return s.status(400).json({ error: err.code === "LIMIT_FILE_SIZE" ? `O arquivo passa do limite de ${MAXMB} MB.` : "Falha no envio." }); }
  const b = q.body || {}, title = String(b.title || "").trim().slice(0, 100);
  if (!V || !title || b.rights !== "1") { rm(); return s.status(400).json({ error: !V ? "Envie um arquivo MP4, WebM, OGG ou MOV." : !title ? "Informe um título." : "Confirme que você tem os direitos sobre o vídeo." }); }
  const v = { id: uid(), uid: q.user.id, title, desc: String(b.desc || "").slice(0, 2000), cat: CATS.includes(b.cat) ? b.cat : "Outros", dur: Math.max(0, Math.min(86400, +b.dur || 0)), file: V.filename, thumb: T ? T.filename : null, dl: b.dl === "1", views: 0, created: Date.now() };
  db.videos.push(v); save(); s.status(201).json(vid(v, q.user));
}));
app.delete("/api/videos/:id", need, (q, s) => {
  const v = find(q.params.id); if (!v) return nf(s);
  if (v.uid !== q.user.id && !admin(q.user)) return s.status(403).json({ error: "Sem permissão." });
  [v.file, v.thumb].forEach(f => f && fs.unlink(path.join(UP, f), () => {}));
  db.videos = db.videos.filter(x => x !== v); db.comments = db.comments.filter(c => c.v !== v.id); db.likes = db.likes.filter(l => l.v !== v.id);
  save(); s.json({ ok: true });
});
app.get("/api/videos/:id/download", (q, s) => {
  const v = find(q.params.id); if (!v || !v.dl) return nf(s);
  const slug = v.title.replace(/[^\w\- ]+/g, "").trim().slice(0, 60) || "video";
  s.download(path.join(UP, v.file), slug + path.extname(v.file));
});
app.post("/api/videos/:id/like", need, (q, s) => {
  const v = find(q.params.id); if (!v) return nf(s);
  const i = db.likes.findIndex(l => l.v === v.id && l.u === q.user.id);
  i < 0 ? db.likes.push({ v: v.id, u: q.user.id }) : db.likes.splice(i, 1); save();
  s.json({ liked: i < 0, likes: db.likes.filter(l => l.v === v.id).length });
});
app.post("/api/videos/:id/comments", need, (q, s) => {
  const v = find(q.params.id), t = String(q.body?.t || "").trim().slice(0, 500);
  if (!v) return nf(s); if (!t) return s.status(400).json({ error: "Escreva um comentário." });
  const c = { id: uid(), v: v.id, u: q.user.id, text: t, t: Date.now() }; db.comments.push(c); save(); s.status(201).json(cm(c, q.user));
});
app.delete("/api/comments/:id", need, (q, s) => {
  const c = db.comments.find(x => x.id === q.params.id); if (!c) return nf(s);
  if (c.u !== q.user.id && !admin(q.user)) return s.status(403).json({ error: "Sem permissão." });
  db.comments = db.comments.filter(x => x !== c); save(); s.json({ ok: true });
});
app.post("/api/videos/:id/report", need, (q, s) => {
  const v = find(q.params.id); if (!v) return nf(s);
  db.reports.push({ id: uid(), v: v.id, u: q.user.id, reason: String(q.body?.reason || "").slice(0, 500), t: Date.now() }); save(); s.json({ ok: true });
});

// ---- canais ----
app.get("/api/channels/:id", (q, s) => {
  const u = who(q), c = db.users.find(x => x.id === q.params.id); if (!c) return nf(s);
  const sb = db.subs.filter(x => x.c === c.id); s.json({ id: c.id, name: c.name, subs: sb.length, subbed: !!u && sb.some(x => x.u === u.id) });
});
app.post("/api/channels/:id/sub", need, (q, s) => {
  const c = db.users.find(u => u.id === q.params.id); if (!c) return nf(s);
  if (c.id === q.user.id) return s.status(400).json({ error: "Você não pode se inscrever no próprio canal." });
  const i = db.subs.findIndex(x => x.u === q.user.id && x.c === c.id);
  i < 0 ? db.subs.push({ u: q.user.id, c: c.id }) : db.subs.splice(i, 1); save();
  s.json({ subbed: i < 0, subs: db.subs.filter(x => x.c === c.id).length });
});

app.use("/api", (q, s) => nf(s));
app.use((e, q, s, n) => s.status(500).json({ error: "Erro interno." }));
app.listen(PORT, () => console.log(`POATUBE no ar: http://localhost:${PORT}`));
