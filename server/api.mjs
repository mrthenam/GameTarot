// Game server: prizes with quantities and win rates, server-side draws, voucher codes, admin API.
// One request handler, mounted by Vite in dev (vite.config.ts) and by server/index.mjs in production.
// Data lives in server/data/tarot.db (SQLite, node:sqlite).
import { DatabaseSync } from 'node:sqlite';
import { createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const RARITIES = ['common', 'rare', 'epic', 'legendary'];
const TIER = { common: 0, rare: 1, epic: 2, legendary: 3 };
const ICONS = ['star', 'hourglass', 'ticket', 'giftbox', 'tea', 'envelope', 'crown', 'cake', 'crystal'];
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DAY_MS = 86400000;
const TOKEN_HOURS = 12;

const DEFAULT_SETTINGS = {
  gameTitle: 'Căn Phòng Tarot',
  subtitle: 'Bốc một lá bài — nhận thông điệp và món quà từ vũ trụ',
  shopName: '',
  turnsPerDay: 3,
  pityEvery: 5,
  voucherDays: 7,
  codePrefix: 'TAROT',
  redeemNote: 'Đưa mã này cho nhân viên khi thanh toán để nhận quà.',
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Local calendar day (server time), e.g. 2026-11-16. */
function dayOf(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function hashPassword(pw, salt = randomBytes(16).toString('hex')) {
  return `${salt}:${scryptSync(pw, salt, 32).toString('hex')}`;
}
function checkPassword(pw, stored) {
  const [salt, hex] = String(stored).split(':');
  if (!salt || !hex) return false;
  const a = Buffer.from(hex, 'hex');
  const b = scryptSync(pw, salt, 32);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * @param {{ dev?: boolean, dataDir?: string, log?: (msg: string) => void }} [opts]
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => Promise<void>}
 */
export function createApi(opts = {}) {
  const dev = !!opts.dev;
  const log = opts.log ?? ((m) => console.log(m));
  // DATA_DIR, or a Railway volume when one is attached, keeps the database across deploys.
  const dataDir = opts.dataDir ?? process.env.DATA_DIR ?? process.env.RAILWAY_VOLUME_MOUNT_PATH ?? path.join(ROOT, 'data');
  mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'tarot.db'));
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS prizes (
      id TEXT PRIMARY KEY, pos INTEGER NOT NULL, name TEXT NOT NULL, desc TEXT NOT NULL DEFAULT '',
      icon TEXT NOT NULL, rarity TEXT NOT NULL, rate REAL NOT NULL DEFAULT 0,
      quantity INTEGER, daily_limit INTEGER, won INTEGER NOT NULL DEFAULT 0,
      voucher INTEGER NOT NULL DEFAULT 1, extra_turns INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1, fallback INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS draws (
      id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, day TEXT NOT NULL, player TEXT,
      prize_id TEXT NOT NULL, prize_name TEXT NOT NULL, rarity TEXT NOT NULL,
      code TEXT UNIQUE, expires INTEGER, redeemed_at INTEGER,
      pity INTEGER NOT NULL DEFAULT 0, test INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS draws_day ON draws(day, prize_id);
    CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, streak INTEGER NOT NULL DEFAULT 0, draws INTEGER NOT NULL DEFAULT 0, last INTEGER);
  `);

  const kvGet = (k) => db.prepare('SELECT v FROM kv WHERE k = ?').get(k)?.v;
  const kvSet = (k, v) => db.prepare('INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').run(k, v);
  const tx = (fn) => {
    db.exec('BEGIN IMMEDIATE');
    try {
      const out = fn();
      db.exec('COMMIT');
      return out;
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  };

  // ---------------------------------------------------------------- first run
  if (!db.prepare('SELECT COUNT(*) AS n FROM prizes').get().n) seedFromConfig();
  if (!kvGet('secret')) kvSet('secret', randomBytes(32).toString('hex'));
  const pwFile = path.join(dataDir, 'admin-password.txt');
  if (!process.env.ADMIN_PASSWORD && !kvGet('admin_hash')) {
    const pw = Array.from({ length: 10 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join('').toLowerCase();
    kvSet('admin_hash', hashPassword(pw));
    writeFileSync(pwFile, `${pw}\n`);
    log(`[tarot] Mật khẩu trang admin: ${pw} (đã lưu ở ${pwFile})`);
  }

  /** Copy shop settings and prizes from public/config.json; weights become % rates. */
  function seedFromConfig() {
    let raw = {};
    try {
      raw = JSON.parse(readFileSync(path.join(ROOT, '..', 'public', 'config.json'), 'utf8'));
    } catch {
      /* no file: defaults */
    }
    const settings = { ...DEFAULT_SETTINGS };
    for (const k of Object.keys(settings)) if (raw[k] !== undefined && typeof raw[k] === typeof settings[k]) settings[k] = raw[k];
    kvSet('settings', JSON.stringify(settings));
    const list = Array.isArray(raw.prizes) && raw.prizes.length ? raw.prizes : [
      { id: 'wish', name: 'Lời chúc may mắn', desc: 'Vũ trụ gửi bạn một ngày tràn đầy năng lượng tích cực!', icon: 'star', rarity: 'common', weight: 1, voucher: false },
    ];
    const total = list.reduce((s, p) => s + (Number(p.weight) > 0 ? Number(p.weight) : 0), 0) || 1;
    let fb = list.findIndex((p) => p.voucher === false && !p.extraTurns);
    if (fb < 0) fb = 0;
    const ins = db.prepare(`INSERT INTO prizes (id, pos, name, desc, icon, rarity, rate, quantity, daily_limit, voucher, extra_turns, active, fallback)
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, 1, ?)`);
    tx(() => list.forEach((p, i) => ins.run(
      String(p.id || `qua${i + 1}`), i, String(p.name || 'Món quà'), String(p.desc || ''),
      ICONS.includes(p.icon) ? p.icon : 'giftbox', RARITIES.includes(p.rarity) ? p.rarity : 'common',
      Math.round(((Number(p.weight) > 0 ? Number(p.weight) : 0) / total) * 10000) / 100,
      p.voucher === false ? 0 : 1, Math.max(0, Math.floor(Number(p.extraTurns) || 0)), i === fb ? 1 : 0,
    )));
    log('[tarot] Đã tạo dữ liệu quà ban đầu từ public/config.json');
  }

  // ---------------------------------------------------------------- reads
  const settings = () => ({ ...DEFAULT_SETTINGS, ...JSON.parse(kvGet('settings') || '{}') });
  const prizeRows = () => db.prepare('SELECT * FROM prizes ORDER BY pos').all();
  const toPrize = (r) => ({
    id: r.id, name: r.name, desc: r.desc, icon: r.icon, rarity: r.rarity, rate: r.rate,
    quantity: r.quantity ?? null, dailyLimit: r.daily_limit ?? null, won: r.won,
    voucher: !!r.voucher, extraTurns: r.extra_turns, active: !!r.active, fallback: !!r.fallback,
  });
  const publicPrize = (p) => ({ id: p.id, name: p.name, desc: p.desc, icon: p.icon, rarity: p.rarity, voucher: p.voucher, extraTurns: p.extraTurns });
  const wonToday = (day) => Object.fromEntries(
    db.prepare('SELECT prize_id AS id, COUNT(*) AS n FROM draws WHERE day = ? AND test = 0 GROUP BY prize_id').all(day).map((r) => [r.id, r.n]),
  );

  // ---------------------------------------------------------------- the draw
  function draw(player, force) {
    return tx(() => {
      const now = Date.now();
      const day = dayOf(now);
      const st = settings();
      const prizes = prizeRows().map(toPrize).filter((p) => p.active);
      const today = wonToday(day);
      const available = (p) => (p.quantity === null || p.won < p.quantity) && (p.dailyLimit === null || (today[p.id] ?? 0) < p.dailyLimit);
      const pl = db.prepare('SELECT * FROM players WHERE id = ?').get(player) ?? { id: player, streak: 0, draws: 0 };
      const pityTriggered = st.pityEvery > 0 && pl.streak >= st.pityEvery;
      const fallback = prizes.find((p) => p.fallback && available(p));
      const weighted = (pool) => {
        const total = pool.reduce((s, p) => s + p.rate, 0);
        if (total <= 0) return pool[randomInt(pool.length)];
        let r = Math.random() * total;
        for (const p of pool) if ((r -= p.rate) < 0) return p;
        return pool[pool.length - 1];
      };

      let prize = null;
      let test = false;
      if (dev && force && RARITIES.includes(force)) {
        // capture/testing only: pick that rarity and leave the stock alone
        const pool = prizes.filter((p) => p.rarity === force);
        if (pool.length) {
          prize = weighted(pool);
          test = true;
        }
      }
      if (!prize && pityTriggered) {
        const pool = prizes.filter((p) => TIER[p.rarity] >= 1 && p.rate > 0 && available(p));
        if (pool.length) prize = weighted(pool);
      }
      if (!prize) {
        // every rate is an absolute chance; an unlucky roll, a sold-out prize or a day's cap → fallback
        let r = Math.random() * 100;
        for (const p of prizes) {
          if ((r -= p.rate) < 0) {
            prize = p;
            break;
          }
        }
        if (!prize || !available(prize)) prize = fallback ?? null;
      }
      if (!prize) {
        const pool = prizes.filter(available);
        if (!pool.length) throw new HttpError(503, 'Kho quà đã hết. Vui lòng báo nhân viên.');
        prize = weighted(pool);
      }

      let code = null;
      if (prize.voucher) {
        const exists = db.prepare('SELECT 1 FROM draws WHERE code = ?');
        do code = `${st.codePrefix}-${Array.from({ length: 6 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join('')}`;
        while (exists.get(code));
      }
      const expires = prize.voucher && st.voucherDays > 0 ? now + st.voucherDays * DAY_MS : null;
      db.prepare(`INSERT INTO draws (at, day, player, prize_id, prize_name, rarity, code, expires, pity, test)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(now, day, player, prize.id, prize.name, prize.rarity, code, expires, pityTriggered ? 1 : 0, test ? 1 : 0);
      if (!test) db.prepare('UPDATE prizes SET won = won + 1 WHERE id = ?').run(prize.id);
      const streak = TIER[prize.rarity] >= 1 ? 0 : pl.streak + 1;
      db.prepare(`INSERT INTO players (id, streak, draws, last) VALUES (?, ?, 1, ?)
        ON CONFLICT(id) DO UPDATE SET streak = excluded.streak, draws = draws + 1, last = excluded.last`).run(player, streak, now);
      return { prize: publicPrize(prize), code, expires, at: now, pityTriggered, streak };
    });
  }

  // ---------------------------------------------------------------- admin
  function makeToken() {
    const exp = Date.now() + TOKEN_HOURS * 3600000;
    const sig = createHmac('sha256', kvGet('secret')).update(String(exp)).digest('base64url');
    return { token: `${exp}.${sig}`, exp };
  }
  function checkToken(req) {
    const m = /^Bearer (\d+)\.([\w-]+)$/.exec(req.headers.authorization ?? '');
    if (!m || Number(m[1]) < Date.now()) throw new HttpError(401, 'Phiên đăng nhập đã hết hạn.');
    const want = createHmac('sha256', kvGet('secret')).update(m[1]).digest();
    const got = Buffer.from(m[2], 'base64url');
    if (got.length !== want.length || !timingSafeEqual(got, want)) throw new HttpError(401, 'Phiên đăng nhập không hợp lệ.');
  }
  function passwordOk(pw) {
    if (typeof pw !== 'string' || !pw) return false;
    if (process.env.ADMIN_PASSWORD) {
      const a = Buffer.from(pw), b = Buffer.from(process.env.ADMIN_PASSWORD);
      return a.length === b.length && timingSafeEqual(a, b);
    }
    return checkPassword(pw, kvGet('admin_hash'));
  }

  function adminState() {
    const day = dayOf(Date.now());
    const today = wonToday(day);
    const one = (sql, ...a) => db.prepare(sql).get(...a).n;
    return {
      settings: settings(),
      prizes: prizeRows().map(toPrize).map((p) => ({ ...p, wonToday: today[p.id] ?? 0 })),
      stats: {
        draws: one('SELECT COUNT(*) AS n FROM draws WHERE test = 0'),
        drawsToday: one('SELECT COUNT(*) AS n FROM draws WHERE test = 0 AND day = ?', day),
        codes: one('SELECT COUNT(*) AS n FROM draws WHERE test = 0 AND code IS NOT NULL'),
        redeemed: one('SELECT COUNT(*) AS n FROM draws WHERE test = 0 AND redeemed_at IS NOT NULL'),
        players: one('SELECT COUNT(*) AS n FROM players'),
      },
      passwordFromEnv: !!process.env.ADMIN_PASSWORD,
    };
  }

  /** Dashboard numbers: daily series for the last `days` days plus totals and wins per prize. */
  function adminStats(days) {
    const now = Date.now();
    const today = dayOf(now);
    const yesterday = dayOf(now - DAY_MS);
    const list = [];
    for (let i = days - 1; i >= 0; i--) list.push(dayOf(now - i * DAY_MS));
    const from = list[0];
    const byDay = new Map(list.map((d) => [d, { day: d, draws: 0, codes: 0, redeemed: 0 }]));
    for (const r of db.prepare(`SELECT day, COUNT(*) AS draws, COUNT(code) AS codes FROM draws
      WHERE test = 0 AND day >= ? GROUP BY day`).all(from)) {
      const d = byDay.get(r.day);
      if (d) Object.assign(d, { draws: r.draws, codes: r.codes });
    }
    const since = new Date(`${from}T00:00:00`).getTime();
    for (const r of db.prepare('SELECT redeemed_at FROM draws WHERE test = 0 AND redeemed_at >= ?').all(since)) {
      const d = byDay.get(dayOf(r.redeemed_at));
      if (d) d.redeemed++;
    }
    const one = (sql, ...a) => db.prepare(sql).get(...a).n;
    const byPrize = db.prepare(`SELECT prize_id AS id, prize_name AS name, rarity, COUNT(*) AS count FROM draws
      WHERE test = 0 AND day >= ? GROUP BY prize_id ORDER BY count DESC`).all(from);
    return {
      days: [...byDay.values()],
      byPrize,
      totals: {
        draws: one('SELECT COUNT(*) AS n FROM draws WHERE test = 0'),
        drawsToday: one('SELECT COUNT(*) AS n FROM draws WHERE test = 0 AND day = ?', today),
        drawsYesterday: one('SELECT COUNT(*) AS n FROM draws WHERE test = 0 AND day = ?', yesterday),
        drawsYesterdaySoFar: one('SELECT COUNT(*) AS n FROM draws WHERE test = 0 AND day = ? AND at <= ?', yesterday, now - DAY_MS),
        codes: one('SELECT COUNT(*) AS n FROM draws WHERE test = 0 AND code IS NOT NULL'),
        codesToday: one('SELECT COUNT(*) AS n FROM draws WHERE test = 0 AND code IS NOT NULL AND day = ?', today),
        redeemed: one('SELECT COUNT(*) AS n FROM draws WHERE test = 0 AND redeemed_at IS NOT NULL'),
        active: one('SELECT COUNT(*) AS n FROM draws WHERE test = 0 AND code IS NOT NULL AND redeemed_at IS NULL AND (expires IS NULL OR expires >= ?)', now),
        expired: one('SELECT COUNT(*) AS n FROM draws WHERE test = 0 AND code IS NOT NULL AND redeemed_at IS NULL AND expires < ?', now),
        players: one('SELECT COUNT(*) AS n FROM players'),
        playersToday: one('SELECT COUNT(DISTINCT player) AS n FROM draws WHERE test = 0 AND day = ?', today),
      },
    };
  }

  /** Codes list with a status filter, search and paging. */
  function listDraws(q, status, limit, offset) {
    const where = ['code IS NOT NULL'];
    const args = [];
    const now = Date.now();
    if (q) {
      where.push('code LIKE ?');
      args.push(`%${q}%`);
    } else where.push('test = 0');
    if (status === 'active') {
      where.push('redeemed_at IS NULL AND (expires IS NULL OR expires >= ?)');
      args.push(now);
    } else if (status === 'redeemed') where.push('redeemed_at IS NOT NULL');
    else if (status === 'expired') {
      where.push('redeemed_at IS NULL AND expires < ?');
      args.push(now);
    }
    const w = where.join(' AND ');
    const total = db.prepare(`SELECT COUNT(*) AS n FROM draws WHERE ${w}`).get(...args).n;
    const rows = db.prepare(`SELECT * FROM draws WHERE ${w} ORDER BY at DESC, id DESC LIMIT ? OFFSET ?`).all(...args, limit, offset);
    return { draws: rows.map(drawRow), total };
  }

  const intOrNull = (v, min) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < min) throw new HttpError(400, `Giá trị "${v}" phải là số nguyên từ ${min} trở lên.`);
    return n;
  };

  function savePrizes(list) {
    if (!Array.isArray(list) || !list.length) throw new HttpError(400, 'Cần ít nhất một món quà.');
    const ids = new Set();
    const clean = list.map((p, i) => {
      const id = String(p.id ?? '').trim();
      const name = String(p.name ?? '').trim();
      if (!/^[a-z0-9_-]{1,32}$/i.test(id)) throw new HttpError(400, `Mã món quà "${id}" chỉ được dùng chữ, số, - và _.`);
      if (ids.has(id)) throw new HttpError(400, `Mã món quà "${id}" bị trùng.`);
      ids.add(id);
      if (!name) throw new HttpError(400, `Món quà thứ ${i + 1} chưa có tên.`);
      const rate = Number(p.rate);
      if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new HttpError(400, `Tỉ lệ của "${name}" phải từ 0 đến 100%.`);
      return {
        id, pos: i, name, desc: String(p.desc ?? '').trim(),
        icon: ICONS.includes(p.icon) ? p.icon : 'giftbox',
        rarity: RARITIES.includes(p.rarity) ? p.rarity : 'common',
        rate: Math.round(rate * 100) / 100,
        quantity: intOrNull(p.quantity, 0), dailyLimit: intOrNull(p.dailyLimit, 1),
        voucher: !!p.voucher, extraTurns: Math.max(0, Math.min(5, Math.floor(Number(p.extraTurns) || 0))),
        active: p.active !== false, fallback: !!p.fallback,
      };
    });
    const active = clean.filter((p) => p.active);
    const sum = active.reduce((s, p) => s + p.rate, 0);
    if (sum > 100.0001) throw new HttpError(400, `Tổng tỉ lệ các quà đang bật là ${sum.toFixed(2)}%, không được vượt 100%.`);
    const fbs = clean.filter((p) => p.fallback);
    if (fbs.length !== 1) throw new HttpError(400, 'Hãy chọn đúng một món làm quà dự phòng.');
    const fb = fbs[0];
    if (!fb.active || fb.quantity !== null || fb.dailyLimit !== null)
      throw new HttpError(400, `Quà dự phòng "${fb.name}" phải đang bật và không giới hạn số lượng.`);
    tx(() => {
      const keep = new Map(prizeRows().map((r) => [r.id, r.won]));
      db.exec('DELETE FROM prizes');
      const ins = db.prepare(`INSERT INTO prizes (id, pos, name, desc, icon, rarity, rate, quantity, daily_limit, won, voucher, extra_turns, active, fallback)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const p of clean) {
        ins.run(p.id, p.pos, p.name, p.desc, p.icon, p.rarity, p.rate, p.quantity, p.dailyLimit, keep.get(p.id) ?? 0,
          p.voucher ? 1 : 0, p.extraTurns, p.active ? 1 : 0, p.fallback ? 1 : 0);
      }
    });
  }

  function saveSettings(s) {
    const cur = settings();
    const next = { ...cur };
    for (const k of ['gameTitle', 'subtitle', 'shopName', 'codePrefix', 'redeemNote']) if (typeof s?.[k] === 'string') next[k] = s[k].trim();
    for (const [k, min, max] of [['turnsPerDay', 1, 99], ['pityEvery', 0, 50], ['voucherDays', 0, 365]]) {
      if (s?.[k] === undefined) continue;
      const n = Number(s[k]);
      if (!Number.isInteger(n) || n < min || n > max) throw new HttpError(400, `"${k}" phải là số nguyên từ ${min} đến ${max}.`);
      next[k] = n;
    }
    if (!next.gameTitle) throw new HttpError(400, 'Tên game không được để trống.');
    if (!/^[A-Z0-9]{2,10}$/.test(next.codePrefix)) throw new HttpError(400, 'Tiền tố mã chỉ gồm 2–10 chữ in hoa hoặc số.');
    kvSet('settings', JSON.stringify(next));
  }

  const drawRow = (r) => ({
    id: r.id, at: r.at, player: r.player, prizeId: r.prize_id, prizeName: r.prize_name, rarity: r.rarity,
    code: r.code, expires: r.expires, redeemedAt: r.redeemed_at, pity: !!r.pity, test: !!r.test,
  });

  // ---------------------------------------------------------------- http
  const hits = new Map();
  function limit(key, max, windowMs) {
    const now = Date.now();
    const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (arr.length >= max) throw new HttpError(429, 'Thao tác quá nhanh, vui lòng thử lại sau ít phút.');
    arr.push(now);
    hits.set(key, arr);
    if (hits.size > 5000) hits.clear();
  }

  async function body(req) {
    let size = 0;
    const chunks = [];
    for await (const c of req) {
      size += c.length;
      if (size > 256 * 1024) throw new HttpError(413, 'Dữ liệu quá lớn.');
      chunks.push(c);
    }
    if (!chunks.length) return {};
    try {
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      throw new HttpError(400, 'Dữ liệu gửi lên không đúng định dạng.');
    }
  }

  function send(res, status, data) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(data));
  }

  return async function handle(req, res) {
    const url = new URL(req.url ?? '/', 'http://x');
    const p = url.pathname.replace(/^.*?\/api\//, '/api/');
    const ip = req.socket.remoteAddress ?? '?';
    try {
      const m = req.method;
      if (m === 'GET' && p === '/api/config') {
        return send(res, 200, { settings: settings(), prizes: prizeRows().map(toPrize).filter((x) => x.active).map(publicPrize) });
      }
      if (m === 'POST' && p === '/api/draw') {
        if (!dev) limit(`draw:${ip}`, 300, 10 * 60000);
        const b = await body(req);
        const player = typeof b.player === 'string' && /^[\w-]{8,64}$/.test(b.player) ? b.player : null;
        if (!player) throw new HttpError(400, 'Thiếu mã người chơi.');
        return send(res, 200, draw(player, b.force));
      }
      if (m === 'POST' && p === '/api/admin/login') {
        limit(`login:${ip}`, 8, 5 * 60000);
        const b = await body(req);
        if (!passwordOk(b.password)) throw new HttpError(401, 'Sai mật khẩu.');
        return send(res, 200, makeToken());
      }
      if (p.startsWith('/api/admin/')) {
        checkToken(req);
        if (m === 'GET' && p === '/api/admin/state') return send(res, 200, adminState());
        if (m === 'PUT' && p === '/api/admin/prizes') {
          savePrizes((await body(req)).prizes);
          return send(res, 200, adminState());
        }
        if (m === 'PUT' && p === '/api/admin/settings') {
          saveSettings((await body(req)).settings);
          return send(res, 200, adminState());
        }
        if (m === 'POST' && p === '/api/admin/reset-won') {
          db.exec('UPDATE prizes SET won = 0');
          return send(res, 200, adminState());
        }
        if (m === 'GET' && p === '/api/admin/draws') {
          const q = (url.searchParams.get('q') ?? '').trim().toUpperCase().replace(/[%_]/g, '');
          const status = url.searchParams.get('status') ?? 'all';
          const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 20));
          const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
          return send(res, 200, listDraws(q, status, limit, offset));
        }
        if (m === 'GET' && p === '/api/admin/stats') {
          const days = Math.min(60, Math.max(7, Number(url.searchParams.get('days')) || 14));
          return send(res, 200, adminStats(days));
        }
        if (m === 'POST' && p === '/api/admin/redeem') {
          const code = String((await body(req)).code ?? '').trim().toUpperCase();
          const row = db.prepare('SELECT * FROM draws WHERE code = ?').get(code);
          if (!row) throw new HttpError(404, `Không tìm thấy mã ${code}.`);
          if (row.redeemed_at) throw new HttpError(409, `Mã ${code} đã được đổi lúc ${new Date(row.redeemed_at).toLocaleString('vi-VN')}.`);
          if (row.expires && row.expires < Date.now()) throw new HttpError(410, `Mã ${code} đã hết hạn.`);
          db.prepare('UPDATE draws SET redeemed_at = ? WHERE id = ?').run(Date.now(), row.id);
          return send(res, 200, { draw: drawRow(db.prepare('SELECT * FROM draws WHERE id = ?').get(row.id)) });
        }
        if (m === 'POST' && p === '/api/admin/password') {
          if (process.env.ADMIN_PASSWORD) throw new HttpError(400, 'Mật khẩu đang đặt bằng biến môi trường ADMIN_PASSWORD.');
          const b = await body(req);
          if (!passwordOk(b.current)) throw new HttpError(401, 'Mật khẩu hiện tại không đúng.');
          if (typeof b.next !== 'string' || b.next.length < 6) throw new HttpError(400, 'Mật khẩu mới cần ít nhất 6 ký tự.');
          kvSet('admin_hash', hashPassword(b.next));
          if (existsSync(pwFile)) rmSync(pwFile);
          return send(res, 200, { ok: true });
        }
      }
      throw new HttpError(404, 'Không có đường dẫn này.');
    } catch (e) {
      if (e instanceof HttpError) return send(res, e.status, { error: e.message });
      log(`[tarot] ${e?.stack || e}`);
      return send(res, 500, { error: 'Máy chủ gặp lỗi.' });
    }
  };
}
