const express = require('express');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const SESSION_DAYS = Math.max(1, Number(process.env.SESSION_DAYS) || 7);
const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, 'blog.db'));

db.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL CHECK(length(name) BETWEEN 2 AND 50),
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK(length(title) BETWEEN 3 AND 120),
    excerpt TEXT NOT NULL CHECK(length(excerpt) BETWEEN 10 AND 240),
    content TEXT NOT NULL CHECK(length(content) BETWEEN 20 AND 10000),
    category TEXT NOT NULL CHECK(length(category) BETWEEN 2 AND 30),
    status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('draft', 'published')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK(length(content) BETWEEN 1 AND 1000),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, created_at);
`);

app.use(express.json({ limit: '32kb' }));
app.use(express.static(path.join(__dirname, 'public')));

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map(v => v.trim()).filter(Boolean).map(v => {
    const i = v.indexOf('=');
    return [decodeURIComponent(v.slice(0, i)), decodeURIComponent(v.slice(i + 1))];
  }));
}

function tokenHash(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
function publicUser(user) { return user ? { id: user.id, name: user.name, email: user.email } : null; }
function clean(value) { return typeof value === 'string' ? value.trim() : ''; }

function currentUser(req) {
  const token = parseCookies(req.headers.cookie).session;
  if (!token) return null;
  return db.prepare(`SELECT users.id, users.name, users.email FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > datetime('now')`).get(tokenHash(token)) || null;
}

app.use((req, _res, next) => { req.user = currentUser(req); next(); });

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please sign in to continue.' });
  next();
}

function validatePost(body) {
  const post = {
    title: clean(body.title), excerpt: clean(body.excerpt), content: clean(body.content),
    category: clean(body.category), status: body.status === 'draft' ? 'draft' : 'published'
  };
  if (post.title.length < 3 || post.title.length > 120) return ['Title must be 3–120 characters.'];
  if (post.excerpt.length < 10 || post.excerpt.length > 240) return ['Excerpt must be 10–240 characters.'];
  if (post.content.length < 20 || post.content.length > 10000) return ['Post content must be 20–10,000 characters.'];
  if (post.category.length < 2 || post.category.length > 30) return ['Category must be 2–30 characters.'];
  return [null, post];
}

function setSession(res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000);
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(tokenHash(token), userId, expires.toISOString());
  res.cookie('session', token, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', expires, path: '/' });
}

app.post('/api/auth/register', (req, res) => {
  const name = clean(req.body.name), email = clean(req.body.email).toLowerCase(), password = req.body.password || '';
  if (name.length < 2 || name.length > 50) return res.status(400).json({ error: 'Name must be 2–50 characters.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 8 || password.length > 128) return res.status(400).json({ error: 'Password must be 8–128 characters.' });
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) return res.status(409).json({ error: 'An account with that email already exists.' });
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  const result = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(name, email, `${salt}:${hash}`);
  setSession(res, Number(result.lastInsertRowid));
  res.status(201).json({ user: { id: Number(result.lastInsertRowid), name, email } });
});

app.post('/api/auth/login', (req, res) => {
  const email = clean(req.body.email).toLowerCase(), password = req.body.password || '';
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(401).json({ error: 'Invalid email or password.' });
  const [salt, stored] = user.password_hash.split(':');
  const actual = crypto.scryptSync(password, salt, 64);
  const valid = stored?.length === 128 && crypto.timingSafeEqual(actual, Buffer.from(stored, 'hex'));
  if (!valid) return res.status(401).json({ error: 'Invalid email or password.' });
  setSession(res, user.id);
  res.json({ user: publicUser(user) });
});

app.post('/api/auth/logout', (req, res) => {
  const token = parseCookies(req.headers.cookie).session;
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(token));
  res.clearCookie('session', { path: '/' });
  res.status(204).end();
});

app.get('/api/auth/me', (req, res) => res.json({ user: publicUser(req.user) }));

app.get('/api/posts', (req, res) => {
  const mine = req.query.mine === '1' && req.user;
  const q = clean(req.query.q);
  const category = clean(req.query.category);
  const conditions = [mine ? 'p.user_id = ?' : "p.status = 'published'"];
  const params = [mine ? req.user.id : undefined].filter(v => v !== undefined);
  if (q) { conditions.push('(p.title LIKE ? OR p.excerpt LIKE ? OR p.content LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  if (category && category !== 'All') { conditions.push('p.category = ?'); params.push(category); }
  const posts = db.prepare(`SELECT p.*, u.name AS author,
    (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
    FROM posts p JOIN users u ON u.id = p.user_id WHERE ${conditions.join(' AND ')}
    ORDER BY p.created_at DESC`).all(...params);
  res.json({ posts });
});

app.get('/api/posts/:id', (req, res) => {
  const post = db.prepare(`SELECT p.*, u.name AS author FROM posts p JOIN users u ON u.id = p.user_id WHERE p.id = ?`).get(req.params.id);
  if (!post || (post.status === 'draft' && post.user_id !== req.user?.id)) return res.status(404).json({ error: 'Post not found.' });
  const comments = db.prepare(`SELECT c.id, c.content, c.created_at, c.user_id, u.name AS author
    FROM comments c JOIN users u ON u.id = c.user_id WHERE c.post_id = ? ORDER BY c.created_at`).all(post.id);
  res.json({ post: { ...post, comments } });
});

app.post('/api/posts', requireAuth, (req, res) => {
  const [error, post] = validatePost(req.body);
  if (error) return res.status(400).json({ error });
  const result = db.prepare('INSERT INTO posts (user_id, title, excerpt, content, category, status) VALUES (?, ?, ?, ?, ?, ?)')
    .run(req.user.id, post.title, post.excerpt, post.content, post.category, post.status);
  res.status(201).json({ id: Number(result.lastInsertRowid) });
});

app.put('/api/posts/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Post not found.' });
  if (existing.user_id !== req.user.id) return res.status(403).json({ error: 'You can only edit your own posts.' });
  const [error, post] = validatePost(req.body);
  if (error) return res.status(400).json({ error });
  db.prepare("UPDATE posts SET title=?, excerpt=?, content=?, category=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?")
    .run(post.title, post.excerpt, post.content, post.category, post.status, existing.id);
  res.json({ id: existing.id });
});

app.delete('/api/posts/:id', requireAuth, (req, res) => {
  const post = db.prepare('SELECT user_id FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  if (post.user_id !== req.user.id) return res.status(403).json({ error: 'You can only delete your own posts.' });
  db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

app.post('/api/posts/:id/comments', requireAuth, (req, res) => {
  const content = clean(req.body.content);
  const post = db.prepare("SELECT id FROM posts WHERE id = ? AND status = 'published'").get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Published post not found.' });
  if (!content || content.length > 1000) return res.status(400).json({ error: 'Comment must be 1–1,000 characters.' });
  const result = db.prepare('INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)').run(post.id, req.user.id, content);
  res.status(201).json({ id: Number(result.lastInsertRowid) });
});

app.delete('/api/comments/:id', requireAuth, (req, res) => {
  const comment = db.prepare('SELECT user_id FROM comments WHERE id = ?').get(req.params.id);
  if (!comment) return res.status(404).json({ error: 'Comment not found.' });
  if (comment.user_id !== req.user.id) return res.status(403).json({ error: 'You can only delete your own comments.' });
  db.prepare('DELETE FROM comments WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
app.get('*splat', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: 'Something went wrong.' }); });

if (require.main === module) app.listen(PORT, () => console.log(`Inkspire is running at http://localhost:${PORT}`));
module.exports = { app, db };
