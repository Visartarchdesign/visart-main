// Admin parol yordamchilari: PBKDF2 xesh, parolni tiklash, urinishlarni cheklash.
// Maxfiy ma'lumotlar alohida `admin_auth` jadvalida saqlanadi (ochiq API'lar uni o'qimaydi).

const enc = new TextEncoder();
let ready = false;

export async function ensureAuthTable(db) {
  if (ready) return;
  await db.prepare('CREATE TABLE IF NOT EXISTS admin_auth (key TEXT PRIMARY KEY, value TEXT)').run();
  ready = true;
}
export async function authGet(db, key) {
  try {
    await ensureAuthTable(db);
    const r = await db.prepare('SELECT value FROM admin_auth WHERE key = ?').bind(key).first();
    return r ? r.value : null;
  } catch (e) { return null; }
}
export async function authSet(db, key, value) {
  await ensureAuthTable(db);
  await db.prepare('INSERT INTO admin_auth (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key, String(value)).run();
}
export async function authDel(db, key) {
  try { await ensureAuthTable(db); await db.prepare('DELETE FROM admin_auth WHERE key = ?').bind(key).run(); } catch (e) {}
}

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const unhex = (s) => new Uint8Array((s.match(/../g) || []).map((h) => parseInt(h, 16)));

async function pbkdf2(secret, saltBytes, iter = 100000) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations: iter }, key, 256);
}
export async function makeHash(secret) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return JSON.stringify({ s: hex(salt), h: hex(await pbkdf2(secret, salt)), i: 100000 });
}
function safeEq(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
export async function checkHash(secret, stored) {
  try {
    const o = JSON.parse(stored);
    return safeEq(hex(await pbkdf2(secret, unhex(o.s), o.i || 100000)), o.h);
  } catch (e) { return false; }
}

// Joriy parol: bazadagi (tiklangan/almashtirilgan) bo'lsa — o'sha, bo'lmasa Cloudflare'dagi ADMIN_PASSWORD.
export async function verifyAdminPassword(env, password) {
  const stored = env.DB ? await authGet(env.DB, 'admin_pw') : null;
  if (stored) return checkHash(password, stored);
  if (!env.ADMIN_PASSWORD) return false;
  return safeEq(String(password), String(env.ADMIN_PASSWORD));
}
export async function sessionEpoch(env) {
  const v = env.DB ? await authGet(env.DB, 'session_epoch') : null;
  return v ? Number(v) || 0 : 0;
}

export function validatePassword(pw, username) {
  if (typeof pw !== 'string' || pw.length < 10) return 'Parol kamida 10 ta belgidan iborat bo\'lsin';
  if (pw.length > 200) return 'Parol juda uzun';
  if (username && pw.toLowerCase() === String(username).toLowerCase()) return 'Parol loginga o\'xshamasin';
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'Parolda harf va raqam bo\'lsin';
  return '';
}

// Urinishlarni cheklash (IP bo'yicha). limit marta xato bo'lsa, lockSec soniya bloklanadi.
export async function rateCheck(db, ip, name, limit, lockSec) {
  const key = `rl:${name}:${ip}`;
  const raw = await authGet(db, key);
  const now = Date.now();
  let o = { n: 0, until: 0 };
  try { if (raw) o = JSON.parse(raw); } catch (e) {}
  if (o.until && o.until > now) return { blocked: true, wait: Math.ceil((o.until - now) / 1000) };
  return { blocked: false, key, o, limit, lockSec };
}
export async function rateFail(db, st) {
  const now = Date.now();
  const n = (st.o.until && st.o.until <= now ? 0 : st.o.n) + 1;
  const o = n >= st.limit ? { n: 0, until: now + st.lockSec * 1000 } : { n, until: 0 };
  await authSet(db, st.key, JSON.stringify(o));
}
export async function rateReset(db, st) { await authDel(db, st.key); }
